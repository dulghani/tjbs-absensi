// Mock data layer — simulasi backend untuk development/demo.
// Struktur mengikuti schema yang didefinisikan di dokumentasi modul.
import { generateOTNumber } from '../lib/utils'

let idSeq = 1000
export const uid = (prefix = 'id') => `${prefix}-${idSeq++}`

// ── Companies ─────────────────────────────────────────────────────────────────
export const companies = [
  { id: 'co-1', code: 'PT-MAJU', name: 'PT Maju Jaya', npwp: '01.234.567.8-001.000', address: 'Jl. Industri No. 12', city: 'Surabaya', phone: '031-1234567', email: 'hr@ptmaju.co', pic_name: 'Dewi Lestari', pic_phone: '0812-3456789', status: 'active', employees: 48 },
  { id: 'co-2', code: 'PT-GLOB', name: 'PT Global Indo', npwp: '02.345.678.9-002.000', address: 'Jl. Raya Darmo No. 5', city: 'Surabaya', phone: '031-2345678', email: 'hr@globalindo.co', pic_name: 'Sari Indah', pic_phone: '0813-4567890', status: 'active', employees: 32 },
  { id: 'co-3', code: 'PT-BRK', name: 'PT Berkah Mandiri', npwp: '03.456.789.0-003.000', address: 'Jl. Margomulyo No. 8', city: 'Gresik', phone: '031-3456789', email: 'hr@berkahmandiri.co', pic_name: 'Hendra Wijaya', pic_phone: '0814-5678901', status: 'active', employees: 15 },
]

// ── Org hierarchy ─────────────────────────────────────────────────────────────
export const divisions = [
  { id: 'div-1', company_id: 'co-1', code: 'DIV-PROD', name: 'Divisi Produksi', status: 'active' },
  { id: 'div-2', company_id: 'co-1', code: 'DIV-ADM', name: 'Divisi Admin', status: 'active' },
  { id: 'div-3', company_id: 'co-2', code: 'DIV-OPS', name: 'Divisi Operasional', status: 'active' },
]

export const departments = [
  { id: 'dept-1', company_id: 'co-1', division_id: 'div-1', code: 'DEPT-PRODA', name: 'Produksi A', manager_id: 'emp-1', status: 'active' },
  { id: 'dept-2', company_id: 'co-1', division_id: 'div-1', code: 'DEPT-QC', name: 'Quality Control', manager_id: 'emp-5', status: 'active' },
  { id: 'dept-3', company_id: 'co-1', division_id: 'div-2', code: 'DEPT-HRD', name: 'HRD', manager_id: null, status: 'active' },
  { id: 'dept-4', company_id: 'co-1', division_id: 'div-1', code: 'DEPT-GDG', name: 'Gudang', manager_id: 'emp-2', status: 'active' },
  { id: 'dept-5', company_id: 'co-2', division_id: 'div-3', code: 'DEPT-PKG', name: 'Packaging', manager_id: 'emp-4', status: 'active' },
  { id: 'dept-6', company_id: 'co-2', division_id: 'div-3', code: 'DEPT-QC2', name: 'Quality Control', manager_id: 'emp-6', status: 'active' },
  { id: 'dept-7', company_id: 'co-3', division_id: null, code: 'DEPT-PROD3', name: 'Produksi', manager_id: null, status: 'active' },
]

export const sections = [
  { id: 'sec-1', department_id: 'dept-1', company_id: 'co-1', code: 'SEC-L12', name: 'Line 1-2', status: 'active' },
  { id: 'sec-2', department_id: 'dept-1', company_id: 'co-1', code: 'SEC-PACK', name: 'Packing', status: 'active' },
  { id: 'sec-3', department_id: 'dept-2', company_id: 'co-1', code: 'SEC-QC', name: 'QC Section', status: 'active' },
]

