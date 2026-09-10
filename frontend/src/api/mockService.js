// Mock service layer — mensimulasikan REST API di atas mock data.
// Semua fungsi return Promise agar kompatibel dengan pola async React Query.
import * as db from './mockData'
import { uid } from './mockData'
import { generateOTNumber } from '../lib/utils'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))

// ── Auth ──────────────────────────────────────────────────────────────────────
export async function mockLogin({ email, role }) {
  await delay(400)
  const user = db.users.find((u) => u.roles.includes(role)) || db.users[0]
  const company = user.company_id ? db.companies.find((c) => c.id === user.company_id) : null
  return { user, company, token: 'mock-jwt-token-' + user.id }
}

// ── Companies ─────────────────────────────────────────────────────────────────
export async function getCompanies() { await delay(); return [...db.companies] }
export async function getCompany(id) { await delay(); return db.companies.find((c) => c.id === id) }
export async function createCompany(data) {
  await delay(400)
  const c = { id: uid('co'), status: 'active', employees: 0, ...data }
  db.companies.push(c)
  return c
}
export async function updateCompany(id, data) {
  await delay(300)
  const idx = db.companies.findIndex((c) => c.id === id)
  db.companies[idx] = { ...db.companies[idx], ...data }
  return db.companies[idx]
}

// ── Org hierarchy ─────────────────────────────────────────────────────────────
export async function getOrgTree(companyId) {
  await delay(300)
  const company = db.companies.find((c) => c.id === companyId)
  const divs = db.divisions.filter((d) => d.company_id === companyId)
  const buildDept = (deptId) => {
    const secs = db.sections.filter((s) => s.department_id === deptId)
    return secs.map((s) => ({
      ...s, type: 'section',
      children: db.productionLines.filter((l) => l.section_id === s.id).map((l) => ({ ...l, type: 'line' })),
    }))
  }
  const buildDivision = (divId) => {
    const depts = db.departments.filter((d) => d.division_id === divId)
    return depts.map((d) => ({ ...d, type: 'department', children: buildDept(d.id) }))
  }
  return {
    ...company, type: 'company',
    children: divs.map((d) => ({ ...d, type: 'division', children: buildDivision(d.id) })),
  }
}
export async function getDepartments(companyId) { await delay(); return db.departments.filter((d) => d.company_id === companyId) }
export async function getDivisions(companyId) { await delay(); return db.divisions.filter((d) => d.company_id === companyId) }
export async function createDepartment(companyId, data) {
  await delay(350)
  const d = { id: uid('dept'), company_id: companyId, status: 'active', ...data }
  db.departments.push(d)
  return d
}
export async function createDivision(companyId, data) {
  await delay(350)
  const d = { id: uid('div'), company_id: companyId, status: 'active', ...data }
  db.divisions.push(d)
  return d
}

// ── Employees ─────────────────────────────────────────────────────────────────
export async function getEmployees(filters = {}) {
  await delay(300)
  let result = [...db.employees]
  if (filters.company_id && filters.company_id !== 'all') result = result.filter((e) => e.company_id === filters.company_id)
  if (filters.department) result = result.filter((e) => e.department === filters.department)
  if (filters.status && filters.status !== 'all') result = result.filter((e) => e.status === filters.status)
  if (filters.search) {
    const s = filters.search.toLowerCase()
    result = result.filter((e) => e.name.toLowerCase().includes(s) || e.nik.includes(s))
  }
  return result.map((e) => ({ ...e, companyName: db.companies.find((c) => c.id === e.company_id)?.name }))
}
export async function getEmployee(id) {
  await delay(250)
  const e = db.employees.find((x) => x.id === id)
  return e ? { ...e, companyName: db.companies.find((c) => c.id === e.company_id)?.name } : null
}
export async function createEmployee(data) {
  await delay(400)
  const e = { id: uid('emp'), status: 'active', ...data }
  db.employees.push(e)
  const company = db.companies.find((c) => c.id === data.company_id)
  if (company) company.employees++
  return e
}
export async function updateEmployee(id, data) {
  await delay(350)
  const idx = db.employees.findIndex((e) => e.id === id)
  db.employees[idx] = { ...db.employees[idx], ...data }
  return db.employees[idx]
}
export async function deleteEmployee(id) {
  await delay(300)
  const idx = db.employees.findIndex((e) => e.id === id)
  if (idx >= 0) db.employees.splice(idx, 1)
  return { success: true }
}

