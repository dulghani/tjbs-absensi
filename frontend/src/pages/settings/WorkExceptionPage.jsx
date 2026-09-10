import { useEffect, useState } from 'react'
import { Plus, Trash2, Calendar, AlertCircle, RefreshCw, Clock } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { getCompanies, getWorkExceptions, createWorkException, updateWorkException, deleteWorkException } from '../../api/realService'
import { Card, CardBody, Input, Select } from '../../components/ui/Primitives'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from '../../components/ui/Table'
import Badge from '../../components/ui/Badge'
import { toast } from '../../components/ui/Toast'

const TYPE_CONFIG = {
  holiday: {
    label: 'Libur', color: 'bg-red-50 text-red-700 ring-red-200',
    icon: AlertCircle, desc: 'Hari kerja menjadi libur (libur nasional, cuti bersama)',
  },
  replacement_day: {
    label: 'Ganti Hari', color: 'bg-blue-50 text-blue-700 ring-blue-200',
    icon: RefreshCw, desc: 'Hari libur menjadi hari kerja pengganti — absen dihitung normal, bukan lembur merah',
  },
  half_day: {
    label: 'Setengah Hari', color: 'bg-amber-50 text-amber-700 ring-amber-200',
    icon: Clock, desc: 'Jam kerja diperpendek (misalnya malam tahun baru, hari raya eve)',
  },
}

const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember']

