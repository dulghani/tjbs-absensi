import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Plus, Search, Eye, Edit2, Trash2, Trash, UploadCloud, Download, Tag, UserX, UserCheck } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { getEmployeesPaginated, getEmployeeDepartments, getEmployeeDivisions, getCompanies, createEmployee, updateEmployee, deleteEmployee, bulkDeleteEmployees, importEmployeesGlobal, exportEmployees, getImportTemplate, toggleEmployeeStatus } from '../../api/realService'
import { Card, CardBody, Input, Select } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination, PageSizeSelector } from '../../components/ui/Table'
import { fDate } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

export default function EmployeesPage() {
  const user = useAuthStore((s) => s.user)
  const role = user?.roles?.[0]
  const isMultiCompany = ['coordinator', 'field_officer'].includes(role)
  const canEdit = ['coordinator', 'field_officer', 'hrd'].includes(role)

  const [employees, setEmployees] = useState(null)
  const [total, setTotal] = useState(0)
  const [companies, setCompanies] = useState([])
  const [departments, setDepartments] = useState([])
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const companyFromUrl = searchParams.get('company')
  const [filterCompany, setFilterCompany] = useState(companyFromUrl || (isMultiCompany ? 'all' : user.company_id))
  const [filterDivision, setFilterDivision] = useState('all')
  const [filterDepartment, setFilterDepartment] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [divisions, setDivisions] = useState([])
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importCompany, setImportCompany] = useState('')
  const [importing, setImporting] = useState(false)
  const [toggleTarget, setToggleTarget] = useState(null)
  const [toggleEndDate, setToggleEndDate] = useState(new Date().toISOString().slice(0, 10))
  const [toggling, setToggling] = useState(false)
  const [viewTarget, setViewTarget] = useState(null)
  const [bulkEditOpen, setBulkEditOpen] = useState(false)
  const [bulkEditField, setBulkEditField] = useState('position')
  const [bulkEditValue, setBulkEditValue] = useState('')
  const [bulkEditing, setBulkEditing] = useState(false)
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => {
    getCompanies().then(setCompanies)
    getEmployeeDivisions('all').then(setDivisions).catch(() => setDivisions([]))
  }, [])

  useEffect(() => {
    getEmployeeDivisions(filterCompany).then(setDivisions).catch(() => setDivisions([]))
    getEmployeeDepartments(filterCompany, null).then(setDepartments)
    setFilterDivision('all')
    setFilterDepartment('all')
  }, [filterCompany])

  // Saat divisi berubah → dept list menyempit sesuai divisi terpilih
  useEffect(() => {
    getEmployeeDepartments(filterCompany, filterDivision).then(setDepartments)
    setFilterDepartment('all')
  }, [filterDivision])
  useEffect(() => { setPage(1); setSelected(new Set()) }, [search, filterCompany, filterDivision, filterDepartment, filterStatus, perPage])
  useEffect(() => { load() }, [search, filterCompany, filterDivision, filterDepartment, filterStatus, page, perPage])

  async function load() {
    const result = await getEmployeesPaginated(
      { search, company_id: filterCompany, division_id: filterDivision, department: role === 'staff_dept' ? user.department : filterDepartment, status: filterStatus },
      page, perPage
    )
    setEmployees(result.data)
    setTotal(result.total)
    setSelected(new Set()) // data halaman berubah, reset centangan supaya tidak salah pilih baris lama
  }

  function openCreate() {
    setEditing(null)
    reset({ company_id: !isMultiCompany ? user.company_id : '', employmentStatus: 'contract' })
    setModalOpen(true)
  }

  function openEdit(e) {
    setEditing(e)
    reset({
      nik: e.nik,
      name: e.name,
      company_id: e.company_id,
      division_id: e.division_id || '',
      department: e.department || '',
      position: e.position || '',
      joinDate: e.joinDate || e.join_date || '',
      employmentStatus: e.employmentStatus || e.employment_status || 'contract',
      phone: e.phone || '',
      ktp: e.ktp || e.ktp_number || '',
      address: e.address || '',
    })
    setModalOpen(true)
  }

  async function onSubmit(data) {
    try {
      if (editing) { await updateEmployee(editing.id, data); toast.success('Data karyawan diperbarui') }
      else { await createEmployee({ ...data, nik: data.nik || String(Math.floor(Math.random() * 900000) + 100000) }); toast.success('Karyawan baru ditambahkan') }
      setModalOpen(false); load()
    } catch { toast.error('Gagal menyimpan data') }
  }

  async function handleDelete() {
    await deleteEmployee(deleteTarget.id)
    toast.success('Data karyawan dihapus')
    setDeleteTarget(null)
    load()
  }

  function toggleSelectAll() {
    if (selected.size === employees.length) setSelected(new Set())
    else setSelected(new Set(employees.map((e) => e.id)))
  }
  function toggleSelectOne(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      const result = await bulkDeleteEmployees(Array.from(selected))
      const count = result?.deleted ?? selected.size
      toast.success(`${count} karyawan berhasil dihapus`)
      setBulkDeleteOpen(false)
      setSelected(new Set())
      load()
    } catch (err) {
      toast.error(err?.message || 'Gagal menghapus karyawan terpilih')
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleToggleStatus() {
    if (!toggleTarget) return
    setToggling(true)
    try {
      const isActive = toggleTarget.status === 'active'
      await toggleEmployeeStatus(toggleTarget.id, isActive ? { end_date: toggleEndDate } : {})
      toast.success(isActive
        ? `${toggleTarget.name} dinonaktifkan per ${toggleEndDate}`
        : `${toggleTarget.name} diaktifkan kembali`)
      setToggleTarget(null)
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal mengubah status')
    } finally { setToggling(false) }
  }

  async function handleImport() {
    if (!importFile) return
    const targetCompany = isMultiCompany ? importCompany : user.company_id
    setImporting(true)
    try {
      const result = await importEmployeesGlobal(importFile, targetCompany || null)
      toast.success(`Import selesai: ${result.created} baru, ${result.updated} diperbarui`)
      setImportOpen(false); setImportFile(null); setImportCompany('')
      load()
    } catch (err) {
      toast.error(err?.message || 'Gagal import file')
    } finally { setImporting(false) }
  }

  async function handleExport() {
    try {
      const rows = await exportEmployees({ company_id: filterCompany, department: filterDepartment })
      if (!rows?.length) { toast.error('Tidak ada data untuk diexport'); return }

      // Bangun Excel menggunakan SheetJS yang sudah terinstall
      const XLSX = await import('xlsx')
      const ws = XLSX.utils.json_to_sheet(rows)
      // Set lebar kolom supaya mudah dibaca
      ws['!cols'] = [8, 35, 25, 20, 25, 15, 15, 18].map(w => ({ wch: w }))
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Karyawan')
      XLSX.writeFile(wb, `karyawan-${new Date().toISOString().slice(0,10)}.xlsx`)
      toast.success(`${rows.length} karyawan berhasil diexport`)
    } catch { toast.error('Gagal export') }
  }

  async function handleBulkEdit() {
    if (!bulkEditValue.trim() || !selected.size) return
    setBulkEditing(true)
    try {
      // Update satu-satu (tidak ada bulk update endpoint, tapi ini paralel jadi tetap cepat)
      await Promise.all(
        Array.from(selected).map(id => updateEmployee(id, { [bulkEditField]: bulkEditValue.trim() }))
      )
      toast.success(`${selected.size} karyawan diperbarui`)
      setBulkEditOpen(false)
      setBulkEditValue('')
      setSelected(new Set())
      load()
    } catch { toast.error('Gagal bulk update') } finally { setBulkEditing(false) }
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const allSelected = employees?.length > 0 && selected.size === employees.length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Data Karyawan</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} karyawan ditemukan{selected.size > 0 ? ` · ${selected.size} dipilih` : ''}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {canEdit && selected.size > 0 && (
            <>
              <Button variant="secondary" icon={Tag} onClick={() => { setBulkEditField('position'); setBulkEditValue(''); setBulkEditOpen(true) }}>
                Set Jabatan ({selected.size})
              </Button>
              <Button variant="secondary" icon={Tag} onClick={() => { setBulkEditField('department'); setBulkEditValue(''); setBulkEditOpen(true) }}>
                Set Departemen ({selected.size})
              </Button>
              <Button variant="danger" icon={Trash} onClick={() => setBulkDeleteOpen(true)}>Hapus ({selected.size})</Button>
            </>
          )}
          <Button variant="secondary" icon={Download} onClick={handleExport}>Export Excel</Button>
          {canEdit && <Button variant="secondary" icon={UploadCloud} onClick={() => setImportOpen(true)}>Import Excel</Button>}
          {canEdit && <Button variant="primary" icon={Plus} onClick={openCreate}>Tambah</Button>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Cari nama/NIK..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand bg-white"
          />
        </div>
        {isMultiCompany && (
          <select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Perusahaan</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Divisi</option>
          <option value="null">— Tanpa Divisi</option>
          {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {role !== 'staff_dept' && (
          <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
            <option value="all">Semua Departemen</option>
            <option value="null">— Tanpa Departemen</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none">
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="inactive">Nonaktif</option>
        </select>
        <div className="ml-auto">
          <PageSizeSelector value={perPage} onChange={setPerPage} />
        </div>
      </div>

      <Card>
        <CardBody className="p-0 sm:p-4">
          <Table>
            <Thead>
              <Tr>
                {canEdit && (
                  <Th className="w-8">
                    <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded border-gray-300 text-brand cursor-pointer" />
                  </Th>
                )}
                <Th>NIK</Th><Th>Nama</Th>
                {isMultiCompany && <Th>Perusahaan</Th>}
                <Th>Divisi</Th><Th>Departemen</Th><Th>Jabatan</Th><Th>Tgl Masuk</Th><Th>Tgl Keluar</Th><Th>Status</Th><Th></Th>
              </Tr>
            </Thead>
            <Tbody>
              {!employees ? null : employees.length === 0 ? (
                <TableEmpty colSpan={9} message="Tidak ada data karyawan" />
              ) : employees.map((emp) => (
                <Tr key={emp.id} className={selected.has(emp.id) ? 'bg-brand-light/40' : ''}>
                  {canEdit && (
                    <Td>
                      <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelectOne(emp.id)} className="w-4 h-4 rounded border-gray-300 text-brand cursor-pointer" />
                    </Td>
                  )}
                  <Td className="font-mono text-xs">{emp.nik}</Td>
                  <Td className="font-medium text-gray-900">{emp.name}</Td>
                  {isMultiCompany && <Td><Badge color="bg-blue-50 text-blue-700 ring-blue-200">{emp.companyName}</Badge></Td>}
                  <Td className="text-xs text-gray-500">{emp.divisionName || '-'}</Td>
                  <Td>{emp.department}</Td>
                  <Td>{emp.position}</Td>
                  <Td>{fDate(emp.joinDate)}</Td>
                  <Td className={emp.status === 'inactive' ? 'text-red-500 text-xs' : 'text-xs text-gray-400'}>
                    {emp.end_date ? fDate(emp.end_date) : '-'}
                  </Td>
                  <Td><Badge status={emp.status} /></Td>
                  <Td>
                    <div className="flex gap-1">
                      <button onClick={() => setViewTarget(emp)} title="Lihat detail" className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md"><Eye size={14} /></button>
                      {canEdit && <button onClick={() => openEdit(emp)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-gray-100 rounded-md"><Edit2 size={14} /></button>}
                      {canEdit && (
                        <button
                          onClick={() => { setToggleTarget(emp); setToggleEndDate(new Date().toISOString().slice(0, 10)) }}
                          title={emp.status === 'active' ? 'Nonaktifkan karyawan' : 'Aktifkan kembali'}
                          className={`p-1.5 rounded-md ${emp.status === 'active' ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                        >
                          {emp.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                      )}
                      {canEdit && <button onClick={() => setDeleteTarget(emp)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-md"><Trash2 size={14} /></button>}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} perPage={perPage} />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} size="lg"
        title={editing ? 'Edit Data Karyawan' : 'Tambah Data Karyawan'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="NIK" placeholder="Auto generate jika kosong" {...register('nik')} />
            <Input label="Nama Lengkap" placeholder="Nama sesuai KTP" {...register('name', { required: true })} error={errors.name && 'Wajib diisi'} />
          </div>
          {isMultiCompany && (
            <Select label="Perusahaan" {...register('company_id', { required: true })}>
              <option value="">-- Pilih Perusahaan --</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          )}
          <EmployeeFormDivisionDept
            key={editing?.id || 'new'}
            companyId={isMultiCompany ? watch('company_id') : user.company_id}
            register={register}
            watch={watch}
            setValue={setValue}
            defaultDivisionId={editing?.division_id}
            defaultDepartment={editing?.department}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jabatan" placeholder="Posisi/jabatan" {...register('position')} />
            <Input label="Tgl Mulai Kerja" type="date" {...register('joinDate', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Status Kepegawaian" {...register('employmentStatus')}>
              <option value="permanent">Tetap</option>
              <option value="contract">Kontrak</option>
              <option value="probation">Percobaan</option>
              <option value="temporary">Harian/Lepas</option>
            </Select>
            <Input label="No. HP" placeholder="08xx-xxxx-xxxx" {...register('phone')} />
          </div>
          <Input label="No. KTP" placeholder="16 digit NIK KTP" {...register('ktp')} />
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Alamat</label>
            <textarea rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-brand resize-none" placeholder="Alamat lengkap" {...register('address')} />
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} danger
        title="Hapus Karyawan" message={`Apakah Anda yakin ingin menghapus data ${deleteTarget?.name}? Tindakan ini tidak dapat dibatalkan.`}
      />

      <ConfirmModal
        open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)} onConfirm={handleBulkDelete} danger loading={bulkDeleting}
        title="Hapus Beberapa Karyawan" message={`Yakin hapus ${selected.size} karyawan yang dipilih? Data absensi & mapping PIN terkait juga ikut terhapus. Tindakan ini tidak dapat dibatalkan.`}
      />

      {/* Modal Nonaktifkan / Aktifkan Kembali */}
      <Modal
        open={!!toggleTarget} onClose={() => setToggleTarget(null)} size="sm"
        title={toggleTarget?.status === 'active' ? 'Nonaktifkan Karyawan' : 'Aktifkan Kembali Karyawan'}
        footer={<>
          <Button variant="secondary" onClick={() => setToggleTarget(null)}>Batal</Button>
          <Button
            variant={toggleTarget?.status === 'active' ? 'danger' : 'primary'}
            loading={toggling} onClick={handleToggleStatus}
          >
            {toggleTarget?.status === 'active' ? 'Nonaktifkan' : 'Aktifkan Kembali'}
          </Button>
        </>}
      >
        {toggleTarget && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              {toggleTarget.status === 'active'
                ? `Karyawan <b>${toggleTarget.name}</b> akan dinonaktifkan. Status absensi dan penggajian akan berhenti per tanggal yang dipilih.`
                : `Karyawan <b>${toggleTarget.name}</b> akan diaktifkan kembali. Tanggal keluar akan dihapus.`
              }
            </p>
            {toggleTarget.status === 'active' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Tanggal Nonaktif <span className="text-red-500">*</span></label>
                <input
                  type="date"
                  value={toggleEndDate}
                  onChange={e => setToggleEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand"
                />
                <p className="text-[11px] text-gray-400 mt-1">Tanggal ini akan tercatat sebagai hari terakhir kerja karyawan.</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal View Detail Karyawan */}
      <Modal
        open={!!viewTarget} onClose={() => setViewTarget(null)} size="sm"
        title="Detail Karyawan"
        footer={<>
          <Button variant="secondary" onClick={() => setViewTarget(null)}>Tutup</Button>
          {canEdit && <Button variant="primary" icon={Edit2} onClick={() => { openEdit(viewTarget); setViewTarget(null) }}>Edit</Button>}
        </>}
      >
        {viewTarget && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Field label="NIK" value={viewTarget.nik} />
              <Field label="Status" value={<Badge status={viewTarget.status} />} />
            </div>
            <Field label="Nama Lengkap" value={viewTarget.name} bold />
            <Field label="Perusahaan" value={viewTarget.companyName} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Divisi" value={viewTarget.divisionName || '-'} />
              <Field label="Departemen" value={viewTarget.department || '-'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jabatan" value={viewTarget.position || '-'} />
              <Field label="Status Kepegawaian" value={viewTarget.employmentStatus || '-'} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tgl Masuk" value={fDate(viewTarget.joinDate)} />
              <Field label="Tgl Keluar" value={viewTarget.end_date ? fDate(viewTarget.end_date) : '-'} />
            </div>
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
              <Field label="No. HP" value={viewTarget.phone || '-'} />
              <Field label="No. KTP" value={viewTarget.ktp || viewTarget.ktp_number || '-'} />
            </div>
            {viewTarget.address && <Field label="Alamat" value={viewTarget.address} />}
          </div>
        )}
      </Modal>

      <Modal
        open={bulkEditOpen} onClose={() => setBulkEditOpen(false)} size="sm"
        title={`Set ${bulkEditField === 'position' ? 'Jabatan' : 'Departemen'} — ${selected.size} Karyawan`}
        footer={<>
          <Button variant="secondary" onClick={() => setBulkEditOpen(false)}>Batal</Button>
          <Button variant="primary" loading={bulkEditing} disabled={!bulkEditValue.trim()} onClick={handleBulkEdit}>
            Terapkan ke {selected.size} Karyawan
          </Button>
        </>}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {bulkEditField === 'position'
              ? 'Isi jabatan yang sama untuk semua karyawan terpilih sekaligus.'
              : 'Isi departemen yang sama untuk semua karyawan terpilih sekaligus.'}
          </p>
          <Input
            label={bulkEditField === 'position' ? 'Jabatan' : 'Departemen'}
            placeholder={bulkEditField === 'position' ? 'Operator Produksi, Security, dll' : 'Produksi, Gudang, dll'}
            value={bulkEditValue}
            onChange={e => setBulkEditValue(e.target.value)}
            autoFocus
          />
          <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-2.5 ring-1 ring-amber-200">
            Ini akan menimpa {bulkEditField === 'position' ? 'jabatan' : 'departemen'} yang sudah ada sebelumnya untuk semua {selected.size} karyawan terpilih.
          </div>
        </div>
      </Modal>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title="Import Karyawan dari Excel" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setImportOpen(false)}>Batal</Button>
          <Button variant="primary" icon={UploadCloud} loading={importing} disabled={!importFile} onClick={handleImport}>Import Sekarang</Button>
        </>}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">Format: file export karyawan dari Fingerspot (.xlsx)</p>
            <button
              onClick={async () => {
                const t = await getImportTemplate()
                const XLSX = await import('xlsx')
                const ws = XLSX.utils.aoa_to_sheet([t.headers, t.example[0]])
                ws['!cols'] = t.headers.map((_, i) => ({ wch: [8,8,20,15,15,8,15,15,12,15][i] || 15 }))
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, 'Template')
                XLSX.writeFile(wb, 'template-import-karyawan.xlsx')
              }}
              className="text-xs text-brand hover:underline flex items-center gap-1"
            >
              <Download size={12} /> Download Template
            </button>
          </div>

          {isMultiCompany && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Perusahaan Tujuan <span className="text-red-500">*</span></label>
              <select
                value={importCompany}
                onChange={(e) => setImportCompany(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand"
              >
                <option value="">-- Pilih perusahaan yang menerima data ini --</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-xs text-gray-400 mt-1">Data karyawan dalam file akan dimasukkan ke perusahaan ini. Kolom "Kantor" dipakai sebagai divisi.</p>
            </div>
          )}

          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <input type="file" accept=".xlsx,.xls" className="hidden" id="emp-import-file"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
            <label htmlFor="emp-import-file" className="cursor-pointer">
              <UploadCloud size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">{importFile ? importFile.name : 'Klik untuk pilih file .xlsx'}</p>
            </label>
          </div>

          <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-2.5 ring-1 ring-amber-200">
            Import aman diulang — data yang sudah ada akan diperbarui berdasarkan NIK, tidak dobel.
          </div>
        </div>
      </Modal>
    </div>
  )
}

/**
 * Cascade: Perusahaan → Divisi → Departemen
 * - Divisi  : dari data karyawan (getEmployeeDivisions)
 * - Departemen: dari data karyawan, difilter by divisi yang dipilih (getEmployeeDepartments)
 * - Keduanya selalu dropdown (tidak pernah input teks bebas)
 */
function EmployeeFormDivisionDept({ companyId, register, watch, setValue, defaultDivisionId, defaultDepartment }) {
  const [divs, setDivs] = useState([])
  const [depts, setDepts] = useState([])

  // Nilai dari form state (controlled) — selalu sinkron
  const currentDivId = watch('division_id') || ''
  const currentDept  = watch('department') || ''

  // Load divisi + restore nilai edit saat companyId tersedia
  useEffect(() => {
    if (!companyId || companyId === 'all') { setDivs([]); setDepts([]); return }
    getEmployeeDivisions(companyId).then(divList => {
      setDivs(divList)
      // Setelah options ada, set value supaya select menampilkan pilihan yang benar
      if (defaultDivisionId) setValue('division_id', defaultDivisionId, { shouldDirty: false })
    }).catch(() => setDivs([]))
    getEmployeeDepartments(companyId, defaultDivisionId || null).then(deptList => {
      setDepts(deptList)
      if (defaultDepartment) setValue('department', defaultDepartment, { shouldDirty: false })
    }).catch(() => setDepts([]))
  }, [companyId])

  // Reload dept saat divisi berubah oleh user
  useEffect(() => {
    if (!companyId || companyId === 'all') return
    getEmployeeDepartments(companyId, currentDivId || null).then(setDepts).catch(() => setDepts([]))
  }, [currentDivId])

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Divisi</label>
        <select
          {...register('division_id')}
          value={currentDivId}
          onChange={e => setValue('division_id', e.target.value, { shouldDirty: true })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand"
        >
          <option value="">-- Pilih Divisi --</option>
          {divs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Departemen</label>
        <select
          {...register('department')}
          value={currentDept}
          onChange={e => setValue('department', e.target.value, { shouldDirty: true })}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand"
        >
          <option value="">-- Pilih Departemen --</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        {depts.length === 0 && companyId && companyId !== 'all' && (
          <p className="text-[11px] text-gray-400 mt-1">
            {currentDivId ? 'Belum ada data departemen' : 'Pilih divisi untuk filter departemen'}
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, value, bold = false }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
      <p className={bold ? "font-semibold text-gray-900" : "text-gray-700"}>{value}</p>
    </div>
  )
}
