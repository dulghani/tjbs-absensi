// Real service layer — memanggil backend Laravel asli lewat axios (lihat api/index.js),
// lalu MENORMALISASI hasilnya supaya bentuknya identik dengan mockService.js.
// Tujuannya: halaman React yang sudah dibangun di atas mockService bisa langsung
// pindah ke backend asli cukup dengan ganti 1 baris import, tanpa ubah JSX apa pun.
import api from './index'

const unwrap = (res) => res.data // res sudah lolos axios interceptor (lihat api/index.js), res = body JSON
const unwrapPaginated = (res) => res.data.data // Laravel paginate(): {data: {data: [...], links, meta}}

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function realLogin({ email, password }) {
  const res = await api.post('/auth/login', { email, password })
  // Backend: { user: {...., company: {...}|null}, token }
  const user = { ...res.user, roles: [res.user.role] } // mock pakai user.roles (array), backend pakai user.role (string)
  return { user, company: res.user.company || null, token: res.token }
}

// ── Companies ─────────────────────────────────────────────────────────────────
function normalizeCompany(c) {
  return { ...c, employees: c.employees_count ?? c.employees ?? 0 }
}
export async function getCompanies() {
  const res = await api.get('/organizations/companies')
  return unwrap(res).map(normalizeCompany)
}
export async function getCompany(id) {
  const res = await api.get(`/organizations/companies/${id}`)
  return normalizeCompany(unwrap(res))
}
export async function createCompany(data) {
  const res = await api.post('/organizations/companies', data)
  return normalizeCompany(unwrap(res))
}
export async function updateCompany(id, data) {
  const res = await api.patch(`/organizations/companies/${id}`, data)
  return normalizeCompany(unwrap(res))
}

// ── Org hierarchy ─────────────────────────────────────────────────────────────
export async function getOrgTree(companyId) {
  const res = await api.get(`/organizations/companies/${companyId}/tree`)
  return res // tree dikembalikan langsung tanpa wrapper 'data' oleh backend
}
export async function getDepartments(companyId) {
  const res = await api.get(`/organizations/companies/${companyId}/departments`)
  return unwrap(res)
}
export async function getDivisions(companyId) {
  if (!companyId) return []
  const params = companyId === 'all' ? {} : { company_id: companyId }
  const res = await api.get('/organizations/divisions', { params })
  return unwrap(res) ?? []
}
export async function getOrgDepartments(companyId, divisionId) {
  if (!companyId || companyId === 'all') return []
  const params = divisionId && divisionId !== 'all' ? { division_id: divisionId } : {}
  const res = await api.get(`/organizations/companies/${companyId}/departments`, { params })
  return unwrap(res).data ?? []
}
export async function createDepartment(companyId, data) {
  const res = await api.post(`/organizations/companies/${companyId}/departments`, data)
  return unwrap(res)
}
export async function createDivision(companyId, data) {
  const res = await api.post(`/organizations/companies/${companyId}/divisions`, data)
  return unwrap(res)
}

