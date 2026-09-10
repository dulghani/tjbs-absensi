# OutsourceHR — Sistem Manajemen SDM Outsourcing

Aplikasi frontend React untuk sistem manajemen HR outsourcing multi-perusahaan. Saat ini berjalan
dengan **mock data layer** (lihat `src/api/mockService.js`) sehingga bisa langsung dicoba tanpa
backend nyata. Ganti layer ini dengan panggilan ke `src/api/index.js` (sudah disiapkan lengkap
untuk REST API Laravel) begitu backend siap.

## Menjalankan Aplikasi

```bash
cd frontend
npm install
npm run dev
```

Buka `http://localhost:5173`. Di halaman login, pilih salah satu role — email & password apapun
akan berhasil masuk (mode demo).

## Struktur Folder

```
src/
├── api/
│   ├── index.js         # Definisi lengkap REST API client (axios) — untuk backend nyata
│   ├── mockData.js       # Data dummy: companies, employees, shifts, overtime, dst.
│   └── mockService.js    # Fungsi simulasi backend (dipakai saat ini oleh semua halaman)
├── components/
│   ├── ui/                # Button, Modal, Table, Toast, Badge, Primitives (Input/Select/dst)
│   └── layout/             # Sidebar, Topbar, AppLayout, ProtectedRoute
├── lib/
│   ├── utils.js            # Formatter tanggal/uang/durasi, status & role label/warna
│   └── menuConfig.js       # Konfigurasi menu sidebar per role
├── stores/
│   ├── authStore.js        # Zustand — user, token, company, permission check
│   └── appStore.js         # Zustand — UI state (sidebar, notifikasi)
├── pages/
│   ├── auth/                LoginPage (role-based demo login)
│   ├── dashboard/            DashboardPage, ReportsPage
│   ├── org/                  CompaniesPage, CompanyDetail (tabs), OrganizationPage (tree)
│   ├── employees/             EmployeesPage (CRUD + filter)
│   ├── shifts/                 ShiftsPage
│   ├── attendance/             AttendancePage
│   ├── overtime/                OvertimePage (multi-item request form)
│   ├── payroll/                  PayrollPage
│   ├── documents/                 DocumentsPage
│   ├── settings/                   WorkSettingsPage, AuditPage
│   └── users/                      UsersPage (+ Permission Matrix)
└── App.jsx                # Routing utama
```

## Role & Hak Akses (Demo)

| Role | Deskripsi | Menu Utama |
|---|---|---|
| Koordinator Outsourcing | Akses penuh semua perusahaan | Semua menu + Settings, Audit Log |
| Petugas Lapangan | Kelola beberapa perusahaan yang ditangani | Karyawan, Absensi, Lembur, User |
| Staff HRD | Kelola satu perusahaan | Karyawan, Konfirmasi Lembur, Dokumen |
| Staff Departemen | Ajukan lembur untuk tim | Pengajuan Lembur, Absensi Tim |

## Fitur Utama yang Sudah Diimplementasikan

1. Login berbasis role dengan tampilan & menu yang menyesuaikan otomatis
2. Manajemen Perusahaan — CRUD + tab detail (jam kerja, aturan lembur, komponen gaji)
3. Struktur Organisasi — tree view Company -> Division -> Department -> Section -> Line
4. Data Karyawan — CRUD lengkap dengan filter perusahaan/departemen/status
5. Shift & Kalender — kelola shift kerja per perusahaan (pagi/sore/malam)
6. Absensi — tabel log kehadiran dengan status & durasi kerja/lembur
7. Pengajuan Lembur Multi-Item — form dengan tombol "+ Tambah Karyawan" untuk memasukkan
   banyak karyawan sekaligus dalam satu nomor lembur (menggunakan useFieldArray dari
   react-hook-form), lengkap dengan approval per-item oleh HRD
8. Penggajian — proses payroll per perusahaan/periode, status draft -> processing -> finalized
9. Dokumen — kelola kebijakan/kontrak dengan tracking acknowledgment karyawan
10. Notifikasi — dropdown notifikasi real-time di topbar dengan mark-as-read
11. Manajemen User & Permission Matrix — toggle permission granular per role
12. Audit Log — riwayat lengkap seluruh transaksi (siapa, kapan, aksi apa)

## Menghubungkan ke Backend Nyata

1. Set `VITE_API_URL` di file `.env` mengarah ke API Laravel Anda
2. Di setiap halaman, ganti import dari `../../api/mockService` menjadi fungsi yang sesuai
   dari `../../api/index.js` (nama fungsi sengaja dibuat mirip agar migrasi mudah)
3. Hapus `src/api/mockData.js` dan `src/api/mockService.js` setelah migrasi selesai

## Tech Stack

- React 19 + Vite
- React Router v6 (routing)
- Zustand (state management, dengan persist untuk auth)
- TanStack React Query (siap dipakai untuk data fetching dari backend nyata)
- React Hook Form (form + validasi, termasuk useFieldArray untuk multi-item lembur)
- Tailwind CSS v4
- Lucide React (icons)
- date-fns (format tanggal, locale Indonesia)

## Langkah Selanjutnya

- [ ] Setup backend Laravel sesuai dokumentasi modul (schema sudah didefinisikan sebelumnya)
- [ ] Ganti mock service dengan API client nyata
- [ ] Tambahkan halaman detail karyawan (riwayat assignment, dokumen pribadi)
- [ ] Tambahkan kalender visual untuk shift & hari libur
- [ ] Tambahkan grafik di dashboard (recharts sudah terpasang)
- [ ] Implementasi upload file untuk dokumen
