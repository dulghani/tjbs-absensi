import { useEffect, useState } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { Plus, Trash2, Clock, Check, X, ChevronDown, ChevronUp, Building2, Calendar, User, RefreshCw } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getOvertimeRequests, createOvertimeRequest, approveOvertimeItem, rejectOvertimeItem, approveAllOvertime, getCompanies, getEmployeeDivisions, getEmployeeDepartments, recalculateAttendance, deleteOvertimeRequest } from '../../api/realService'
import EmployeeAutocomplete from '../../components/ui/EmployeeAutocomplete'
import { Card, CardBody, Input, Select, EmptyState } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table'
import { fDate, fDuration, generateOTNumber } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'
import { Clock as ClockIcon } from 'lucide-react'

export default function OvertimePage() {
  const user = useAuthStore((s) => s.user)
  const company = useAuthStore((s) => s.company)
  const role = user?.roles?.[0]
  const isSuperAdmin = role === 'super_admin'
  const isMultiCompany = isSuperAdmin || ['coordinator', 'field_officer'].includes(role)
  const isHrd = role === 'hrd'
  const isDept = role === 'staff_dept'
  // Semua role di atas staff_dept bisa approve
  const canCreate = isSuperAdmin || ['staff_dept', 'field_officer', 'coordinator', 'hrd'].includes(role)
  const canApprove = isSuperAdmin || isHrd || ['coordinator', 'field_officer'].includes(role)

  const [requests, setRequests] = useState(null)
  const [expanded, setExpanded] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterCompany, setFilterCompany] = useState('all')
  const [companies, setCompanies] = useState([])
  // Default: bulan ini
  const [filterFrom, setFilterFrom] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10)
  })
  const [filterTo, setFilterTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => { getCompanies().then(setCompanies) }, [])
  useEffect(() => { load() }, [filterStatus, filterCompany, filterFrom, filterTo])

  async function load() {
    const cid = isMultiCompany ? filterCompany : user.company_id
    const data = await getOvertimeRequests({
      company_id: cid, status: filterStatus,
      from_date: filterFrom || undefined,
      to_date: filterTo || undefined,
    })
    setRequests(data)
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteOvertimeRequest(deleteTarget.id)
      toast.success('SPL berhasil dihapus')
      setDeleteTarget(null); load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus SPL')
    } finally { setDeleting(false) }
  }

  async function handleApproveItem(reqId, itemId) {
    await approveOvertimeItem(reqId, itemId, user.name)
    toast.success('Item lembur disetujui')
    load()
  }
  async function handleRejectItem(reqId, itemId) {
    await rejectOvertimeItem(reqId, itemId)
    toast.warning('Item lembur ditolak')
    load()
  }
  async function handleApproveAll(reqId) {
    await approveAllOvertime(reqId, user.name)
    toast.success('Semua item lembur disetujui')
    load()
  }

  async function handleSyncAttendance(ot) {
    try {
      const result = await recalculateAttendance(ot.company_id, ot.date, ot.date)
      toast.success(result?.message || 'Absensi berhasil disinkronisasi dengan data lembur')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal sinkronisasi absensi')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{canApprove && !isDept ? 'Konfirmasi Lembur' : isDept ? 'Pengajuan Lembur' : 'Data Lembur'}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{requests?.length ?? '...'} pengajuan lembur</p>
        </div>
        {canCreate && <Button variant="primary" icon={Plus} onClick={() => setModalOpen(true)}>Buat Pengajuan Lembur</Button>}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
        {isMultiCompany && (
          <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Perusahaan</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1.5">
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
          <span className="text-gray-400 text-sm">–</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
        </div>
      </div>

      <div className="space-y-3">
        {requests?.length === 0 && (
          <Card><EmptyState icon={ClockIcon} title="Belum ada pengajuan lembur" /></Card>
        )}
        {requests?.map((ot) => (
          <Card key={ot.id}>
            <div className="p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold text-gray-900">{ot.no}</span>
                  <Badge status={ot.status} />
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1"><Building2 size={12} />{companies.find(c => c.id === ot.company_id)?.name}</span>
                  <span className="flex items-center gap-1"><Calendar size={12} />{fDate(ot.date)}</span>
                  <span className="flex items-center gap-1"><User size={12} />{ot.requestedBy}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setExpanded(expanded === ot.id ? null : ot.id)}>
                  {expanded === ot.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Detail
                </Button>
                {canApprove && ot.status === 'pending' && (
                  <Button variant="primary" size="sm" icon={Check} onClick={() => handleApproveAll(ot.id)}>Setujui Semua</Button>
                )}
                {ot.status === 'pending' && (
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(ot)}>Hapus</Button>
                )}
                {canApprove && ot.status === 'approved' && (
                  <Button variant="secondary" size="sm" icon={RefreshCw} onClick={() => handleSyncAttendance(ot)}
                    title="Sinkronisasi data absensi — gunakan jika lembur diapprove setelah absensi dihitung">
                    Sinkron Absensi
                  </Button>
                )}
              </div>
            </div>

            {expanded === ot.id && (
              <div className="border-t border-gray-100 p-4">
                {ot.description && <p className="text-xs text-gray-500 mb-3 bg-gray-50 rounded-lg p-2.5">{ot.description}</p>}
                <Table>
                  <Thead><Tr>
                    <Th>Karyawan</Th><Th>Jam Mulai</Th><Th>Jam Selesai</Th><Th>Durasi</Th><Th>Catatan</Th><Th>Status SPL</Th><Th>Aktual Pulang</Th><Th>Lembur Aktual</Th>
                    {canApprove && ot.status === 'pending' && <Th>Aksi</Th>}
                  </Tr></Thead>
                  <Tbody>
                    {ot.items.map((it) => {
                      const att = it.attendance
                      const spl_mnt = it.duration ?? 0
                      const act_mnt = att?.overtime_minutes ?? null
                      // Status lembur aktual: hijau=sesuai, merah=kurang, kuning=lebih, abu=belum ada data
                      const overtimeStatus = act_mnt === null ? null
                        : act_mnt >= spl_mnt ? 'match'
                        : act_mnt > 0 ? 'less'
                        : 'none'
                      const overtimeBadge = {
                        match: 'bg-green-50 text-green-700',
                        less:  'bg-red-50 text-red-600',
                        more:  'bg-amber-50 text-amber-700',
                        none:  'bg-gray-50 text-gray-400',
                      }[overtimeStatus] ?? 'bg-gray-50 text-gray-400'

                      return (
                      <Tr key={it.id}>
                        <Td className="font-medium text-gray-900">{it.employee}</Td>
                        <Td>{it.start}</Td>
                        <Td>{it.end}</Td>
                        <Td>{fDuration(it.duration)}</Td>
                        <Td className="text-gray-400">{it.notes || '-'}</Td>
                        <Td><Badge status={it.status} /></Td>
                        <Td className="font-mono text-xs">
                          {att?.actual_end_time
                            ? <span className="text-gray-700">{att.actual_end_time.slice(0,5)}</span>
                            : <span className="text-gray-300">-</span>}
                        </Td>
                        <Td>
                          {act_mnt === null
                            ? <span className="text-xs text-gray-300">-</span>
                            : <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${overtimeBadge}`}>
                                {fDuration(act_mnt)}
                                {overtimeStatus === 'match' && ' ✓'}
                                {overtimeStatus === 'less' && ' ↓'}
                              </span>
                          }
                        </Td>
                        {canApprove && ot.status === 'pending' && (
                          <Td>
                            {it.status === 'pending' && (
                              <div className="flex gap-1">
                                <button onClick={() => handleApproveItem(ot.id, it.id)} className="p-1.5 bg-green-50 text-green-600 rounded-md hover:bg-green-100"><Check size={13} /></button>
                                <button onClick={() => handleRejectItem(ot.id, it.id)} className="p-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100"><X size={13} /></button>
                              </div>
                            )}
                          </Td>
                        )}
                      </Tr>
                    )})}
                  </Tbody>
                </Table>
              </div>
            )}
          </Card>
        ))}
      </div>

      <OvertimeCreateModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={load} user={user} company={company} isDept={isDept} />

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        danger loading={deleting} title="Hapus SPL Lembur"
        message={deleteTarget ? `Hapus SPL ${deleteTarget.no}? Semua item lembur dalam SPL ini akan ikut terhapus.` : ''}
      />
    </div>
  )
}

// ── Multi-item Overtime Creation Modal ──────────────────────────────────────────
function OvertimeCreateModal({ open, onClose, onCreated, user, company, isDept }) {
  const role = user?.roles?.[0]
  const isSuperAdmin = role === 'super_admin'
  // HRD & staff_dept: perusahaan terkunci ke perusahaan user.
  // Super admin & coordinator/field_officer: bebas pilih perusahaan.
  const companyLocked = ['hrd', 'staff_dept'].includes(role)
  const lockedCompanyId = companyLocked ? (user?.company_id || company?.id || '') : ''

  const [companies, setCompanies] = useState([])
  const [selectedEmployees, setSelectedEmployees] = useState({})
  const { register, control, handleSubmit, watch, reset, formState: { isSubmitting } } = useForm({
    defaultValues: {
      company_id: lockedCompanyId || company?.id || '',
      date: new Date().toISOString().slice(0, 10),
      department: user?.department || '',
      description: '',
      items: [{ start: '17:00', end: '19:00', notes: '' }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const selectedCompanyId = watch('company_id')

  useEffect(() => {
    if (open) {
      getCompanies().then(setCompanies)
      setSelectedEmployees({})
      const cid = lockedCompanyId || company?.id || user?.company_id || ''
      reset({
        company_id: cid,
        date: new Date().toISOString().slice(0, 10),
        department: user?.department || '',
        description: '',
        items: [{ start: '17:00', end: '19:00', notes: '' }],
      })
    }
  }, [open])

  function calcDuration(start, end) {
    if (!start || !end) return 0
    const [sh, sm] = start.split(':').map(Number)
    const [eh, em] = end.split(':').map(Number)
    let mins = (eh * 60 + em) - (sh * 60 + sm)
    if (mins < 0) mins += 24 * 60
    return mins
  }

  async function onSubmit(data) {
    try {
      const items = data.items.map((it, idx) => {
        const emp = selectedEmployees[idx]
        return { ...it, employee_id: emp?.id || '', employee: emp?.name || '', duration: calcDuration(it.start, it.end) }
      }).filter(it => it.employee_id)

      if (!items.length) { toast.error('Pilih minimal 1 karyawan'); return }

      const payload = {
        company_id: data.company_id,
        department: data.department || null,
        date: data.date,
        description: data.description,
        requestedBy: user.name,
        items,
      }
      console.log('[Overtime] submit payload:', JSON.stringify(payload, null, 2))

      await createOvertimeRequest(payload)
      toast.success('Pengajuan lembur berhasil dikirim')
      onClose(); onCreated()
    } catch (err) {
      const msg = err?.response?.data?.message
        || err?.response?.data?.errors && JSON.stringify(err.response.data.errors)
        || err?.message
        || 'Gagal membuat pengajuan'
      console.error('[Overtime] error:', err?.response?.data || err)
      toast.error(msg)
    }
  }

  return (
    <Modal
      open={open} onClose={onClose} size="xl" title="Buat Pengajuan Lembur"
      subtitle="Tambahkan beberapa karyawan sekaligus dalam satu nomor lembur"
      footer={
        <div className="flex items-center justify-between w-full">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <ClockIcon size={12} />
            {fields.length} karyawan dalam pengajuan ini
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Batal</Button>
            <Button type="button" variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Ajukan Lembur</Button>
          </div>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Header form */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Perusahaan</label>
            <select
              {...register('company_id', { required: true })}
              disabled={companyLocked}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none disabled:bg-gray-50 disabled:text-gray-500"
            >
              <option value="">-- Pilih Perusahaan --</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {companyLocked && <p className="text-[11px] text-gray-400 mt-1">Terkunci ke perusahaan Anda</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Tanggal Lembur</label>
            <input type="date" {...register('date', { required: true })} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Keterangan / Alasan Lembur</label>
          <input {...register('description')} placeholder="Lembur produksi batch 07/2026..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
        </div>

        {/* Tabel karyawan lembur */}
        <div>
          <p className="text-xs font-semibold text-gray-700 mb-2">Daftar Karyawan Lembur</p>
          <div className="rounded-xl border border-gray-200 overflow-visible">

            {/* Header tabel */}
            <div className="bg-gray-50 border-b border-gray-200 grid" style={{ gridTemplateColumns: '1fr 145px 145px 1fr 36px' }}>
              {['Karyawan', 'Jam Mulai', 'Jam Selesai', 'Catatan', ''].map((h, i) => (
                <div key={i} className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wide ${i > 0 ? 'border-l border-gray-200' : ''}`}>{h}</div>
              ))}
            </div>

            {/* Baris data */}
            {fields.map((field, idx) => (
              <OvertimeRowEmployee
                key={field.id}
                idx={idx}
                register={register}
                companyId={selectedCompanyId}
                userRole={user?.roles?.[0]}
                userDepartment={user?.department}
                selectedEmployee={selectedEmployees[idx] || null}
                onEmployeeChange={(emp) => setSelectedEmployees(prev => ({ ...prev, [idx]: emp }))}
                onRemove={() => {
                  if (fields.length > 1) {
                    remove(idx)
                    setSelectedEmployees(prev => {
                      const n = {}
                      Object.keys(prev).forEach(k => {
                        const ki = parseInt(k)
                        if (ki < idx) n[ki] = prev[k]
                        else if (ki > idx) n[ki - 1] = prev[k]
                      })
                      return n
                    })
                  }
                }}
                canRemove={fields.length > 1}
              />
            ))}

            {/* Tambah baris — footer tabel kiri bawah */}
            <div className="px-3 py-2 bg-gray-50 border-t border-gray-200">
              <button type="button" onClick={() => append({ start: '17:00', end: '19:00', notes: '' })}
                className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                <Plus size={13} /> Tambah Baris
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

/**
 * Satu baris karyawan lembur dengan layout 2 sub-baris di kolom Karyawan:
 *   Sub-baris 1: [divisi] [dept]   ← filter (hanya role non-staff_dept)
 *   Sub-baris 2: [🔍 cari nama]    ← search
 * Kolom waktu & catatan di-align ke tengah baris.
 */
function OvertimeRowEmployee({ idx, register, companyId, userRole, userDepartment,
  selectedEmployee, onEmployeeChange, onRemove, canRemove }) {
  const isStaffDept = userRole === 'staff_dept'
  const [divisions, setDivisions] = useState([])
  const [departments, setDepartments] = useState([])
  const [filterDiv, setFilterDiv] = useState('all')
  const [filterDept, setFilterDept] = useState(
    isStaffDept && userDepartment ? userDepartment : 'all'
  )

  useEffect(() => {
    if (!companyId || companyId === 'all') return
    getEmployeeDivisions(companyId).then(setDivisions).catch(() => {})
    getEmployeeDepartments(companyId).then(setDepartments).catch(() => {})
  }, [companyId])

  useEffect(() => {
    if (!companyId || companyId === 'all' || filterDiv === 'all') return
    getEmployeeDepartments(companyId, filterDiv).then(setDepartments).catch(() => {})
    setFilterDept('all')
  }, [filterDiv])

  return (
    <div className="grid border-b border-gray-100 last:border-0 hover:bg-gray-50/40 transition-colors"
      style={{ gridTemplateColumns: '1fr 145px 145px 1fr 36px' }}>

      {/* Kolom Karyawan — 2 sub-baris */}
      <div className="p-2 space-y-1">
        {/* Sub-baris 1: filter divisi + dept (tidak untuk staff_dept) */}
        {!isStaffDept && (
          <div className="flex gap-1">
            <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
              className="flex-1 min-w-0 text-xs px-1.5 py-1 border border-gray-200 rounded bg-white outline-none focus:border-brand text-gray-600 truncate">
              <option value="all">Semua Divisi</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="flex-1 min-w-0 text-xs px-1.5 py-1 border border-gray-200 rounded bg-white outline-none focus:border-brand text-gray-600 truncate">
              <option value="all">Semua Dept</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}
        {/* Sub-baris 2: search karyawan */}
        <EmployeeAutocomplete
          value={selectedEmployee}
          onChange={onEmployeeChange}
          companyId={companyId}
          userRole={userRole}
          userDepartment={userDepartment}
          hideFilters
          externalDivId={filterDiv}
          externalDept={isStaffDept ? userDepartment : filterDept}
          placeholder="Cari nama atau NIK..."
        />
      </div>

      {/* Jam Mulai */}
      <div className="p-2 border-l border-gray-100 flex items-center">
        <input type="time" {...register(`items.${idx}.start`, { required: true })}
          className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-brand" />
      </div>

      {/* Jam Selesai */}
      <div className="p-2 border-l border-gray-100 flex items-center">
        <input type="time" {...register(`items.${idx}.end`, { required: true })}
          className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-brand" />
      </div>

      {/* Catatan */}
      <div className="p-2 border-l border-gray-100 flex items-center">
        <input {...register(`items.${idx}.notes`)} placeholder="Opsional..."
          className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-lg bg-white outline-none focus:border-brand" />
      </div>

      {/* Aksi */}
      <div className="flex items-center justify-center border-l border-gray-100">
        <button type="button" onClick={onRemove} disabled={!canRemove}
          className="p-1.5 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-20 transition-colors">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