// ── Employees ─────────────────────────────────────────────────────────────────
function normalizeEmployee(e) {
  return {
    ...e,
    companyName: e.company?.name,
    divisionName: e.division?.name,
    joinDate: e.join_date,
    employmentStatus: e.employment_status,
    ktp: e.ktp_number,
  }
}
function denormalizeEmployeePayload(data) {
  const { employmentStatus, joinDate, ktp, ...rest } = data
  return {
    ...rest,
    ...(employmentStatus && { employment_status: employmentStatus }),
    ...(joinDate && { join_date: joinDate }),
    ...(ktp && { ktp_number: ktp }),
  }
}
export async function getEmployees(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  if (params.status === 'all') delete params.status
  const res = await api.get('/employees', { params })
  return unwrapPaginated(res).map(normalizeEmployee)
}
// Versi server-side pagination — dipakai EmployeesPage supaya bisa handle ratusan
// data tanpa perlu tarik semua sekaligus ke browser. Beda dari getEmployees() di atas
// (yang cuma balikin array 50 data pertama, tanpa info total/halaman lain).
export async function getEmployeesPaginated(filters = {}, page = 1, perPage = 25) {
  const params = { ...filters, page, per_page: perPage }
  if (params.company_id === 'all') delete params.company_id
  if (params.status === 'all') delete params.status
  if (params.department === 'all') delete params.department // Bug fix: tanpa ini backend filter WHERE department='all' → 0 hasil
  const res = await api.get('/employees', { params })
  const paginator = res.data // {data: [...], current_page, last_page, total, ...}
  return {
    data: paginator.data.map(normalizeEmployee),
    total: paginator.total, currentPage: paginator.current_page, lastPage: paginator.last_page,
  }
}
export async function getEmployee(id) {
  const res = await api.get(`/employees/${id}`)
  return normalizeEmployee(unwrap(res))
}
export async function createEmployee(data) {
  const res = await api.post('/employees', denormalizeEmployeePayload(data))
  return normalizeEmployee(unwrap(res))
}
export async function updateEmployee(id, data) {
  const res = await api.patch(`/employees/${id}`, denormalizeEmployeePayload(data))
  return normalizeEmployee(unwrap(res))
}
export async function deleteEmployee(id) {
  const res = await api.delete(`/employees/${id}`)
  return unwrap(res)
}
export async function bulkDeleteEmployees(ids) {
  const res = await api.delete('/employees/bulk-delete', { data: { ids } })
  return unwrap(res)
}
export async function toggleEmployeeStatus(id, data = {}) {
  const res = await api.patch(`/employees/${id}/toggle-status`, data)
  return unwrap(res)
}
export async function exportEmployees(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  if (params.department === 'all') delete params.department
  const res = await api.get('/employees/export', { params })
  return unwrap(res)
}
export async function searchEmployees(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  if (params.division_id === 'all') delete params.division_id
  if (params.department === 'all') delete params.department
  const res = await api.get('/employees/search', { params })
  return unwrap(res).map(e => ({ ...e, divisionName: e.division?.name }))
}
export async function resolveIncompleteAttendance(summaryId, data) {
  // data: { time_type: 'check_in'|'check_out'|'both', actual_start_time?, actual_end_time?, notes? }
  const res = await api.post(`/attendance/summaries/${summaryId}/resolve`, data)
  return unwrap(res)
}
export async function getLeaveRequests(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  const res = await api.get('/leave', { params })
  return res // paginated
}
export async function createLeaveRequest(data) {
  const res = await api.post('/leave', data)
  return unwrap(res)
}
export async function approveLeave(id, notes) {
  const res = await api.post(`/leave/${id}/approve`, { notes })
  return unwrap(res)
}
export async function rejectLeave(id, notes) {
  const res = await api.post(`/leave/${id}/reject`, { notes })
  return unwrap(res)
}
export async function deleteLeave(id) {
  return api.delete(`/leave/${id}`)
}
export async function getManualDeductions(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  const res = await api.get('/manual-deductions', { params })
  return res // paginated: {data:[...], meta:{...}}
}
export async function createManualDeduction(data) {
  const res = await api.post('/manual-deductions', data)
  return unwrap(res)
}
export async function updateManualDeduction(id, data) {
  const res = await api.patch(`/manual-deductions/${id}`, data)
  return unwrap(res)
}
export async function deleteManualDeduction(id) {
  return api.delete(`/manual-deductions/${id}`)
}
export async function batchResolveIncomplete(data) {
  const res = await api.post('/attendance/summaries/batch-resolve', data)
  return res
}
export async function exportAttendanceExcel(params) {
  // responseType blob karena download file
  return api.get('/attendance/export', { params, responseType: 'blob' })
}
export async function recalculateAttendance(companyId, fromDate, toDate) {
  const res = await api.post('/attendance/recalculate', { company_id: companyId, from_date: fromDate, to_date: toDate })
  return res // {message, job_count} — no data wrapper
}
export async function deleteOvertimeRequest(id) {
  return api.delete(`/overtime/${id}`)
}
export async function getWorkExceptions(companyId, year, month) {
  const params = {}
  if (year) params.year = year
  if (month) params.month = month
  const res = await api.get(`/companies/${companyId}/work-exceptions`, { params })
  return unwrap(res)
}
export async function createWorkException(companyId, data) {
  const res = await api.post(`/companies/${companyId}/work-exceptions`, data)
  return unwrap(res)
}
export async function updateWorkException(companyId, id, data) {
  const res = await api.patch(`/companies/${companyId}/work-exceptions/${id}`, data)
  return unwrap(res)
}
export async function deleteWorkException(companyId, id) {
  const res = await api.delete(`/companies/${companyId}/work-exceptions/${id}`)
  return unwrap(res)
}
export async function getImportTemplate() {
  const res = await api.get('/employees/template')
  return unwrap(res)
}
export async function importEmployeesGlobal(file, companyId = null) {
  const form = new FormData()
  form.append('file', file)
  if (companyId) form.append('company_id', companyId)
  const res = await api.post('/employees/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  return unwrap(res)
}

// ── Companies ──────────────────────────────────────────────────────────────────
export async function toggleCompanyStatus(id) {
  const res = await api.patch(`/organizations/companies/${id}/toggle-status`)
  return unwrap(res)
}
export async function deleteDivision(id) {
  const res = await api.delete(`/organizations/divisions/${id}`)
  return unwrap(res)
}
export async function deleteDepartment(id) {
  const res = await api.delete(`/organizations/departments/${id}`)
  return unwrap(res)
}

// ── Shifts ────────────────────────────────────────────────────────────────────
export async function getShifts(companyId) {
  const res = await api.get(`/shifts/companies/${companyId}/shifts`)
  return unwrap(res)
}
export async function createShift(companyId, data) {
  const res = await api.post(`/shifts/companies/${companyId}/shifts`, data)
  return unwrap(res)
}
export async function updateShift(id, data) {
  const res = await api.patch(`/shifts/${id}`, data)
  return unwrap(res)
}
export async function deleteShift(id) {
  const res = await api.delete(`/shifts/${id}`)
  return unwrap(res)
}

// ── Work settings ─────────────────────────────────────────────────────────────
function normalizeWorkSettings(s, tiers = []) {
  if (!s) return null
  return {
    workStart: s.work_start_time, workEnd: s.work_end_time, breakMin: s.break_duration_minutes,
    workDays: s.work_days || [1, 1, 1, 1, 1, 0, 0],
    dailyHoursOverride: s.daily_hours_override || {},
    businessDateCutoff: s.business_date_cutoff || '05:00',
    lateTolerance: s.late_tolerance_minutes, otMinMin: s.overtime_min_minutes,
    otMethod: s.overtime_calc_method,
    tiers: tiers.map((t) => ({ id: t.id, dayType: t.day_type, from: t.hour_from, to: t.hour_to, multiplier: t.multiplier })),
  }
}
export async function getWorkSettings(companyId) {
  const [settingRes, tiersRes] = await Promise.all([
    api.get(`/payroll/work-settings/${companyId}`),
    api.get(`/payroll/overtime-rates/${companyId}`),
  ])
  return normalizeWorkSettings(unwrap(settingRes), unwrap(tiersRes))
}
export async function createOvertimeRateTier(companyId, data) {
  const payload = { company_id: companyId, day_type: data.dayType, tier_order: data.tierOrder, hour_from: data.from, hour_to: data.to || null, multiplier: data.multiplier }
  const res = await api.post('/payroll/overtime-rates', payload)
  return unwrap(res)
}
export async function deleteOvertimeRateTier(id) {
  const res = await api.delete(`/payroll/overtime-rates/${id}`)
  return unwrap(res)
}
export async function updateOvertimeRateTier(id, data) {
  const payload = { day_type: data.dayType, tier_order: data.tierOrder, hour_from: data.from, hour_to: data.to || null, multiplier: data.multiplier }
  const res = await api.patch(`/payroll/overtime-rates/${id}`, payload)
  return unwrap(res)
}

// ── Hari Kerja Efektif Bulanan ────────────────────────────────────────────────
export async function getEffectiveWorkDaysList(companyId) {
  const res = await api.get(`/payroll/effective-work-days/${companyId}`)
  return unwrap(res)
}
export async function saveEffectiveWorkDays(companyId, periodMonth, periodYear, effectiveDays) {
  const res = await api.post('/payroll/effective-work-days', { company_id: companyId, period_month: periodMonth, period_year: periodYear, effective_days: effectiveDays })
  return unwrap(res)
}
export async function deleteEffectiveWorkDaysEntry(id) {
  const res = await api.delete(`/payroll/effective-work-days/${id}`)
  return unwrap(res)
}
export async function updateWorkSettings(companyId, data) {
  const payload = {
    work_start_time: data.workStart, work_end_time: data.workEnd, break_duration_minutes: data.breakMin,
    work_days: data.workDays, late_tolerance_minutes: data.lateTolerance,
    overtime_min_minutes: data.otMinMin,
    daily_hours_override: data.daily_hours_override || {},
    business_date_cutoff: data.businessDateCutoff || '05:00',
    ...(data.effective_date && { effective_date: data.effective_date }),
  }
  const res = await api.patch(`/payroll/work-settings/${companyId}`, payload)
  return normalizeWorkSettings(unwrap(res))
}

// ── Salary components ─────────────────────────────────────────────────────────
function normalizeSalaryComponent(s) {
  return { ...s, name: s.component_name, type: s.component_type, calc: s.calculation_type, value: s.base_value, taxable: s.is_taxable, order: s.sort_order }
}
export async function getSalaryComponents(companyId) {
  const res = await api.get(`/payroll/components/${companyId}`)
  return unwrap(res).map(normalizeSalaryComponent)
}
export async function createSalaryComponent(companyId, data) {
  const payload = { company_id: companyId, component_name: data.name, component_type: data.type, calculation_type: data.calc, base_value: data.value, is_taxable: data.taxable }
  const res = await api.post('/payroll/components', payload)
  return normalizeSalaryComponent(unwrap(res))
}
export async function updateSalaryComponent(id, data) {
  const payload = { component_name: data.name, component_type: data.type, calculation_type: data.calc, base_value: data.value, is_taxable: data.taxable }
  const res = await api.patch(`/payroll/components/${id}`, payload)
  return normalizeSalaryComponent(unwrap(res))
}
export async function deleteSalaryComponent(id) {
  const res = await api.delete(`/payroll/components/${id}`)
  return unwrap(res)
}

// ── Attendance ────────────────────────────────────────────────────────────────
function normalizeAttendance(r) {
  return {
    // Backend kirim attendance_date sebagai ISO datetime lengkap ("2026-07-14T00:00:00...Z"),
    // sementara <input type="date"> di form filter cuma "2026-07-14" — potong ke 10 karakter
    // pertama supaya perbandingan string di halaman Absensi cocok.
    ...r, date: r.attendance_date?.slice(0, 10), status: r.attendance_status,
    employeeName: r.employee?.name, department: r.employee?.department,
    pin: r.employee?.device_mappings?.map((m) => m.device_pin).join(', ') || '-',
    checkIn: r.actual_start_time, checkOut: r.actual_end_time,
    lateMinutes: r.late_minutes, overtimeMinutes: r.overtime_minutes, workMinutes: r.productive_work_minutes,
    overtimeVerified: r.overtime_verified, // true=hijau(ada pengajuan lembur), false=kuning(tidak ada), null=di bawah ambang batas
  }
}
export async function getAttendanceSummaries(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  const res = await api.get('/attendance/summaries', { params })
  // Backend sekarang pakai paginate() (sebelumnya limit(200) polos) — data asli ada di res.data.data.
  return res.data.data.map(normalizeAttendance)
}
export async function getAttendanceSummariesPaginated(filters = {}, page = 1, perPage = 25) {
  const params = { ...filters, page, per_page: perPage }
  if (params.company_id === 'all') delete params.company_id
  if (params.department === 'all') delete params.department
  if (params.status === 'all') delete params.status
  const res = await api.get('/attendance/summaries', { params })
  const paginator = res.data
  return {
    data: paginator.data.map(normalizeAttendance),
    total: paginator.total, currentPage: paginator.current_page, lastPage: paginator.last_page,
  }
}
export async function getEmployeeDepartments(companyId, divisionId) {
  // Ambil dari tabel struktur organisasi (departments) sebagai sumber utama
  // sehingga departemen baru yang belum punya karyawan tetap muncul di dropdown
  if (companyId && companyId !== 'all') {
    try {
      const params = {}
      if (divisionId && divisionId !== 'all') params.division_id = divisionId
      const res = await api.get(`/organizations/companies/${companyId}/departments`, { params })
      const orgDepts = unwrap(res) ?? []
      if (orgDepts.length > 0) {
        // Kembalikan array nama departemen (string) untuk kompatibilitas
        return orgDepts.map(d => d.name)
      }
    } catch {}
  }
  // Fallback: ambil dari data karyawan yang sudah ada
  const params = {}
  if (companyId && companyId !== 'all') params.company_id = companyId
  if (divisionId && divisionId !== 'all') params.division_id = divisionId
  const res = await api.get('/employees/departments', { params })
  return unwrap(res) ?? []
}
export async function getEmployeeDivisions(companyId) {
  // Ambil dari tabel struktur organisasi (divisions) sebagai sumber utama
  if (companyId && companyId !== 'all') {
    try {
      const res = await api.get(`/organizations/companies/${companyId}/divisions`)
      const orgDivs = unwrap(res) ?? []
      if (orgDivs.length > 0) return orgDivs // {id, name, code, ...}
    } catch {}
  }
  // Fallback: ambil dari data karyawan
  const res = await api.get('/employees/divisions', { params: companyId && companyId !== 'all' ? { company_id: companyId } : {} })
  return unwrap(res) ?? []
}
export async function getAttendanceAnalytics(employeeId, month, year) {
  const res = await api.get(`/attendance/analytics/${employeeId}/${month}/${year}`)
  return unwrap(res)
}
export async function getAttendanceStats(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  if (params.department === 'all') delete params.department
  const res = await api.get('/attendance/summary-stats', { params })
  return unwrap(res)
}

// ── Overtime ──────────────────────────────────────────────────────────────────
function normalizeOvertime(o) {
  return {
    ...o, no: o.request_number, date: o.overtime_date, requestedBy: o.requestedBy?.name,
    approvedBy: o.approved_by,
    items: (o.details || []).map((d) => ({
      id: d.id, employee_id: d.employee_id, employee: d.employee?.name,
      start: d.plan_start_time, end: d.plan_end_time, duration: d.plan_duration_minutes,
      status: d.status, notes: d.notes,
      attendance: d.attendance || null, // jam pulang & lembur aktual
    })),
  }
}
export async function getOvertimeRequests(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  if (params.status === 'all') delete params.status
  const res = await api.get('/overtime', { params })
  return unwrap(res).map(normalizeOvertime)
}
export async function createOvertimeRequest(data) {
  const payload = {
    company_id: data.company_id, department: data.department, overtime_date: data.date,
    description: data.description,
    items: data.items.map((it) => ({ employee_id: it.employee_id, start: it.start, end: it.end, notes: it.notes })),
  }
  const res = await api.post('/overtime', payload)
  return normalizeOvertime(unwrap(res))
}
export async function approveOvertimeItem(requestId, itemId) {
  const res = await api.post(`/overtime/${requestId}/items/${itemId}/approve`)
  return normalizeOvertime(unwrap(res))
}
export async function rejectOvertimeItem(requestId, itemId) {
  const res = await api.post(`/overtime/${requestId}/items/${itemId}/reject`)
  return normalizeOvertime(unwrap(res))
}
export async function approveAllOvertime(requestId) {
  const res = await api.post(`/overtime/${requestId}/approve-all`)
  return normalizeOvertime(unwrap(res))
}

// ── Payroll ───────────────────────────────────────────────────────────────────
function normalizePayroll(p) {
  return {
    ...p,
    companyName: p.company?.name,
    employees: p.employee_count,
    totalGross: p.total_gross,
    totalNet: p.total_net,
    date_from: p.date_from,
    date_to: p.date_to,
    scope_label: p.scope_label,
  }
}
export async function getPayrolls(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  const res = await api.get('/payroll', { params })
  return unwrap(res).map(normalizePayroll)
}
export async function processPayroll(data) {
  const res = await api.post('/payroll/process', data)
  return normalizePayroll(unwrap(res))
}
export async function finalizePayroll(id) {
  const res = await api.post(`/payroll/${id}/finalize`)
  return normalizePayroll(unwrap(res))
}
export async function deletePayroll(id) {
  const res = await api.delete(`/payroll/${id}`)
  return res
}
export async function recalculatePayroll(id) {
  const res = await api.post(`/payroll/${id}/recalculate`)
  return normalizePayroll(unwrap(res))
}
export async function updatePayrollDetail(payrollId, employeeId, data) {
  const res = await api.patch(`/payroll/${payrollId}/detail/${employeeId}`, data)
  return unwrap(res)
}
export async function downloadPayrollSlipPdf(payrollId, employeeId) {
  return api.get(`/audit-logs/reports/payroll/${payrollId}/slip/${employeeId}`, { responseType: 'blob' })
}

// ── Documents ─────────────────────────────────────────────────────────────────
function normalizeDocument(d) {
  return {
    ...d, number: d.document_number, category: d.category?.name, effectiveDate: d.effective_date,
    requiresAck: d.requires_acknowledgment, status: d.current_approval_status,
    ackCount: d.acknowledgments_count ?? 0, totalTarget: d.total_target ?? '?',
    createdAt: d.created_at,
  }
}
export async function getDocuments(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  const res = await api.get('/documents', { params })
  return unwrap(res).map(normalizeDocument)
}
// Cari/buat kategori dulu by nama (backend butuh category_id, form UI cuma punya nama kategori),
// baru kirim dokumennya. Sedikit tidak efisien (2 request) tapi menjaga DocumentsPage.jsx tetap sama.
export async function createDocument(data) {
  const catCode = data.category.toUpperCase().replace(/\s+/g, '_').slice(0, 40)
  const catRes = await api.post('/documents/categories', { company_id: data.company_id, code: catCode, name: data.category })
  const category = unwrap(catRes)

  const payload = {
    company_id: data.company_id, category_id: category.id, title: data.title,
    effective_date: data.effectiveDate, requires_acknowledgment: data.requiresAck,
  }
  const res = await api.post('/documents', payload)
  return normalizeDocument({ ...unwrap(res), category })
}

// ── Notifications ─────────────────────────────────────────────────────────────
function normalizeNotification(n) {
  return { ...n, type: n.related_entity_type, entityId: n.related_entity_id, read: !!n.read_at, createdAt: n.created_at }
}
export async function getNotifications() {
  const res = await api.get('/notifications/me')
  return unwrap(res).map(normalizeNotification)
}
export async function markNotificationRead(id) {
  const res = await api.post(`/notifications/${id}/mark-read`)
  return unwrap(res)
}
export async function markAllNotificationsRead() {
  const res = await api.post('/notifications/mark-all-read')
  return unwrap(res)
}

// ── Users ─────────────────────────────────────────────────────────────────────
function normalizeUser(u) {
  return { ...u, roles: [u.role], companyName: u.company?.name }
}
export async function getUsers(filters = {}) {
  const params = { ...filters }
  if (params.company_id === 'all') delete params.company_id
  const res = await api.get('/users', { params })
  return unwrap(res).map(normalizeUser)
}
export async function createUser(data) {
  const payload = { name: data.name, email: data.email, phone: data.phone, role: data.roles?.[0] || data.role, company_id: data.company_id || null, department: data.department || null }
  const res = await api.post('/users', payload)
  // res = {data: {...user}, temp_password: 'xxx'} — kembalikan keduanya
  return { user: normalizeUser(res.data), temp_password: res.temp_password }
}
export async function updateUser(id, data) {
  const res = await api.patch(`/users/${id}`, data)
  return normalizeUser(unwrap(res))
}
export async function deleteUser(id) {
  const res = await api.delete(`/users/${id}`)
  return unwrap(res)
}
export async function resetUserPassword(id) {
  const res = await api.post(`/users/${id}/reset-password`)
  return { user: normalizeUser(res.data), temp_password: res.temp_password }
}
export async function changePassword(data) {
  return api.post('/auth/change-password', data)
}
export async function getAppSettings() {
  const res = await api.get('/app-settings')
  return unwrap(res)
}
export async function updateAppSettings(formData) {
  // FormData karena ada file upload logo
  const res = await api.post('/app-settings', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return unwrap(res)
}

// ── Role Permissions ──────────────────────────────────────────────────────────
// CATATAN: backend belum punya tabel/endpoint role_permissions granular (baru pakai
// kolom 'role' sederhana di users). Fitur toggle permission di UI ini untuk saat ini
// masih disimpan di memori browser saja (tidak persisten ke server). Lihat README
// backend bagian "Catatan Implementasi Lanjutan" untuk rencana migrasi ke
// spatie/laravel-permission.
import { ROLE_PERMISSIONS as DEFAULT_ROLE_PERMISSIONS } from './mockData'
const _localRolePermissions = { ...DEFAULT_ROLE_PERMISSIONS }

export async function getRolePermissions(role) {
  return _localRolePermissions[role] || []
}
export async function updateRolePermissions(role, permissions) {
  _localRolePermissions[role] = permissions
  return permissions
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
function normalizeAuditLog(l) {
  return {
    ...l, user: l.user?.name, role: l.user?.role, action: l.action_category, entity: l.entity_type,
    entityName: l.entity_name, summary: l.changes_summary, timestamp: l.created_at, ip: l.source_ip,
  }
}
export async function getAuditLogs(filters = {}) {
  const params = {}
  if (filters.entity && filters.entity !== 'all') params.entity_type = filters.entity
  const res = await api.get('/audit-logs', { params })
  return unwrapPaginated(res).map(normalizeAuditLog)
}
export async function getAuditLogsPaginated(filters = {}, page = 1, perPage = 25) {
  const params = { page, per_page: perPage }
  if (filters.entity && filters.entity !== 'all') params.entity_type = filters.entity
  const res = await api.get('/audit-logs', { params })
  const paginator = res.data
  return {
    data: paginator.data.map(normalizeAuditLog),
    total: paginator.total, currentPage: paginator.current_page, lastPage: paginator.last_page,
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────
export async function getAttendanceReport(companyId, fromDate, toDate, department) {
  const params = { company_id: companyId, from_date: fromDate, to_date: toDate }
  if (department && department !== 'all') params.department = department
  return api.get('/audit-logs/reports/attendance-summary', { params })
}
export async function getRekapHarian(companyId, fromDate, toDate, department) {
  const params = { company_id: companyId, from_date: fromDate, to_date: toDate }
  if (department && department !== 'all') params.department = department
  return api.get('/audit-logs/reports/attendance-harian', { params })
}
export async function exportRekapHarianExcel(params) {
  return api.get('/audit-logs/reports/attendance-harian/export', { params, responseType: 'blob' })
}
export async function getOvertimeReport(companyId, month, year, department) {
  const params = { company_id: companyId, period_month: month, period_year: year }
  if (department && department !== 'all') params.department = department
  // interceptor sudah extract res.data, jadi res = {data:[...], meta:{...}} langsung
  return api.get('/audit-logs/reports/overtime-summary', { params })
}
export async function getPayrollSlips(payrollId) {
  // interceptor sudah extract res.data, jadi res = {payroll:{...}, slips:[...]} langsung
  // JANGAN pakai unwrap(res) lagi karena itu akan ambil .data dari object yg tidak punya .data
  const res = await api.get(`/audit-logs/reports/payroll/${payrollId}/slips`)
  return res
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export async function getDashboardStats() {
  const res = await api.get('/dashboard/stats')
  return unwrap(res) // res = {data:{...stats}} → unwrap = stats object
}

// ── Attendance Devices (Fingerspot) — struktur sudah 1:1 cocok dengan backend ──
export async function getDevices(companyId) {
  const res = await api.get('/attendance-devices', { params: companyId && companyId !== 'all' ? { company_id: companyId } : {} })
  return unwrap(res).map((d) => ({ ...d, companyName: d.company?.name, lineName: d.line?.name, divisionName: d.division?.name }))
}
export async function createDevice(data) {
  const res = await api.post('/attendance-devices', data)
  return unwrap(res)
}
export async function updateDevice(id, data) {
  const res = await api.patch(`/attendance-devices/${id}`, data)
  return unwrap(res)
}
export async function deleteDevice(id) {
  const res = await api.delete(`/attendance-devices/${id}`)
  return unwrap(res)
}
export async function testDeviceConnection(id) {
  try {
    const res = await api.post(`/attendance-devices/${id}/test-connection`)
    return res // {success, message, record_count_today} langsung tanpa wrapper data
  } catch (err) {
    // 422 saat gagal connect — backend balikin {success:false, message} di err.response.data
    return err?.response?.data || { success: false, message: err?.message || 'Koneksi gagal' }
  }
}
export async function syncDeviceNow(id, dateOrRange = {}) {
  // Backend mengembalikan {success, message} langsung (tanpa wrapper data)
  const res = await api.post(`/attendance-devices/${id}/sync-now`, dateOrRange)
  return res // res sudah = body JSON dari interceptor, langsung {success, message}
}
export async function syncEmployeesFromApi(deviceId) {
  // Coba endpoint baru (dari log) yang sudah terbukti bekerja
  const res = await api.post(`/attendance-devices/${deviceId}/create-employees-from-logs`)
  return unwrap(res)
}
export async function getSyncCoverage(deviceId, from, to) {
  const res = await api.get(`/attendance-devices/${deviceId}/sync-coverage`, { params: { from, to } })
  return unwrap(res)
}
export async function getSyncLogs(deviceId) {
  const res = await api.get(`/attendance-devices/${deviceId}/sync-logs`)
  return unwrap(res)
}
export async function getDeviceMappings(deviceId) {
  const res = await api.get(`/attendance-devices/${deviceId}/mappings`)
  return unwrap(res).map((m) => ({ ...m, employeeName: m.employee?.name, employeeNik: m.employee?.nik }))
}
export async function addDeviceMapping(deviceId, data) {
  const res = await api.post(`/attendance-devices/${deviceId}/mappings`, data)
  return unwrap(res)
}
export async function removeDeviceMapping(deviceId, mappingId) {
  // NOTE: signature mock lama removeDeviceMapping(id) cuma 1 arg; backend butuh deviceId juga.
  // DeviceIntegrationPage.jsx manggilnya removeDeviceMapping(m.id) — perlu sedikit penyesuaian
  // di halaman tsb kalau connect ke backend asli (lihat catatan di response chat).
  const res = await api.delete(`/attendance-devices/${deviceId}/mappings/${mappingId}`)
  return unwrap(res)
}

export async function importEmployeesToDevice(deviceId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await api.post(`/attendance-devices/${deviceId}/import-employees`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return unwrap(res)
}
