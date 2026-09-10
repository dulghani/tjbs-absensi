# Panduan Setup Lengkap — OutsourceHR (dari Nol)

Panduan ini asumsi: Laragon sudah terinstall di `D:\project\laragon`, project ada di
`D:\project\laragon\www\hr-os\{backend,frontend}`, dan semua file terbaru (hasil seluruh
perbaikan sebelumnya) sudah di-copy ke lokasi tersebut.

Jalankan tiap bagian **berurutan**. Setiap bagian yang butuh proses tetap jalan (server,
queue, scheduler) perlu **terminal terpisah yang dibiarkan terbuka**.

---

## 0. Prasyarat

Buka **Terminal Laragon** (klik kanan tray icon → Terminal — bukan Git Bash biasa, supaya
PATH PHP/Composer otomatis benar).

```bash
php --version      # harus 8.2+
composer --version
mysql --version
node --version
npm --version
```

---

## 1. Database — Mulai Bersih

Hapus database lama kalau ada sisa data testing, buat baru:

```bash
mysql -u root -e "DROP DATABASE IF EXISTS outsourcehr; CREATE DATABASE outsourcehr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## 2. Backend — Install & Konfigurasi

```bash
cd /d/project/laragon/www/hr-os/backend
composer install
```

Kalau muncul error security advisory:
```bash
composer config audit.block-insecure false
composer install
```

Setup environment:
```bash
copy .env.example .env
php artisan key:generate
```

Cek isi `.env`, pastikan bagian ini benar:
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=outsourcehr
DB_USERNAME=root
DB_PASSWORD=

APP_TIMEZONE=Asia/Jakarta
```

Migrasi database (bikin ~48 tabel) + seed user awal:
```bash
php artisan migrate:fresh
php artisan db:seed
```

Ini bikin akun login: **admin@outsourcehr.local / password**

Bersihkan cache supaya semua config/command baru kebaca:
```bash
php artisan optimize:clear
```

### Jalankan Backend (3 terminal terpisah, biarkan semua terbuka)

**Terminal 1 — Web server:**
```bash
cd /d/project/laragon/www/hr-os/backend
php artisan serve
```

**Terminal 2 — Queue worker (WAJIB, tanpa ini sync & kalkulasi tidak jalan):**
```bash
cd /d/project/laragon/www/hr-os/backend
php artisan queue:work
```

**Terminal 3 — Scheduler (untuk sync otomatis tiap 15 menit):**
```bash
cd /d/project/laragon/www/hr-os/backend
php artisan schedule:work
```

---

## 3. Frontend — Install & Jalankan

**Terminal 4:**
```bash
cd /d/project/laragon/www/hr-os/frontend
npm install
echo VITE_API_URL=http://localhost:8000/api > .env
npm run dev
```

Buka `http://localhost:5173`, login pakai **admin@outsourcehr.local / password**. Pastikan
masuk ke Dashboard tanpa error CSRF/network.

---

## 4. Import Data Karyawan dari Excel Fingerspot

Pastikan file `datakaryawan.xlsx` ada di `backend/storage/app/imports/`.

**Terminal baru** (server/queue/scheduler biarkan tetap jalan di terminal masing-masing):
```bash
cd /d/project/laragon/www/hr-os/backend
php artisan employees:import-fingerspot imports/datakaryawan.xlsx
```

Ini otomatis membuat perusahaan "WIN JATAYU" (dari kolom Kantor di Excel) + 82 karyawan.
Catatan: kolom **NIK** di file ini tidak unik, sistem pakai **PIN mesin** (kolom ID) sebagai
identifier, bukan NIK.

---

## 5. Daftarkan Mesin Fingerspot & Petakan PIN

```bash
php artisan tinker
```
```php
$company = App\Models\Company::where('name', 'WIN JATAYU')->first();

$device = App\Models\AttendanceDevice::create([
    'company_id' => $company->id,
    'name' => 'Mesin Absen WIN JATAYU',
    'cloud_id' => 'C2636CF4DB102128',
    'api_key' => 'B6OVA7F8GORAGVTL',
]);

echo $device->id;
```

**Catat UUID yang muncul**, lalu keluar:
```php
exit
```

Import ulang, sekarang dengan `--device` supaya PIN ikut dipetakan (aman dijalankan ulang,
tidak duplikat):
```bash
php artisan employees:import-fingerspot imports/datakaryawan.xlsx --device=UUID_DARI_ATAS
```

Harus muncul: `Dipetakan ke PIN: 82`

---

## 6. Setup Aturan Kerja (Wajib, Sebelum Kalkulasi Absensi)

Tanpa ini, semua karyawan akan tertandai "Hari Libur" alih-alih "Hadir"/"Absen". Form UI
"Aturan Kerja" saat ini defaultnya berlaku bulan depan, jadi untuk **setup awal** pakai
tinker supaya langsung berlaku:

```bash
php artisan tinker
```
```php
$company = App\Models\Company::where('name', 'WIN JATAYU')->first();

App\Models\CompanyWorkSetting::create([
    'company_id' => $company->id,
    'work_start_time' => '07:00',
    'work_end_time' => '16:00',
    'break_duration_minutes' => 60,
    'work_days' => [1, 1, 1, 1, 1, 1, 0],   // Senin-Sabtu kerja, Minggu libur — SESUAIKAN
    'overtime_min_minutes' => 30,
    'overtime_calc_method' => 'per_hour',    // HARUS Inggris: per_hour | per_15min | flat
    'late_tolerance_minutes' => 15,
    'effective_date' => '2025-01-01',        // masa lalu, supaya langsung berlaku
]);
exit
```

---

## 7. Sync Data Absensi dari Fingerspot

```bash
php artisan attendance:sync-devices --date=2026-07-11
```

Job masuk ke queue — **pastikan Terminal 2 (`queue:work`) benar-benar memprosesnya**
(perhatikan output-nya, harus ada baris "Processing..." lalu "Processed").

### Verifikasi Sebelum Lanjut

```bash
php artisan tinker
```
```php
App\Models\AttendanceLog::count();          // harus mendekati jumlah check-in/out hari itu
App\Models\AttendanceSyncLog::latest('started_at')->first();  // cek records_inserted > 0
exit
```

Kalau `Masuk`/`records_inserted` masih 0, cek dulu nama field response API — kadang beda
per tipe mesin:
```bash
php artisan fingerspot:debug-raw UUID_DEVICE_ANDA
```

---

## 8. Hitung Summary Absensi

```bash
php artisan attendance:calculate-summaries --date=2026-07-11 --all-active
```

Tunggu sampai `queue:work` selesai memproses (82 job, satu per karyawan). Cek progres:
```bash
php artisan tinker
```
```php
DB::table('jobs')->count();  // harus turun ke 0 kalau sudah selesai semua
DB::table('failed_jobs')->count();  // harus 0, kalau > 0 cek detail errornya
exit
```

---

## 9. Verifikasi Hasil Akhir di Dashboard

Buka `http://localhost:5173` → menu **Absensi**. Harus terlihat:
- Jam masuk/keluar sesuai waktu asli (WIB, bukan mundur/maju)
- Status **Hadir** untuk yang check-in, **Absen** untuk yang tidak (bukan "Hari Libur"
  kecuali memang hari Minggu)

Menu **Integrasi Mesin Absensi** → tab **Riwayat Sync**: `Masuk` harus > 0, `Unmapped` = 0.

---

## Ringkasan Urutan (Copy-Paste Cepat)

```bash
# === Database ===
mysql -u root -e "DROP DATABASE IF EXISTS outsourcehr; CREATE DATABASE outsourcehr CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# === Backend setup ===
cd /d/project/laragon/www/hr-os/backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate:fresh
php artisan db:seed
php artisan optimize:clear

# === Jalankan (3 terminal terpisah) ===
php artisan serve          # Terminal 1
php artisan queue:work     # Terminal 2
php artisan schedule:work  # Terminal 3

# === Frontend (terminal 4) ===
cd /d/project/laragon/www/hr-os/frontend
npm install
echo VITE_API_URL=http://localhost:8000/api > .env
npm run dev

# === Import & Sync (terminal baru) ===
cd /d/project/laragon/www/hr-os/backend
php artisan employees:import-fingerspot imports/datakaryawan.xlsx
# → buat device via tinker, catat UUID-nya (lihat Bagian 5)
php artisan employees:import-fingerspot imports/datakaryawan.xlsx --device=UUID
# → buat company_work_settings via tinker (lihat Bagian 6)
php artisan attendance:sync-devices --date=2026-07-11
php artisan attendance:calculate-summaries --date=2026-07-11 --all-active
```

---

## Troubleshooting Cepat

| Gejala | Cek |
|---|---|
| CSRF token mismatch | `grep EnsureFrontendRequestsAreStateful bootstrap/app.php` harus TIDAK ketemu |
| Command "not defined" | `php artisan optimize:clear`, pastikan file ada di `app/Console/Commands/` |
| Sync Skip semua | `php artisan fingerspot:debug-raw {device_id}` untuk cek field API asli |
| Jam mundur 7 jam | Cek `config/app.php` timezone = `Asia/Jakarta`, cek tidak ada `->setTimezone('UTC')` di `SyncFingerspotAttendanceJob.php` |
| Semua "Hari Libur" | `company_work_settings` belum ada untuk company tsb (Bagian 6) |
| Kalkulasi tidak jalan | `queue:work` tidak aktif — cek `DB::table('jobs')->count()` |