export const productionLines = [
  { id: 'line-1', section_id: 'sec-1', department_id: 'dept-1', company_id: 'co-1', code: 'LINE-1', name: 'Line 1', capacity: 20, status: 'active' },
  { id: 'line-2', section_id: 'sec-1', department_id: 'dept-1', company_id: 'co-1', code: 'LINE-2', name: 'Line 2', capacity: 20, status: 'active' },
  { id: 'line-3', section_id: 'sec-2', department_id: 'dept-1', company_id: 'co-1', code: 'LINE-PACK', name: 'Line Packing', capacity: 15, status: 'active' },
]

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = [
  { id: 'u-1', name: 'Budi Santoso', email: 'budi@outsource.co', phone: '0811-1111111', roles: ['coordinator'], company_id: null, department: null, status: 'active', permissions: ['*'] },
  { id: 'u-2', name: 'Rina Wahyu', email: 'rina@outsource.co', phone: '0811-2222222', roles: ['field_officer'], company_id: 'co-1', department: null, status: 'active', permissions: ['employee.view','employee.create','employee.edit','overtime.view_all','user_management.dept'] },
  { id: 'u-3', name: 'Dewi Lestari', email: 'dewi@ptmaju.co', phone: '0811-3333333', roles: ['hrd'], company_id: 'co-1', department: null, status: 'active', permissions: ['employee.view','employee.create','employee.edit','overtime.approve','overtime.view_all','user_management.dept'] },
  { id: 'u-4', name: 'Eko Prasetyo', email: 'eko@ptmaju.co', phone: '0811-4444444', roles: ['staff_dept'], company_id: 'co-1', department: 'Produksi A', status: 'active', permissions: ['overtime.create_own','overtime.view_own'] },
  { id: 'u-5', name: 'Sari Indah', email: 'sari@globalindo.co', phone: '0811-5555555', roles: ['hrd'], company_id: 'co-2', department: null, status: 'active', permissions: ['employee.view','employee.create','employee.edit','overtime.approve','overtime.view_all'] },
]

// ── Employees ─────────────────────────────────────────────────────────────────
export const employees = [
  { id: 'emp-1', nik: '2025001', name: 'Ahmad Rizki', company_id: 'co-1', department: 'Produksi A', line: 'Line 1', position: 'Operator Mesin', status: 'active', joinDate: '2023-01-15', phone: '0821-1111111', ktp: '3578011501900001', address: 'Jl. Kenjeran No. 10, Surabaya', employmentStatus: 'permanent' },
  { id: 'emp-2', nik: '2025002', name: 'Siti Aminah', company_id: 'co-1', department: 'Gudang', line: '-', position: 'Admin Gudang', status: 'active', joinDate: '2022-06-01', phone: '0821-2222222', ktp: '3578012201880002', address: 'Jl. Rungkut No. 5, Surabaya', employmentStatus: 'permanent' },
  { id: 'emp-3', nik: '2025003', name: 'Doni Firmansyah', company_id: 'co-1', department: 'Produksi A', line: 'Line 2', position: 'Teknisi', status: 'active', joinDate: '2023-03-10', phone: '0821-3333333', ktp: '3578011003920003', address: 'Jl. Wonokromo No. 22, Surabaya', employmentStatus: 'contract' },
  { id: 'emp-4', nik: '2025004', name: 'Maya Putri', company_id: 'co-2', department: 'Packaging', line: '-', position: 'Operator', status: 'active', joinDate: '2022-12-01', phone: '0821-4444444', ktp: '3578011212910004', address: 'Jl. Darmo No. 8, Surabaya', employmentStatus: 'permanent' },
  { id: 'emp-5', nik: '2025005', name: 'Rudi Hartono', company_id: 'co-1', department: 'Quality Control', line: '-', position: 'QC Manager', status: 'active', joinDate: '2021-05-20', phone: '0821-5555555', ktp: '3578012005890005', address: 'Jl. Mulyosari No. 15, Surabaya', employmentStatus: 'permanent' },
  { id: 'emp-6', nik: '2025006', name: 'Andi Saputra', company_id: 'co-3', department: 'Produksi', line: '-', position: 'Operator', status: 'inactive', joinDate: '2021-08-15', phone: '0821-6666666', ktp: '3578011508870006', address: 'Jl. Gresik Kota No. 3, Gresik', employmentStatus: 'permanent' },
  { id: 'emp-7', nik: '2025007', name: 'Wulan Sari', company_id: 'co-1', department: 'Produksi A', line: 'Line 1', position: 'Operator Mesin', status: 'active', joinDate: '2024-02-01', phone: '0821-7777777', ktp: '3578014102950007', address: 'Jl. Kertajaya No. 18, Surabaya', employmentStatus: 'probation' },
  { id: 'emp-8', nik: '2025008', name: 'Bayu Anggara', company_id: 'co-2', department: 'Quality Control', line: '-', position: 'QC Staff', status: 'active', joinDate: '2023-07-15', phone: '0821-8888888', ktp: '3578011507930008', address: 'Jl. Ngagel No. 9, Surabaya', employmentStatus: 'permanent' },
]

