# OutsourceHR — Backend (Laravel 11)

Backend API untuk sistem HR outsourcing multi-perusahaan. Dibangun dari skeleton resmi
Laravel 11, berisi ~45 tabel database sesuai 7 modul inti yang sudah dirancang (Master
Organisasi, Shift Management, Attendance Engine, Workflow Engine, Document Management,
Notification & Approval Center, Audit Log) + integrasi mesin fingerprint Fingerspot.

## Prasyarat

| Tool | Versi | Cek |
|---|---|---|
| PHP | ^8.2 | `php --version` |
| Composer | ^2.0 | `composer --version` |
| PostgreSQL | ^15 (atau MySQL 8+) | `psql --version` |
| Ekstensi PHP | pdo_pgsql, mbstring, xml, curl, zip, gd, bcmath | biasanya sudah ikut default installer |

## Setup Langkah demi Langkah

### 1. Install dependencies
```bash
cd backend
composer install
```

### 2. Konfigurasi environment
```bash
cp .env.example .env
php artisan key:generate
```
Edit `.env`, sesuaikan `DB_*` dengan kredensial PostgreSQL Anda. Kalau ingin coba cepat
tanpa install PostgreSQL, ganti jadi SQLite:
```env
DB_CONNECTION=sqlite
```
```bash
touch database/database.sqlite
```

### 3. Jalankan migration (buat seluruh ~45 tabel)
```bash
php artisan migrate
```

### 4. Seed user awal
```bash
php artisan db:seed
```
Ini membuat akun login pertama: **admin@outsourcehr.local / password** (role: coordinator).
**Segera ganti password setelah login pertama.**

### 5. Jalankan server
```bash
php artisan serve
```
API akan aktif di `http://localhost:8000/api/v1` — eh, sebenarnya di `http://localhost:8000/api`
(prefix `/v1` di dokumentasi sebelumnya hanya konvensi penamaan endpoint di frontend;
`routes/api.php` di backend ini otomatis kena prefix `/api` oleh Laravel).

**Untuk menyamakan dengan `VITE_API_URL` di frontend**, set di `frontend/.env`:
```
VITE_API_URL=http://localhost:8000/api
```

### 6. Jalankan queue worker (WAJIB untuk sync Fingerspot & notifikasi)
Job seperti `SyncFingerspotAttendanceJob` berjalan async lewat queue. Buka terminal terpisah:
```bash
php artisan queue:work
```

### 7. Jalankan scheduler (untuk sync otomatis tiap 15 menit)
Di production, daftarkan cron job yang memanggil scheduler Laravel tiap menit:
```bash
* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1
```
Untuk development, bisa jalankan manual:
```bash
php artisan schedule:work
```

---

## Import Data Karyawan dari Fingerspot

File `datakaryawan.xlsx` yang Anda upload sudah disalin ke `storage/app/imports/`.
Command ini akan **otomatis membuat/mencocokkan** karyawan dan (opsional) memetakan PIN mesin.

### ⚠️ Catatan Data Quality
Kolom `NIK` di file tersebut **tidak unik** — banyak karyawan berbeda memakai nilai NIK yang
sama (mis. "191" dipakai 10+ orang). Command import ini memakai kolom `ID` (PIN mesin,
selalu unik) sebagai kunci pencocokan, bukan NIK. Field `nik` tetap disimpan di database
untuk referensi, tapi jangan dijadikan identifier unik di logika bisnis lain.

### Langkah 1 — Cek/buat perusahaan dulu (opsional)
Kalau perusahaan "WIN JATAYU" (nama di kolom Kantor) belum ada di database, command akan
membuatnya otomatis. Kalau sudah punya company_id tertentu, pakai `--company=`.

### Langkah 2 — Daftarkan device Fingerspot dulu (supaya PIN langsung terpetakan)
Bisa lewat UI (menu **Integrasi Mesin Absensi**) atau lewat tinker:
```bash
php artisan tinker
>>> $device = App\Models\AttendanceDevice::create([
...     'company_id' => 'uuid-perusahaan-anda',
...     'name' => 'Mesin Absen WIN JATAYU',
...     'cloud_id' => 'C2636CF4DB102128',
...     'api_key' => 'B6OVA7F8GORAGVTL',
... ]);
>>> echo $device->id;
```

### Langkah 3 — Jalankan import
```bash
php artisan employees:import-fingerspot imports/datakaryawan.xlsx --device={device_id_dari_langkah_2}
```

Atau tanpa mapping PIN dulu (bisa dipetakan manual belakangan lewat UI):
```bash
php artisan employees:import-fingerspot imports/datakaryawan.xlsx
```

Command akan menampilkan ringkasan: berapa karyawan dibuat, diperbarui, dan berapa PIN
berhasil dipetakan ke device.

### Menjalankan ulang (idempotent)
Command ini aman dijalankan berkali-kali — karyawan yang sudah ada (dicocokkan via PIN)
akan di-update, bukan diduplikasi.

---

## Struktur Modul

```
app/
├── Models/                 45 model Eloquent (1 per tabel)
├── Http/Controllers/Api/   Controller REST API per modul
├── Jobs/                   SyncFingerspotAttendanceJob (queued)
├── Services/Attendance/    FingerspotService (client API)
├── Console/Commands/       SyncAttendanceDevices, ImportFingerspotEmployees
└── Exceptions/             FingerspotException

database/migrations/        12 file, ~45 tabel, urut sesuai dependency antar modul
routes/api.php               Semua endpoint REST, grouped per modul
routes/console.php           Jadwal scheduler (sync Fingerspot tiap 15 menit)
```

## Testing Endpoint (contoh dengan curl)

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@outsourcehr.local","password":"password"}'

# Simpan token dari response, lalu:
curl http://localhost:8000/api/employees \
  -H "Authorization: Bearer {token}"
```

## Menghubungkan ke Frontend

Frontend saat ini masih pakai **mock service** (`frontend/src/api/mockService.js`) supaya
bisa dicoba tanpa backend. Untuk pindah ke backend asli:

1. Set `VITE_API_URL=http://localhost:8000/api` di `frontend/.env`
2. Di setiap halaman React, ganti import dari `../../api/mockService` ke `../../api/index.js`
   (fungsi-fungsinya sengaja dibuat dengan pola serupa untuk memudahkan migrasi)
3. Sesuaikan auth flow: `frontend/src/pages/auth/LoginPage.jsx` saat ini pakai `mockLogin()`,
   ganti ke `authApi.login()` dari `api/index.js`

## Catatan Implementasi Lanjutan (belum dibuat, prioritas berikutnya)

- [ ] `CalculatePayrollJob` — perhitungan gross/net aktual per karyawan (kerangkanya sudah
      ada di `PayrollController::process()`, tinggal diisi logic dari `attendance_summaries`
      + `company_work_settings` + `company_salary_components`)
- [ ] `AttendanceCalculationJob` — job end-of-day yang mengubah `attendance_logs` (raw)
      jadi `attendance_summaries` (hasil hitung), dijadwalkan tiap malam
- [ ] Workflow engine generik — saat ini `OvertimeController` approve/reject langsung,
      belum lewat `workflow_instances`. Tabel sudah siap, tinggal wiring service-nya
- [ ] Notification sending — `notifications` table siap, belum ada job pengirim
      email/SMS aktual (`NotificationDeliveryLog` sudah didesain untuk ini)
- [ ] Role & Permission granular — saat ini pakai kolom `role` sederhana di `users`.
      Untuk permission per-fitur yang lebih detail, pertimbangkan integrasi
      `spatie/laravel-permission`
