# Rangkuman Debugging — Integrasi Fingerspot & Setup Laravel

Dokumen ini merangkum seluruh masalah yang ditemukan selama setup project OutsourceHR
(backend Laravel + integrasi mesin fingerprint Fingerspot) di environment Laragon, solusi
yang diterapkan, dan gambaran arsitektur sistem setelah semua perbaikan.

---

## 1. Daftar Masalah & Solusi (Kronologis)

| # | Masalah | Akar Penyebab | Solusi |
|---|---|---|---|
| 1 | Tampilan frontend polos tanpa styling | Tailwind CSS v4 gagal ter-compile di sebagian environment | Downgrade ke Tailwind v3.4 (lebih stabil, konfigurasi klasik) |
| 2 | `php: command not found` di Git Bash | Git Bash biasa tidak otomatis dapat PATH dari Laragon | Pakai **Terminal bawaan Laragon**, atau tambahkan PHP ke PATH manual |
| 3 | `composer install` gagal — security advisory | Composer versi baru block install kalau ada advisory Laravel yang terdeteksi | `composer config audit.block-insecure false` |
| 4 | Error `ilike` di pencarian karyawan | `ilike` adalah operator khusus PostgreSQL, tidak ada di MySQL (default Laragon) | Ganti ke `whereLike()` Laravel — portable ke MySQL/PostgreSQL/SQLite |
| 5 | `CSRF token mismatch` saat login | Middleware `EnsureFrontendRequestsAreStateful` (pola cookie-based SPA) terpasang, padahal frontend pakai Bearer token murni | Hapus middleware itu dari `bootstrap/app.php` — auth cukup lewat `auth:sanctum` per-route |
| 6 | Command `attendance:calculate-summaries` "not defined" | File baru belum di-copy ke project lokal, dan cache config lama masih dipakai | Copy file + `php artisan optimize:clear` |
| 7 | NIK di file Excel Fingerspot ternyata tidak unik | Kolom "NIK" isinya kode grup/batch (banyak karyawan share nilai sama) | Import pakai kolom **PIN mesin** (kolom "ID") sebagai identifier unik, bukan NIK |
| 8 | Sync Fingerspot: `Skip=100%, Masuk=0` | Nama field response API asli (`PIN`, `Date Time`, `Type`) beda dari asumsi awal (`pin`, `scan_date`, `in_out`) | Buat command diagnostik `fingerspot:debug-raw` untuk lihat response asli → sesuaikan parsing di `SyncFingerspotAttendanceJob` |
| 9 | Tanggal sync mundur 1 hari (10 Jul vs 11 Jul asli) | `config/app.php` timezone hardcode `UTC`, tidak baca `.env` | Ubah jadi `env('APP_TIMEZONE', 'Asia/Jakarta')` |
| 10 | Semua record `Unmapped` setelah field mapping benar | Mapping PIN↔karyawan belum pernah dibuat (device dibuat manual via tinker/UI, tapi command import dengan `--device` belum dijalankan) | Jalankan ulang `employees:import-fingerspot ... --device={id}` |
| 11 | Data absensi "kotor" (banyak baris kosong) | Sisa hasil `calculate-summaries` dari sebelum semua fix di atas selesai (status `absent` palsu) | `AttendanceSummary::truncate()`, hitung ulang dari raw log yang sudah bersih |
| 12 | Jam masuk mundur 7 jam (07:55 tampil jadi 00:55) | **Double timezone conversion**: waktu asli WIB dikonversi ke UTC saat simpan, lalu dibaca ulang seolah sudah WIB (karena app timezone sudah Asia/Jakarta) | Hapus konversi `->setTimezone('UTC')` — simpan & baca konsisten pakai Asia/Jakarta saja |
| 13 | Mayoritas karyawan berstatus "Hari Libur" | `company_work_settings` belum pernah diisi untuk perusahaan ini | Buat record `CompanyWorkSetting` via tinker dengan `effective_date` di masa lalu (bukan default bulan depan) |
| 14 | Error enum `overtime_calc_method` | Saya kasih contoh nilai `'per_jam'` (Indonesia), padahal kolom cuma terima `'per_hour'`/`'per_15min'`/`'flat'` (Inggris) | Pakai `'per_hour'` |
| 15 | `calculate-summaries` jalan tapi hasil masih kosong | Kemungkinan race condition — command dispatch ke **queue**, tapi `queue:work` sempat tidak jalan/tidak sempat proses semua job | Cek `jobs`/`failed_jobs` table, pastikan `queue:work` aktif sebelum cek hasil |

