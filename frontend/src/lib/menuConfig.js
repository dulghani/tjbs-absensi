import {
  LayoutDashboard, Building2, Users, Clock, Coins, BarChart3,
  Settings2, UserCog, FileText, Bell, ShieldCheck, CalendarClock, CalendarX2, Network, Fingerprint, Palette,
} from 'lucide-react'

export const MENU_CONFIG = {
  coordinator: [
    { group: 'Dashboard', items: [{ id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, path: '/dashboard' }] },
    { group: 'Data Master', items: [
      { id: 'companies', label: 'Perusahaan', icon: Building2, path: '/companies' },
      { id: 'org', label: 'Struktur Organisasi', icon: Network, path: '/organization' },
      { id: 'employees', label: 'Karyawan', icon: Users, path: '/employees' },
    ]},
    { group: 'Operasional', items: [
      { id: 'shifts', label: 'Shift & Kalender', icon: CalendarClock, path: '/shifts' },
      { id: 'attendance', label: 'Absensi', icon: Clock, path: '/attendance' },
      { id: 'device_integration', label: 'Integrasi Mesin Absensi', icon: Fingerprint, path: '/device-integration' },
      { id: 'overtime', label: 'Data Lembur', icon: Clock, path: '/overtime' },
      { id: 'leave', label: 'Izin Karyawan', icon: CalendarClock, path: '/leave' },
      { id: 'payroll', label: 'Penggajian', icon: Coins, path: '/payroll' },
      { id: 'manual_deductions', label: 'Potongan Manual', icon: Coins, path: '/manual-deductions' },
    ]},
    { group: 'Dokumen & Laporan', items: [
      { id: 'documents', label: 'Dokumen', icon: FileText, path: '/documents' },
      { id: 'reports', label: 'Laporan', icon: BarChart3, path: '/reports' },
    ]},
    { group: 'Pengaturan', items: [
      { id: 'work_settings', label: 'Aturan Kerja', icon: Settings2, path: '/work-settings' },
      { id: 'work_exceptions', label: 'Kalender Pengecualian', icon: CalendarX2, path: '/work-exceptions' },
      { id: 'users', label: 'Manajemen User', icon: UserCog, path: '/users' },
      { id: 'app_settings', label: 'Pengaturan Aplikasi', icon: Palette, path: '/app-settings' },
      { id: 'audit', label: 'Audit Log', icon: ShieldCheck, path: '/audit' },
    ]},
  ],
  field_officer: [
    { group: 'Dashboard', items: [{ id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, path: '/dashboard' }] },
    { group: 'Data', items: [
      { id: 'employees', label: 'Karyawan', icon: Users, path: '/employees' },
      { id: 'attendance', label: 'Absensi', icon: Clock, path: '/attendance' },
      { id: 'device_integration', label: 'Integrasi Mesin Absensi', icon: Fingerprint, path: '/device-integration' },
      { id: 'overtime', label: 'Data Lembur', icon: Clock, path: '/overtime' },
      { id: 'leave', label: 'Izin Karyawan', icon: CalendarClock, path: '/leave' },
    ]},
    { group: 'Pengaturan', items: [{ id: 'users', label: 'Kelola User', icon: UserCog, path: '/users' }] },
  ],
  hrd: [
    { group: 'Dashboard', items: [{ id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, path: '/dashboard' }] },
    { group: 'Data', items: [
      { id: 'employees', label: 'Karyawan', icon: Users, path: '/employees' },
      { id: 'attendance', label: 'Absensi', icon: Clock, path: '/attendance' },
      { id: 'overtime', label: 'Konfirmasi Lembur', icon: Clock, path: '/overtime' },
      { id: 'leave', label: 'Izin Karyawan', icon: CalendarClock, path: '/leave' },
      { id: 'documents', label: 'Dokumen', icon: FileText, path: '/documents' },
    ]},
    { group: 'Pengaturan', items: [{ id: 'users', label: 'Kelola User', icon: UserCog, path: '/users' }] },
  ],
  staff_dept: [
    { group: 'Dashboard', items: [{ id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, path: '/dashboard' }] },
    { group: 'Operasional', items: [
      { id: 'overtime', label: 'Pengajuan Lembur', icon: Clock, path: '/overtime' },
      { id: 'attendance', label: 'Absensi Tim', icon: Clock, path: '/attendance' },
      { id: 'leave', label: 'Izin Karyawan', icon: CalendarClock, path: '/leave' },
    ]},
  ],
}