// ── Shifts ────────────────────────────────────────────────────────────────────
export async function getShifts(companyId) { await delay(250); return db.shifts.filter((s) => s.company_id === companyId) }
export async function createShift(companyId, data) {
  await delay(350)
  const s = { id: uid('sh'), company_id: companyId, status: 'active', total_work_minutes: 0, ...data }
  db.shifts.push(s)
  return s
}
export async function updateShift(id, data) {
  await delay(300)
  const idx = db.shifts.findIndex((s) => s.id === id)
  db.shifts[idx] = { ...db.shifts[idx], ...data }
  return db.shifts[idx]
}
export async function deleteShift(id) {
  await delay(300)
  const idx = db.shifts.findIndex((s) => s.id === id)
  if (idx >= 0) db.shifts.splice(idx, 1)
  return { success: true }
}

// ── Work settings ─────────────────────────────────────────────────────────────
export async function getWorkSettings(companyId) { await delay(250); return db.workSettings[companyId] }
export async function updateWorkSettings(companyId, data) {
  await delay(350)
  db.workSettings[companyId] = { ...db.workSettings[companyId], ...data }
  return db.workSettings[companyId]
}

// ── Salary components ─────────────────────────────────────────────────────────
export async function getSalaryComponents(companyId) { await delay(250); return db.salaryComponents.filter((s) => s.company_id === companyId) }
export async function createSalaryComponent(companyId, data) {
  await delay(350)
  const s = { id: uid('sc'), company_id: companyId, ...data }
  db.salaryComponents.push(s)
  return s
}
export async function deleteSalaryComponent(id) {
  await delay(250)
  const idx = db.salaryComponents.findIndex((s) => s.id === id)
  if (idx >= 0) db.salaryComponents.splice(idx, 1)
  return { success: true }
}

// ── Attendance ────────────────────────────────────────────────────────────────
export async function getAttendanceSummaries(filters = {}) {
  await delay(300)
  let result = [...db.attendanceRecords]
  if (filters.employee_id) result = result.filter((a) => a.employee_id === filters.employee_id)
  if (filters.company_id && filters.company_id !== 'all') {
    const empIds = db.employees.filter((e) => e.company_id === filters.company_id).map((e) => e.id)
    result = result.filter((a) => empIds.includes(a.employee_id))
  }
  return result.map((a) => ({ ...a, employeeName: db.employees.find((e) => e.id === a.employee_id)?.name, department: db.employees.find((e) => e.id === a.employee_id)?.department }))
}
export async function getAttendanceAnalytics(employeeId) {
  await delay(300)
  const records = db.attendanceRecords.filter((a) => a.employee_id === employeeId)
  return {
    totalDays: records.length,
    present: records.filter((r) => r.status === 'present').length,
    late: records.filter((r) => r.status === 'late').length,
    absent: records.filter((r) => r.status === 'absent').length,
    onLeave: records.filter((r) => r.status === 'on_leave').length,
    totalOvertimeMinutes: records.reduce((s, r) => s + (r.overtimeMinutes || 0), 0),
    totalWorkMinutes: records.reduce((s, r) => s + (r.workMinutes || 0), 0),
    attendancePct: records.length ? ((records.filter((r) => r.status === 'present' || r.status === 'late').length / records.length) * 100).toFixed(1) : 0,
  }
}

// ── Attendance Devices (integrasi mesin fingerprint) ────────────────────────────
export async function getDevices(companyId) {
  await delay(300)
  let result = [...db.attendanceDevices]
  if (companyId && companyId !== 'all') result = result.filter((d) => d.company_id === companyId)
  return result.map((d) => ({ ...d, companyName: db.companies.find((c) => c.id === d.company_id)?.name, lineName: db.productionLines.find((l) => l.id === d.line_id)?.name }))
}
export async function createDevice(data) {
  await delay(400)
  const d = { id: uid('dev'), brand: 'fingerspot', status: 'active', last_synced_at: null, last_sync_status: 'never', last_sync_error: null, sync_mode: 'scheduled', sync_interval_minutes: 15, timezone: 'Asia/Jakarta', ...data }
  db.attendanceDevices.push(d)
  return d
}
export async function updateDevice(id, data) {
  await delay(350)
  const idx = db.attendanceDevices.findIndex((d) => d.id === id)
  db.attendanceDevices[idx] = { ...db.attendanceDevices[idx], ...data }
  return db.attendanceDevices[idx]
}
export async function deleteDevice(id) {
  await delay(300)
  const idx = db.attendanceDevices.findIndex((d) => d.id === id)
  if (idx >= 0) db.attendanceDevices.splice(idx, 1)
  return { success: true }
}

// Simulasi panggilan nyata ke FingerspotService::testConnection() di backend.
export async function testDeviceConnection(id) {
  await delay(900)
  const device = db.attendanceDevices.find((d) => d.id === id)
  // Simulasikan hasil realistis: berhasil kalau cloud_id & api_key terisi.
  if (!device.cloud_id || !device.api_key) {
    return { success: false, message: 'cloud_id atau api_key belum diisi' }
  }
  const ok = Math.random() > 0.15
  return ok
    ? { success: true, message: 'Koneksi berhasil', record_count_today: Math.floor(Math.random() * 10) }
    : { success: false, message: 'Tidak bisa terhubung ke Fingerspot: connection timeout' }
}

