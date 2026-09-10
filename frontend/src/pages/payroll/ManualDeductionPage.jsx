import { useEffect, useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Trash2, Edit2, AlertCircle, Search, X, ChevronDown } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import {
  getManualDeductions, createManualDeduction, updateManualDeduction, deleteManualDeduction,
  getCompanies, getEmployeeDivisions, getEmployeeDepartments, getEmployees,
} from '../../api/realService'
import { Card, CardHeader, CardTitle, CardBody, Select, Input } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination } from '../../components/ui/Table'
import { fCurrency, MONTHS_ID } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

const DEDUCTION_TYPES = [
  { value: 'kasbon',        label: 'Kasbon / Pinjaman' },
  { value: 'cicilan',       label: 'Cicilan' },
  { value: 'denda',         label: 'Denda' },
  { value: 'keterlambatan', label: 'Keterlambatan' },
  { value: 'kerusakan',     label: 'Kerusakan Barang' },
  { value: 'other',         label: 'Lainnya' },
]

const THIS_MONTH = new Date().getMonth() + 1
const THIS_YEAR  = new Date().getFullYear()

// ── Employee Autocomplete Cascading ───────────────────────────────────────────
function EmployeeCascade({ companyId, value, onChange, disabled }) {
  const [divisions,   setDivisions]   = useState([])
  const [departments, setDepartments] = useState([])
  const [employees,   setEmployees]   = useState([])
  const [divId,       setDivId]       = useState('')
  const [dept,        setDept]        = useState('')
  const [search,      setSearch]      = useState('')
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const ref = useRef()

  // Reset saat perusahaan berubah
  useEffect(() => {
    setDivId(''); setDept(''); setSearch(''); onChange(null)
    setDivisions([]); setDepartments([]); setEmployees([])
    if (companyId) getEmployeeDivisions(companyId).then(setDivisions).catch(() => {})
  }, [companyId])

  // Load departemen saat divisi berubah
  useEffect(() => {
    setDept(''); setSearch(''); onChange(null); setEmployees([])
    if (companyId) getEmployeeDepartments(companyId, divId || null).then(setDepartments).catch(() => {})
  }, [divId])

  // Load karyawan saat departemen berubah (max 50)
  useEffect(() => {
    setSearch(''); onChange(null); setEmployees([])
    if (companyId) {
      setLoading(true)
      const filters = { company_id: companyId, status: 'active', per_page: 200 }
      if (divId) filters.division_id = divId
      if (dept)  filters.department  = dept
      getEmployees(filters)
        .then(emp => setEmployees(Array.isArray(emp) ? emp : emp?.data || []))
        .catch(() => setEmployees([]))
        .finally(() => setLoading(false))
    }
  }, [dept, divId])

  // Close on outside click
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = search
    ? employees.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.nik?.includes(search))
    : employees

  const selected = value ? employees.find(e => e.id === value) : null

  return (
    <div className="space-y-2">
      {/* Divisi */}
      {divisions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Divisi</label>
          <select value={divId} onChange={e => setDivId(e.target.value)} disabled={disabled || !companyId}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 disabled:bg-gray-50">
            <option value="">Semua Divisi</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {/* Departemen */}
      {departments.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Departemen</label>
          <select value={dept} onChange={e => setDept(e.target.value)} disabled={disabled || !companyId}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 disabled:bg-gray-50">
            <option value="">Semua Departemen</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {/* Autocomplete karyawan */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Karyawan <span className="text-red-500">*</span>
          {loading && <span className="text-gray-400 ml-1">(memuat...)</span>}
          {!loading && employees.length > 0 && <span className="text-gray-400 ml-1">({employees.length} orang)</span>}
        </label>
        <div ref={ref} className="relative">
          <div
            onClick={() => { if (!disabled && companyId) { setOpen(o => !o) } }}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer bg-white transition-colors
              ${!companyId ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-gray-300 hover:border-blue-400'}
              ${open ? 'border-blue-500 ring-1 ring-blue-500' : ''}
            `}
          >
            {selected ? (
              <>
                <span className="flex-1 text-gray-800">{selected.name}</span>
                <span className="text-[11px] text-gray-400 font-mono">{selected.nik}</span>
                <button type="button" onClick={e => { e.stopPropagation(); onChange(null); setSearch('') }} className="text-gray-400 hover:text-red-500 ml-1">
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <Search size={13} className="text-gray-400 shrink-0" />
                <input
                  type="text" value={search} onChange={e => { setSearch(e.target.value); setOpen(true) }}
                  placeholder={companyId ? 'Cari nama / NIK karyawan...' : 'Pilih perusahaan dulu'}
                  disabled={!companyId}
                  className="flex-1 outline-none text-sm bg-transparent placeholder-gray-400"
                  onClick={e => e.stopPropagation()}
                />
                <ChevronDown size={13} className="text-gray-400 shrink-0" />
              </>
            )}
          </div>

          {open && !selected && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400 text-center">
                  {loading ? 'Memuat...' : search ? 'Karyawan tidak ditemukan' : 'Pilih divisi/departemen untuk filter'}
                </p>
              ) : filtered.slice(0, 80).map(emp => (
                <button key={emp.id} type="button"
                  onClick={() => { onChange(emp.id); setOpen(false); setSearch('') }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 text-left"
                >
                  <div>
                    <p className="font-medium text-gray-800">{emp.name}</p>
                    <p className="text-[11px] text-gray-400">{emp.department || 'Tanpa Departemen'}</p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono shrink-0 ml-2">{emp.nik}</span>
                </button>
              ))}
              {filtered.length > 80 && (
                <p className="px-3 py-2 text-[11px] text-gray-400 text-center border-t">+{filtered.length - 80} lainnya — ketik untuk filter</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ManualDeductionPage() {
  const user    = useAuthStore(s => s.user)
  const company = useAuthStore(s => s.company)
  const isMulti = ['coordinator','super_admin'].includes(user?.roles?.[0])

  const [data, setData]           = useState(null)
  const [meta, setMeta]           = useState(null)
  const [companies, setCompanies] = useState([])
  const [filterCompany, setFilterCompany] = useState(isMulti ? 'all' : (user?.company_id || ''))
  const [filterMonth, setFilterMonth]     = useState(THIS_MONTH)
  const [filterYear, setFilterYear]       = useState(THIS_YEAR)
  const [filterStatus, setFilterStatus]   = useState('all')
  const [page, setPage] = useState(1)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  // Form state untuk modal tambah
  const [formCompany, setFormCompany] = useState(isMulti ? '' : (user?.company_id || company?.id || ''))
  const [formEmployee, setFormEmployee] = useState(null) // employee_id
  const [formMonth,   setFormMonth]   = useState(THIS_MONTH)
  const [formYear,    setFormYear]    = useState(THIS_YEAR)
  const [formType,    setFormType]    = useState('kasbon')
  const [formDesc,    setFormDesc]    = useState('')
  const [formAmount,  setFormAmount]  = useState('')
  const [formNotes,   setFormNotes]   = useState('')
  const [formStatus,  setFormStatus]  = useState('active')
  const [submitting,  setSubmitting]  = useState(false)

  useEffect(() => { if (isMulti) getCompanies().then(setCompanies) }, [])
  useEffect(() => { load(1) }, [filterCompany, filterMonth, filterYear, filterStatus])

  async function load(p = 1) {
    try {
      const cid = isMulti ? (filterCompany !== 'all' ? filterCompany : undefined) : (user?.company_id || company?.id)
      const res = await getManualDeductions({ company_id: cid, period_month: filterMonth, period_year: filterYear, status: filterStatus !== 'all' ? filterStatus : undefined, page: p })
      const raw = res?.data?.data || res?.data || []
      setData(Array.isArray(raw) ? raw : [])
      setMeta(res?.data?.meta || res?.meta || null)
      setPage(p)
    } catch { setData([]) }
  }

  function openAdd() {
    setEditing(null)
    setFormCompany(isMulti ? '' : (user?.company_id || company?.id || ''))
    setFormEmployee(null); setFormMonth(THIS_MONTH); setFormYear(THIS_YEAR)
    setFormType('kasbon'); setFormDesc(''); setFormAmount(''); setFormNotes('')
    setModalOpen(true)
  }

  function openEdit(item) {
    setEditing(item)
    setFormType(item.type); setFormDesc(item.description)
    setFormAmount(item.amount); setFormNotes(item.notes || ''); setFormStatus(item.status)
    setModalOpen(true)
  }

  async function onSubmit() {
    if (!editing && !formEmployee) { toast.error('Pilih karyawan terlebih dahulu'); return }
    if (!formDesc.trim()) { toast.error('Keterangan wajib diisi'); return }
    if (!formAmount || +formAmount <= 0) { toast.error('Nominal harus lebih dari 0'); return }

    setSubmitting(true)
    try {
      if (editing) {
        await updateManualDeduction(editing.id, { description: formDesc, type: formType, amount: +formAmount, notes: formNotes || null, status: formStatus })
        toast.success('Potongan berhasil diperbarui')
      } else {
        const cid = isMulti ? formCompany : (user?.company_id || company?.id)
        if (!cid) { toast.error('Pilih perusahaan'); setSubmitting(false); return }
        await createManualDeduction({ company_id: cid, employee_id: formEmployee, period_month: +formMonth, period_year: +formYear, type: formType, description: formDesc, amount: +formAmount, notes: formNotes || null })
        toast.success('Potongan berhasil ditambahkan')
      }
      setModalOpen(false); load(1)
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Gagal menyimpan')
    } finally { setSubmitting(false) }
  }

  async function handleDelete() {
    setDeleting(true)
    try { await deleteManualDeduction(deleteTarget.id); toast.success('Potongan dihapus'); setDeleteTarget(null); load(1) }
    catch { toast.error('Gagal menghapus') } finally { setDeleting(false) }
  }

  const total = data?.reduce((s, r) => s + (+r.amount || 0), 0) ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Potongan Gaji Manual</h2>
          <p className="text-sm text-gray-500 mt-0.5">Input potongan di luar kalkulasi otomatis sistem</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openAdd}>Tambah Potongan</Button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap items-end">
        {isMulti && (
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Perusahaan</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="cancelled">Dibatalkan</option>
        </select>
      </div>

      {data && data.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 rounded-lg ring-1 ring-amber-200 text-sm">
          <AlertCircle size={15} className="text-amber-600 shrink-0" />
          <span className="text-amber-800">Total potongan periode ini: <strong>{fCurrency(total)}</strong> dari {data.length} entri</span>
        </div>
      )}

      <Card>
        <CardBody className="p-0 sm:p-4">
          <Table>
            <Thead><Tr>
              <Th>Karyawan</Th><Th>Departemen</Th><Th>Jenis</Th><Th>Keterangan</Th><Th>Periode</Th><Th>Nominal</Th><Th>Status</Th><Th></Th>
            </Tr></Thead>
            <Tbody>
              {!data ? null : data.length === 0
                ? <TableEmpty colSpan={8} message="Tidak ada potongan manual untuk periode ini" />
                : data.map(item => (
                  <Tr key={item.id}>
                    <Td className="font-medium text-gray-900">{item.employee?.name}</Td>
                    <Td className="text-gray-500">{item.employee?.department || '-'}</Td>
                    <Td><Badge color="amber">{DEDUCTION_TYPES.find(t => t.value === item.type)?.label || item.type}</Badge></Td>
                    <Td className="text-gray-600 max-w-[200px] truncate">{item.description}</Td>
                    <Td className="text-gray-500 whitespace-nowrap">{MONTHS_ID[(item.period_month || 1) - 1]} {item.period_year}</Td>
                    <Td className="font-mono text-red-600 font-semibold whitespace-nowrap">{fCurrency(item.amount)}</Td>
                    <Td><Badge status={item.status === 'active' ? 'active' : 'inactive'} /></Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(item)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={13} /></button>
                        <button onClick={() => setDeleteTarget(item)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
                      </div>
                    </Td>
                  </Tr>
                ))
              }
            </Tbody>
          </Table>
          {meta && meta.last_page > 1 && (
            <Pagination page={page} totalPages={meta.last_page} onPageChange={p => load(p)} total={meta.total} perPage={25} />
          )}
        </CardBody>
      </Card>

      {/* Modal Tambah/Edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Potongan' : 'Tambah Potongan Manual'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={submitting} onClick={onSubmit}>{editing ? 'Simpan' : 'Tambah'}</Button>
        </>}
      >
        <div className="space-y-3">
          {!editing && (<>
            {/* Pilih Perusahaan */}
            {isMulti && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Perusahaan <span className="text-red-500">*</span></label>
                <select value={formCompany} onChange={e => setFormCompany(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500">
                  <option value="">-- Pilih Perusahaan --</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Cascading: Divisi → Departemen → Karyawan */}
            <EmployeeCascade
              companyId={formCompany || (isMulti ? '' : (user?.company_id || company?.id))}
              value={formEmployee}
              onChange={setFormEmployee}
            />

            {/* Periode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Periode Bulan</label>
                <select value={formMonth} onChange={e => setFormMonth(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500">
                  {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Tahun</label>
                <select value={formYear} onChange={e => setFormYear(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500">
                  {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </>)}

          {/* Jenis */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Jenis Potongan <span className="text-red-500">*</span></label>
            <select value={formType} onChange={e => setFormType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500">
              {DEDUCTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Keterangan <span className="text-red-500">*</span></label>
            <input type="text" value={formDesc} onChange={e => setFormDesc(e.target.value)}
              placeholder="Misal: Cicilan pinjaman bulan ke-3"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
          </div>

          {/* Nominal */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Nominal (Rp) <span className="text-red-500">*</span></label>
            <input type="number" value={formAmount} onChange={e => setFormAmount(e.target.value)}
              placeholder="500000" min={0}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
          </div>

          {/* Catatan */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Catatan (opsional)</label>
            <input type="text" value={formNotes} onChange={e => setFormNotes(e.target.value)}
              placeholder="Info tambahan..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500" />
          </div>

          {editing && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
              <select value={formStatus} onChange={e => setFormStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500">
                <option value="active">Aktif</option>
                <option value="cancelled">Dibatalkan</option>
              </select>
            </div>
          )}

          <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-2.5 ring-1 ring-blue-200">
            Potongan ini akan dimasukkan ke perhitungan gaji pada periode yang dipilih.
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        danger loading={deleting} title="Hapus Potongan"
        message={deleteTarget ? `Hapus potongan ${fCurrency(deleteTarget.amount)} untuk ${deleteTarget.employee?.name}?` : ''}
      />
    </div>
  )
}
