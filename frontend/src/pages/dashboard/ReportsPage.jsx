import { useEffect, useState, useRef } from 'react'
import { Download, Printer, Users, Clock, Coins, CalendarCheck, AlertTriangle, ChevronDown, ChevronRight, LayoutList } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getCompanies, getPayrolls, getEmployeeDepartments, getAttendanceReport, getOvertimeReport, getPayrollSlips, getRekapHarian, exportRekapHarianExcel } from '../../api/realService'
import { Card, CardHeader, CardTitle, CardBody, Select } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from '../../components/ui/Table'
import { fCurrency, fDuration, MONTHS_ID } from '../../lib/utils'

const TABS = [
  { label: 'Rekap Absensi', icon: CalendarCheck, color: 'text-purple-600 bg-purple-50' },
  { label: 'Rekap Harian', icon: LayoutList, color: 'text-blue-600 bg-blue-50' },
  { label: 'Rekap Lembur', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  { label: 'Slip Gaji', icon: Coins, color: 'text-green-600 bg-green-50' },
]

function exportToExcel(rows, headers, filename) {
  // Gunakan SheetJS yang sudah tersedia di bundle
  import('xlsx').then(XLSX => {
    const wsData = [headers, ...rows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Laporan')
    XLSX.writeFile(wb, `${filename}.xlsx`)
  }).catch(() => {
    // Fallback: CSV sederhana
    const csv = [headers, ...rows].map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
    a.download = `${filename}.csv`
    a.click()
  })
}

export default function ReportsPage() {
  const user = useAuthStore(s => s.user)
  const role = user?.roles?.[0]
  const isMultiCompany = ['coordinator', 'field_officer'].includes(role)

  const [tab, setTab] = useState(0)
  const [companies, setCompanies] = useState([])
  const [departments, setDepartments] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [company, setCompany] = useState(isMultiCompany ? '' : user.company_id)

  useEffect(() => {
    getCompanies().then(c => { setCompanies(c); if (!isMultiCompany && c.length) setCompany(c[0].id) })
    getPayrolls().then(setPayrolls)
  }, [])

  useEffect(() => {
    if (company) getEmployeeDepartments(company).then(setDepartments)
  }, [company])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Laporan</h2>
        <p className="text-sm text-gray-500 mt-0.5">Export dan cetak laporan operasional</p>
      </div>

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {TABS.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setTab(i)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === i ? `${t.color} ring-2 ring-offset-1 ring-current` : 'bg-white text-gray-500 ring-1 ring-gray-200 hover:bg-gray-50'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <AttendanceReport
          companies={companies} departments={departments}
          company={company} onCompanyChange={setCompany}
          isMultiCompany={isMultiCompany}
        />
      )}
      {tab === 1 && (
        <RekapHarian
          companies={companies} departments={departments}
          company={company} onCompanyChange={setCompany}
          isMultiCompany={isMultiCompany}
        />
      )}
      {tab === 2 && (
        <OvertimeReport
          companies={companies} departments={departments}
          company={company} onCompanyChange={setCompany}
          isMultiCompany={isMultiCompany}
        />
      )}
      {tab === 3 && (
        <PayrollSlipReport payrolls={payrolls} companies={companies} />
      )}
    </div>
  )
}

