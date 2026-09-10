import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err.response?.data || err)
  }
)

export default api

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
}

// ── Organizations ─────────────────────────────────────────────────────────────
export const orgApi = {
  companies: {
    list: (p) => api.get('/organizations/companies', { params: p }),
    get: (id) => api.get(`/organizations/companies/${id}`),
    tree: (id) => api.get(`/organizations/companies/${id}/tree`),
    create: (d) => api.post('/organizations/companies', d),
    update: (id, d) => api.patch(`/organizations/companies/${id}`, d),
    delete: (id) => api.delete(`/organizations/companies/${id}`),
  },
  divisions: {
    list: (cid, p) => api.get(`/organizations/companies/${cid}/divisions`, { params: p }),
    create: (cid, d) => api.post(`/organizations/companies/${cid}/divisions`, d),
    update: (id, d) => api.patch(`/organizations/divisions/${id}`, d),
    delete: (id) => api.delete(`/organizations/divisions/${id}`),
  },
  departments: {
    list: (cid, p) => api.get(`/organizations/companies/${cid}/departments`, { params: p }),
    create: (cid, d) => api.post(`/organizations/companies/${cid}/departments`, d),
    update: (id, d) => api.patch(`/organizations/departments/${id}`, d),
    delete: (id) => api.delete(`/organizations/departments/${id}`),
  },
  sections: {
    list: (did, p) => api.get(`/organizations/departments/${did}/sections`, { params: p }),
    create: (did, d) => api.post(`/organizations/departments/${did}/sections`, d),
    update: (id, d) => api.patch(`/organizations/sections/${id}`, d),
  },
  lines: {
    list: (sid, p) => api.get(`/organizations/sections/${sid}/lines`, { params: p }),
    create: (sid, d) => api.post(`/organizations/sections/${sid}/lines`, d),
    update: (id, d) => api.patch(`/organizations/lines/${id}`, d),
  },
}

// ── Employees ──────────────────────────────────────────────────────────────────
export const employeeApi = {
  list: (p) => api.get('/employees', { params: p }),
  get: (id) => api.get(`/employees/${id}`),
  create: (d) => api.post('/employees', d),
  update: (id, d) => api.patch(`/employees/${id}`, d),
  delete: (id) => api.delete(`/employees/${id}`),
  assignment: (id) => api.get(`/employees/${id}/assignment/current`),
  assign: (id, d) => api.post(`/employees/${id}/assign`, d),
  import: (file) => { const f = new FormData(); f.append('file', file); return api.post('/employees/import', f, { headers: { 'Content-Type': 'multipart/form-data' } }) },
}

// ── Shifts ────────────────────────────────────────────────────────────────────
export const shiftApi = {
  list: (cid, p) => api.get(`/shifts/companies/${cid}/shifts`, { params: p }),
  create: (cid, d) => api.post(`/shifts/companies/${cid}/shifts`, d),
  update: (id, d) => api.patch(`/shifts/${id}`, d),
  delete: (id) => api.delete(`/shifts/${id}`),
  patterns: {
    list: (cid) => api.get(`/shifts/companies/${cid}/patterns`),
    create: (cid, d) => api.post(`/shifts/companies/${cid}/patterns`, d),
  },
  assignment: {
    get: (eid) => api.get(`/shifts/employees/${eid}/current`),
    create: (eid, d) => api.post(`/shifts/employees/${eid}/assign`, d),
  },
  swaps: {
    list: (p) => api.get('/shifts/swaps', { params: p }),
    create: (d) => api.post('/shifts/swaps', d),
    approve: (id) => api.patch(`/shifts/swaps/${id}/approve`),
    reject: (id, r) => api.patch(`/shifts/swaps/${id}/reject`, { reason: r }),
  },
  calendar: {
    get: (cid, yr) => api.get(`/calendars/companies/${cid}/year/${yr}`),
    addHoliday: (cid, d) => api.post(`/calendars/companies/${cid}/holidays`, d),
    update: (id, d) => api.patch(`/calendars/dates/${id}`, d),
  },
}

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceApi = {
  checkIn: (d) => api.post('/attendance/check-in', d),
  checkOut: (d) => api.post('/attendance/check-out', d),
  manualEntry: (d) => api.post('/attendance/manual-entry', d),
  daily: (eid, date) => api.get(`/attendance/daily/${eid}/${date}`),
  summaries: (eid, p) => api.get(`/attendance/summaries/${eid}`, { params: p }),
  analytics: (eid, m, y) => api.get(`/attendance/analytics/${eid}/${m}/${y}`),
  deptAnalytics: (did, m, y) => api.get(`/attendance/analytics/department/${did}/${m}/${y}`),
  adjustments: {
    create: (d) => api.post('/attendance/adjustments', d),
    approve: (id) => api.patch(`/attendance/adjustments/${id}/approve`),
    reject: (id, r) => api.patch(`/attendance/adjustments/${id}/reject`, { reason: r }),
  },
  leave: {
    types: (cid) => api.get(`/leave/companies/${cid}/types`),
    list: (eid, p) => api.get(`/leave/requests/${eid}`, { params: p }),
    create: (d) => api.post('/leave/requests', d),
    approve: (id) => api.patch(`/leave/requests/${id}/approve`),
    reject: (id, r) => api.patch(`/leave/requests/${id}/reject`, { reason: r }),
  },
}

