import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Building2, Users, MapPin, Edit2, Power } from 'lucide-react'
import { getCompanies, createCompany, updateCompany, toggleCompanyStatus } from '../../api/realService'
import { Card, CardBody, Input, Skeleton } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { Textarea } from '../../components/ui/Primitives'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/utils'
import CompanyDetail from './CompanyDetail'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState(null)
  const [selected, setSelected] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm()

  useEffect(() => { load() }, [])

  async function load() {
    const data = await getCompanies()
    setCompanies(data)
    if (data.length && !selected) setSelected(data[0])
  }

  async function handleToggleStatus(company) {
    try {
      await toggleCompanyStatus(company.id)
      toast.success(`Perusahaan ${company.status === 'active' ? 'dinonaktifkan' : 'diaktifkan'}`)
      load()
    } catch { toast.error('Gagal mengubah status') }
  }

  function openCreate() { setEditing(null); reset({}); setModalOpen(true) }
  function openEdit(c) { setEditing(c); reset(c); setModalOpen(true) }

  async function onSubmit(data) {
    try {
      if (editing) {
        await updateCompany(editing.id, data)
        toast.success('Data perusahaan berhasil diperbarui')
      } else {
        await createCompany(data)
        toast.success('Perusahaan baru berhasil ditambahkan')
      }
      setModalOpen(false)
      load()
    } catch (err) {
      const msg = err?.response?.data?.message
        || (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join(', ')
          : null)
        || err?.message
        || 'Gagal menyimpan data'
      toast.error(msg)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Perusahaan</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola data perusahaan klien outsourcing</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreate}>Tambah Perusahaan</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {!companies ? [1,2,3].map(i => <Skeleton key={i} className="h-32" />) : companies.map((c) => (
          <Card
            key={c.id}
            className={cn('p-4 cursor-pointer transition-all hover:shadow-sm', selected?.id === c.id && 'ring-2 ring-brand border-transparent', c.status === 'inactive' && 'opacity-60')}
            onClick={() => setSelected(c)}
          >
            <div className="flex items-start gap-3 mb-3">
              <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', c.status === 'active' ? 'bg-brand-light' : 'bg-gray-100')}>
                <Building2 size={18} className={c.status === 'active' ? 'text-brand' : 'text-gray-400'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <Badge status={c.status} className="mt-1" />
              </div>
              <div className="flex gap-1">
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleStatus(c) }}
                  className={cn('text-gray-300 hover:text-amber-500', c.status === 'inactive' && 'text-amber-400')}
                  title={c.status === 'active' ? 'Nonaktifkan Perusahaan' : 'Aktifkan Perusahaan'}
                >
                  <Power size={14} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); openEdit(c) }} className="text-gray-300 hover:text-gray-500">
                  <Edit2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-1.5 mb-1">
              <Users size={12} /> {c.employees} karyawan
            </div>
            <div className="text-xs text-gray-400 flex items-center gap-1.5">
              <MapPin size={12} className="flex-shrink-0" /> <span className="truncate">{c.address}, {c.city}</span>
            </div>
          </Card>
        ))}
      </div>

      {selected && <CompanyDetail key={selected.id} company={selected} />}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Perusahaan' : 'Tambah Perusahaan Baru'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kode Perusahaan" placeholder="PT-XYZ" {...register('code', { required: true })} error={errors.code && 'Wajib diisi'} />
            <Input label="Nama Perusahaan" placeholder="PT. Nama Perusahaan" {...register('name', { required: true })} error={errors.name && 'Wajib diisi'} />
          </div>
          <Input label="NPWP" placeholder="00.000.000.0-000.000" {...register('npwp')} />
          <Textarea label="Alamat" rows={2} placeholder="Alamat lengkap perusahaan" {...register('address')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kota" placeholder="Surabaya" {...register('city')} />
            <Input label="Telepon" placeholder="031-xxxxxxx" {...register('phone')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nama PIC" placeholder="Nama penanggung jawab" {...register('pic_name')} />
            <Input label="No. HP PIC" placeholder="08xx-xxxx-xxxx" {...register('pic_phone')} />
          </div>
        </form>
      </Modal>
    </div>
  )
}