---

## 2. Prinsip Desain yang Ditetapkan Selama Debugging

Beberapa keputusan arsitektur yang "mengeras" jadi aturan tetap sistem ini, hasil dari
proses debug di atas:

### Timezone: Satu Zona Waktu Konsisten (Asia/Jakarta)
Sistem ini **sengaja tidak** pakai pola "simpan UTC, tampilkan lokal" yang umum di aplikasi
multi-region. Karena target pengguna cuma Indonesia (WIB), semua lapisan — `config/app.php`,
`now()`, parsing waktu Fingerspot, tampilan di frontend — konsisten pakai **Asia/Jakarta**
dari ujung ke ujung. Ini menyederhanakan banyak hal, tapi artinya **kalau nanti sistem ini
dipakai lintas zona waktu (WITA/WIT atau luar negeri), perlu redesign ulang bagian ini.**

### PIN Mesin, Bukan NIK, Sebagai Identifier Karyawan dari Fingerspot
Data NIK di file export Fingerspot tidak reliable (tidak unik). Semua proses matching
(import karyawan, sync absensi) berpatokan ke **PIN mesin** (`device_employee_mappings`),
bukan NIK. NIK tetap disimpan di database untuk referensi, tapi tidak dipakai untuk logic.

### Semua Proses Berat Lewat Queue (Async)
Sync Fingerspot dan kalkulasi absensi/payroll **tidak** berjalan langsung saat request HTTP
masuk — semua di-dispatch ke queue (`jobs` table) dan diproses terpisah oleh `queue:work`.
Konsekuensinya: **`queue:work` harus selalu aktif** selama development maupun production,
kalau tidak, job cuma menumpuk tanpa diproses.

---

## 3. Arsitektur Sistem Saat Ini

### Alur Data Lengkap: Fingerspot → Dashboard

```
┌─────────────────────┐
│  Mesin Fingerprint   │  (Fingerspot Cloud, per lokasi/kantor)
│  cloud_id + api_key  │
└──────────┬───────────┘
           │ (1) FingerspotService::fetchAttendanceLog()
           │     GET dengan auth MD5(cloud_id+date+timestamp+api_key)
           ▼
┌──────────────────────────────┐
│ SyncFingerspotAttendanceJob   │  (queued, per device per tanggal)
│  - baca field: PIN, Date Time,│
│    Type / Type ID             │
│  - cocokkan PIN → employee_id │
│    lewat device_employee_     │
│    mappings                   │
│  - simpan ke attendance_logs  │
│    (skip kalau sudah ada)     │
└──────────┬────────────────────┘
           │ (2) trigger otomatis per karyawan yang datanya baru masuk
           ▼
┌──────────────────────────────┐
│ CalculateAttendanceSummaryJob │  (queued, per karyawan per tanggal)
│  → AttendanceCalculationService│
│  - ambil expected shift dari  │
│    employee_shifts ATAU       │
│    company_work_settings      │
│  - hitung telat/lembur/jam    │
│    kerja aktual               │
│  - simpan ke                  │
│    attendance_summaries       │
└──────────┬────────────────────┘
           │ (3) dipakai saat proses payroll
           ▼
┌──────────────────────────────┐
│  CalculatePayrollJob          │  (queued, per proses payroll)
│  → PayrollCalculationService  │
│  - agregat attendance_summaries│
│    1 bulan                    │
│  - hitung gross/net per       │
│    komponen gaji + lembur     │
│  - simpan ke payroll_details  │
└────────────────────────────────┘
```

### Jadwal Otomatis (Scheduler — butuh `php artisan schedule:work` aktif)