// ── Overtime ──────────────────────────────────────────────────────────────────
export const overtimeApi = {
  list: (p) => api.get('/overtime', { params: p }),
  get: (id) => api.get(`/overtime/${id}`),
  create: (d) => api.post('/overtime', d),
  submit: (id) => api.post(`/overtime/${id}/submit`),
  cancel: (id) => api.delete(`/overtime/${id}`),
}

// ── Workflow ──────────────────────────────────────────────────────────────────
export const workflowApi = {
  definitions: {
    list: (cid) => api.get(`/workflows/definitions/companies/${cid}`),
    create: (cid, d) => api.post(`/workflows/definitions/companies/${cid}`, d),
    update: (id, d) => api.patch(`/workflows/definitions/${id}`, d),
  },
  instances: {
    get: (id) => api.get(`/workflows/instances/${id}`),
    pending: (p) => api.get('/workflows/instances/pending', { params: p }),
    approve: (id, d) => api.post(`/workflows/instances/${id}/approve`, d),
    reject: (id, d) => api.post(`/workflows/instances/${id}/reject`, d),
    trail: (id) => api.get(`/workflows/instances/${id}/audit-trail`),
  },
}

// ── Payroll ───────────────────────────────────────────────────────────────────
export const payrollApi = {
  list: (p) => api.get('/payroll', { params: p }),
  get: (id) => api.get(`/payroll/${id}`),
  process: (d) => api.post('/payroll/process', d),
  finalize: (id) => api.post(`/payroll/${id}/finalize`),
  slip: (id, eid) => api.get(`/payroll/${id}/employees/${eid}/slip`),
  components: {
    list: (cid) => api.get(`/payroll/components/${cid}`),
    create: (d) => api.post('/payroll/components', d),
    update: (id, d) => api.patch(`/payroll/components/${id}`, d),
    delete: (id) => api.delete(`/payroll/components/${id}`),
  },
  workSettings: {
    get: (cid) => api.get(`/payroll/work-settings/${cid}`),
    update: (cid, d) => api.patch(`/payroll/work-settings/${cid}`, d),
  },
}

// ── Documents ─────────────────────────────────────────────────────────────────
export const documentApi = {
  list: (p) => api.get('/documents', { params: p }),
  get: (id) => api.get(`/documents/${id}`),
  create: (d) => api.post('/documents', d),
  upload: (id, file) => {
    const f = new FormData(); f.append('file', file)
    return api.post(`/documents/${id}/upload`, f, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  acknowledge: (id, d) => api.post(`/documents/${id}/acknowledge`, d),
  mine: (p) => api.get('/my-documents', { params: p }),
  categories: {
    list: (cid) => api.get(`/documents/categories/${cid}`),
    create: (d) => api.post('/documents/categories', d),
  },
}

// ── Notifications ──────────────────────────────────────────────────────────────
export const notificationApi = {
  list: (p) => api.get('/notifications/me', { params: p }),
  markRead: (id) => api.post(`/notifications/${id}/mark-read`),
  markAllRead: () => api.post('/notifications/mark-all-read'),
  approvalCenter: (p) => api.get('/approval-center/pending', { params: p }),
  history: (p) => api.get('/approval-center/history', { params: p }),
  preferences: {
    get: () => api.get('/user/notification-preferences'),
    update: (d) => api.patch('/user/notification-preferences', d),
  },
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const userApi = {
  list: (p) => api.get('/users', { params: p }),
  get: (id) => api.get(`/users/${id}`),
  create: (d) => api.post('/users', d),
  update: (id, d) => api.patch(`/users/${id}`, d),
  delete: (id) => api.delete(`/users/${id}`),
  roles: {
    list: () => api.get('/roles'),
    assign: (uid, d) => api.post(`/users/${uid}/roles`, d),
  },
  permissions: {
    list: () => api.get('/permissions'),
    rolePerms: (role) => api.get(`/roles/${role}/permissions`),
    updateRolePerms: (role, d) => api.put(`/roles/${role}/permissions`, d),
  },
}

// ── Audit Logs ────────────────────────────────────────────────────────────────
export const auditApi = {
  list: (p) => api.get('/audit-logs', { params: p }),
  get: (id) => api.get(`/audit-logs/${id}`),
  userActivity: (uid, p) => api.get(`/audit-logs/reports/user-activity/${uid}`, { params: p }),
  anomalies: (p) => api.get('/audit-logs/anomalies/flagged', { params: p }),
}

// ── Reports ────────────────────────────────────────────────────────────────────
export const reportApi = {
  attendance: (p) => api.get('/reports/attendance', { params: p }),
  overtime: (p) => api.get('/reports/overtime', { params: p }),
  payroll: (p) => api.get('/reports/payroll', { params: p }),
  employees: (p) => api.get('/reports/employees', { params: p }),
  export: (type, p) => api.get(`/reports/${type}/export`, { params: p, responseType: 'blob' }),
}
