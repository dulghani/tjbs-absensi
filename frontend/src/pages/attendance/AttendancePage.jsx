import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, Search, CheckCircle, RefreshCw, Download, CheckSquare } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getAttendanceSummariesPaginated, getAttendanceStats, getCompanies, getEmployeeDepartments, resolveIncompleteAttendance, batchResolveIncomplete, exportAttendanceExcel, recalculateAttendance } from '../../api/realService'
import { Card, CardBody, Select } from '../../components/ui/Primitives'
import Badge from '../../components/ui/Badge'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination, PageSizeSelector, SortableTh } from '../../components/ui/Table'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { fDate, fDuration, cn } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function daysAgoStr(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10) }

export default function AttendancePage() {
  const user = useAuthStore((s) => s.user)
  const role = user?.roles?.[0]
  const isMultiCompany = ['coordinator', 'field_officer'].includes(role)

  const [records, setRecords] = useState(null)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [companies, setCompanies] = useState([])
  const [departments, setDepartments] = useState([])
  const [resolveTarget, setResolveTarget] = useState(null)
  const [resolveTime, setResolveTime] = useState('17:00')
  const [resolveStartTime, setResolveStartTime] = useState('08:00')
  const [resolveTimeType, setResolveTimeType] = useState('check_out')
  const [resolveNote, setResolveNote] = useState('')
  const [resolving, setResolving] = useState(false)
  const [batchOpen, setBatchOpen] = useState(false)
  const [batchTimeType, setBatchTimeType] = useState('check_out')
  const [batchTime, setBatchTime] = useState('17:00')
  const [batchStartTime, setBatchStartTime] = useState('08:00')
  const [batchNote, setBatchNote] = useState('')
  const [batching, setBatching] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [exporting, setExporting] = useState(false)
  const [recalcOpen, setRecalcOpen] = useState(false)
  const [recalcFrom, setRecalcFrom] = useState(daysAgoStr(6))
  const [recalcTo, setRecalcTo] = useState(todayStr())
  const [recalculating, setRecalculating] = useState(false)
  const [filterCompany, setFilterCompany] = useState(isMultiCompany ? 'all' : user.company_id)
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPin, setFilterPin] = useState('')
  const [filterName, setFilterName] = useState('')
  const [fromDate, setFromDate] = useState(daysAgoStr(6)) // default: 7 hari terakhir
  const [toDate, setToDate] = useState(todayStr())
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [sortBy, setSortBy] = useState('attendance_date')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => { getCompanies().then(setCompanies) }, [])
  useEffect(() => { getEmployeeDepartments(filterCompany).then(setDepartments) }, [filterCompany])

  async function handleResolve() {
    if (!resolveTarget) return
    setResolving(true)
    try {
      await resolveIncompleteAttendance(resolveTarget.id, {
        time_type:          resolveTimeType,
        actual_start_time:  ['check_in','both'].includes(resolveTimeType) ? resolveStartTime : undefined,
        actual_end_time:    ['check_out','both'].includes(resolveTimeType) ? resolveTime : undefined,
        notes: resolveNote || `Diselesaikan manual oleh HRD`,
      })
      toast.success(`Data ${resolveTarget.employeeName} berhasil diselesaikan`)
      setResolveTarget(null); setResolveNote('')
      // Reset filter ke 'all' agar record yang sudah resolved tetap terlihat
      if (filterStatus === 'incomplete') setFilterStatus('all')
      else setTimeout(() => load(), 300)
    } catch (err) {
      const msg = err?.response?.data?.message
        || (err?.response?.data?.errors ? JSON.stringify(err.response.data.errors) : null)
        || err?.message
        || 'Gagal menyelesaikan data gantung'
      console.error('[Resolve] HTTP', err?.response?.status, err?.response?.data)
      toast.error(msg)
    } finally { setResolving(false) }
  }

  async function handleBatchResolve() {
    const companyId = filterCompany !== 'all' ? filterCompany : null
    if (!companyId) { toast.error('Pilih perusahaan terlebih dahulu'); return }
    setBatching(true)
    try {
      const payload = {
        company_id: companyId,
        time_type: batchTimeType,
        actual_start_time: ['check_in','both'].includes(batchTimeType) ? batchStartTime : undefined,
        actual_end_time:   ['check_out','both'].includes(batchTimeType) ? batchTime : undefined,
        notes: batchNote || `Diselesaikan manual (batch) oleh HRD`,
      }
      // Jika ada yang dipilih via checkbox → kirim IDs spesifik
      if (selectedIds.size > 0) {
        payload.summary_ids = Array.from(selectedIds)
      } else {
        // Tidak ada yang dipilih → pakai filter aktif
        payload.from_date  = fromDate || undefined
        payload.to_date    = toDate || undefined
        payload.department = filterDepartment !== 'all' ? filterDepartment : undefined
      }
      const result = await batchResolveIncomplete(payload)
      toast.success(result?.message || 'Batch resolve selesai')
      setBatchOpen(false); setBatchNote(''); setSelectedIds(new Set())
      if (filterStatus === 'incomplete') setFilterStatus('all')
      else load()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Gagal batch resolve')
    } finally { setBatching(false) }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Hanya record incomplete di halaman ini
  const incompleteOnPage = useMemo(
    () => (records || []).filter(r => r.status === 'incomplete'),
    [records]
  )
  const allPageSelected = incompleteOnPage.length > 0 && incompleteOnPage.every(r => selectedIds.has(r.id))

  function toggleSelectAll() {
    if (allPageSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        incompleteOnPage.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        incompleteOnPage.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  async function handleExport() {
    const companyId = filterCompany !== 'all' ? filterCompany : null
    if (!companyId) { toast.error('Pilih perusahaan terlebih dahulu'); return }
    setExporting(true)
    try {
      const res = await exportAttendanceExcel({
        company_id: companyId,
        from_date: fromDate,
        to_date: toDate,
        department: filterDepartment !== 'all' ? filterDepartment : undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined,
      })
      const blob = res instanceof Blob ? res : new Blob([res], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Absensi_${fromDate}_${toDate}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      let msg = 'Gagal export'
      try {
        const blobData = err instanceof Blob ? err : err?.response?.data instanceof Blob ? err.response.data : null
        if (blobData) { const t = await blobData.text(); try { msg = JSON.parse(t)?.message || t.slice(0,200) } catch { msg = t.slice(0,200) } }
        else msg = err?.message || msg
      } catch {}
      toast.error(msg)
    } finally { setExporting(false) }
  }

  async function handleRecalculate() {
    const targetCompany = filterCompany !== 'all' ? filterCompany : null
    if (!targetCompany) { toast.error('Pilih perusahaan terlebih dahulu'); return }
    setRecalculating(true)
    try {
      const result = await recalculateAttendance(targetCompany, recalcFrom, recalcTo)
      toast.success(result.message || 'Hitung ulang selesai')
      setRecalcOpen(false)
      load()
    } catch (err) {
      const msg = err?.response?.data?.message
        || (err?.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(', ') : null)
        || err?.message
        || 'Gagal menjadwalkan recalculate'
      console.error('[Recalculate] HTTP', err?.response?.status, err?.response?.data)
      toast.error(msg)
    } finally { setRecalculating(false) }
  }
  useEffect(() => { setPage(1); setSelectedIds(new Set()) }, [filterCompany, filterDepartment, filterStatus, filterPin, filterName, fromDate, toDate, perPage])
  useEffect(() => { load() }, [filterCompany, filterDepartment, filterStatus, filterPin, filterName, fromDate, toDate, page, perPage, sortBy, sortDir])
  // Statistik dihitung terpisah dari tabel (agregat seluruh rentang, bukan cuma halaman aktif).
  useEffect(() => {
    getAttendanceStats({ company_id: filterCompany, department: filterDepartment, from_date: fromDate, to_date: toDate }).then(setStats)
  }, [filterCompany, filterDepartment, fromDate, toDate])

  async function load() {
    const result = await getAttendanceSummariesPaginated(
      { company_id: filterCompany, department: filterDepartment, status: filterStatus, name: filterName || undefined, from_date: fromDate, to_date: toDate, sort_by: sortBy, sort_dir: sortDir },
      page, perPage
    )
    setRecords(result.data)
    setTotal(result.total)
  }

  function toggleSort(key) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Data Absensi</h2>
          <p className="text-sm text-gray-500 mt-0.5">Log kehadiran & hasil perhitungan jam kerja — {total} entri</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" icon={Download} size="sm" loading={exporting} onClick={handleExport}>
            Export Excel
          </Button>
          <Button variant="secondary" icon={CheckSquare} size="sm"
            onClick={() => { setBatchTimeType('check_out'); setBatchNote(''); setBatchOpen(true) }}
          >
            {selectedIds.size > 0 ? `Selesaikan ${selectedIds.size} Dipilih` : 'Selesaikan Data Gantung'}
          </Button>
          <Button
            variant="secondary" icon={RefreshCw} size="sm"
            onClick={() => { setRecalcFrom(fromDate); setRecalcTo(toDate); setRecalcOpen(true) }}
          >
            Hitung Ulang
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-5 gap-3">
          <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Hadir</p><p className="text-xl font-semibold text-green-600">{(stats.present ?? 0) + (stats.late ?? 0)}</p></Card>
          <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Hadir + Lembur ✓</p><p className="text-xl font-semibold text-green-700">{stats.overtime_verified ?? 0}</p></Card>
          <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Hadir ⚠ Lembur</p><p className="text-xl font-semibold text-amber-600">{stats.overtime_unverified ?? 0}</p></Card>
          <Card className="p-4"><p className="text-xs text-gray-500 mb-1">Absen</p><p className="text-xl font-semibold text-red-600">{stats.absent}</p></Card>
          <Card className="p-4 ring-1 ring-red-100"><p className="text-xs text-gray-500 mb-1">⚠ Gantung</p><p className="text-xl font-semibold text-red-600">{stats.incomplete ?? 0}</p></Card>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Dari Tanggal</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} max={toDate} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-1">Sampai Tanggal</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} min={fromDate} max={todayStr()} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
        </div>
        {isMultiCompany && (
          <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Perusahaan</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Departemen</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Status</option>
          <option value="present">Hadir</option>
          <option value="absent">Absen</option>
          <option value="on_leave">Izin</option>
          <option value="incomplete">⚠ Data Gantung</option>
          <option value="manually_reviewed">✓ Sudah Diisi Manual</option>
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Cari nama / PIN..." value={filterName} onChange={(e) => setFilterName(e.target.value)}
            className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand bg-white w-48"
          />
        </div>
        <div className="ml-auto"><PageSizeSelector value={perPage} onChange={setPerPage} /></div>
      </div>

      <Card>
        <CardBody className="p-0 sm:p-4">
          {/* Info bar saat ada yang dipilih */}
          {selectedIds.size > 0 && (
            <div className="mb-3 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5">
              <span className="text-sm text-blue-700 font-medium">
                {selectedIds.size} data gantung dipilih
              </span>
              <div className="flex gap-2">
                <button onClick={() => { setBatchTimeType('check_out'); setBatchNote(''); setBatchOpen(true) }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <CheckSquare size={13} /> Selesaikan yang Dipilih
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-100 rounded-lg">
                  Batal Pilih
                </button>
              </div>
            </div>
          )}
          <Table>
            <Thead><Tr>
              <Th className="w-8">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                  title="Pilih semua data gantung di halaman ini"
                />
              </Th>
              <SortableTh label="Tanggal" sortKey="attendance_date" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <Th>Karyawan</Th><Th>PIN</Th><Th>Departemen</Th>
              <SortableTh label="Jam Masuk" sortKey="actual_start_time" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Jam Keluar" sortKey="actual_end_time" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Jam Kerja" sortKey="productive_work_minutes" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Lembur" sortKey="overtime_minutes" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
              <SortableTh label="Status" sortKey="attendance_status" sortBy={sortBy} sortDir={sortDir} onSort={toggleSort} />
            </Tr></Thead>
            <Tbody>
              {!records ? null : records.length === 0 ? <TableEmpty colSpan={10} /> : records.map((r) => (
                <Tr key={r.id} className={selectedIds.has(r.id) ? 'bg-blue-50' : ''}>
                  <Td>
                    {r.status === 'incomplete' ? (
                      <input
                        type="checkbox"
                        checked={selectedIds.has(r.id)}
                        onChange={() => toggleSelect(r.id)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer"
                      />
                    ) : (
                      <span className="block w-4" />
                    )}
                  </Td>
                  <Td>{fDate(r.date)}</Td>
                  <Td className="font-medium text-gray-900">{r.employeeName}</Td>
                  <Td className="font-mono text-xs text-gray-500">{r.pin}</Td>
                  <Td>{r.department}</Td>
                  <Td>{r.checkIn || '-'}</Td>
                  <Td>
                    {r.checkOut || '-'}
                    {r.checkIn && r.checkOut && r.checkOut < r.checkIn && (
                      <span className="ml-1 text-[10px] text-amber-600 font-medium" title="Check-out terjadi di hari berikutnya (shift lintas tengah malam)">+1 hari</span>
                    )}
                  </Td>
                  <Td>{fDuration(r.workMinutes)}</Td>
                  <Td>
                    {r.overtimeMinutes > 0 ? (
                      <span
                        className={cn(
                          'font-medium',
                          r.overtimeVerified === true && 'text-green-600',
                          r.overtimeVerified === false && 'text-amber-600',
                          r.overtimeVerified == null && 'text-gray-600'
                        )}
                        title={
                          r.overtimeVerified === true ? 'Sesuai dengan pengajuan lembur yang disetujui'
                          : r.overtimeVerified === false ? 'Lembur tercatat tapi TIDAK ada pengajuan lembur — cek manual'
                          : undefined
                        }
                      >
                        {fDuration(r.overtimeMinutes)}
                        {r.overtimeVerified === false && <AlertTriangle size={11} className="inline ml-1 mb-0.5" />}
                      </span>
                    ) : '-'}
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <AttendanceBadge status={r.status} overtimeMinutes={r.overtimeMinutes} overtimeVerified={r.overtimeVerified} />
                      {r.status === 'incomplete' && (
                        <button
                          onClick={() => { setResolveTarget(r); setResolveTime('17:00'); setResolveNote('') }}
                          title="Isi jam pulang manual"
                          className="p-1 rounded text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          <CheckCircle size={13} />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} perPage={perPage} />
        </CardBody>
      </Card>

      {/* Modal Resolusi Data Gantung */}
      <Modal
        open={!!resolveTarget} onClose={() => setResolveTarget(null)} size="sm"
        title="Selesaikan Data Gantung"
        footer={<>
          <Button variant="secondary" onClick={() => setResolveTarget(null)}>Batal</Button>
          <Button variant="primary" loading={resolving} onClick={handleResolve}>Simpan & Hitung Ulang</Button>
        </>}
      >
        {resolveTarget && (
          <div className="space-y-3">
            <div className="bg-amber-50 rounded-lg p-3 ring-1 ring-amber-200">
              <p className="text-xs font-semibold text-amber-800">{resolveTarget.employeeName}</p>
              <p className="text-xs text-amber-600">{fDate(resolveTarget.date)} · Jam masuk tercatat: {resolveTarget.checkIn || '-'}</p>
            </div>

            {/* Pilih jenis waktu */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Jenis Koreksi</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'check_out', label: '🔴 Isi Jam\nKeluar' },
                  { value: 'check_in',  label: '🟢 Isi Jam\nMasuk' },
                  { value: 'both',      label: '🔄 Isi\nKeduanya' },
                ].map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setResolveTimeType(opt.value)}
                    className={`px-2 py-2 text-[11px] rounded-lg border text-center whitespace-pre-line transition-colors ${resolveTimeType === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
                  >{opt.label}</button>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5">
                {resolveTimeType === 'check_out' && 'Karyawan sudah masuk tapi belum scan keluar'}
                {resolveTimeType === 'check_in'  && 'Scan salah terbaca sebagai masuk, padahal seharusnya keluar'}
                {resolveTimeType === 'both'       && 'Isi jam masuk dan jam keluar sekaligus'}
              </p>
            </div>

            {/* Input jam masuk */}
            {['check_in','both'].includes(resolveTimeType) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Jam Masuk <span className="text-red-500">*</span></label>
                <input type="time" value={resolveStartTime} onChange={e => setResolveStartTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
              </div>
            )}

            {/* Input jam keluar */}
            {['check_out','both'].includes(resolveTimeType) && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Jam Keluar <span className="text-red-500">*</span></label>
                <input type="time" value={resolveTime} onChange={e => setResolveTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Catatan</label>
              <input value={resolveNote} onChange={e => setResolveNote(e.target.value)}
                placeholder="Alasan koreksi..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Batch Resolve Data Gantung */}
      <Modal
        open={batchOpen} onClose={() => setBatchOpen(false)} size="sm"
        title="Selesaikan Semua Data Gantung"
        footer={<>
          <Button variant="secondary" onClick={() => setBatchOpen(false)}>Batal</Button>
          <Button variant="primary" icon={CheckSquare} loading={batching} onClick={handleBatchResolve}>
            Selesaikan Semua
          </Button>
        </>}
      >
        <div className="space-y-3">
          <div className="bg-amber-50 text-amber-800 text-xs rounded-lg p-3 ring-1 ring-amber-200">
            {selectedIds.size > 0
              ? <><strong>{selectedIds.size} data dipilih</strong> akan diselesaikan.</>
              : <>Akan mengisi jam untuk <strong>semua data gantung</strong> sesuai filter aktif.</>
            }
          </div>

          {/* Pilih tipe */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Jenis Koreksi</label>
            <div className="grid grid-cols-3 gap-2">
              {[['check_out','🔴 Jam Keluar'],['check_in','🟢 Jam Masuk'],['both','🔄 Keduanya']].map(([v,l]) => (
                <button key={v} type="button" onClick={() => setBatchTimeType(v)}
                  className={`py-2 text-[11px] rounded-lg border text-center transition-colors ${batchTimeType===v?'border-blue-500 bg-blue-50 text-blue-700 font-medium':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {['check_in','both'].includes(batchTimeType) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Jam Masuk</label>
              <input type="time" value={batchStartTime} onChange={e => setBatchStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
            </div>
          )}
          {['check_out','both'].includes(batchTimeType) && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Jam Keluar</label>
              <input type="time" value={batchTime} onChange={e => setBatchTime(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Catatan (opsional)</label>
            <input type="text" value={batchNote} onChange={e => setBatchNote(e.target.value)}
              placeholder="Misal: Lupa scan pulang"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
          </div>
          <p className="text-[11px] text-gray-400">
            Filter aktif: {fromDate} s.d. {toDate}
            {filterDepartment !== 'all' ? ` · Dept: ${filterDepartment}` : ''}
          </p>
        </div>
      </Modal>

      {/* Modal Recalculate */}
      <Modal
        open={recalcOpen} onClose={() => setRecalcOpen(false)} size="sm"
        title="Hitung Ulang Absensi"
        footer={<>
          <Button variant="secondary" onClick={() => setRecalcOpen(false)}>Batal</Button>
          <Button variant="primary" icon={RefreshCw} loading={recalculating} onClick={handleRecalculate}>
            Mulai Hitung Ulang
          </Button>
        </>}
      >
        <div className="space-y-3">
          <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-3 ring-1 ring-blue-200">
            Proses berjalan langsung — halaman akan refresh otomatis setelah selesai. Untuk range besar (&gt;30 hari) mungkin perlu beberapa menit.
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Dari Tanggal</label>
              <input type="date" value={recalcFrom} onChange={e => setRecalcFrom(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Sampai Tanggal</label>
              <input type="date" value={recalcTo} onChange={e => setRecalcTo(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand" />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Maksimal 90 hari. Estimasi waktu ~1 menit per 60 proses (karyawan × hari).</p>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Badge status kehadiran dengan 3 varian "Hadir":
 *   Hadir (hijau)         → hadir, tidak ada lembur
 *   Hadir + Lembur (hijau)→ hadir, lembur terkonfirmasi (overtime_verified=true)
 *   Hadir ⚠ (kuning)     → hadir, lembur belum terkonfirmasi (overtime_verified=false)
 *
 * Status 'late' dari data lama ditampilkan sebagai 'Hadir' (tanpa punish terlambat).
 */
function AttendanceBadge({ status, overtimeMinutes, overtimeVerified }) {
  // Treat 'late' as 'present' (multi-shift company, no late penalty)
  const effectiveStatus = status === 'late' ? 'present' : status

  if (effectiveStatus === 'present') {
    if (overtimeMinutes > 0 && overtimeVerified === true) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap bg-green-50 text-green-700 ring-green-300">
          Hadir + Lembur
        </span>
      )
    }
    if (overtimeMinutes > 0 && overtimeVerified === false) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap bg-amber-50 text-amber-700 ring-amber-300"
          title="Lembur tercatat tapi belum ada SPL yang disetujui">
          Hadir ⚠
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap bg-green-50 text-green-700 ring-green-200">
        Hadir
      </span>
    )
  }

  return <Badge status={effectiveStatus} />
}
