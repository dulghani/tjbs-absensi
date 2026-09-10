import { useEffect, useState } from 'react'
import { Plus, Check, X, Trash2, Clock, UserX, LogOut } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import {
  getLeaveRequests, createLeaveRequest, approveLeave, rejectLeave, deleteLeave,
  getCompanies,
} from '../../api/realService'
import { Card, CardBody } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination } from '../../components/ui/Table'
import { fDate, MONTHS_ID } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'
import EmployeeCascade from '../../components/shared/EmployeeCascade'

const LEAVE_TYPES = [
  { value: 'not_present', label: 'Tidak Masuk',  icon: UserX,  color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'late',        label: 'Terlambat',    icon: Clock,  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'early_leave', label: 'Pulang Cepat', icon: LogOut, color: 'bg-blue-50 text-blue-700 border-blue-200' },
]

const TODAY = new Date().toISOString().slice(0, 10)
const THIS_MONTH = new Date().getMonth() + 1
const THIS_YEAR  = new Date().getFullYear()

function LeaveTypeBadge({ type }) {
  const t = LEAVE_TYPES.find(x => x.value === type)
  if (!t) return <span className="text-gray-400 text-xs">{type}</span>
  const Icon = t.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${t.color}`}>
      <Icon size={11} /> {t.label}
    </span>
  )
}

export default function LeavePage() {
  const user    = useAuthStore(s => s.user)
  const company = useAuthStore(s => s.company)
  // Baca role langsung dari user object dengan berbagai fallback
  const role = user?.role ?? user?.roles?.[0] ?? ''
  const isMulti    = ['coordinator','super_admin'].includes(role)
  // canApprove: hrd, coordinator, super_admin bisa approve
  const canApprove = ['coordinator','super_admin','hrd'].includes(role)
  const canSubmit  = role !== ''  // semua role yang sudah login bisa submit

  const [data, setData]   = useState(null)
  const [meta, setMeta]   = useState(null)
  const [companies, setCompanies] = useState([])
  const [filterCompany, setFilterCompany] = useState(isMulti ? 'all' : (user?.company_id || ''))
  const [filterStatus, setFilterStatus]   = useState('all')
  const [filterType,   setFilterType]     = useState('all')
  const [filterFrom, setFilterFrom] = useState(`${THIS_YEAR}-${String(THIS_MONTH).padStart(2,'0')}-01`)
  const [filterTo,   setFilterTo]   = useState(TODAY)
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [formCompany,  setFormCompany]  = useState(isMulti ? '' : (user?.company_id || company?.id || ''))
  const [formEmployee, setFormEmployee] = useState(null)
  const [formType,     setFormType]     = useState('not_present')
  const [formDate,     setFormDate]     = useState(TODAY)
  const [formTime,     setFormTime]     = useState('')
  const [formReason,   setFormReason]   = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  const [actionTarget, setActionTarget] = useState(null)
  const [actionNotes,  setActionNotes]  = useState('')
  const [actioning,    setActioning]    = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => { if (isMulti) getCompanies().then(setCompanies) }, [])
  useEffect(() => { load(1) }, [filterCompany, filterStatus, filterType, filterFrom, filterTo])

  async function load(p = 1) {
    try {
      const cid = isMulti ? (filterCompany !== 'all' ? filterCompany : undefined) : (user?.company_id || company?.id)
      const res = await getLeaveRequests({ company_id: cid, status: filterStatus !== 'all' ? filterStatus : undefined, leave_type: filterType !== 'all' ? filterType : undefined, from_date: filterFrom, to_date: filterTo, page: p, per_page: 25 })
      const rows = res?.data?.data || res?.data || []
      setData(Array.isArray(rows) ? rows : [])
      setMeta(res?.data?.meta || null)
      setPage(p)
    } catch { setData([]) }
  }

  function openAdd() {
    setFormCompany(isMulti ? '' : (user?.company_id || company?.id || ''))
    setFormEmployee(null); setFormType('not_present')
    setFormDate(TODAY); setFormTime(''); setFormReason('')
    setModalOpen(true)
  }

  async function onSubmit() {
    if (submitting) return   // cegah double submit
    if (!formEmployee) { toast.error('Pilih karyawan terlebih dahulu'); return }
    if (!formReason.trim()) { toast.error('Alasan wajib diisi'); return }
    const cid = isMulti ? formCompany : (user?.company_id || company?.id)
    if (!cid) { toast.error('Pilih perusahaan terlebih dahulu'); return }

    // Normalisasi jam ke HH:MM
    let actualTime = formTime || null
    if (actualTime && actualTime.length > 5) actualTime = actualTime.slice(0, 5)

    setSubmitting(true)
    try {
      await createLeaveRequest({
        company_id:  cid,
        employee_id: formEmployee,
        leave_type:  formType,
        leave_date:  formDate,
        actual_time: actualTime,
        reason:      formReason,
      })
      toast.success('Pengajuan izin berhasil ditambahkan')
      setModalOpen(false); load(1)
    } catch (err) {
      const msg = err?.response?.data?.message
        || (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join(', ')
          : null)
        || err?.message
        || 'Gagal menyimpan'
      toast.error(msg)
    } finally { setSubmitting(false) }
  }

  async function handleAction() {
    setActioning(true)
    try {
      if (actionTarget.action === 'approve') { await approveLeave(actionTarget.id, actionNotes); toast.success('Izin disetujui & absensi diperbarui') }
      else { await rejectLeave(actionTarget.id, actionNotes); toast.success('Izin ditolak') }
      setActionTarget(null); setActionNotes(''); load(page)
    } catch (err) { toast.error(err?.response?.data?.message || 'Gagal') }
    finally { setActioning(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await deleteLeave(deleteTarget.id); toast.success('Dihapus'); setDeleteTarget(null); load(1) }
    catch (err) { toast.error(err?.response?.data?.message || 'Gagal') }
    finally { setDeleting(false) }
  }

  const pendingCount = data?.filter(r => r.status === 'pending').length ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Izin Karyawan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Tidak masuk, terlambat, dan pulang cepat</p>
        </div>
        <div className="flex gap-2 items-center">
          {pendingCount > 0 && <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">{pendingCount} menunggu</span>}
          {canSubmit && <Button variant="primary" icon={Plus} onClick={openAdd}>Tambah Izin</Button>}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {isMulti && (
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Perusahaan</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Tipe</option>
          {LEAVE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
        <div className="flex items-center gap-1.5">
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
          <span className="text-gray-400">–</span>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="px-2 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none" />
        </div>
      </div>

      <Card>
        <CardBody className="p-0 sm:p-4">
          <Table>
            <Thead><Tr>
              <Th>Karyawan</Th><Th>Dept</Th><Th>Tipe</Th><Th>Tanggal</Th><Th>Jam</Th><Th>Alasan</Th><Th>Status</Th><Th>Diproses</Th><Th></Th>
            </Tr></Thead>
            <Tbody>
              {!data ? null : data.length === 0
                ? <TableEmpty colSpan={9} />
                : data.map(row => (
                  <Tr key={row.id}>
                    <Td className="font-medium text-gray-900">{row.employee?.name}</Td>
                    <Td className="text-gray-500 text-xs">{row.employee?.department || '-'}</Td>
                    <Td><LeaveTypeBadge type={row.leave_type} /></Td>
                    <Td className="whitespace-nowrap text-sm">{fDate(row.leave_date)}</Td>
                    <Td className="font-mono text-xs">{row.actual_time ? row.actual_time.slice(0,5) : '-'}</Td>
                    <Td className="text-gray-600 max-w-[160px] truncate text-xs">{row.reason}</Td>
                    <Td>
                      <Badge color={row.status==='approved'?'green':row.status==='rejected'?'red':'amber'}>
                        {row.status==='approved'?'Disetujui':row.status==='rejected'?'Ditolak':'Menunggu'}
                      </Badge>
                    </Td>
                    <Td className="text-gray-400 text-xs">{row.approved_by?.name || '-'}</Td>
                    <Td>
                      <div className="flex gap-1 flex-wrap">
                        {/* Debug: tampilkan info role jika tombol tidak muncul */}
                        {canApprove && !['approved','rejected'].includes(row.status) && (<>
                          <button onClick={() => { setActionTarget({id:row.id,action:'approve'}); setActionNotes('') }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-md">
                            <Check size={11}/> Setujui
                          </button>
                          <button onClick={() => { setActionTarget({id:row.id,action:'reject'}); setActionNotes('') }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md">
                            <X size={11}/> Tolak
                          </button>
                        </>)}
                        {!['approved','rejected'].includes(row.status) && (
                          <button onClick={() => setDeleteTarget(row)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md" title="Hapus"><Trash2 size={13}/></button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))
              }
            </Tbody>
          </Table>
          {meta?.last_page > 1 && <Pagination page={page} totalPages={meta.last_page} onPageChange={p => load(p)} total={meta.total} perPage={25} />}
        </CardBody>
      </Card>

      {/* Modal Tambah */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Pengajuan Izin"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button><Button variant="primary" loading={submitting} onClick={onSubmit}>Ajukan</Button></>}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">Tipe Izin <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-3 gap-2">
              {LEAVE_TYPES.map(t => { const Icon = t.icon; return (
                <button key={t.value} type="button" onClick={() => setFormType(t.value)}
                  className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${formType===t.value ? t.color+' ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                  <Icon size={16}/>{t.label}
                </button>
              )})}
            </div>
          </div>

          {isMulti && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Perusahaan <span className="text-red-500">*</span></label>
              <select value={formCompany} onChange={e => setFormCompany(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500">
                <option value="">-- Pilih Perusahaan --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          <EmployeeCascade companyId={formCompany || (!isMulti ? (user?.company_id||company?.id) : '')} value={formEmployee} onChange={setFormEmployee} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal <span className="text-red-500">*</span></label>
              <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500"/>
            </div>
            {formType !== 'not_present' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">{formType==='late'?'Jam Masuk Aktual':'Jam Pulang Aktual'}</label>
                <input type="time" value={formTime} onChange={e => setFormTime(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500"/>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Alasan <span className="text-red-500">*</span></label>
            <textarea value={formReason} onChange={e => setFormReason(e.target.value)} rows={2} placeholder="Keterangan izin..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 resize-none"/>
          </div>

          <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-2.5 ring-1 ring-blue-200">
            {formType==='not_present' && 'Setelah disetujui, status absensi berubah dari Absen → Izin.'}
            {formType==='late' && 'Setelah disetujui, keterlambatan tidak dianggap pelanggaran.'}
            {formType==='early_leave' && 'Setelah disetujui, pulang cepat tidak dianggap pelanggaran.'}
          </div>
        </div>
      </Modal>

      {/* Modal Approve/Reject */}
      <Modal open={!!actionTarget} onClose={() => setActionTarget(null)}
        title={actionTarget?.action==='approve'?'Setujui Izin':'Tolak Izin'} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setActionTarget(null)}>Batal</Button>
          <Button variant={actionTarget?.action==='approve'?'primary':'danger'} loading={actioning} onClick={handleAction}>
            {actionTarget?.action==='approve'?'Setujui':'Tolak'}
          </Button>
        </>}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Catatan (opsional)</label>
            <textarea value={actionNotes} onChange={e => setActionNotes(e.target.value)} rows={2} placeholder={actionTarget?.action==='approve'?'Catatan persetujuan...':'Alasan penolakan...'} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none resize-none focus:border-blue-500"/>
          </div>
          {actionTarget?.action==='approve' && <p className="text-xs text-green-700 bg-green-50 rounded-lg p-2.5 ring-1 ring-green-200">Data absensi akan diperbarui otomatis setelah disetujui.</p>}
        </div>
      </Modal>

      <ConfirmModal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} danger loading={deleting} title="Hapus Pengajuan Izin"
        message={deleteTarget ? `Hapus izin ${LEAVE_TYPES.find(t=>t.value===deleteTarget.leave_type)?.label} untuk ${deleteTarget.employee?.name}?` : ''} />
    </div>
  )
}