| Waktu | Command | Fungsi |
|---|---|---|
| Tiap 15 menit | `attendance:sync-devices` | Sync semua device aktif untuk hari ini |
| 01:00 dini hari | `attendance:sync-devices --date=kemarin` | Tangkap shift malam yang baru selesai lewat tengah malam |
| 02:00 dini hari | `attendance:calculate-summaries --all-active` | Jaring pengaman — pastikan SEMUA karyawan aktif ke-cover (termasuk yang device-nya offline → tertandai absent) |

### File-File Kunci (Backend)

```
app/
├── Services/
│   ├── Attendance/
│   │   ├── FingerspotService.php          # Client API Fingerspot (auth, fetch log)
│   │   └── AttendanceCalculationService.php # Raw log → summary (telat/lembur/jam kerja)
│   └── Payroll/
│       └── PayrollCalculationService.php   # Summary → gaji aktual (gross/net)
├── Jobs/
│   ├── SyncFingerspotAttendanceJob.php     # Orchestrator sync 1 device 1 tanggal
│   ├── CalculateAttendanceSummaryJob.php   # Wrapper queue utk 1 karyawan 1 tanggal
│   └── CalculatePayrollJob.php             # Wrapper queue utk 1 proses payroll
├── Console/Commands/
│   ├── SyncAttendanceDevices.php           # Trigger sync semua device (dipanggil scheduler)
│   ├── CalculateAttendanceSummaries.php    # Trigger kalkulasi batch
│   ├── ImportFingerspotEmployees.php       # Import karyawan dari xlsx export
│   └── DebugFingerspotRaw.php              # Diagnostic — dump response API mentah
└── Http/Controllers/Api/
    ├── AttendanceDeviceController.php       # CRUD device, test koneksi, sync manual (dari UI)
    ├── AttendanceController.php             # Check-in/out manual, lihat summary
    └── PayrollController.php                # Proses payroll, aturan kerja, komponen gaji
```

### Tabel Database Terkait (MySQL)

```
attendance_devices          # Kredensial Fingerspot per device (api_key terenkripsi)
device_employee_mappings    # PIN mesin ↔ employee_id (bukan NIK!)
attendance_sync_logs        # Riwayat tiap percobaan sync (fetched/inserted/skipped/unmapped)
attendance_logs             # Raw punch in/out (sumber kebenaran mentah)
attendance_summaries        # Hasil kalkulasi per karyawan per hari
company_work_settings       # Aturan jam kerja per perusahaan (versioned by effective_date)
company_overtime_rates      # Tier multiplier lembur
payrolls / payroll_details  # Hasil akhir perhitungan gaji
```

---

## 4. Status Saat Ini

✅ **Sudah berfungsi (per update terakhir, lihat Bagian 6 untuk detail lengkap):**
- Login (Bearer token, tanpa CSRF issue)
- Import karyawan dari Excel Fingerspot — via CLI **dan** via UI (upload langsung di menu Integrasi Mesin Absensi)
- Sync absensi dari Fingerspot API, termasuk sync range/backdate tanggal
- Timezone konsisten Asia/Jakarta di seluruh sistem
- Kalkulasi absensi: status, jam kerja, lembur (formula: selisih dari jam kerja default, dengan ambang minimal), verifikasi silang ke pengajuan lembur (indikator hijau/kuning)
- Sistem payroll model upah harian lengkap (Upah Per Hari, Kehadiran, Lembur Biasa/Merah, Potongan Absen/Izin Pulang)
- Aturan Kerja: jam kerja per-hari (override khusus, mis. Sabtu 5 jam), Aturan Lembur (tier bisa ditambah/edit/hapus), Komponen Gaji bisa diedit, Hari Kerja Efektif Bulanan
- Bulk delete karyawan + filter departemen, pagination & sorting di semua tabel data besar

⚠️ **Belum dikerjakan / masih manual:**
- Workflow engine generik (approval multi-step) — overtime approve/reject masih langsung, belum lewat `workflow_instances`
- Notification sending (email/SMS aktual) — tabel sudah ada, belum ada job pengirim
- Kalender hari libur nasional belum terhubung ke deteksi "lembur merah" (masih berbasis `work_days` per perusahaan saja)