// ── Shifts ────────────────────────────────────────────────────────────────────
export const shifts = [
  { id: 'sh-1', company_id: 'co-1', code: 'SHIFT-PAGI', name: 'Pagi Kerja', start_time: '07:00', end_time: '16:00', break_duration_minutes: 60, total_work_minutes: 480, is_night_shift: false, color_code: '#22c55e', status: 'active' },
  { id: 'sh-2', company_id: 'co-1', code: 'SHIFT-SORE', name: 'Sore Kerja', start_time: '16:00', end_time: '01:00', break_duration_minutes: 60, total_work_minutes: 480, is_night_shift: true, color_code: '#f59e0b', status: 'active' },
  { id: 'sh-3', company_id: 'co-1', code: 'SHIFT-MALAM', name: 'Malam Kerja', start_time: '01:00', end_time: '07:00', break_duration_minutes: 30, total_work_minutes: 330, is_night_shift: true, color_code: '#6366f1', status: 'active' },
  { id: 'sh-4', company_id: 'co-2', code: 'SHIFT-REG', name: 'Regular', start_time: '08:00', end_time: '17:00', break_duration_minutes: 60, total_work_minutes: 480, is_night_shift: false, color_code: '#22c55e', status: 'active' },
]

// ── Work settings per company ─────────────────────────────────────────────────
export const workSettings = {
  'co-1': { workStart: '07:00', workEnd: '16:00', breakMin: 60, workDays: [1,1,1,1,1,1,0], lateTolerance: 15, otMinMin: 30, otMethod: 'per_jam', tiers: [
    { dayType: 'weekday', from: 1, to: 2, multiplier: 1.5 },
    { dayType: 'weekday', from: 3, to: null, multiplier: 2.0 },
    { dayType: 'weekend', from: 1, to: null, multiplier: 2.0 },
    { dayType: 'holiday', from: 1, to: null, multiplier: 3.0 },
  ]},
  'co-2': { workStart: '08:00', workEnd: '17:00', breakMin: 60, workDays: [1,1,1,1,1,0,0], lateTolerance: 10, otMinMin: 30, otMethod: 'per_15_menit', tiers: [
    { dayType: 'weekday', from: 1, to: 1, multiplier: 1.5 },
    { dayType: 'weekday', from: 2, to: null, multiplier: 2.0 },
    { dayType: 'weekend', from: 1, to: null, multiplier: 2.0 },
    { dayType: 'holiday', from: 1, to: null, multiplier: 3.0 },
  ]},
  'co-3': { workStart: '07:30', workEnd: '16:30', breakMin: 30, workDays: [1,1,1,1,1,1,0], lateTolerance: 15, otMinMin: 60, otMethod: 'per_jam', tiers: [
    { dayType: 'weekday', from: 1, to: null, multiplier: 1.5 },
    { dayType: 'weekend', from: 1, to: null, multiplier: 2.0 },
    { dayType: 'holiday', from: 1, to: null, multiplier: 2.0 },
  ]},
}