export default function WorkExceptionPage() {
  const [companies, setCompanies] = useState([])
  const [selectedCompany, setSelectedCompany] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(0) // 0 = semua
  const [exceptions, setExceptions] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm()
  const watchType = watch('exception_type')

  useEffect(() => {
    getCompanies().then(c => { setCompanies(c); if (c.length) setSelectedCompany(c[0].id) })
  }, [])

  useEffect(() => {
    if (selectedCompany) load()
  }, [selectedCompany, year, month])

  async function load() {
    try {
      const data = await getWorkExceptions(selectedCompany, year, month || undefined)
      setExceptions(data)
    } catch { toast.error('Gagal memuat kalender pengecualian') }
  }

  function openCreate() {
    setEditing(null)
    reset({ exception_type: 'holiday', exception_date: '', replaces_date: '', half_day_minutes: 240, description: '' })
    setModalOpen(true)
  }

  function openEdit(e) {
    setEditing(e)
    reset({
      exception_date: e.exception_date,
      exception_type: e.exception_type,
      replaces_date: e.replaces_date || '',
      half_day_minutes: e.half_day_minutes || 240,
      description: e.description || '',
    })
    setModalOpen(true)
  }

  async function onSubmit(data) {
    try {
      const payload = {
        exception_date: data.exception_date,
        exception_type: data.exception_type,
        replaces_date: data.exception_type === 'replacement_day' ? data.replaces_date : null,
        half_day_minutes: data.exception_type === 'half_day' ? Number(data.half_day_minutes) : null,
        description: data.description || null,
      }
      if (editing) {
        await updateWorkException(selectedCompany, editing.id, payload)
        toast.success('Pengecualian diperbarui')
      } else {
        await createWorkException(selectedCompany, payload)
        toast.success('Pengecualian ditambahkan')
      }
      setModalOpen(false); load()
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan')
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteWorkException(selectedCompany, deleteTarget.id)
      toast.success('Dihapus')
      setDeleteTarget(null); load()
    } finally { setDeleting(false) }
  }

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Kalender Pengecualian</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola libur nasional, ganti hari, dan setengah hari per perusahaan</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={openCreate} disabled={!selectedCompany}>
          Tambah Pengecualian
        </Button>
      </div>

      {/* Keterangan jenis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
          <Card key={key} className="p-3">
            <div className="flex items-start gap-2.5">
              <cfg.icon size={15} className={cfg.color.includes('red') ? 'text-red-500 mt-0.5' : cfg.color.includes('blue') ? 'text-blue-500 mt-0.5' : 'text-amber-500 mt-0.5'} />
              <div>
                <p className="text-xs font-semibold text-gray-800">{cfg.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{cfg.desc}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        <select value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand">
          {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={year} onChange={e => setYear(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand">
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={month} onChange={e => setMonth(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand">
          <option value={0}>Semua Bulan</option>
          {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
        </select>
      </div>

      {/* Tabel */}
      <Card>
        <Table>
          <Thead>
            <Tr>
              <Th>Tanggal</Th><Th>Hari</Th><Th>Jenis</Th><Th>Keterangan</Th><Th>Detail</Th><Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {exceptions.length === 0
              ? <TableEmpty colSpan={6} message={`Belum ada pengecualian untuk ${year}${month ? ' bulan ' + MONTHS[month-1] : ''}`} />
              : exceptions.map(e => {
                const cfg = TYPE_CONFIG[e.exception_type]
                const dt = new Date(e.exception_date + 'T00:00:00')
                const dayName = dt.toLocaleDateString('id-ID', { weekday: 'long' })
                return (
                  <Tr key={e.id}>
                    <Td className="font-medium">{dt.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' })}</Td>
                    <Td className={dt.getDay() === 0 || dt.getDay() === 6 ? 'text-red-500' : ''}>{dayName}</Td>
                    <Td><Badge color={cfg.color}>{cfg.label}</Badge></Td>
                    <Td className="max-w-xs truncate">{e.description || '-'}</Td>
                    <Td className="text-xs text-gray-500">
                      {e.exception_type === 'replacement_day' && e.replaces_date
                        ? `Menggantikan ${new Date(e.replaces_date + 'T00:00:00').toLocaleDateString('id-ID', { day:'numeric', month:'short' })}`
                        : e.exception_type === 'half_day' && e.half_day_minutes
                          ? `${e.half_day_minutes} menit (${Math.floor(e.half_day_minutes/60)}j${e.half_day_minutes%60 ? e.half_day_minutes%60+'m' : ''})`
                          : '-'}
                    </Td>
                    <Td>
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(e)} className="p-1.5 text-gray-400 hover:text-brand hover:bg-gray-100 rounded-md"><Calendar size={13} /></button>
                        <button onClick={() => setDeleteTarget(e)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md"><Trash2 size={13} /></button>
                      </div>
                    </Td>
                  </Tr>
                )
              })
            }
          </Tbody>
        </Table>
      </Card>

      {/* Modal Tambah/Edit */}
      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} size="sm"
        title={editing ? 'Edit Pengecualian' : 'Tambah Pengecualian'}
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>}
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Tanggal" type="date" {...register('exception_date', { required: true })}
            error={errors.exception_date && 'Wajib diisi'} />

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Jenis Pengecualian</label>
            <div className="space-y-1.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <label key={key} className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${watchType === key ? 'border-brand bg-brand-light/30' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" value={key} {...register('exception_type')} className="mt-0.5 accent-brand" />
                  <div>
                    <p className="text-xs font-medium text-gray-800">{cfg.label}</p>
                    <p className="text-[11px] text-gray-400">{cfg.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {watchType === 'replacement_day' && (
            <Input label="Menggantikan Tanggal" type="date" {...register('replaces_date')}
              hint="Hari kerja yang dijadikan libur dan digantikan oleh tanggal di atas" />
          )}

          {watchType === 'half_day' && (
            <div>
              <Input label="Durasi Kerja (menit)" type="number" min={30} max={480}
                {...register('half_day_minutes', { min: 30, max: 480 })} />
              <p className="text-[11px] text-gray-400 mt-1">Contoh: 240 = 4 jam kerja</p>
            </div>
          )}

          <Input label="Keterangan" placeholder="Libur Nasional HUT RI, Cuti Bersama, dll"
            {...register('description')} />
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete}
        danger loading={deleting}
        title="Hapus Pengecualian"
        message={`Hapus pengecualian ${deleteTarget?.exception_date ? new Date(deleteTarget.exception_date + 'T00:00:00').toLocaleDateString('id-ID') : ''} (${TYPE_CONFIG[deleteTarget?.exception_type]?.label || ''})?`}
      />
    </div>
  )
}