---

## 5. Pelajaran Penting untuk Development Selanjutnya

1. **Selalu restart `queue:work` setelah edit file Job/Service** — PHP proses lama tetap
   pakai kode lama sampai di-restart, ini penyebab paling sering "kok belum berubah".
2. **`php artisan optimize:clear` setelah edit config atau tambah command baru** — Laravel
   cache config & daftar command, perubahan tidak langsung kebaca.
3. **Command debug (`fingerspot:debug-raw`) jauh lebih cepat daripada tebak-tebak field
   API** — kalau nanti integrasi API pihak ketiga lain bermasalah, bikin command serupa dulu.
4. **`--all-active` di `calculate-summaries` vs mode default** — default cuma proses
   karyawan yang punya log hari itu (ringan), `--all-active` proses semua (perlu buat
   memastikan yang tidak absen pun tercatat "absent", bukan hilang dari laporan).
5. **React: SELALU pakai `key` prop saat render komponen detail yang bergantung pada item
   terpilih** (`<Detail key={selected.id} data={selected} />`). Tanpa ini, React tidak
   me-remount komponen saat pilihan berubah — state lama (form, tab aktif, file upload)
   bisa nyangkut dan menyebabkan bug yang terlihat seperti "salah kirim data" padahal
   akar masalahnya di lifecycle React. Bug ini muncul 2x di project ini (Integrasi Mesin
   Absensi, lalu Detail Perusahaan) dengan gejala berbeda tapi akar sama.
6. **Backend selalu jadi sumber kebenaran, bukan ingatan percakapan** — kalau sandbox kerja
   ter-reset, minta user upload ulang project lokal mereka daripada rekonstruksi dari memori.

---

## 6. Sesi Lanjutan — Multiple Delete, Fix Aturan Kerja, Sorting Absensi, Format Jam

Sesi ini dimulai dari kondisi project yang sudah matang (lihat Bagian 1-5), lalu menambahkan
beberapa fitur & fix penting. **Catatan teknis**: di tengah sesi sebelumnya, sandbox kerja
sempat ter-reset (bukan disengaja) — project berhasil dipulihkan dari upload ulang project
lokal user, dan terverifikasi 100% sehat (lint + build) sebelum lanjut kerja.

### Masalah & Solusi

| # | Masalah | Akar Penyebab | Solusi |
|---|---|---|---|
| 1 | Import karyawan via UI gagal — "File tidak ditemukan" | Laravel 11 terbaru pindah folder default upload ke `storage/app/private/`, kode masih baca dari `storage/app/` | Pakai `Storage::path()`, bukan hardcode `storage_path('app/'.$path)` |
| 2 | Tambah perusahaan baru gagal total | `AuditLog::record()` default `company_id` dari user yang login — untuk coordinator (lintas-perusahaan) nilainya `null`, sementara kolom `company_id` di `audit_logs` `NOT NULL` → crash | Kolom dibuat nullable + 12 titik pemanggilan `AuditLog::record()` diperbaiki kirim `company_id` eksplisit dari entitas terkait, bukan dari user aktor |
| 3 | Jam kerja absensi > 8 jam semua dihitung lembur penuh (bukan cuma kelebihannya) | Karyawan shift malam WIN ITE belum ada `company_work_settings` → masuk jalur "kerja di hari libur" yang menghitung SEMUA jam sebagai lembur | Perlu setup Aturan Kerja per perusahaan (data/config, bukan cuma bug kode) |
| 4 | Ambang verifikasi lembur hardcode >1 jam, padahal user minta berbasis selisih dari jam kerja default | Formula lama: `overtime = actual - expected` tanpa cek ambang minimal | Tambah `overtime_min_minutes` sebagai gate — lembur cuma dihitung kalau selisih ≥ ambang minimal perusahaan |
| 5 | Import salah masuk ke perusahaan lain saat pindah device cepat | **React**: komponen `DeviceDetail` tidak punya `key` prop → tidak di-remount saat ganti device, state lama (file, tab) bisa nyangkut | Tambah `key={selectedDevice.id}`, plus lapisan pengaman: kunci device lain saat upload aktif, konfirmasi eksplisit sebelum submit |
| 6 | Aturan Lembur tidak bisa disimpan | Tombol "Simpan" di `OvertimeRulesView` tidak punya `onClick`/`type="submit"` sama sekali — murni dekoratif, form juga tidak pakai `register()` | Rewrite total: form fungsional + submit ke `updateWorkSettings`, plus CRUD tier lembur (tambah/edit/hapus) yang sebelumnya cuma tampilan statis |
| 7 | Komponen Gaji tidak bisa diedit | Cuma ada tombol hapus, tidak ada update endpoint maupun UI edit | Tambah endpoint `PATCH /payroll/components/{id}` + tombol edit yang buka modal sama dalam mode edit |
| 8 | Load lambat/aneh saat pindah perusahaan di menu Perusahaan | Bug `key` prop yang SAMA seperti #5, kali ini di `CompaniesPage.jsx` dan `WorkSettingsPage.jsx` | Tambah `key={selected.id}` di kedua tempat |
| 9 | Halaman Karyawan cuma tampil 50 dari 225 data (dari sesi sebelumnya) | Sudah diperbaiki sesi lalu, sesi ini ditambah bulk-select + filter departemen | — |
| 10 | Absensi tidak bisa di-sort, tidak ada kolom PIN | Header tabel dibuat statis (bukan sortable) sejak awal pagination server-side dibangun; PIN karyawan tidak pernah di-eager-load | Tambah `sort_by`/`sort_dir` (whitelist kolom) + filter `pin` di backend; kolom PIN dari relasi `employee.deviceMappings` |

