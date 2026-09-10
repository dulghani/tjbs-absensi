import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Eye, Download, RefreshCw, Trash2, Pencil } from 'lucide-react'
import { getPayrolls, processPayroll, finalizePayroll, deletePayroll, recalculatePayroll, getCompanies, getEmployeeDivisions, getEmployeeDepartments, getPayrollSlips, updatePayrollDetail } from '../../api/realService'
import api from '../../api/index'
import { Card, CardHeader, CardTitle, CardBody, Select, Input, EmptyState } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination, PageSizeSelector, SortableTh } from '../../components/ui/Table'
import { useTableControls } from '../../hooks/useTableControls'
import { fCurrency, fDate, MONTHS_ID } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

const THIS_YEAR  = new Date().getFullYear()
const THIS_MONTH = new Date().getMonth() + 1  // 1-based

/** Default: tgl 25 bulan lalu s.d. 24 bulan ini (pola payroll tgl 25) */
function defaultDateRange() {
  const now   = new Date()
  const to    = new Date(now.getFullYear(), now.getMonth(), 24)
  const from  = new Date(now.getFullYear(), now.getMonth() - 1, 25)
  return {
    from: from.toISOString().slice(0, 10),
    to:   to.toISOString().slice(0, 10),
  }
}

export default function PayrollPage() {
  const [payrolls, setPayrolls] = useState(null)
  const [companies, setCompanies] = useState([])
  const [divisions, setDivisions] = useState([])
  const [departments, setDepartments] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [previewPayroll, setPreviewPayroll] = useState(null)
  const [previewSlips, setPreviewSlips] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [recalcTarget, setRecalcTarget] = useState(null)
  const [recalculating, setRecalculating] = useState(false)
  const [editSlip, setEditSlip] = useState(null)   // {slip, payroll} untuk koreksi manual
  const [editForm, setEditForm] = useState({ gross: '', deduction: '', notes: '' })
  const [editSaving, setEditSaving] = useState(false)

  const { range } = { range: defaultDateRange() }
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm({
    defaultValues: {
      period_year: THIS_YEAR, period_month: THIS_MONTH,
      date_from: range.from, date_to: range.to,
      effective_work_days: '', division_id: '', department: '',
    }
  })
  const watchCompany   = watch('company_id')
  const watchDivision  = watch('division_id')

  useEffect(() => { getCompanies().then(setCompanies); load() }, [])
  useEffect(() => {
    if (watchCompany) {
      getEmployeeDivisions(watchCompany).then(setDivisions).catch(() => setDivisions([]))
      getEmployeeDepartments(watchCompany).then(setDepartments).catch(() => setDepartments([]))
    }
  }, [watchCompany])
  useEffect(() => {
    if (watchCompany && watchDivision) {
      getEmployeeDepartments(watchCompany, watchDivision).then(setDepartments).catch(() => setDepartments([]))
    }
  }, [watchDivision])

  async function load() { setPayrolls(await getPayrolls()) }
  const tc = useTableControls(payrolls, { defaultSortBy: 'period_year', defaultSortDir: 'desc' })

  async function onSubmit(data) {
    try {
      await processPayroll({
        company_id:           data.company_id,
        period_month:         Number(data.period_month),
        period_year:          Number(data.period_year),
        date_from:            data.date_from || null,
        date_to:              data.date_to   || null,
        effective_work_days:  data.effective_work_days ? Number(data.effective_work_days) : null,
        division_id:          data.division_id  || null,
        department:           data.department   || null,
      })
      toast.success('Proses penggajian dimulai — cek status di tabel')
      setModalOpen(false); load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal memproses penggajian')
    }
  }

  async function handleDownload(p) {
    try {
      toast.info('Menyiapkan file Excel...')
      const endpoint = `/audit-logs/reports/payroll/${p.id}/export-gaji`
      console.log('[Download] axios baseURL:', api.defaults.baseURL)
      console.log('[Download] full URL:', api.defaults.baseURL + endpoint)
      const res = await api.get(endpoint, { responseType: 'blob' })
      // Interceptor (res) => res.data sudah membuat res = Blob langsung
      // JANGAN akses res.data lagi — itu undefined
      const blob = res instanceof Blob
        ? res
        : new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Gaji_${String(p.period_month).padStart(2,'0')}_${p.period_year}_${(p.companyName || '').replace(/\s+/g, '_')}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      let errMsg = 'Gagal download Excel'
      try {
        // Axios interceptor melakukan Promise.reject(err.response?.data || err)
        // Saat responseType:blob + status 500, err.response.data = Blob
        // Sehingga err di sini ADALAH Blob langsung (bukan axios error object)
        const blobOrData = err instanceof Blob ? err
          : (err?.response?.data instanceof Blob ? err.response.data : null)

        if (blobOrData instanceof Blob) {
          const text = await blobOrData.text()
          console.error('[Download] server error body:', text.slice(0, 500))
          try { errMsg = JSON.parse(text)?.message || text.slice(0, 200) }
          catch { errMsg = text.slice(0, 200) }
        } else if (err?.message) {
          errMsg = err.message
        }
      } catch (e2) {
        console.error('[Download] error parsing failed:', e2)
      }
      console.error('[Download] err object:', err)
      toast.error('Export gagal: ' + errMsg)
    }
  }

  async function handlePreview(p) {
    setPreviewPayroll(p)
    setPreviewSlips(null)
    setPreviewLoading(true)
    try {
      const result = await getPayrollSlips(p.id)
      // API returns {payroll: {...}, slips: [...]}
      setPreviewSlips(result?.slips || result || [])
    } catch { toast.error('Gagal memuat data slip') }
    finally { setPreviewLoading(false) }
  }

  async function handleFinalize(id) {
    await finalizePayroll(id)
    toast.success('Payroll berhasil difinalisasi')
    load()
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deletePayroll(deleteTarget.id)
      toast.success('Payroll berhasil dihapus')
      setDeleteTarget(null); load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus payroll')
    } finally { setDeleting(false) }
  }

  async function handleRecalculate(p) {
    setRecalcTarget(p)
    setRecalculating(true)
    try {
      await recalculatePayroll(p.id)
      toast.success('Hitung ulang selesai')
      setRecalcTarget(null); load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menghitung ulang')
    } finally { setRecalculating(false) }
  }

  function handleOpenEdit(slip) {
    setEditSlip({ slip, payroll: previewPayroll })
    setEditForm({
      gross: slip.gross_salary,
      deduction: slip.breakdown?.absence_deduction ?? 0,
      notes: '',
    })
  }

  async function handleSaveEdit() {
    if (!editSlip) return
    setEditSaving(true)
    try {
      await updatePayrollDetail(editSlip.payroll.id, editSlip.slip.employee_id, {
        gross_salary: Number(editForm.gross),
        total_deduction: Number(editForm.deduction),
        notes: editForm.notes,
      })
      toast.success('Koreksi berhasil disimpan')
      setEditSlip(null)
      // Reload preview — format: {slips:[...]} atau {data:{slips:[...]}}
      const result = await getPayrollSlips(previewPayroll.id)
      const slips = result?.slips ?? result?.data?.slips ?? result ?? []
      setPreviewSlips(Array.isArray(slips) ? slips : [])
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan koreksi')
    } finally { setEditSaving(false) }
  }

  function openModal() {
    const r = defaultDateRange()
    reset({
      period_year: THIS_YEAR, period_month: THIS_MONTH,
      date_from: r.from, date_to: r.to,
      effective_work_days: '', company_id: '', division_id: '', department: '',
    })
    setModalOpen(true)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Penggajian</h2>
          <p className="text-sm text-gray-500 mt-0.5">Proses dan kelola gaji karyawan outsourcing</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openModal}>Proses Gaji Baru</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Penggajian</CardTitle>
          {payrolls && payrolls.length > 0 && <PageSizeSelector value={tc.perPage} onChange={tc.setPerPage} />}
        </CardHeader>
        <CardBody className="p-0 sm:p-4">
          <Table>
            <Thead><Tr>
              <SortableTh label="Perusahaan" sortKey="companyName" sortBy={tc.sortBy} sortDir={tc.sortDir} onSort={tc.toggleSort} />
              <SortableTh label="Periode" sortKey="period_year" sortBy={tc.sortBy} sortDir={tc.sortDir} onSort={tc.toggleSort} />
              <Th>Range Absensi</Th><Th>Scope</Th>
              <Th>Karyawan</Th><Th>Total Bruto</Th><Th>Total Neto</Th><Th>Status</Th><Th></Th>
            </Tr></Thead>
            <Tbody>
              {!payrolls ? null : payrolls.length === 0
                ? <TableEmpty colSpan={9} />
                : tc.paginated.map((p) => (
                  <Tr key={p.id}>
                    <Td className="font-medium text-gray-900">{p.companyName}</Td>
                    <Td>{MONTHS_ID[p.period_month - 1]} {p.period_year}</Td>
                    <Td className="text-xs text-gray-500">
                      {p.date_from && p.date_to
                        ? `${fDate(p.date_from)} – ${fDate(p.date_to)}`
                        : '-'
                      }
                    </Td>
                    <Td className="text-xs text-gray-500">{p.scope_label || 'Semua'}</Td>
                    <Td>{p.employees} orang</Td>
                    <Td className="font-mono text-xs">{fCurrency(p.totalGross)}</Td>
                    <Td className="font-mono text-xs">{fCurrency(p.totalNet)}</Td>
                    <Td><Badge status={p.status} /></Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => handlePreview(p)} title="Preview data gaji" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><Eye size={14} /></button>
                        <button
                          onClick={() => handleDownload(p)}
                          title="Download Excel Gaji"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md"
                        >
                          <Download size={14} />
                        </button>
                        {p.status !== 'finalized' && (
                          <button
                            onClick={() => handleRecalculate(p)}
                            disabled={recalcTarget?.id === p.id && recalculating}
                            title="Hitung ulang payroll"
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md disabled:opacity-40"
                          >
                            <RefreshCw size={14} className={recalcTarget?.id === p.id && recalculating ? 'animate-spin' : ''} />
                          </button>
                        )}
                        {p.status !== 'finalized' && (
                          <button
                            onClick={() => setDeleteTarget(p)}
                            title="Hapus payroll"
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        {p.status === 'processing' && (
                          <Button size="sm" variant="primary" onClick={() => handleFinalize(p.id)}>Finalisasi</Button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))
              }
            </Tbody>
          </Table>
          <Pagination page={tc.page} totalPages={tc.totalPages} onPageChange={tc.setPage} total={tc.total} perPage={tc.perPage} />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Proses Penggajian Baru" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Mulai Proses</Button>
        </>}
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          {/* Perusahaan */}
          <Select label="Perusahaan" {...register('company_id', { required: true })}>
            <option value="">-- Pilih --</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          {/* Periode */}
          <div className="grid grid-cols-2 gap-3">
            <Select label="Periode Bulan" {...register('period_month')}>
              {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
            <Select label="Tahun" {...register('period_year')}>
              {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </div>

          {/* Range tanggal absensi */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2.5 bg-gray-50">
            <p className="text-xs font-semibold text-gray-600">Range Tanggal Absensi</p>
            <p className="text-[11px] text-gray-400">Absensi dalam rentang ini yang dihitung. Default: tgl 25 bulan lalu s.d. 24 bulan ini.</p>
            <div className="grid grid-cols-2 gap-2">
              <Input label="Dari Tanggal" type="date" {...register('date_from')} />
              <Input label="Sampai Tanggal" type="date" {...register('date_to')} />
            </div>
          </div>

          {/* Filter scope */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2.5">
            <p className="text-xs font-semibold text-gray-600">Filter Scope (Opsional)</p>
            <p className="text-[11px] text-gray-400">Kosongkan = proses semua karyawan aktif perusahaan ini.</p>
            <Select label="Divisi" {...register('division_id')}>
              <option value="">Semua Divisi</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Select label="Departemen" {...register('department')}>
              <option value="">Semua Departemen</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>

          {/* Hari kerja efektif */}
          <Input
            label="Hari Kerja Efektif" type="number" placeholder="mis. 25" min={1} max={31}
            {...register('effective_work_days')}
            hint="Jumlah hari kerja riil dalam periode ini — acuan hitung potongan absen."
          />

          <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-2.5 ring-1 ring-blue-200">
            Sistem menarik data absensi & lembur terkonfirmasi dalam range tanggal di atas, kemudian menghitung gaji di background.
          </div>
        </form>
      </Modal>

      {/* Modal Preview Data Gaji */}
      <Modal
        open={!!previewPayroll} onClose={() => { setPreviewPayroll(null); setPreviewSlips(null) }}
        title={previewPayroll ? `Preview Gaji — ${previewPayroll.companyName} ${MONTHS_ID[(previewPayroll.period_month||1)-1]} ${previewPayroll.period_year}` : ''}
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => { setPreviewPayroll(null); setPreviewSlips(null) }}>Tutup</Button>
          <Button variant="primary" icon={Download} onClick={() => { handleDownload(previewPayroll); }}>Download Excel</Button>
        </>}
      >
        {previewLoading && <p className="text-sm text-gray-400 text-center py-8">Memuat data...</p>}
        {!previewLoading && previewSlips && previewSlips.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Belum ada data slip — pastikan proses gaji sudah selesai dijalankan</p>
        )}
        {previewSlips && previewSlips.length > 0 && (<>
          <p className="text-xs text-gray-500 px-3 py-2 bg-gray-50 border border-gray-200 rounded-t-lg">
            {previewPayroll.date_from && `Range: ${fDate(previewPayroll.date_from)} – ${fDate(previewPayroll.date_to)} · `}
            {previewSlips.length} karyawan · Scope: {previewPayroll.scope_label || 'Semua'}
          </p>
          <div className="overflow-auto max-h-[60vh] border-x border-b border-gray-200 rounded-b-lg">
            <table className="w-full text-xs border-collapse" style={{ minWidth: '900px' }}>
              <thead>
                <tr className="bg-gray-100">
                  {/* Fixed columns — sticky top + left */}
                  <th className="sticky top-0 left-0 z-30 bg-gray-100 border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap" style={{ minWidth: 64 }}>NIK</th>
                  <th className="sticky top-0 z-30 bg-gray-100 border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap" style={{ minWidth: 160, left: 64 }}>Nama</th>
                  <th className="sticky top-0 z-30 bg-gray-100 border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600 whitespace-nowrap" style={{ minWidth: 80, left: 224 }}>Dept</th>
                  <th className="sticky top-0 z-30 bg-gray-100 border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600 whitespace-nowrap" style={{ minWidth: 40, left: 304 }}>H</th>
                  {/* Scrollable columns — sticky top only */}
                  {['Absen','Upah/Hari','Upah Hadir','Lb Biasa (j)','Lb Biasa (Rp)','Lb Merah (j)','Lb Merah (Rp)','Potongan','Gross','Net',
                    ...(previewPayroll?.status !== 'finalized' ? [''] : [])
                  ].map((h,i) => (
                    <th key={i} className="sticky top-0 z-20 bg-gray-100 border border-gray-200 px-2 py-1.5 text-right font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewSlips.map((s, i) => (
                  <tr key={i} className="hover:bg-blue-50/40 border-b border-gray-100">
                    {/* Fixed cells */}
                    <td className="sticky left-0 z-10 bg-white border border-gray-200 px-2 py-1" style={{ left: 0 }}>{s.nik || '-'}</td>
                    <td className="sticky z-10 bg-white border border-gray-200 px-2 py-1 font-medium" style={{ left: 64 }}>{s.name}</td>
                    <td className="sticky z-10 bg-white border border-gray-200 px-2 py-1 text-gray-500" style={{ left: 224 }}>{s.department || '-'}</td>
                    <td className="sticky z-10 bg-white border border-gray-200 px-2 py-1 text-center" style={{ left: 304 }}>{s.total_work_days}</td>
                    {/* Scrollable cells */}
                    <td className="border border-gray-200 px-2 py-1 text-center">{s.breakdown?.absent ?? '-'}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono">{fCurrency(s.breakdown?.daily_wage)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono">{fCurrency(s.breakdown?.attendance_earning ?? s.gross_salary)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono text-center">{s.breakdown?.overtime_regular_hours ?? 0}j</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono">{fCurrency(s.breakdown?.overtime_regular)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono text-center">{s.breakdown?.overtime_holiday_hours ?? 0}j</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono text-red-700">{fCurrency(s.breakdown?.overtime_holiday)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono text-red-600">{fCurrency(s.breakdown?.absence_deduction)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono font-semibold">{fCurrency(s.gross_salary)}</td>
                    <td className="border border-gray-200 px-2 py-1 text-right font-mono font-semibold text-green-700">{fCurrency(s.net_salary)}</td>
                    {previewPayroll?.status !== 'finalized' && (
                      <td className="border border-gray-200 px-2 py-1 text-center">
                        <button onClick={() => handleOpenEdit(s)} title="Koreksi manual" className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Pencil size={12} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={4} className="sticky left-0 z-10 bg-gray-100 border border-gray-200 px-2 py-1.5">TOTAL ({previewSlips.length} karyawan)</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-center">-</td>
                  <td className="border border-gray-200 px-2 py-1.5"></td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono">{fCurrency(previewSlips.reduce((s,r) => s + (+r.breakdown?.attendance_earning || +r.gross_salary || 0), 0))}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono">{previewSlips.reduce((s,r) => s + (+r.breakdown?.overtime_regular_hours || 0), 0)}j</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono">{fCurrency(previewSlips.reduce((s,r) => s + (+r.breakdown?.overtime_regular || 0), 0))}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono">{previewSlips.reduce((s,r) => s + (+r.breakdown?.overtime_holiday_hours || 0), 0)}j</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-red-700">{fCurrency(previewSlips.reduce((s,r) => s + (+r.breakdown?.overtime_holiday || 0), 0))}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-red-600">{fCurrency(previewSlips.reduce((s,r) => s + (+r.breakdown?.absence_deduction || 0), 0))}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono">{fCurrency(previewSlips.reduce((s,r) => s + (+r.gross_salary || 0), 0))}</td>
                  <td className="border border-gray-200 px-2 py-1.5 text-right font-mono text-green-700">{fCurrency(previewSlips.reduce((s,r) => s + (+r.net_salary || 0), 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>)}
      </Modal>
      <Modal
        open={!!editSlip} onClose={() => setEditSlip(null)} size="sm"
        title={`Koreksi Manual — ${editSlip?.slip?.name || ''}`}
        footer={<>
          <Button variant="secondary" onClick={() => setEditSlip(null)}>Batal</Button>
          <Button variant="primary" loading={editSaving} onClick={handleSaveEdit}>Simpan Koreksi</Button>
        </>}
      >
        <div className="space-y-3">
          <div className="bg-amber-50 text-amber-800 text-xs rounded-lg p-3 ring-1 ring-amber-200">
            Koreksi ini mengganti nilai Gross dan Potongan secara manual. Net = Gross − Potongan.
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Gaji Bruto (Gross)</label>
            <input type="number" value={editForm.gross} onChange={e => setEditForm(f => ({ ...f, gross: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Potongan</label>
            <input type="number" value={editForm.deduction} onChange={e => setEditForm(f => ({ ...f, deduction: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex justify-between">
            <span className="text-gray-600">Neto (diterima)</span>
            <span className="font-bold text-green-700">{fCurrency((+editForm.gross || 0) - (+editForm.deduction || 0))}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Alasan Koreksi</label>
            <input type="text" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Misal: Bonus tambahan, koreksi jam lembur" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500" />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        danger loading={deleting}
        title="Hapus Payroll"
        message={deleteTarget ? `Hapus payroll ${MONTHS_ID[(deleteTarget.period_month||1)-1]} ${deleteTarget.period_year} — ${deleteTarget.companyName}? Semua data slip akan ikut terhapus dan tidak dapat dikembalikan.` : ''}
      />
    </div>
  )
}