export const salaryComponents = [
  { id: 'sc-1', company_id: 'co-1', name: 'Gaji Pokok', type: 'earning', calc: 'fixed', value: 2500000, taxable: true, order: 1 },
  { id: 'sc-2', company_id: 'co-1', name: 'Tunjangan Transport', type: 'earning', calc: 'fixed', value: 300000, taxable: false, order: 2 },
  { id: 'sc-3', company_id: 'co-1', name: 'Tunjangan Makan', type: 'earning', calc: 'per_hari', value: 15000, taxable: false, order: 3 },
  { id: 'sc-4', company_id: 'co-1', name: 'BPJS Kesehatan', type: 'deduction', calc: 'percentage', value: 1, taxable: false, order: 4 },
  { id: 'sc-5', company_id: 'co-1', name: 'BPJS Ketenagakerjaan', type: 'deduction', calc: 'percentage', value: 2, taxable: false, order: 5 },
  { id: 'sc-6', company_id: 'co-2', name: 'Gaji Pokok', type: 'earning', calc: 'fixed', value: 2800000, taxable: true, order: 1 },
  { id: 'sc-7', company_id: 'co-2', name: 'Tunjangan Transport', type: 'earning', calc: 'fixed', value: 350000, taxable: false, order: 2 },
]

// ── Attendance ────────────────────────────────────────────────────────────────
function genAttendance() {
  const records = []
  const today = new Date()
  for (const emp of employees.filter(e => e.status === 'active')) {
    for (let i = 0; i < 14; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      const day = d.getDay()
      if (day === 0) continue
      const dateStr = d.toISOString().slice(0, 10)
      const rand = Math.random()
      let status = 'present', lateMin = 0, otMin = 0
      if (rand < 0.05) status = 'absent'
      else if (rand < 0.15) { status = 'late'; lateMin = Math.floor(Math.random() * 45) + 5 }
      else if (rand < 0.20) status = 'on_leave'
      if (status === 'present' && Math.random() < 0.3) otMin = Math.floor(Math.random() * 180) + 30
      records.push({
        id: uid('att'), employee_id: emp.id, date: dateStr, status,
        checkIn: status === 'absent' || status === 'on_leave' ? null : `0${6 + (lateMin > 30 ? 1 : 0)}:${String(lateMin % 60).padStart(2,'0')}`,
        checkOut: status === 'absent' || status === 'on_leave' ? null : '16:05',
        lateMinutes: lateMin, overtimeMinutes: otMin, workMinutes: status === 'present' || status === 'late' ? 480 - lateMin : 0,
      })
    }
  }
  return records
}
export const attendanceRecords = genAttendance()

// ── Attendance Devices (integrasi mesin fingerprint) ───────────────────────────
export const attendanceDevices = [
  { id: 'dev-1', company_id: 'co-1', line_id: 'line-1', brand: 'fingerspot', name: 'Mesin Absen Gerbang Utama', cloud_id: 'C2636CF4DB102128', api_key: 'B6OVA7F8GORAGVTL', location: 'Lobby depan', timezone: 'Asia/Jakarta', sync_mode: 'scheduled', sync_interval_minutes: 15, last_synced_at: '2025-07-10T08:15:00Z', last_sync_status: 'success', last_sync_error: null, status: 'active' },
  { id: 'dev-2', company_id: 'co-1', line_id: 'line-3', brand: 'fingerspot', name: 'Mesin Absen Gudang', cloud_id: 'C2636CF4DB102129', api_key: 'B6OVA7F8GORAGVTM', location: 'Pintu gudang', timezone: 'Asia/Jakarta', sync_mode: 'scheduled', sync_interval_minutes: 15, last_synced_at: '2025-07-10T08:00:00Z', last_sync_status: 'partial', last_sync_error: null, status: 'active' },
  { id: 'dev-3', company_id: 'co-2', line_id: null, brand: 'fingerspot', name: 'Mesin Absen PT Global Indo', cloud_id: 'C2636CF4DB102199', api_key: 'B6OVA7F8GORAGVTX', location: 'Lobby', timezone: 'Asia/Jakarta', sync_mode: 'manual', sync_interval_minutes: 15, last_synced_at: null, last_sync_status: 'never', last_sync_error: null, status: 'active' },
]