### Fitur Baru Ditambahkan

- **Bulk delete karyawan** — checkbox multi-select + endpoint `DELETE /employees/bulk-delete`, plus filter departemen
- **Hari Kerja Efektif Bulanan** — tabel baru `company_effective_work_days`, dikelola di tab Jam Kerja, jadi default otomatis saat proses payroll (masih bisa dioverride manual)
- **Format jam 24 jam** — semua 8 input `type="time"` di aplikasi ditambah `lang="id-ID"` supaya tidak ambigu 12 vs 00

### File yang Berubah Sesi Ini

**Backend:** `EmployeeController.php` (+bulkDestroy, +departments), `AttendanceDeviceController.php` (fix Storage::path), `PayrollController.php` (+updateSalaryComponent, +updateOvertimeRate, +CRUD effective-work-days, wire effective_work_days default), `AttendanceController.php` (+sort, +filter pin/department/status), `AttendanceCalculationService.php` (+ambang minimal lembur), `AuditLog` migration + 5 controller, `routes/api.php`, migration baru `company_effective_work_days` (model sudah ada dari sesi sebelumnya, endpoint baru dibuat)

**Frontend:** `EmployeesPage.jsx` (rewrite: bulk select, filter departemen), `CompanyDetail.jsx` (rewrite total: edit komponen gaji, Aturan Lembur fungsional, Hari Kerja Efektif Bulanan), `CompaniesPage.jsx` + `WorkSettingsPage.jsx` (+key prop), `AttendancePage.jsx` (+sort, +kolom PIN, +filter PIN), `DeviceIntegrationPage.jsx` (dari sesi lalu: +key prop, +konfirmasi import, +sync range), `ShiftsPage.jsx` + `OvertimePage.jsx` (+lang="id-ID"), `realService.js` (+banyak fungsi baru)


---

## 7. Sesi Implementasi Hybrid Duration-Based System

### Bug Fix Sesi Ini

| # | Bug | Akar Penyebab | Fix |
|---|---|---|---|
| 1 | Data karyawan kosong sampai filter departemen dipilih | `getEmployeesPaginated` tidak membuang `department=all` — backend terima literal `WHERE department='all'` → 0 hasil | Tambah `if (params.department === 'all') delete params.department` di baris yang tepat |
| 2 | Lembur kembali ke threshold 30 menit | Default `?? 30` di semua branch `resolveExpectedShift()`, termasuk kasus shift spesifik & tidak ada setting | Ganti semua default ke `?? 60` sesuai spesifikasi Hybrid |