// ── Rekap Harian (Matrix) ──────────────────────────────────────────────────────
function RekapHarian({ companies, departments, company, onCompanyChange, isMultiCompany }) {
  const now = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [fromDate, setFromDate]   = useState(firstDay)
  const [toDate, setToDate]       = useState(lastDay)
  const [department, setDepartment] = useState('all')
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)

  async function load() {
    if (!company) return
    setLoading(true)
    try { setData(await getRekapHarian(company, fromDate, toDate, department)) }
    catch { setData(null) } finally { setLoading(false) }
  }

  async function handleExport() {
    if (!company) return
    setExporting(true)
    try {
      const res = await exportRekapHarianExcel({
        company_id: company, from_date: fromDate, to_date: toDate,
        department: department !== 'all' ? department : undefined,
      })
      const blob = res instanceof Blob ? res : new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `RekapHarian_${fromDate}_${toDate}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { } finally { setExporting(false) }
  }

  // Status cell styling
  const cellStyle = (s) => {
    if (!s) return 'text-gray-200'
    if (s === 'H') return 'text-green-700 font-semibold'
    if (s === 'A') return 'bg-amber-50 text-amber-700 font-semibold'
    if (s === 'S') return 'text-blue-600'
    if (s === 'I') return 'text-purple-600'
    if (s === '?') return 'bg-red-50 text-red-500'
    if (s === '-') return 'text-gray-300'
    return 'text-gray-500'
  }

  const dates  = data?.dates ?? []
  const rows   = data?.data  ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rekap Harian</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {/* Filter */}
        <div className="flex flex-wrap gap-2 items-end">
          {isMultiCompany && (
            <select value={company} onChange={e => onCompanyChange(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
              <option value="">-- Pilih Perusahaan --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div><label className="block text-[11px] text-gray-500 mb-1">Dari</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" /></div>
          <div><label className="block text-[11px] text-gray-500 mb-1">Sampai</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" /></div>
          <select value={department} onChange={e => setDepartment(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Departemen</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button variant="primary" loading={loading} onClick={load}>Tampilkan</Button>
          {data && <Button variant="secondary" icon={Download} loading={exporting} onClick={handleExport}>Export Excel</Button>}
        </div>

        {data && (
          <>
            {/* Company header */}
            <div className="text-xs text-gray-500 space-y-0.5">
              <div className="flex gap-2"><span className="w-32 font-medium">Kantor</span><span>: {data.company}</span></div>
              <div className="flex gap-2"><span className="w-32 font-medium">Periode Absensi</span><span>: {fromDate} s/d {toDate}</span></div>
            </div>

            {/* Legend */}
            <div className="flex gap-4 text-xs text-gray-500 flex-wrap">
              {[['H','Hadir','text-green-700'],['A','Absen','text-amber-700'],['S','Sakit','text-blue-600'],['I','Ijin','text-purple-600'],['?','Gantung','text-red-500'],['-','Libur','text-gray-400']].map(([k,v,c]) => (
                <span key={k} className="flex items-center gap-1"><b className={c}>{k}</b> = {v}</span>
              ))}
            </div>

            {/* Matrix table */}
            <div className="overflow-auto max-h-[70vh] border border-gray-200 rounded-lg">
              <table className="text-xs border-collapse" style={{ minWidth: dates.length * 32 + 500 }}>
                <thead>
                  {/* Row 1: group headers */}
                  <tr className="bg-gray-100">
                    <th rowSpan={2} className="sticky left-0 z-30 bg-gray-100 border border-gray-200 px-2 py-1 text-center whitespace-nowrap" style={{ minWidth: 40 }}>No</th>
                    <th rowSpan={2} className="sticky z-30 bg-gray-100 border border-gray-200 px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 140, left: 40 }}>Nama</th>
                    <th rowSpan={2} className="sticky z-30 bg-gray-100 border border-gray-200 px-2 py-1 text-left whitespace-nowrap" style={{ minWidth: 80, left: 180 }}>Dept</th>
                    <th colSpan={dates.length} className="border border-gray-200 px-2 py-1 text-center bg-blue-50 text-blue-800 font-semibold">PERIODE ABSEN KARYAWAN</th>
                    <th colSpan={2} className="border border-gray-200 px-2 py-1 text-center bg-green-50 text-green-800 font-semibold">KEHADIRAN</th>
                    <th colSpan={5} className="border border-gray-200 px-2 py-1 text-center bg-red-50 text-red-800 font-semibold">KETIDAKHADIRAN</th>
                    <th colSpan={2} className="border border-gray-200 px-2 py-1 text-center bg-amber-50 text-amber-800 font-semibold">LEMBUR</th>
                  </tr>
                  {/* Row 2: date + summary columns */}
                  <tr className="bg-gray-50">
                    {dates.map(d => (
                      <th key={d} className="border border-gray-200 px-1 py-1 text-center font-medium text-gray-600" style={{ minWidth: 28 }}>
                        {new Date(d).getDate()}
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600 whitespace-nowrap">Total</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600 whitespace-nowrap">Durasi</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600">A</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600">S</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600">I</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600">⚠</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600 whitespace-nowrap">Total</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600 whitespace-nowrap">Hari</th>
                    <th className="border border-gray-200 px-2 py-1 text-center text-gray-600 whitespace-nowrap">Durasi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={dates.length + 12} className="text-center py-8 text-gray-400">Tidak ada data</td></tr>
                  )}
                  {rows.map((r, idx) => (
                    <tr key={r.employee_id} className="hover:bg-blue-50/30 border-b border-gray-100">
                      <td className="sticky left-0 z-10 bg-white border border-gray-100 px-2 py-1 text-center text-gray-400" style={{ left: 0 }}>{idx + 1}</td>
                      <td className="sticky z-10 bg-white border border-gray-100 px-2 py-1 font-medium text-gray-900" style={{ left: 40 }}>{r.name}</td>
                      <td className="sticky z-10 bg-white border border-gray-100 px-2 py-1 text-gray-500" style={{ left: 180 }}>{r.department}</td>
                      {dates.map(d => (
                        <td key={d} className={`border border-gray-100 px-1 py-1 text-center ${cellStyle(r.daily[d])}`}>
                          {r.daily[d] ?? ''}
                        </td>
                      ))}
                      {/* Kehadiran */}
                      <td className="border border-gray-100 px-2 py-1 text-center font-semibold text-green-700">{r.hadir}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center font-mono text-green-700">{r.durasi_kerja}</td>
                      {/* Ketidakhadiran */}
                      <td className="border border-gray-100 px-2 py-1 text-center text-amber-700">{r.absen || '-'}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center text-blue-600">{r.sakit || '-'}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center text-purple-600">{r.ijin || '-'}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center text-red-500">{r.gantung || '-'}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center text-red-700 font-semibold">{(r.absen + r.sakit + r.ijin + r.gantung) || '-'}</td>
                      {/* Lembur */}
                      <td className="border border-gray-100 px-2 py-1 text-center text-amber-600">{r.lembur_hari || '-'}</td>
                      <td className="border border-gray-100 px-2 py-1 text-center font-mono text-amber-600">{r.durasi_lembur !== '0:00' ? r.durasi_lembur : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ── Rekap Absensi ──────────────────────────────────────────────────────────────
function AttendanceReport({ companies, departments, company, onCompanyChange, isMultiCompany }) {
  const now = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)

  const [fromDate, setFromDate] = useState(firstDay)
  const [toDate, setToDate] = useState(lastDay)
  const [department, setDepartment] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!company) return
    setLoading(true)
    try {
      const res = await getAttendanceReport(company, fromDate, toDate, department)
      setData(res)
    } catch { setData(null) } finally { setLoading(false) }
  }

  function handleExport() {
    if (!data?.data?.length) return
    const headers = ['NIK', 'Nama', 'Departemen', 'Jabatan', 'Hadir', 'Absen', 'Telat', 'Pulang Cepat', 'Cuti', 'Data Gantung', 'Total Lembur (Jam)', 'Total Kerja (Jam)']
    const rows = data.data.map(r => [r.nik, r.name, r.department, r.position, r.hari_hadir, r.hari_absen, r.hari_telat, r.hari_pulang_cepat, r.hari_cuti, r.data_gantung, r.total_lembur_jam, r.total_kerja_jam])
    exportToExcel(rows, headers, `rekap-absensi-${fromDate}-${toDate}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rekap Absensi</CardTitle>
        {data && <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>Export Excel</Button>}
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          {isMultiCompany && (
            <select value={company} onChange={e => onCompanyChange(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
              <option value="">-- Pilih Perusahaan --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Dari</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
          </div>
          <div>
            <label className="block text-[11px] text-gray-500 mb-1">Sampai</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
          </div>
          <select value={department} onChange={e => setDepartment(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Departemen</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button variant="primary" loading={loading} onClick={load}>Tampilkan</Button>
        </div>

        {data && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-green-700">{data.data.reduce((s, r) => s + r.hari_hadir, 0)}</p>
                <p className="text-xs text-green-600">Total Hadir</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-red-700">{data.data.reduce((s, r) => s + r.hari_absen, 0)}</p>
                <p className="text-xs text-red-600">Total Absen</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-700">{data.data.reduce((s, r) => s + r.total_lembur_jam, 0).toFixed(1)}j</p>
                <p className="text-xs text-amber-600">Total Lembur</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center ring-1 ring-red-200">
                <p className="text-xl font-bold text-red-700">{data.data.reduce((s, r) => s + r.data_gantung, 0)}</p>
                <p className="text-xs text-red-600">⚠ Data Gantung</p>
              </div>
            </div>

            <Table>
              <Thead><Tr>
                <Th>NIK</Th><Th>Nama</Th><Th>Dept</Th>
                <Th className="text-center">Hadir</Th><Th className="text-center">Absen</Th>
                <Th className="text-center">Telat</Th><Th className="text-center">Cepat</Th>
                <Th className="text-center">Cuti</Th><Th className="text-center">⚠</Th>
                <Th className="text-right">Lembur</Th><Th className="text-right">Jam Kerja</Th>
              </Tr></Thead>
              <Tbody>
                {data.data.length === 0 ? <TableEmpty colSpan={11} /> : data.data.map(r => (
                  <Tr key={r.employee_id}>
                    <Td className="font-mono text-xs text-gray-400">{r.nik}</Td>
                    <Td className="font-medium text-gray-900">{r.name}</Td>
                    <Td className="text-xs text-gray-500">{r.department}</Td>
                    <Td className="text-center font-semibold text-green-700">{r.hari_hadir}</Td>
                    <Td className="text-center text-red-600">{r.hari_absen || '-'}</Td>
                    <Td className="text-center text-amber-600">{r.hari_telat || '-'}</Td>
                    <Td className="text-center text-orange-600">{r.hari_pulang_cepat || '-'}</Td>
                    <Td className="text-center text-blue-600">{r.hari_cuti || '-'}</Td>
                    <Td className="text-center">{r.data_gantung > 0 ? <span className="text-red-600 font-medium">{r.data_gantung}</span> : '-'}</Td>
                    <Td className="text-right font-mono text-xs text-amber-700">{r.total_lembur_jam > 0 ? `${r.total_lembur_jam}j` : '-'}</Td>
                    <Td className="text-right font-mono text-xs text-gray-600">{r.total_kerja_jam}j</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ── Rekap Lembur ───────────────────────────────────────────────────────────────
function OvertimeReport({ companies, departments, company, onCompanyChange, isMultiCompany }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [department, setDepartment] = useState('all')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(null)

  async function load() {
    if (!company) return
    setLoading(true)
    try {
      const res = await getOvertimeReport(company, month, year, department)
      setData(res)
    } catch { setData(null) } finally { setLoading(false) }
  }

  function handleExport() {
    if (!data?.data?.length) return
    const headers = ['NIK', 'Nama', 'Departemen', 'Hari Lembur', 'Total Jam', 'SPL Ada', 'Warning']
    const rows = data.data.map(r => [r.nik, r.name, r.department, r.hari_lembur, r.total_jam, r.terverifikasi, r.warning])
    exportToExcel(rows, headers, `rekap-lembur-${year}-${String(month).padStart(2,'0')}`)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rekap Lembur</CardTitle>
        {data && <Button variant="secondary" size="sm" icon={Download} onClick={handleExport}>Export Excel</Button>}
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap gap-2 items-end">
          {isMultiCompany && (
            <select value={company} onChange={e => onCompanyChange(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
              <option value="">-- Pilih Perusahaan --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={department} onChange={e => setDepartment(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Departemen</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <Button variant="primary" loading={loading} onClick={load}>Tampilkan</Button>
        </div>

        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-700">{data.meta.total_employees}</p>
                <p className="text-xs text-amber-600">Karyawan Lembur</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-amber-700">{data.meta.total_overtime_jam}j</p>
                <p className="text-xs text-amber-600">Total Jam Lembur</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center ring-1 ring-red-100">
                <p className="text-xl font-bold text-red-700">{data.data.reduce((s, r) => s + r.warning, 0)}</p>
                <p className="text-xs text-red-600">Lembur Tanpa SPL</p>
              </div>
            </div>

            <Table>
              <Thead><Tr>
                <Th className="w-8"></Th><Th>NIK</Th><Th>Nama</Th><Th>Departemen</Th>
                <Th className="text-center">Hari Lembur</Th>
                <Th className="text-right">Total Jam</Th>
                <Th className="text-center">SPL Ada</Th>
                <Th className="text-center">⚠ Warning</Th>
              </Tr></Thead>
              <Tbody>
                {data.data.length === 0 ? <TableEmpty colSpan={8} /> : data.data.map(r => (
                  <>
                    <Tr key={r.employee_id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === r.employee_id ? null : r.employee_id)}>
                      <Td>{expanded === r.employee_id ? <ChevronDown size={13} className="text-gray-400" /> : <ChevronRight size={13} className="text-gray-400" />}</Td>
                      <Td className="font-mono text-xs text-gray-400">{r.nik}</Td>
                      <Td className="font-medium text-gray-900">{r.name}</Td>
                      <Td className="text-xs text-gray-500">{r.department}</Td>
                      <Td className="text-center">{r.hari_lembur}</Td>
                      <Td className="text-right font-mono text-xs font-semibold text-amber-700">{r.total_jam}j</Td>
                      <Td className="text-center text-green-700">{r.terverifikasi}</Td>
                      <Td className="text-center">{r.warning > 0 ? <span className="text-red-600 font-semibold">{r.warning}</span> : '-'}</Td>
                    </Tr>
                    {expanded === r.employee_id && r.detail.map(d => (
                      <Tr key={d.date} className="bg-gray-50 text-xs">
                        <Td></Td>
                        <Td colSpan={2} className="text-gray-400 pl-8">{d.date}</Td>
                        <Td className="text-gray-500">{d.shift_type === 'holiday' ? 'Hari Libur' : 'Hari Kerja'}</Td>
                        <Td className="text-center">{Math.round(d.overtime_minutes / 60 * 10) / 10}j</Td>
                        <Td colSpan={3} className="text-center">
                          {d.overtime_verified === true && <span className="text-green-600">✓ SPL</span>}
                          {d.overtime_verified === false && <span className="text-amber-600 flex items-center gap-1"><AlertTriangle size={11} /> Tidak ada SPL</span>}
                        </Td>
                      </Tr>
                    ))}
                  </>
                ))}
              </Tbody>
            </Table>
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ── Slip Gaji ──────────────────────────────────────────────────────────────────
function PayrollSlipReport({ payrolls, companies }) {
  const [selectedPayrollId, setSelectedPayrollId] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedSlip, setSelectedSlip] = useState(null)
  const printRef = useRef(null)

  async function load() {
    if (!selectedPayrollId) return
    setLoading(true)
    try {
      const res = await getPayrollSlips(selectedPayrollId)
      setData(res)
      setSelectedSlip(null)
    } catch { setData(null) } finally { setLoading(false) }
  }

  function handlePrint() {
    const printWin = window.open('', '_blank')
    printWin.document.write(`
      <html><head><title>Slip Gaji</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
        h2 { font-size: 16px; margin-bottom: 4px; }
        .sub { color: #666; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { padding: 6px 8px; border: 1px solid #ddd; text-align: left; }
        th { background: #f5f5f5; }
        .right { text-align: right; }
        .total { font-weight: bold; background: #f0f0f0; }
        .net { font-size: 14px; font-weight: bold; color: #16a34a; }
        hr { margin: 12px 0; border-color: #ddd; }
        @media print { @page { margin: 10mm; } }
      </style></head><body>
      ${printRef.current?.innerHTML || ''}
      </body></html>
    `)
    printWin.document.close()
    printWin.print()
  }

  function handleExportAllExcel() {
    if (!data?.slips?.length) return
    const headers = ['NIK', 'Nama', 'Departemen', 'Jabatan', 'Hari Kerja', 'Jam Kerja', 'Jam Lembur', 'Gaji Bruto', 'Potongan', 'Gaji Neto']
    const rows = data.slips.map(s => [s.nik, s.name, s.department, s.position, s.total_work_days, s.total_work_hours, s.total_overtime_hours, s.gross_salary, s.total_deduction, s.net_salary])
    exportToExcel(rows, headers, `rekap-gaji-${data.payroll.period_month}-${data.payroll.period_year}`)
  }

  const slipToPrint = selectedSlip ?? (data?.slips?.length === 1 ? data.slips[0] : null)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Slip Gaji</CardTitle></CardHeader>
        <CardBody>
          <div className="flex flex-wrap gap-2 items-end">
            <select value={selectedPayrollId} onChange={e => setSelectedPayrollId(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none min-w-[220px]">
              <option value="">-- Pilih Periode Payroll --</option>
              {payrolls.map(p => (
                <option key={p.id} value={p.id}>{p.companyName} — {MONTHS_ID[p.period_month - 1]} {p.period_year} ({p.status})</option>
              ))}
            </select>
            <Button variant="primary" loading={loading} onClick={load}>Muat Data</Button>
          </div>
        </CardBody>
      </Card>

      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Daftar karyawan */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Karyawan ({data.slips.length})</CardTitle>
              <Button variant="secondary" size="sm" icon={Download} onClick={handleExportAllExcel}>Excel</Button>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                {data.slips.map(s => (
                  <button
                    key={s.employee_id}
                    onClick={() => setSelectedSlip(s)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${selectedSlip?.employee_id === s.employee_id ? 'bg-brand-light' : ''}`}
                  >
                    <p className="text-sm font-medium text-gray-900">{s.name}</p>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-xs text-gray-400">{s.department}</span>
                      <span className="text-xs font-semibold text-green-700">{fCurrency(s.net_salary)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Slip preview */}
          <div className="lg:col-span-2">
            {slipToPrint ? (
              <Card>
                <CardHeader>
                  <CardTitle>Preview Slip</CardTitle>
                  <Button variant="secondary" size="sm" icon={Printer} onClick={handlePrint}>Cetak / PDF</Button>
                </CardHeader>
                <CardBody>
                  <div ref={printRef}>
                    <SlipPreview slip={slipToPrint} payroll={data.payroll} />
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card className="flex items-center justify-center h-64">
                <p className="text-gray-400 text-sm">Pilih karyawan di sebelah kiri untuk melihat slip gaji</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SlipPreview({ slip, payroll }) {
  return (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div className="border-b border-gray-200 pb-3">
        <h2 className="text-base font-bold text-gray-900">{payroll.company?.name}</h2>
        <p className="text-gray-500 text-xs">{payroll.company?.address}</p>
        <p className="text-xs font-semibold text-gray-700 mt-2 uppercase tracking-wide">Slip Gaji — {MONTHS_ID[payroll.period_month - 1]} {payroll.period_year}</p>
      </div>

      {/* Info karyawan */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <div className="flex justify-between"><span className="text-gray-500">Nama</span><span className="font-medium">{slip.name}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">NIK</span><span className="font-mono">{slip.nik}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Departemen</span><span>{slip.department}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Jabatan</span><span>{slip.position}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Hari Kerja</span><span>{slip.total_work_days} hari</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Hari Kerja Efektif</span><span>{payroll.effective_work_days ?? '-'} hari</span></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pendapatan */}
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase mb-2 tracking-wide">Pendapatan</p>
          <table className="w-full text-xs">
            <tbody>
              {slip.earnings.map((e, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-600">{e.name}</td>
                  <td className="py-1.5 text-right font-mono text-gray-900">
                    {e.calc === 'daily_wage_rate' ? `Rp ${fCurrency(e.value).replace('Rp', '').trim()}` :
                     ['attendance_earning', 'overtime_regular', 'overtime_holiday', 'fixed', 'per_hari', 'percentage'].includes(e.calc) ?
                     fCurrency(e.value) : <span className="text-gray-400 italic">otomatis</span>}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 text-gray-700">Total Pendapatan</td>
                <td className="py-2 text-right font-mono text-green-700">{fCurrency(slip.gross_salary)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Potongan */}
        <div>
          <p className="text-xs font-semibold text-gray-700 uppercase mb-2 tracking-wide">Potongan</p>
          <table className="w-full text-xs">
            <tbody>
              {slip.deductions.length === 0 && <tr><td className="text-gray-400 italic py-1.5">Tidak ada potongan</td></tr>}
              {slip.deductions.map((d, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1.5 text-gray-600">{d.name}</td>
                  <td className="py-1.5 text-right font-mono text-red-600">{fCurrency(d.value)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2 text-gray-700">Total Potongan</td>
                <td className="py-2 text-right font-mono text-red-700">{fCurrency(slip.total_deduction)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gaji Neto */}
      <div className="bg-green-50 rounded-xl p-4 ring-1 ring-green-200 flex items-center justify-between">
        <div>
          <p className="text-xs text-green-700 font-medium">GAJI DITERIMA (NETO)</p>
          <p className="text-xs text-green-600 mt-0.5">Bruto {fCurrency(slip.gross_salary)} − Potongan {fCurrency(slip.total_deduction)}</p>
        </div>
        <p className="text-2xl font-bold text-green-700">{fCurrency(slip.net_salary)}</p>
      </div>
    </div>
  )
}