// Simulasi dispatch job SyncFingerspotAttendanceJob + hasil langsung (di backend nyata ini async/queued).
export async function syncDeviceNow(id) {
  await delay(1200)
  const device = db.attendanceDevices.find((d) => d.id === id)
  const mappedPins = db.deviceEmployeeMappings.filter((m) => m.device_id === id && m.status === 'active')
  const fetched = Math.floor(Math.random() * 6) + mappedPins.length
  const unmapped = Math.max(0, fetched - mappedPins.length)
  const inserted = fetched - unmapped
  const status = unmapped > 0 ? 'partial' : (Math.random() > 0.1 ? 'success' : 'failed')

  const log = {
    id: uid('sync'), device_id: id, sync_date: new Date().toISOString().slice(0, 10),
    status: status === 'failed' ? 'failed' : status,
    records_fetched: status === 'failed' ? 0 : fetched,
    records_inserted: status === 'failed' ? 0 : inserted,
    records_skipped: 0,
    records_unmapped: status === 'failed' ? 0 : unmapped,
    error_message: status === 'failed' ? 'Tidak bisa terhubung ke Fingerspot: connection timeout' : null,
    started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
  }
  db.attendanceSyncLogs.unshift(log)
  device.last_synced_at = log.started_at
  device.last_sync_status = status
  device.last_sync_error = log.error_message
  return log
}

export async function getSyncLogs(deviceId) {
  await delay(250)
  return db.attendanceSyncLogs.filter((l) => l.device_id === deviceId).sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
}

export async function getDeviceMappings(deviceId) {
  await delay(250)
  return db.deviceEmployeeMappings.filter((m) => m.device_id === deviceId).map((m) => ({ ...m, employeeName: db.employees.find((e) => e.id === m.employee_id)?.name, employeeNik: db.employees.find((e) => e.id === m.employee_id)?.nik }))
}
export async function addDeviceMapping(deviceId, data) {
  await delay(300)
  const existing = db.deviceEmployeeMappings.find((m) => m.device_id === deviceId && m.device_pin === data.device_pin)
  if (existing) { Object.assign(existing, data); return existing }
  const m = { id: uid('map'), device_id: deviceId, status: 'active', ...data }
  db.deviceEmployeeMappings.push(m)
  return m
}
export async function removeDeviceMapping(deviceId, id) {
  await delay(250)
  const idx = db.deviceEmployeeMappings.findIndex((m) => m.id === id)
  if (idx >= 0) db.deviceEmployeeMappings.splice(idx, 1)
  return { success: true }
}