### Implementasi Hybrid Duration-Based

Penulisan ulang total `AttendanceCalculationService` sesuai spesifikasi Hybrid:

**Perubahan utama dari sistem lama:**

1. **Business Date Cut-off (configurable)** — field baru `business_date_cutoff` (default `05:00`) di `company_work_settings`. Scan 00:00–04:59 dihitung hari kerja sebelumnya. Migration: `000016_add_business_date_cutoff_to_work_settings`

2. **Pairing MIN/MAX** (bukan first check_in / first check_out setelah check_in):
   - Scan_Masuk = `MIN(logged_time)` dalam business date window
   - Scan_Pulang = `MAX(logged_time)` dalam business date window
   - Tidak bergantung label `log_type` dari Fingerspot (yang terbukti tidak konsisten)
   - Window dihitung: `$date cutoff` → `$date+1 cutoff - 1 detik`

3. **4 Kondisi Branching:**
   - Kondisi 1 (Undertime): `durasi < target` → potong gaji
   - Kondisi 2 (Normal): `target ≤ durasi < target+threshold` → kelebihan hangus
   - Kondisi 3 (Overtime): `durasi - target ≥ threshold` → hitung lembur + cek SPL
   - Kondisi 4 (Gantung): hanya 1 scan → status `incomplete`, antrian HRD

4. **Verifikasi SPL** — `overtime_verified = true` (hijau) jika ada pengajuan lembur disetujui, `false` (kuning/warning) jika tidak ada

**Migration baru:**
- `000016_add_business_date_cutoff_to_work_settings` — field `business_date_cutoff VARCHAR(5)` default `'05:00'`
- `000018_add_incomplete_status_to_attendance_summaries` — MODIFY COLUMN enum + `'incomplete'`

**Belum diimplementasi (scope berikutnya):**
- Exception Calendar (per-tanggal spesifik: libur nasional, setengah hari, Minggu jadi hari kerja)

---

## 8. Sesi Fix Multi-Issue (Dari Screenshot 20 Jul 2026)

### Masalah & Solusi

| # | Masalah | Akar Penyebab | Fix |
|---|---|---|---|
| 1 | JATAYU: Lembur = Jam Kerja | Tidak ada `company_work_settings` → semua jam = "holiday overtime" | Perlu setup Aturan Kerja per perusahaan (data config, bukan bug kode) |
| 2 | ITE: Lembur kelebihan 1 jam | Target dihitung `shift_end - shift_start - break_minutes` = 7j, tapi actual (MIN/MAX) termasuk break = 8j → selisih 1j lebih besar dari seharusnya | Hapus `break_duration_minutes` dari perhitungan target Hybrid — actual dan target harus konsisten (keduanya termasuk waktu istirahat) |
| 3 | Badge Gantung terlalu agresif | `incomplete` langsung muncul untuk 1 scan, meski karyawan mungkin masih bekerja | Tambah cek waktu: incomplete hanya aktif kalau sudah melewati `expected_end_time + 30 menit` |
| 4 | Sync interval tidak dihormati (selalu 15 menit) | `console.php` hardcode `->everyFifteenMinutes()`, tidak baca `sync_interval_minutes` per device | Buat command baru `attendance:sync-check` yang jalan tiap menit tapi dispatch job per-device hanya kalau interval-nya sudah lewat (pakai Cache sebagai tracker) |
| 5 | Import karyawan hanya di menu Integrasi Mesin | Tidak ada endpoint global import tanpa device binding | Tambah endpoint `POST /employees/import` (importGlobal) + tombol "Import Excel" di halaman Karyawan |
| 6 | Tidak ada nonaktif perusahaan | Belum ada endpoint/UI toggle status | Tambah endpoint `PATCH /companies/{id}/toggle-status` + tombol Power di card perusahaan |
| 7 | Input Struktur Organisasi rumit | Halaman hanya tree view, form tambah kurang intuitif | Redesign: input divisi langsung di atas, tiap divisi punya inline input tambah departemen |
| 8 | Tidak ada delete divisi/departemen | Endpoint belum ada | Tambah `DELETE /divisions/{id}` dan `DELETE /departments/{id}` |

