import { useEffect, useState } from 'react'
import { Building2, Users, Clock, Coins, Calendar, ArrowUpRight, UserCheck, TrendingUp, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, Area, AreaChart } from 'recharts'
import { useAuthStore } from '../../stores/authStore'
import { getDashboardStats, getOvertimeRequests, getPayrolls, getCompanies } from '../../api/realService'
import api from '../../api/index'
import { Card, CardHeader, CardTitle, CardBody, Skeleton } from '../../components/ui/Primitives'
import Badge from '../../components/ui/Badge'
import { fDate, MONTHS_ID } from '../../lib/utils'
import { Link } from 'react-router-dom'

const COLORS = ['#3b82f6','#ef4444','#f59e0b','#22c55e','#8b5cf6','#06b6d4']
const COMPANY_COLORS = ['#6366f1','#ec4899','#06b6d4','#10b981','#f59e0b','#ef4444']

function StatCard({ label, value, sub, icon: Icon, color = 'brand' }) {
  const colorMap = { brand:'bg-blue-50 text-blue-600', green:'bg-green-50 text-green-600', amber:'bg-amber-50 text-amber-600', purple:'bg-purple-50 text-purple-600', teal:'bg-teal-50 text-teal-600' }
  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}><Icon size={17} /></div>
      </div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  )
}