export const deviceEmployeeMappings = [
  { id: 'map-1', device_id: 'dev-1', device_pin: '1001', employee_id: 'emp-1', status: 'active' },
  { id: 'map-2', device_id: 'dev-1', device_pin: '1002', employee_id: 'emp-3', status: 'active' },
  { id: 'map-3', device_id: 'dev-1', device_pin: '1003', employee_id: 'emp-7', status: 'active' },
  { id: 'map-4', device_id: 'dev-2', device_pin: '2001', employee_id: 'emp-2', status: 'active' },
]

export const attendanceSyncLogs = [
  { id: 'sync-1', device_id: 'dev-1', sync_date: '2025-07-10', status: 'success', records_fetched: 6, records_inserted: 6, records_skipped: 0, records_unmapped: 0, error_message: null, started_at: '2025-07-10T08:15:00Z', finished_at: '2025-07-10T08:15:04Z' },
  { id: 'sync-2', device_id: 'dev-1', sync_date: '2025-07-09', status: 'success', records_fetched: 6, records_inserted: 6, records_skipped: 0, records_unmapped: 0, error_message: null, started_at: '2025-07-09T08:15:00Z', finished_at: '2025-07-09T08:15:03Z' },
  { id: 'sync-3', device_id: 'dev-2', sync_date: '2025-07-10', status: 'partial', records_fetched: 4, records_inserted: 2, records_skipped: 0, records_unmapped: 2, error_message: null, started_at: '2025-07-10T08:00:00Z', finished_at: '2025-07-10T08:00:05Z' },
  { id: 'sync-4', device_id: 'dev-2', sync_date: '2025-07-08', status: 'failed', records_fetched: 0, records_inserted: 0, records_skipped: 0, records_unmapped: 0, error_message: 'Tidak bisa terhubung ke Fingerspot: connection timeout', started_at: '2025-07-08T08:00:00Z', finished_at: '2025-07-08T08:00:30Z' },
]

// ── Overtime requests ─────────────────────────────────────────────────────────
export const overtimeRequests = [
  {
    id: 'ot-1', no: 'OT-PTMJ-202507-001', company_id: 'co-1', department: 'Produksi A', date: '2025-07-05',
    status: 'approved', requestedBy: 'Eko Prasetyo', approvedBy: 'Dewi Lestari', description: 'Target produksi bulan Juli',
    items: [
      { id: 'oti-1', employee_id: 'emp-1', employee: 'Ahmad Rizki', start: '16:00', end: '19:00', duration: 180, status: 'approved', notes: '' },
      { id: 'oti-2', employee_id: 'emp-3', employee: 'Doni Firmansyah', start: '16:00', end: '18:00', duration: 120, status: 'approved', notes: '' },
    ],
  },
  {
    id: 'ot-2', no: 'OT-PTMJ-202507-002', company_id: 'co-1', department: 'Gudang', date: '2025-07-07',
    status: 'pending', requestedBy: 'Eko Prasetyo', approvedBy: null, description: 'Stock opname akhir bulan',
    items: [
      { id: 'oti-3', employee_id: 'emp-2', employee: 'Siti Aminah', start: '16:00', end: '20:00', duration: 240, status: 'pending', notes: 'Perlu bantuan 2 orang' },
    ],
  },
  {
    id: 'ot-3', no: 'OT-PTGI-202507-001', company_id: 'co-2', department: 'Packaging', date: '2025-07-04',
    status: 'approved', requestedBy: 'Staff Packaging', approvedBy: 'Sari Indah', description: 'Kejar deadline pengiriman',
    items: [
      { id: 'oti-4', employee_id: 'emp-4', employee: 'Maya Putri', start: '17:00', end: '20:00', duration: 180, status: 'approved', notes: '' },
    ],
  },
]