### File Berubah Sesi Ini
- `AttendanceCalculationService.php` — hapus break deduction dari target, Kondisi 4 timing
- `SyncCheckCommand.php` — command baru yang baca interval per-device  
- `console.php` — pakai `attendance:sync-check` tiap menit, bukan hardcode 15 menit
- `AttendanceDeviceController.php` — tambah `importGlobal()`
- `OrganizationController.php` — tambah `toggleCompanyStatus()`, `deleteDivision()`, `deleteDepartment()`
- `routes/api.php` — route baru: toggle-status, delete div/dept, global import
- `realService.js` — fungsi baru: `importEmployeesGlobal`, `toggleCompanyStatus`, `deleteDivision`, `deleteDepartment`
- `EmployeesPage.jsx` — tombol + modal Import Excel
- `CompaniesPage.jsx` — tombol Power (nonaktif/aktifkan), dim card inactive
- `OrganizationPage.jsx` — rewrite total: divisi + departemen langsung inline

---

## 9. Fix Deploy + Redesign Target Menit Per Hari

### Masalah & Solusi

| # | Masalah | Akar Penyebab | Fix |
|---|---|---|---|
| 1 | Tab "Import Karyawan" masih tampil di Integrasi Mesin | Sisa konten `ImportEmployeesTab` (dead code) masih ada dan bercampur dengan `SettingsTab` di file — perubahan sesi kemarin hanya menghapus dari array tab tapi badan fungsinya masih ada | Hapus seluruh fungsi `ImportEmployeesTab` dari file |
| 2 | `effective_date` di masa depan → settings tidak aktif | User membuat settings dengan `effective_date` bulan Agustus → tidak terbaca saat hitung data Juli | Perlu update via tinker (lihat di bawah) |
| 3 | `break_duration_minutes` mempengaruhi hitungan lembur | Sudah difix di sesi sebelumnya (baris hapus dari target), tapi belum ter-deploy | Deploy file baru — tidak ada perubahan kode tambahan |
| 4 | Banyak status "Terlambat" yang tidak akurat | Sistem memakai `work_start_time` global sebagai referensi jam masuk, sehingga karyawan yang datang lebih awal dari jadwal tetap dianggap "tidak tepat waktu" kalau jam globalnya berbeda | Redesign `daily_hours_override` ke format `target_minutes` per hari — jika hari pakai `target_minutes`, tidak ada deteksi terlambat (pure duration mode). Tambah Format B (`start_time`/`end_time`) untuk yang masih perlu deteksi terlambat. |

### Format Baru daily_hours_override
```json
Format A (pure duration, tanpa deteksi terlambat):
{ "1": { "target_minutes": 480 }, "6": { "target_minutes": 300 } }

Format B (dengan referensi waktu, ada deteksi terlambat):
{ "6": { "start_time": "07:00", "end_time": "12:00" } }
```

### Perintah Tinker untuk Fix effective_date
```php
App\Models\CompanyWorkSetting::where('company_id', '<UUID_PERUSAHAAN>')
  ->update(['effective_date' => '2025-01-01']);
```

---

## 10. Laporan & Export

### Fitur Baru

**Backend — `ReportsController`** (`app/Http/Controllers/Api/ReportsController.php`):
- `GET /reports/attendance-summary` — Rekap kehadiran per karyawan (agregat hari hadir/absen/telat/lembur/gantung dalam rentang tanggal)
- `GET /reports/overtime-summary` — Rekap lembur per karyawan per periode (detail per hari, status SPL/warning)
- `GET /reports/payroll/{id}/slips` — Data slip gaji semua karyawan dalam satu payroll
- `GET /reports/payroll/{id}/slip/{empId}` — Slip gaji 1 karyawan

**Frontend — `ReportsPage.jsx`** (redesign total dari placeholder):
- Tab **Rekap Absensi**: filter perusahaan/tanggal/departemen → tabel agregat per karyawan + 4 summary card + export Excel
- Tab **Rekap Lembur**: filter bulan/tahun/departemen → tabel dengan baris expandable (detail per tanggal) + export Excel
- Tab **Slip Gaji**: select periode payroll → daftar karyawan di kiri, preview slip di kanan → tombol Cetak/PDF (print to browser)

