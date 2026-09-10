import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, Clock, Moon, Sun, Trash2 } from 'lucide-react'
import { getCompanies, getShifts, createShift, deleteShift } from '../../api/realService'
import { Card, CardHeader, CardTitle, CardBody, Select, Input, EmptyState } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { fDuration } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

export default function ShiftsPage() {
  const [companies, setCompanies] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [shifts, setShifts] = useState(null)
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  useEffect(() => {
    setLoadingCompanies(true)
    getCompanies()
      .then((c) => { setCompanies(c); if (c.length) setSelectedId(c[0].id) })
      .catch(() => {})
      .finally(() => setLoadingCompanies(false))
  }, [])
  useEffect(() => { if (selectedId) load() }, [selectedId])

  async function load() { setShifts(await getShifts(selectedId)) }

  async function onSubmit(data) {
    try {
      await createShift(selectedId, { ...data, is_night_shift: data.is_night_shift === 'true', break_duration_minutes: Number(data.break_duration_minutes) })
      toast.success('Shift baru berhasil ditambahkan')
      setModalOpen(false); load()
    } catch { toast.error('Gagal menyimpan shift') }
  }

  async function handleDelete(id) {
    await deleteShift(id)
    toast.success('Shift dihapus')
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Shift & Kalender</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola pola shift kerja per perusahaan</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => { reset({ is_night_shift: 'false' }); setModalOpen(true) }}>Tambah Shift</Button>
      </div>

      <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="max-w-xs">
        {loadingCompanies
          ? <option>Memuat perusahaan...</option>
          : companies.length === 0
            ? <option>Belum ada perusahaan</option>
            : companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
        }
      </Select>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shifts?.length === 0 && <Card className="col-span-full"><EmptyState icon={Clock} title="Belum ada shift" description="Tambahkan shift kerja untuk perusahaan ini" /></Card>}
        {shifts?.map((s) => (
          <Card key={s.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: s.color_code + '20', color: s.color_code }}>
                  {s.is_night_shift ? <Moon size={15} /> : <Sun size={15} />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">{s.code}</p>
                </div>
              </div>
              <button onClick={() => handleDelete(s.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
            </div>
            <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
              <span className="font-mono">{s.start_time} - {s.end_time}</span>
              {s.is_night_shift && <Badge color="bg-indigo-50 text-indigo-700 ring-indigo-200">Shift Malam</Badge>}
            </div>
            <div className="text-xs text-gray-400 space-y-0.5">
              <p>Istirahat: {s.break_duration_minutes} menit</p>
              <p>Total kerja: {fDuration(s.total_work_minutes)}</p>
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Shift Baru" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>}
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Kode Shift" placeholder="SHIFT-PAGI" {...register('code', { required: true })} />
            <Input label="Nama Shift" placeholder="Pagi Kerja" {...register('name', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Jam Mulai" type="time" lang="id-ID" {...register('start_time', { required: true })} />
            <Input label="Jam Selesai" type="time" lang="id-ID" {...register('end_time', { required: true })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Istirahat (menit)" type="number" defaultValue={60} {...register('break_duration_minutes')} />
            <Select label="Shift Malam?" {...register('is_night_shift')}>
              <option value="false">Tidak</option>
              <option value="true">Ya</option>
            </Select>
          </div>
          <Input label="Warna" type="color" defaultValue="#22c55e" {...register('color_code')} />
        </form>
      </Modal>
    </div>
  )
}
