import { clsx } from 'clsx'
import { format, formatDistanceToNow, parseISO, isValid } from 'date-fns'
import { id as idLocale } from 'date-fns/locale'

// ── Class merge ───────────────────────────────────────────────────────────────
export function cn(...args) { return clsx(args) }

// ── Date helpers ──────────────────────────────────────────────────────────────
export function fDate(date, fmt = 'd MMM yyyy') {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? format(d, fmt, { locale: idLocale }) : '-'
}

export function fDateTime(date) { return fDate(date, 'd MMM yyyy, HH:mm') }
export function fTime(time) {
  if (!time) return '-'
  if (time.length === 5) return time
  const d = typeof time === 'string' ? parseISO(time) : time
  return isValid(d) ? format(d, 'HH:mm') : time
}
export function fRelative(date) {
  if (!date) return '-'
  const d = typeof date === 'string' ? parseISO(date) : date
  return isValid(d) ? formatDistanceToNow(d, { addSuffix: true, locale: idLocale }) : '-'
}
export function fMonthYear(m, y) {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${months[m - 1]} ${y}`
}

// ── Number helpers ────────────────────────────────────────────────────────────
export function fCurrency(n) {
  if (n == null) return '-'
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
export function fNumber(n) {
  if (n == null) return '-'
  return new Intl.NumberFormat('id-ID').format(n)
}
export function fDuration(minutes) {
  if (!minutes && minutes !== 0) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}j`
  return `${h}j ${m}m`
}
export function fPercent(n, decimals = 1) {
  if (n == null) return '-'
  return `${Number(n).toFixed(decimals)}%`
}

// ── Status configs ────────────────────────────────────────────────────────────
export const STATUS_COLORS = {
  active: 'bg-green-50 text-green-700 ring-green-200',
  inactive: 'bg-gray-50 text-gray-600 ring-gray-200',
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  submitted: 'bg-blue-50 text-blue-700 ring-blue-200',
  approved: 'bg-green-50 text-green-700 ring-green-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
  draft: 'bg-gray-50 text-gray-600 ring-gray-200',
  processing: 'bg-amber-50 text-amber-700 ring-amber-200',
  finalized: 'bg-green-50 text-green-700 ring-green-200',
  present: 'bg-green-50 text-green-700 ring-green-200',
  absent: 'bg-red-50 text-red-700 ring-red-200',
  late: 'bg-amber-50 text-amber-700 ring-amber-200',
  early_leave: 'bg-orange-50 text-orange-700 ring-orange-200',
  on_leave: 'bg-blue-50 text-blue-700 ring-blue-200',
  holiday: 'bg-purple-50 text-purple-700 ring-purple-200',
  rest_day: 'bg-gray-50 text-gray-600 ring-gray-200',
  incomplete: 'bg-red-50 text-red-700 ring-red-300', // Kondisi 4 Hybrid — perlu resolusi HRD
  cancelled: 'bg-gray-50 text-gray-600 ring-gray-200',
  suspended: 'bg-orange-50 text-orange-700 ring-orange-200',
}

export const STATUS_LABELS = {
  active: 'Aktif', inactive: 'Nonaktif', pending: 'Menunggu',
  submitted: 'Diajukan', approved: 'Disetujui', rejected: 'Ditolak',
  draft: 'Draft', processing: 'Diproses', finalized: 'Final',
  present: 'Hadir', absent: 'Absen', late: 'Terlambat',
  early_leave: 'Pulang Cepat', on_leave: 'Cuti', holiday: 'Libur',
  rest_day: 'Hari Libur', incomplete: '⚠ Gantung',
  cancelled: 'Dibatalkan', suspended: 'Ditangguhkan',
}

export function getStatusBadge(status) {
  return STATUS_COLORS[status] || 'bg-gray-50 text-gray-600 ring-gray-200'
}
export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status
}

// ── Role configs ──────────────────────────────────────────────────────────────
export const ROLE_LABELS = {
  coordinator: 'Koordinator',
  field_officer: 'Petugas Lapangan',
  hrd: 'Staff HRD',
  staff_dept: 'Staff Departemen',
  super_admin: 'Super Admin',
}

export const ROLE_COLORS = {
  coordinator: 'bg-purple-50 text-purple-700 ring-purple-200',
  field_officer: 'bg-blue-50 text-blue-700 ring-blue-200',
  hrd: 'bg-green-50 text-green-700 ring-green-200',
  staff_dept: 'bg-amber-50 text-amber-700 ring-amber-200',
  super_admin: 'bg-red-50 text-red-700 ring-red-200',
}

// ── Misc ──────────────────────────────────────────────────────────────────────
export function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function generateOTNumber(companyCode, date) {
  const d = new Date(date)
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  const seq = String(Math.floor(Math.random() * 900) + 100)
  return `OT-${companyCode}-${ym}-${seq}`
}

export function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export const MONTHS_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export function currentMonth() { return new Date().getMonth() + 1 }
export function currentYear() { return new Date().getFullYear() }