**Dependency baru**: `xlsx` (SheetJS) — installed via `npm install xlsx`

### Cara Cetak PDF
Klik "Cetak / PDF" → dialog print browser → pilih "Save as PDF" sebagai printer.
Tidak perlu library PDF di backend. Format slip didesain untuk print A4 dengan CSS print-friendly.

---

## 11. Sync Karyawan via Fingerspot API (Tanpa Excel)

### Fitur Baru

**Alur baru (tanpa Excel):**
```
Fingerspot Cloud API → FingerspotService::fetchEmployees()
    → FingerspotEmployeeSyncService::syncFromDevice()
        → Employee (upsert: PIN = identifier)
        → DeviceEmployeeMapping (PIN → device)
```

**File baru:**
- `app/Services/Attendance/FingerspotService.php` — tambah method `fetchEmployees()` dengan endpoint `/api/download/users/{cloud_id}/json/{auth}/{ts}`
- `app/Services/Employee/FingerspotEmployeeSyncService.php` — normalisasi field multi-alias (PIN/pin/id, name/Name/nama, dll) + upsert logic
- `app/Console/Commands/SyncFingerspotEmployees.php` — CLI: `php artisan employees:sync-fingerspot-api`

**Route baru:** `POST /attendance-devices/{id}/sync-employees-api`

**UI:** Tombol "Sync Karyawan API" di header detail mesin (Integrasi Mesin Absensi)

### ⚠️ Catatan Penting
Endpoint `fetchEmployees()` menggunakan pattern URL dugaan berdasarkan dokumentasi Fingerspot:
`https://api.fingerspot.io/api/download/users/{cloud_id}/json/{auth}/{timestamp}`

Karena belum bisa ditest langsung, kemungkinan nama endpoint atau format parameter berbeda. Kalau tombol "Sync Karyawan API" gagal, jalankan dulu:
```bash
# Debug response mentah dari Fingerspot untuk karyawan
php artisan fingerspot:debug-employees {device_uuid}
```
Lalu sesuaikan URL di `FingerspotService::fetchEmployees()` berdasarkan error/response yang muncul.

### CLI Usage
```bash
# Sync semua device aktif
php artisan employees:sync-fingerspot-api

# Sync 1 device tertentu
php artisan employees:sync-fingerspot-api --device=UUID_DEVICE

# Sync per company
php artisan employees:sync-fingerspot-api --company=UUID_COMPANY
```

---

## 12. Fix Form Karyawan Cascade + Super Admin Lembur

| Masalah | Akar | Fix |
|---|---|---|
| Dropdown Divisi kosong padahal perusahaan sudah dipilih | `onChange` custom menimpa `onChange` milik `register()` react-hook-form → division_id tidak pernah masuk form state; plus konflik controlled `value=` | Pakai opsi `onChange` di dalam `register('division_id', {onChange})`, hapus `value=`, pakai `defaultValue` |
| Departemen bukan dropdown dynamic | Sebelumnya fallback teks bebas dari daftar employee departments | Endpoint `/organizations/companies/{id}/departments?division_id=X` (sudah support filter divisi) + fungsi baru `getOrgDepartments()` |
| Super admin tidak bisa pilih karyawan di form lembur | Select perusahaan TANPA opsi placeholder → browser menampilkan perusahaan pertama tapi form state `company_id` = '' → EmployeeAutocomplete tidak dapat companyId | Tambah `<option value="">-- Pilih Perusahaan --</option>` |
| Role locking lembur | — | HRD & staff_dept: perusahaan terkunci (disabled + auto-set). staff_dept: filter divisi juga disembunyikan di autocomplete (dept sudah terkunci sejak awal) |
| Backend menolak division_id | `store`/`update` tidak memvalidasi field itu → silently dropped | Tambah `division_id => nullable\|uuid\|exists:divisions,id`; `department` & `position` jadi nullable |