// ── Daily Monitoring Donut ─────────────────────────────────────────────────────
function DailyMonitoring({ companies, company, isMulti }) {
  const [data, setData] = useState(null)
  const [selCompany, setSelCompany] = useState(company || '')
  const [loading, setLoading] = useState(false)

  useEffect(() => { load() }, [selCompany])

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/dashboard/monitoring', { params: { company_id: selCompany || undefined } })
      setData(res.data)
    } catch {} finally { setLoading(false) }
  }

  const total = data?.total ?? 0
  const pieData = data ? [
    { name: 'Tepat Waktu', value: data.tepat_waktu },
    { name: 'Tidak Hadir', value: data.tidak_hadir },
    { name: 'Terlambat',   value: data.terlambat },
    { name: 'Izin',        value: data.izin },
    { name: 'Gantung',     value: data.gantung },
  ] : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informasi Daily Monitoring</CardTitle>
        <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
      </CardHeader>
      <CardBody>
        {isMulti && (
          <select value={selCompany} onChange={e => setSelCompany(e.target.value)} className="mb-3 w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white outline-none">
            <option value="">Semua Kantor</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="flex justify-center">
          <ResponsiveContainer width={160} height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={2}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} orang`]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center -mt-6 mb-4">
          <p className="text-2xl font-bold text-gray-800">{total}</p>
          <p className="text-xs text-gray-400">Total Karyawan</p>
        </div>
        <div className="space-y-1.5 text-xs">
          {[['Tepat Waktu', data?.tepat_waktu, data?.pct_tepat, 0], ['Tidak Hadir', data?.tidak_hadir, data?.pct_tidak, 1], ['Terlambat', data?.terlambat, data?.pct_lambat, 2], ['Izin', data?.izin, data?.pct_izin, 3]].map(([label, val, pct, ci]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 w-24 shrink-0">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[ci] }} />
                <span className="text-gray-600">{label}</span>
              </div>
              <span className="font-semibold text-gray-800">: {val ?? 0} Karyawan</span>
              <span className="text-gray-400 w-12 text-right">{pct ?? 0}%</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// ── Chart Performa Kehadiran per Minggu ────────────────────────────────────────
function ChartPerforma() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [data, setData] = useState(null)

  useEffect(() => { load() }, [month, year])

  async function load() {
    try {
      const res = await api.get('/dashboard/chart-weekly', { params: { month, year } })
      setData(res.data)
    } catch {}
  }

  const chartData = data ? (data.weeks || []).map((w, i) => {
    const point = { name: w }
    ;(data.series || []).forEach(s => { point[s.name] = s.data[i] })
    return point
  }) : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performa Kehadiran Karyawan</CardTitle>
        <div className="flex gap-1.5 items-center">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white outline-none">
            {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className="px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white outline-none">
            {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
            <defs>
              {(data?.series || []).map((s, i) => (
                <linearGradient key={s.name} id={`grad${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COMPANY_COLORS[i % COMPANY_COLORS.length]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COMPANY_COLORS[i % COMPANY_COLORS.length]} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={35} />
            <Tooltip formatter={(v, name) => [`${v}%`, name]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
            {(data?.series || []).map((s, i) => (
              <Area key={s.name} type="monotone" dataKey={s.name}
                stroke={COMPANY_COLORS[i % COMPANY_COLORS.length]} strokeWidth={2}
                fill={`url(#grad${i})`} dot={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  )
}

// ── Kalender dengan libur ──────────────────────────────────────────────────────
function KalenderWidget({ company }) {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear]   = useState(now.getFullYear())
  const [holidays, setHolidays] = useState([])

  useEffect(() => { loadHolidays() }, [month, year, company])

  async function loadHolidays() {
    try {
      const res = await api.get('/dashboard/kalender', { params: { month: month + 1, year, company_id: company || undefined } })
      setHolidays(res.data || [])
    } catch {}
  }

  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDay = (firstDay.getDay() + 6) % 7 // Monday = 0
  const holidayMap = {}
  holidays.forEach(h => { holidayMap[h.day] = h })
  const today = now.getDate()
  const isCurrentMonth = now.getMonth() === month && now.getFullYear() === year

  function prev() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function next() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const cells = []
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kalender</CardTitle>
        <div className="flex items-center gap-2">
          <button onClick={prev} className="p-1 hover:bg-gray-100 rounded">‹</button>
          <span className="text-sm font-medium">{MONTHS_ID[month]}</span>
          <button onClick={next} className="p-1 hover:bg-gray-100 rounded">›</button>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] mb-1 text-gray-400 font-medium">
          {['M','S','S','R','K','J','S'].map((d, i) => <div key={i}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />
            const h = holidayMap[d]
            const isSun = (startDay + d - 1) % 7 === 6
            const isToday = isCurrentMonth && d === today
            return (
              <div key={i} title={h?.name}
                className={`py-1 rounded text-[11px] cursor-default select-none
                  ${isToday ? 'bg-blue-600 text-white font-bold' : ''}
                  ${!isToday && h ? 'text-red-500 font-semibold' : ''}
                  ${!isToday && !h && isSun ? 'text-red-400' : ''}
                  ${!isToday && !h && !isSun ? 'text-gray-600' : ''}
                `}
              >
                {d}
                {h && !isToday && <div className="w-1 h-1 rounded-full bg-red-400 mx-auto mt-0.5" />}
              </div>
            )
          })}
        </div>
        {holidays.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
            <p className="text-[10px] text-gray-400 font-medium">Keterangan</p>
            {holidays.slice(0, 5).map((h, i) => (
              <div key={i} className="flex gap-1.5 text-[11px]">
                <span className="text-red-500 shrink-0">• {h.day} {MONTHS_ID[month].slice(0,3)}</span>
                <span className="text-gray-600 truncate">{h.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Karyawan Indisipliner ──────────────────────────────────────────────────────
function IndisiplinerWidget({ company }) {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo]     = useState(today)
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState(null)

  async function load(p = 1) {
    try {
      const res = await api.get('/dashboard/indisipliner', { params: { company_id: company || undefined, from_date: from, to_date: to, page: p } })
      setData(res.data); setMeta(res.meta); setPage(p)
    } catch {}
  }

  return (
    <Card>
      <CardHeader><CardTitle>Karyawan Indisipliner</CardTitle></CardHeader>
      <CardBody className="space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white outline-none" />
          <span className="text-gray-400">→</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white outline-none" />
          <button onClick={() => load(1)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Tampilkan</button>
        </div>
        {data && (
          <>
            <div className="space-y-2">
              {data.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Tidak ada data</p>}
              {data.map((r, i) => (
                <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-50">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                      {(r.employee?.name || '-').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">{r.employee?.name}</p>
                      <p className="text-[11px] text-gray-400">{r.employee?.department} · {fDate(r.attendance_date)}</p>
                    </div>
                  </div>
                  <span className="text-xs text-red-500 font-medium shrink-0">● Alpha</span>
                </div>
              ))}
            </div>
            {meta && meta.last_page > 1 && (
              <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-2 py-1 border rounded disabled:opacity-40">‹</button>
                <span>Halaman {page} dari {meta.last_page}</span>
                <button disabled={page >= meta.last_page} onClick={() => load(page + 1)} className="px-2 py-1 border rounded disabled:opacity-40">›</button>
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  )
}

// ── Data Karyawan Belum Lengkap ────────────────────────────────────────────────
function BelumLengkapWidget({ company }) {
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState(null)

  useEffect(() => { load(1) }, [company])

  async function load(p = 1) {
    try {
      const res = await api.get('/dashboard/belum-lengkap', { params: { company_id: company || undefined, page: p } })
      setData(res.data); setMeta(res.meta); setPage(p)
    } catch {}
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Karyawan Belum Lengkap</CardTitle>
        <Link to="/employees" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
          Lihat Semua <ArrowUpRight size={12} />
        </Link>
      </CardHeader>
      <CardBody className="space-y-2">
        {!data && <Skeleton className="h-32" />}
        {data?.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-gray-400">
            <CheckCircle size={24} className="text-green-400" />
            <p className="text-xs">Semua data karyawan sudah lengkap</p>
          </div>
        )}
        {data?.map((emp, i) => (
          <div key={i} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-gray-800 truncate max-w-[180px]">{emp.name}</span>
              <span className="text-gray-500 shrink-0">{emp.pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${emp.pct}%` }} />
            </div>
          </div>
        ))}
        {meta && meta.last_page > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
            <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-2 py-1 border rounded disabled:opacity-40">‹</button>
            <span>Halaman {page} dari {meta.last_page}</span>
            <button disabled={page >= meta.last_page} onClick={() => load(page + 1)} className="px-2 py-1 border rounded disabled:opacity-40">›</button>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const user    = useAuthStore(s => s.user)
  const company = useAuthStore(s => s.company)
  const [stats, setStats]       = useState(null)
  const [recentOT, setRecentOT] = useState([])
  const [payrolls, setPayrolls] = useState([])
  const [companies, setCompanies] = useState([])
  const role = user?.roles?.[0]
  const isMulti = ['coordinator', 'field_officer', 'super_admin'].includes(role)
  const companyId = isMulti ? null : (user?.company_id || company?.id)

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setStats(r.data))
    getOvertimeRequests({ company_id: isMulti ? 'all' : companyId, status: 'pending' }).then(r => setRecentOT((r || []).slice(0, 5)))
    if (['coordinator','super_admin'].includes(role)) {
      getPayrolls().then(p => setPayrolls((p || []).slice(0, 4)))
      getCompanies().then(setCompanies)
    }
  }, [user])

  const today = new Date()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Selamat datang, {user?.name?.split(' ')[0]} 👋</h2>
          <p className="text-sm text-gray-500 mt-0.5">{isMulti ? 'Ringkasan data seluruh outsourcing' : `Ringkasan ${company?.name || ''}`}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2">
          <Calendar size={13} />
          {today.toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
        </div>
      </div>

      {/* Stat Cards */}
      {!stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {isMulti && <StatCard label="Total Perusahaan" value={stats.totalCompanies} sub="Semua aktif" icon={Building2} color="brand" />}
          <StatCard label="Total Karyawan" value={stats.totalEmployees} sub="Karyawan aktif" icon={Users} color="green" />
          <StatCard label="Hadir Hari Ini" value={stats.today?.hadir} sub={stats.today?.absen > 0 ? `${stats.today.absen} absen · ${stats.today.gantung} gantung` : 'Tidak ada absen'} icon={UserCheck} color="teal" />
          <StatCard label="Lembur Pending" value={stats.overtime?.pending} sub="Menunggu persetujuan" icon={Clock} color="amber" />
          {['coordinator','super_admin'].includes(role) && (
            <StatCard label="Penggajian Bulan Ini" value={`${stats.payroll?.finalized} Final`} sub={stats.payroll?.processing > 0 ? `${stats.payroll.processing} sedang diproses` : 'Semua final'} icon={Coins} color="purple" />
          )}
          <StatCard label="Total Lembur Bulan Ini" value={`${stats.thisMonth?.ot_hours}j`} sub={`${stats.overtime?.approved} SPL disetujui`} icon={TrendingUp} color="brand" />
        </div>
      )}

      {/* Row 2: Chart Performa + Kalender */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><ChartPerforma /></div>
        <KalenderWidget company={companyId} />
      </div>

      {/* Row 3: Daily Monitoring + Indisipliner + Belum Lengkap */}
      <div className="grid gap-4 lg:grid-cols-3">
        <DailyMonitoring companies={companies} company={companyId} isMulti={isMulti} />
        <IndisiplinerWidget company={companyId} />
        <BelumLengkapWidget company={companyId} />
      </div>

      {/* Row 4: Lembur Pending + Penggajian */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lembur Menunggu Persetujuan</CardTitle>
            <Link to="/overtime" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">Lihat semua <ArrowUpRight size={12} /></Link>
          </CardHeader>
          <CardBody className="p-0">
            {recentOT.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-6 text-gray-400"><CheckCircle size={24} className="text-green-400" /><p className="text-xs">Tidak ada lembur pending</p></div>
            ) : (
              <div className="divide-y divide-gray-50">
                {recentOT.map(ot => (
                  <div key={ot.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 font-mono">{ot.no}</p>
                      <p className="text-[11px] text-gray-400 truncate">{ot.department} · {ot.items?.length} org · {fDate(ot.date)}</p>
                    </div>
                    <Badge status={ot.status} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {['coordinator','super_admin'].includes(role) && (
          <Card>
            <CardHeader>
              <CardTitle>Status Penggajian</CardTitle>
              <Link to="/payroll" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">Kelola <ArrowUpRight size={12} /></Link>
            </CardHeader>
            <CardBody className="p-0">
              {payrolls.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Belum ada data penggajian bulan ini</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {payrolls.map(p => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-medium text-gray-800">{p.companyName}</p>
                        <p className="text-[11px] text-gray-400">{MONTHS_ID[(p.period_month||1)-1]} {p.period_year}{p.scope_label ? ` · ${p.scope_label}` : ''}</p>
                      </div>
                      <Badge status={p.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  )
}
