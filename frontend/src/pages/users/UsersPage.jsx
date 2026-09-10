import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Edit2, Trash2, ShieldCheck, UserCheck, Building2, Users as UsersIcon, KeyRound, Copy, Check, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getUsers, createUser, updateUser, deleteUser, resetUserPassword, getCompanies, getEmployeeDivisions, getEmployeeDepartments, getRolePermissions, updateRolePermissions } from '../../api/realService'
import { ALL_PERMISSIONS, ROLE_DEFINITIONS } from '../../api/mockData'
import { Card, CardHeader, CardTitle, CardBody, Select, Input, Switch } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination, PageSizeSelector, SortableTh } from '../../components/ui/Table'
import { useTableControls } from '../../hooks/useTableControls'
import { ROLE_LABELS, ROLE_COLORS, initials } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

const ROLE_ICONS = { coordinator: ShieldCheck, field_officer: UserCheck, hrd: Building2, staff_dept: UsersIcon }

// ── Modal tampilkan password sementara ────────────────────────────────────────
function TempPasswordModal({ open, onClose, data }) {
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(false)

  function copy() {
    navigator.clipboard.writeText(data?.temp_password || '')
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Modal open={open} onClose={onClose} title="User Berhasil Dibuat" size="sm"
      footer={<Button variant="primary" onClick={onClose}>Tutup & Lanjutkan</Button>}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg ring-1 ring-green-200">
          <Check size={18} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">{data?.user?.name}</p>
            <p className="text-xs text-green-600">{data?.user?.email}</p>
          </div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 ring-1 ring-amber-200 space-y-2">
          <p className="text-xs font-semibold text-amber-800">⚠ Simpan password ini — hanya tampil sekali!</p>
          <div className="flex items-center gap-2 bg-white rounded border border-amber-300 px-3 py-2">
            <code className="flex-1 text-sm font-mono tracking-wider text-gray-800">
              {show ? data?.temp_password : '••••••••••'}
            </code>
            <button onClick={() => setShow(s => !s)} className="text-gray-400 hover:text-gray-600 p-1">
              {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button onClick={copy} className="text-gray-400 hover:text-blue-600 p-1">
              {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
            </button>
          </div>
        </div>
        <div className="text-xs text-gray-500 space-y-1 bg-gray-50 p-3 rounded-lg">
          <p className="font-medium text-gray-700">Cara login user baru:</p>
          <p>Email: <strong>{data?.user?.email}</strong></p>
          <p>Password: <strong>{show ? data?.temp_password : '(klik 👁 untuk tampilkan)'}</strong></p>
          <p className="text-gray-400 mt-1">Sarankan user ganti password setelah login pertama via menu profil.</p>
        </div>
      </div>
    </Modal>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const user    = useAuthStore(s => s.user)
  const company = useAuthStore(s => s.company)
  const role    = user?.roles?.[0]
  const isCoordinator = ['coordinator', 'super_admin'].includes(role)
  const isHrd   = role === 'hrd'

  const [tab, setTab]         = useState(0)
  const [users, setUsers]     = useState(null)
  const [companies, setCompanies] = useState([])
  const [divisions, setDivisions] = useState([])
  const [departments, setDepartments] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [tempPwdData, setTempPwdData] = useState(null)

  const { register, handleSubmit, reset, watch, setValue, formState: { isSubmitting } } = useForm()
  const watchDivision  = watch('division_id')
  const watchCompany   = watch('company_id')

  // Role yang bisa dibuat sesuai hierarki
  const assignableRoles = isCoordinator
    ? Object.keys(ROLE_DEFINITIONS)
    : role === 'field_officer' ? ['hrd', 'staff_dept']
    : role === 'hrd' ? ['staff_dept']
    : []

  useEffect(() => {
    if (isCoordinator) getCompanies().then(setCompanies)
    load()
  }, [])

  // Load divisi saat company berubah
  useEffect(() => {
    const cid = isCoordinator ? watchCompany : (user?.company_id || company?.id)
    if (cid) {
      getEmployeeDivisions(cid).then(setDivisions).catch(() => setDivisions([]))
      getEmployeeDepartments(cid, null).then(setDepartments).catch(() => setDepartments([]))
    }
  }, [watchCompany])

  // Load departemen saat divisi berubah
  useEffect(() => {
    const cid = isCoordinator ? watchCompany : (user?.company_id || company?.id)
    if (cid && watchDivision) {
      getEmployeeDepartments(cid, watchDivision).then(setDepartments).catch(() => setDepartments([]))
    }
  }, [watchDivision])

  async function load() {
    const data = await getUsers({ company_id: isCoordinator ? 'all' : user.company_id })
    setUsers(data)
  }

  const tc = useTableControls(users, { defaultSortBy: 'name' })

  function openAdd() {
    setEditing(null)
    const defaultCompany = isCoordinator ? '' : (user?.company_id || company?.id || '')
    reset({ name: '', email: '', phone: '', role: '', company_id: defaultCompany, division_id: '', department: '' })
    setModalOpen(true)
    // Load divisi untuk company default
    if (defaultCompany) {
      getEmployeeDivisions(defaultCompany).then(setDivisions).catch(() => setDivisions([]))
      getEmployeeDepartments(defaultCompany).then(setDepartments).catch(() => setDepartments([]))
    }
  }

  function openEdit(u) {
    setEditing(u)
    reset({
      name: u.name, phone: u.phone || '',
      role: u.roles?.[0] || '',
      company_id: u.company_id || '',
      division_id: u.division_id || '',
      department: u.department || '',
      status: u.status,
    })
    setModalOpen(true)
    if (u.company_id) {
      getEmployeeDivisions(u.company_id).then(setDivisions).catch(() => setDivisions([]))
      getEmployeeDepartments(u.company_id).then(setDepartments).catch(() => setDepartments([]))
    }
  }

  async function onSubmit(data) {
    try {
      if (editing) {
        await updateUser(editing.id, {
          name: data.name, phone: data.phone || null,
          ...(isCoordinator && data.role ? { role: data.role } : {}),
          company_id: data.company_id || null,
          department: data.department || null, status: data.status,
        })
        toast.success('User berhasil diperbarui')
        setModalOpen(false); load()
      } else {
        const result = await createUser({
          name: data.name, email: data.email, phone: data.phone || null,
          roles: [data.role], company_id: data.company_id || null,
          department: data.department || null,
        })
        setModalOpen(false)
        setTempPwdData(result)
        load()
      }
    } catch (err) {
      const msg = err?.response?.data?.message
        || (err?.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(', ') : null)
        || err?.message || 'Gagal menyimpan user'
      toast.error(msg)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteUser(deleteTarget.id)
      toast.success('User berhasil dihapus')
      setDeleteTarget(null); load()
    } catch { toast.error('Gagal menghapus user') }
    finally { setDeleting(false) }
  }

  async function handleResetPassword(u) {
    try {
      const result = await resetUserPassword(u.id)
      setTempPwdData(result)
    } catch { toast.error('Gagal reset password') }
  }

  const myCompanyId = isCoordinator ? watchCompany : (user?.company_id || company?.id)

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Manajemen User</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola akun dan hak akses pengguna</p>
        </div>
        {assignableRoles.length > 0 && (
          <Button variant="primary" icon={Plus} onClick={openAdd}>Tambah User</Button>
        )}
      </div>

      <div className="flex border-b border-gray-200">
        {['Daftar User', 'Role & Permission'].map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm border-b-2 transition-colors ${tab === i ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >{t}</button>
        ))}
      </div>

      {tab === 0 && (
        <Card>
          <CardBody className="p-0 sm:p-4">
            {users && users.length > 0 && <div className="flex justify-end mb-2"><PageSizeSelector value={tc.perPage} onChange={tc.setPerPage} /></div>}
            <Table>
              <Thead><Tr>
                <SortableTh label="Nama" sortKey="name" sortBy={tc.sortBy} sortDir={tc.sortDir} onSort={tc.toggleSort} />
                <Th>Email</Th><Th>Role</Th><Th>Perusahaan</Th><Th>Departemen</Th><Th>Status</Th><Th></Th>
              </Tr></Thead>
              <Tbody>
                {!users ? null : users.length === 0 ? <TableEmpty colSpan={7} /> : tc.paginated.map(u => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-light text-brand flex items-center justify-center text-[10px] font-semibold flex-shrink-0">{initials(u.name)}</div>
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </div>
                    </Td>
                    <Td className="text-gray-500 text-xs">{u.email}</Td>
                    <Td><Badge color={ROLE_COLORS[u.roles?.[0]]}>{ROLE_LABELS[u.roles?.[0]] || u.roles?.[0]}</Badge></Td>
                    <Td>{u.companyName || <span className="text-gray-300">-</span>}</Td>
                    <Td>{u.department || <span className="text-gray-300">-</span>}</Td>
                    <Td><Badge status={u.status} /></Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(u)} title="Edit" className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"><Edit2 size={13} /></button>
                        <button onClick={() => handleResetPassword(u)} title="Reset password" className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-md"><KeyRound size={13} /></button>
                        <button onClick={() => setDeleteTarget(u)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={tc.page} totalPages={tc.totalPages} onPageChange={tc.setPage} total={tc.total} perPage={tc.perPage} />
          </CardBody>
        </Card>
      )}

      {tab === 1 && <PermissionMatrix currentRole={role} />}

      {/* Modal Tambah/Edit */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? `Edit User — ${editing.name}` : 'Tambah User Baru'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>
            {editing ? 'Simpan Perubahan' : 'Buat User'}
          </Button>
        </>}
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          {/* Nama */}
          <Input label="Nama Lengkap" placeholder="Nama pengguna" {...register('name', { required: true })} />

          {/* Email — hanya saat tambah baru */}
          {!editing && <Input label="Email" type="email" placeholder="email@domain.com" {...register('email', { required: true })} />}

          {/* Role — editable jika coordinator/super_admin, readonly jika tidak */}
          {editing ? (
            isCoordinator ? (
              <Select label="Role" {...register('role', { required: true })}>
                <option value="">-- Pilih Role --</option>
                {assignableRoles.map(r => <option key={r} value={r}>{ROLE_DEFINITIONS[r]?.label || r}</option>)}
              </Select>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Role</label>
                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 flex items-center gap-2">
                  <Badge color={ROLE_COLORS[editing.roles?.[0]]}>{ROLE_LABELS[editing.roles?.[0]] || editing.roles?.[0]}</Badge>
                  <span className="text-xs text-gray-400">(tidak dapat diubah)</span>
                </div>
              </div>
            )
          ) : (
            <Select label="Role" {...register('role', { required: true })}>
              <option value="">-- Pilih Role --</option>
              {assignableRoles.map(r => <option key={r} value={r}>{ROLE_DEFINITIONS[r]?.label || r}</option>)}
            </Select>
          )}

          {/* Perusahaan — readonly jika bukan coordinator */}
          {isCoordinator ? (
            <Select label="Perusahaan" {...register('company_id')}>
              <option value="">-- Pilih Perusahaan --</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          ) : (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Perusahaan</label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                {company?.name || '-'}
              </div>
              <input type="hidden" value={user?.company_id || company?.id || ''} {...register('company_id')} />
            </div>
          )}

          {/* Divisi */}
          {divisions.length > 0 && (
            <Select label="Divisi (opsional)" {...register('division_id')}>
              <option value="">-- Semua Divisi --</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}

          {/* Departemen — dropdown */}
          {departments.length > 0 ? (
            <Select label="Departemen" {...register('department')}>
              <option value="">-- Pilih Departemen --</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </Select>
          ) : (
            <Input label="Departemen" placeholder="Nama departemen" {...register('department')} />
          )}

          {/* Status — hanya saat edit */}
          {editing && (
            <Select label="Status" {...register('status')}>
              <option value="active">Aktif</option>
              <option value="inactive">Nonaktif</option>
            </Select>
          )}

          {!editing && (
            <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-3 ring-1 ring-blue-200">
              Password sementara akan ditampilkan setelah user dibuat.
            </div>
          )}
        </form>
      </Modal>

      <TempPasswordModal open={!!tempPwdData} onClose={() => setTempPwdData(null)} data={tempPwdData} />

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        danger loading={deleting} title="Hapus User"
        message={deleteTarget ? `Hapus user ${deleteTarget.name} (${deleteTarget.email})? Tidak dapat dibatalkan.` : ''}
      />
    </div>
  )
}

// ── Permission Matrix ─────────────────────────────────────────────────────────
function PermissionMatrix({ currentRole }) {
  const [rolePerms, setRolePerms] = useState({})
  const [myPerms, setMyPerms]     = useState([])
  const [saving, setSaving]       = useState(null)

  const isCoordinator = ['coordinator', 'super_admin'].includes(currentRole)
  const isHrd = currentRole === 'hrd'

  // Role di bawah user ini
  const managableRoles = isCoordinator
    ? Object.keys(ROLE_DEFINITIONS)
    : isHrd ? ['staff_dept']
    : []

  // Role yang bisa dilihat tapi tidak diedit (role sendiri)
  const viewOnlyRoles = isHrd ? ['hrd'] : []

  useEffect(() => {
    const rolesToLoad = [...new Set([...managableRoles, ...viewOnlyRoles, currentRole])]
    Promise.all(rolesToLoad.map(r => getRolePermissions(r).then(p => [r, p])))
      .then(entries => {
        const map = Object.fromEntries(entries)
        setRolePerms(map)
        setMyPerms(map[currentRole] || [])
      })
  }, [currentRole])

  async function togglePerm(role, permCode) {
    // HRD hanya bisa set permission <= permission miliknya
    if (isHrd && !myPerms.includes(permCode)) {
      toast.error('Anda tidak dapat memberikan permission yang tidak Anda miliki')
      return
    }

    const current = rolePerms[role] || []
    const updated = current.includes(permCode) ? current.filter(p => p !== permCode) : [...current, permCode]
    setRolePerms(prev => ({ ...prev, [role]: updated }))
    setSaving(role)
    await updateRolePermissions(role, updated)
    setSaving(null)
  }

  const rolesToShow = [...viewOnlyRoles, ...managableRoles.filter(r => !viewOnlyRoles.includes(r))]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role & Permission</CardTitle>
        {isHrd && <span className="text-xs text-gray-400">Tampil hanya untuk role yang dapat Anda kelola</span>}
      </CardHeader>
      <CardBody className="space-y-6">
        {rolesToShow.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-8">Anda tidak memiliki akses untuk mengatur permission.</p>
        )}
        {rolesToShow.map(roleKey => {
          const roleDef = ROLE_DEFINITIONS[roleKey]
          const Icon    = ROLE_ICONS[roleKey] || UsersIcon
          const isViewOnly = viewOnlyRoles.includes(roleKey)

          return (
            <div key={roleKey}>
              <div className="flex items-center gap-2 mb-3">
                <Icon size={16} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-800">{roleDef?.label || roleKey}</span>
                <Badge color={ROLE_COLORS[roleKey]}>{roleKey}</Badge>
                {isViewOnly && <span className="text-[11px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">hanya lihat</span>}
                {saving === roleKey && <span className="text-xs text-gray-400">Menyimpan...</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {ALL_PERMISSIONS.map(p => {
                  const checked = (rolePerms[roleKey] || []).includes(p.code)
                  const canToggle = !isViewOnly && (isCoordinator || myPerms.includes(p.code))
                  return (
                    <div key={p.code} className={`flex items-center justify-between px-3 py-2 border rounded-lg ${canToggle ? 'border-gray-100' : 'border-gray-50 bg-gray-50/50'}`}>
                      <span className={`text-xs ${canToggle ? 'text-gray-600' : 'text-gray-400'}`}>{p.label}</span>
                      <Switch checked={checked} onChange={() => canToggle && togglePerm(roleKey, p.code)} disabled={!canToggle} />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </CardBody>
    </Card>
  )
}