// ── Overtime ──────────────────────────────────────────────────────────────────
export async function getOvertimeRequests(filters = {}) {
  await delay(300)
  let result = [...db.overtimeRequests]
  if (filters.company_id && filters.company_id !== 'all') result = result.filter((o) => o.company_id === filters.company_id)
  if (filters.status && filters.status !== 'all') result = result.filter((o) => o.status === filters.status)
  return result.sort((a, b) => new Date(b.date) - new Date(a.date))
}
export async function createOvertimeRequest(data) {
  await delay(450)
  const company = db.companies.find((c) => c.id === data.company_id)
  const req = {
    id: uid('ot'),
    no: generateOTNumber(company?.code?.replace('PT-', '') || 'XXX', data.date),
    status: 'pending',
    approvedBy: null,
    ...data,
    items: data.items.map((it) => ({ ...it, id: uid('oti'), status: 'pending' })),
  }
  db.overtimeRequests.unshift(req)
  return req
}
export async function approveOvertimeItem(requestId, itemId, approverName) {
  await delay(300)
  const req = db.overtimeRequests.find((r) => r.id === requestId)
  const item = req.items.find((i) => i.id === itemId)
  item.status = 'approved'
  if (req.items.every((i) => i.status !== 'pending')) {
    req.status = req.items.some((i) => i.status === 'approved') ? 'approved' : 'rejected'
    req.approvedBy = approverName
  }
  return req
}
export async function rejectOvertimeItem(requestId, itemId) {
  await delay(300)
  const req = db.overtimeRequests.find((r) => r.id === requestId)
  const item = req.items.find((i) => i.id === itemId)
  item.status = 'rejected'
  if (req.items.every((i) => i.status !== 'pending')) {
    req.status = req.items.some((i) => i.status === 'approved') ? 'approved' : 'rejected'
  }
  return req
}
export async function approveAllOvertime(requestId, approverName) {
  await delay(350)
  const req = db.overtimeRequests.find((r) => r.id === requestId)
  req.items.forEach((i) => (i.status = 'approved'))
  req.status = 'approved'
  req.approvedBy = approverName
  return req
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export async function getPayrolls(filters = {}) {
  await delay(300)
  let result = [...db.payrolls]
  if (filters.company_id && filters.company_id !== 'all') result = result.filter((p) => p.company_id === filters.company_id)
  return result.map((p) => ({ ...p, companyName: db.companies.find((c) => c.id === p.company_id)?.name }))
}
export async function processPayroll(data) {
  await delay(700)
  const company = db.companies.find((c) => c.id === data.company_id)
  const p = {
    id: uid('pr'), status: 'draft', employees: company?.employees || 0,
    totalGross: Math.floor(Math.random() * 200000000) + 50000000,
    totalNet: 0, processedBy: 'Current User', ...data,
  }
  p.totalNet = Math.floor(p.totalGross * 0.9)
  db.payrolls.unshift(p)
  return p
}
export async function finalizePayroll(id) {
  await delay(400)
  const p = db.payrolls.find((x) => x.id === id)
  p.status = 'finalized'
  return p
}

// ── Documents ─────────────────────────────────────────────────────────────────
export async function getDocuments(filters = {}) {
  await delay(300)
  let result = [...db.documents]
  if (filters.company_id && filters.company_id !== 'all') result = result.filter((d) => d.company_id === filters.company_id)
  return result
}
export async function createDocument(data) {
  await delay(450)
  const d = { id: uid('doc'), number: `DOC-2025-${String(db.documents.length + 1).padStart(3, '0')}`, status: 'pending_approval', version: 1, ackCount: 0, createdAt: new Date().toISOString().slice(0, 10), ...data }
  db.documents.unshift(d)
  return d
}

// ── Notifications ─────────────────────────────────────────────────────────────
export async function getNotifications(userId) {
  await delay(250)
  return db.notifications.filter((n) => n.recipient_id === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}
export async function markNotificationRead(id) {
  await delay(150)
  const n = db.notifications.find((x) => x.id === id)
  if (n) n.read = true
  return n
}
export async function markAllNotificationsRead(userId) {
  await delay(200)
  db.notifications.filter((n) => n.recipient_id === userId).forEach((n) => (n.read = true))
  return { success: true }
}

// ── Users & Roles ─────────────────────────────────────────────────────────────
export async function getUsers(filters = {}) {
  await delay(300)
  let result = [...db.users]
  if (filters.company_id && filters.company_id !== 'all') result = result.filter((u) => u.company_id === filters.company_id)
  return result.map((u) => ({ ...u, companyName: db.companies.find((c) => c.id === u.company_id)?.name }))
}
export async function createUser(data) {
  await delay(400)
  const u = { id: uid('u'), status: 'active', permissions: db.ROLE_PERMISSIONS[data.roles?.[0]] || [], ...data }
  db.users.push(u)
  return u
}
export async function updateUser(id, data) {
  await delay(350)
  const idx = db.users.findIndex((u) => u.id === id)
  db.users[idx] = { ...db.users[idx], ...data }
  return db.users[idx]
}
export async function deleteUser(id) {
  await delay(300)
  const idx = db.users.findIndex((u) => u.id === id)
  if (idx >= 0) db.users.splice(idx, 1)
  return { success: true }
}
export async function getRolePermissions(role) { await delay(200); return db.ROLE_PERMISSIONS[role] || [] }
export async function updateRolePermissions(role, permissions) {
  await delay(350)
  db.ROLE_PERMISSIONS[role] = permissions
  return permissions
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
export async function getAuditLogs(filters = {}) {
  await delay(300)
  let result = [...db.auditLogs]
  if (filters.entity && filters.entity !== 'all') result = result.filter((a) => a.entity === filters.entity)
  return result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

// ── Dashboard stats ───────────────────────────────────────────────────────────
export async function getDashboardStats(user) {
  await delay(350)
  const isMultiCompany = ['coordinator', 'field_officer'].includes(user.roles[0])
  const companyEmployees = isMultiCompany ? db.employees : db.employees.filter((e) => e.company_id === user.company_id)
  const companyOT = isMultiCompany ? db.overtimeRequests : db.overtimeRequests.filter((o) => o.company_id === user.company_id)
  return {
    totalCompanies: db.companies.length,
    totalEmployees: companyEmployees.filter((e) => e.status === 'active').length,
    pendingOvertime: companyOT.filter((o) => o.status === 'pending').length,
    totalOvertimeThisMonth: companyOT.length,
    payrollDraft: db.payrolls.filter((p) => p.status === 'draft').length,
    payrollProcessing: db.payrolls.filter((p) => p.status === 'processing').length,
    payrollFinalized: db.payrolls.filter((p) => p.status === 'finalized').length,
  }
}

export async function importEmployeesToDevice(deviceId, file) {
  await delay(1000)
  return { created: 12, updated: 3, mapped: 15, skipped: 0, total: 15, companies_created: [] }
}