// ── Payroll ───────────────────────────────────────────────────────────────────
export const payrolls = [
  { id: 'pr-1', company_id: 'co-1', period_month: 6, period_year: 2025, employees: 48, totalGross: 234500000, totalNet: 211050000, status: 'finalized', processedBy: 'Budi Santoso' },
  { id: 'pr-2', company_id: 'co-2', period_month: 6, period_year: 2025, employees: 32, totalGross: 156800000, totalNet: 141120000, status: 'draft', processedBy: 'Budi Santoso' },
  { id: 'pr-3', company_id: 'co-3', period_month: 6, period_year: 2025, employees: 15, totalGross: 72300000, totalNet: 65070000, status: 'processing', processedBy: 'Budi Santoso' },
]

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentCategories = [
  { id: 'dc-1', code: 'POLICY', name: 'Kebijakan' },
  { id: 'dc-2', code: 'CONTRACT', name: 'Kontrak Kerja' },
  { id: 'dc-3', code: 'MEMO', name: 'Memo Internal' },
  { id: 'dc-4', code: 'FORM', name: 'Formulir' },
]

export const documents = [
  { id: 'doc-1', number: 'DOC-2025-001', category: 'Kebijakan', title: 'Kebijakan Lembur 2025', company_id: 'co-1', effectiveDate: '2025-02-01', requiresAck: true, status: 'approved', version: 1, ackCount: 32, totalTarget: 48, createdAt: '2025-01-15' },
  { id: 'doc-2', number: 'DOC-2025-002', category: 'Kontrak Kerja', title: 'Kontrak Kerja - Ahmad Rizki', company_id: 'co-1', effectiveDate: '2023-01-15', requiresAck: true, status: 'approved', version: 1, ackCount: 1, totalTarget: 1, createdAt: '2023-01-10' },
  { id: 'doc-3', number: 'DOC-2025-003', category: 'Memo Internal', title: 'Memo Perubahan Jam Kerja Ramadan', company_id: 'co-2', effectiveDate: '2025-03-01', requiresAck: false, status: 'pending_approval', version: 1, ackCount: 0, totalTarget: 32, createdAt: '2025-02-20' },
]

// ── Notifications ─────────────────────────────────────────────────────────────
export const notifications = [
  { id: 'n-1', recipient_id: 'u-3', title: 'Pengajuan Lembur Baru', body: 'Eko Prasetyo mengajukan lembur untuk 1 karyawan pada 7 Juli 2025', type: 'overtime', entityId: 'ot-2', read: false, priority: 'normal', createdAt: '2025-07-06T14:30:00Z' },
  { id: 'n-2', recipient_id: 'u-3', title: 'Dokumen Perlu Persetujuan', body: 'Memo Perubahan Jam Kerja Ramadan menunggu approval Anda', type: 'document', entityId: 'doc-3', read: false, priority: 'normal', createdAt: '2025-07-05T09:00:00Z' },
  { id: 'n-3', recipient_id: 'u-1', title: 'Payroll PT Global Indo', body: 'Payroll bulan Juni 2025 masih berstatus draft', type: 'payroll', entityId: 'pr-2', read: true, priority: 'low', createdAt: '2025-07-01T08:00:00Z' },
]

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const auditLogs = [
  { id: 'al-1', user: 'Budi Santoso', role: 'coordinator', action: 'create', entity: 'payroll', entityName: 'Payroll PT Maju Jaya - Juni 2025', summary: 'Membuat payroll baru', timestamp: '2025-06-30T15:30:00Z', ip: '192.168.1.100', status: 'success' },
  { id: 'al-2', user: 'Dewi Lestari', role: 'hrd', action: 'approve', entity: 'overtime_request', entityName: 'OT-PTMJ-202507-001', summary: 'Menyetujui pengajuan lembur 2 karyawan', timestamp: '2025-07-05T10:15:00Z', ip: '192.168.1.55', status: 'success' },
  { id: 'al-3', user: 'Eko Prasetyo', role: 'staff_dept', action: 'create', entity: 'overtime_request', entityName: 'OT-PTMJ-202507-002', summary: 'Mengajukan lembur baru', timestamp: '2025-07-06T14:30:00Z', ip: '192.168.1.20', status: 'success' },
  { id: 'al-4', user: 'Budi Santoso', role: 'coordinator', action: 'update', entity: 'employee', entityName: 'Ahmad Rizki', summary: 'Update data karyawan: posisi jabatan', timestamp: '2025-07-04T11:00:00Z', ip: '192.168.1.100', status: 'success' },
  { id: 'al-5', user: 'Rina Wahyu', role: 'field_officer', action: 'create', entity: 'employee', entityName: 'Wulan Sari', summary: 'Menambahkan karyawan baru', timestamp: '2025-07-03T09:20:00Z', ip: '192.168.1.30', status: 'success' },
]

// ── Roles & Permissions ────────────────────────────────────────────────────────
export const ROLE_DEFINITIONS = {
  coordinator: { label: 'Koordinator Outsourcing', desc: 'Akses penuh semua data dan fitur', icon: 'ShieldCheck' },
  field_officer: { label: 'Petugas Lapangan', desc: 'Kelola data perusahaan yang ditangani', icon: 'UserCheck' },
  hrd: { label: 'Staff HRD', desc: 'Kelola data perusahaan sendiri', icon: 'Building2' },
  staff_dept: { label: 'Staff Departemen', desc: 'Pengajuan lembur departemen', icon: 'Users' },
}

export const ALL_PERMISSIONS = [
  { code: 'employee.view', label: 'Lihat Karyawan', group: 'Karyawan' },
  { code: 'employee.create', label: 'Tambah Karyawan', group: 'Karyawan' },
  { code: 'employee.edit', label: 'Edit Karyawan', group: 'Karyawan' },
  { code: 'employee.delete', label: 'Hapus Karyawan', group: 'Karyawan' },
  { code: 'overtime.create_own', label: 'Ajukan Lembur', group: 'Lembur' },
  { code: 'overtime.view_own', label: 'Lihat Lembur Sendiri', group: 'Lembur' },
  { code: 'overtime.approve', label: 'Konfirmasi Lembur', group: 'Lembur' },
  { code: 'overtime.view_all', label: 'Lihat Semua Lembur', group: 'Lembur' },
  { code: 'attendance.view', label: 'Lihat Absensi', group: 'Absensi' },
  { code: 'attendance.adjust', label: 'Sesuaikan Absensi', group: 'Absensi' },
  { code: 'payroll.view', label: 'Lihat Gaji', group: 'Payroll' },
  { code: 'payroll.process', label: 'Proses Gaji', group: 'Payroll' },
  { code: 'payroll.finalize', label: 'Finalisasi Gaji', group: 'Payroll' },
  { code: 'settings.company_rules', label: 'Setting Aturan Kerja', group: 'Pengaturan' },
  { code: 'user_management.dept', label: 'Kelola User Departemen', group: 'Pengaturan' },
  { code: 'user_management.all', label: 'Kelola Semua User', group: 'Pengaturan' },
  { code: 'document.manage', label: 'Kelola Dokumen', group: 'Dokumen' },
  { code: 'audit.view', label: 'Lihat Audit Log', group: 'Audit' },
]

export const ROLE_PERMISSIONS = {
  coordinator: ALL_PERMISSIONS.map(p => p.code),
  field_officer: ['employee.view','employee.create','employee.edit','overtime.view_all','attendance.view','user_management.dept'],
  hrd: ['employee.view','employee.create','employee.edit','overtime.approve','overtime.view_all','attendance.view','attendance.adjust','user_management.dept','document.manage'],
  staff_dept: ['overtime.create_own','overtime.view_own','attendance.view'],
}
