import { useEffect, useState } from 'react'
import { Save, Plus, Trash2, Zap, Edit2, X, Check } from 'lucide-react'
import {
  getWorkSettings, updateWorkSettings, getSalaryComponents, createSalaryComponent, updateSalaryComponent, deleteSalaryComponent,
  createOvertimeRateTier, updateOvertimeRateTier, deleteOvertimeRateTier,
  getEffectiveWorkDaysList, saveEffectiveWorkDays, deleteEffectiveWorkDaysEntry,
} from '../../api/realService'
import { Card, CardHeader, CardTitle, CardBody, Input, Select } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from '../../components/ui/Table'
import { fCurrency, cn, MONTHS_ID } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'
import Modal from '../../components/ui/Modal'
import { useForm } from 'react-hook-form'

const TABS = ['Jam Kerja', 'Aturan Lembur', 'Komponen Gaji']
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

const AUTO_CALC_TYPES = ['attendance_earning', 'overtime_regular', 'absence_deduction', 'early_leave_deduction']

const CALC_TYPE_LABELS = {
  fixed: 'Nominal Tetap', percentage: 'Persentase', per_hari: 'Per Hari Hadir',
  daily_wage_rate: 'Rate Upah Per Hari', overtime_holiday: 'Rate Lembur Merah/jam',
  attendance_earning: 'Otomatis: Kehadiran', overtime_regular: 'Otomatis: Lembur Biasa',
  absence_deduction: 'Otomatis: Potongan Absen', early_leave_deduction: 'Otomatis: Potongan Izin Pulang',
}

const QUICK_SETUP_COMPONENTS = [
  { name: 'Upah Per Hari', type: 'earning', calc: 'daily_wage_rate', value: 0 },
  { name: 'Kehadiran', type: 'earning', calc: 'attendance_earning', value: 0 },
  { name: 'Lembur Biasa', type: 'earning', calc: 'overtime_regular', value: 0 },
  { name: 'Lembur Merah', type: 'earning', calc: 'overtime_holiday', value: 0 },
  { name: 'Potongan Absen', type: 'deduction', calc: 'absence_deduction', value: 0 },
  { name: 'Potongan Izin Pulang', type: 'deduction', calc: 'early_leave_deduction', value: 0 },
]

const DEFAULT_SETTINGS = {
  workStart: '08:00', workEnd: '17:00', breakMin: 60,
  workDays: [1, 1, 1, 1, 1, 0, 0], lateTolerance: 15,
  otMinMin: 60, otMethod: 'per_hour', tiers: [], dailyHoursOverride: {},
  businessDateCutoff: '05:00',
}

export default function CompanyDetail({ company }) {
  const [tab, setTab] = useState(0)
  const [settings, setSettings] = useState(undefined)
  const [components, setComponents] = useState([])
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingComponent, setEditingComponent] = useState(null)
  const { register, handleSubmit, reset, watch, formState: { isSubmitting } } = useForm()
  const watchCalc = watch('calc')

  const quickSetupDone = QUICK_SETUP_COMPONENTS.every((qc) => components.some((c) => c.calc === qc.calc))

  useEffect(() => { load() }, [company])
  async function load() {
    const [ws, sc] = await Promise.all([getWorkSettings(company.id), getSalaryComponents(company.id)])
    setSettings(ws)
    setComponents(sc)
  }

  async function handleSaveWorkHours(form) {
    setSaving(true)
    try {
      await updateWorkSettings(company.id, form)
      toast.success('Pengaturan jam kerja berhasil disimpan')
      load()
      // Prompt recalculate — perubahan jam kerja tidak otomatis memperbarui data historis
      setTimeout(() => {
        if (window.confirm(
          '⚠ Perubahan jam kerja berhasil disimpan.\n\n' +
          'Data absensi yang sudah terhitung TIDAK otomatis diperbarui.\n\n' +
          'Buka halaman Absensi → tombol "Hitung Ulang" untuk memperbarui data historis yang terpengaruh perubahan ini.'
        )) {
          window.location.href = '/attendance'
        }
      }, 500)
    } finally { setSaving(false) }
  }

  // Dipakai juga oleh tab Aturan Lembur — spread effectiveSettings dulu supaya field
  // lain (jam kerja, hari kerja, dll) tidak ikut hilang saat cuma ubah minimal lembur.
  async function handleSaveGeneral(partial) {
    setSaving(true)
    try {
      await updateWorkSettings(company.id, { ...effectiveSettings, ...partial })
      toast.success('Pengaturan berhasil disimpan')
      load()
    } finally { setSaving(false) }
  }

  function openCreateComponent() { setEditingComponent(null); reset({ type: 'earning', calc: 'fixed', value: 0 }); setModalOpen(true) }
  function openEditComponent(c) { setEditingComponent(c); reset({ name: c.name, type: c.type, calc: c.calc, value: c.value, taxable: c.taxable }); setModalOpen(true) }

  async function handleSaveComponent(data) {
    try {
      const value = data.value !== undefined && data.value !== '' ? Number(data.value) : null
      if (editingComponent) {
        await updateSalaryComponent(editingComponent.id, { ...data, value, taxable: data.type === 'earning' })
        toast.success('Komponen gaji diperbarui')
      } else {
        await createSalaryComponent(company.id, { ...data, value, taxable: data.type === 'earning' })
        toast.success('Komponen gaji ditambahkan')
      }
      setModalOpen(false)
      load()
    } catch { toast.error('Gagal menyimpan komponen') }
  }

  async function handleQuickSetup() {
    try {
      const toCreate = QUICK_SETUP_COMPONENTS.filter((qc) => !components.some((c) => c.calc === qc.calc))
      for (const qc of toCreate) {
        await createSalaryComponent(company.id, { name: qc.name, type: qc.type, calc: qc.calc, value: qc.value, taxable: false })
      }
      toast.success(`${toCreate.length} komponen standar ditambahkan. Jangan lupa isi rate "Upah Per Hari" & "Lembur Merah".`)
      load()
    } catch { toast.error('Gagal setup komponen') }
  }

  async function handleDeleteComponent(id) {
    await deleteSalaryComponent(id)
    toast.success('Komponen dihapus')
    load()
  }

  if (settings === undefined) return null
  const effectiveSettings = settings || DEFAULT_SETTINGS
  const isFirstSetup = settings === null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detail Perusahaan: {company.name}</CardTitle>
      </CardHeader>
      <div className="flex border-b border-gray-100 px-4 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-3.5 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${tab === i ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >{t}</button>
        ))}
      </div>
      <CardBody>
        {isFirstSetup && (
          <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-3 ring-1 ring-amber-200 mb-4">
            Belum ada aturan kerja untuk perusahaan ini. Isi form di bawah lalu simpan untuk mengaktifkan —
            tanpa ini, semua karyawan akan tercatat "Hari Libur" alih-alih "Hadir"/"Absen" saat kalkulasi absensi berjalan.
          </div>
        )}
        {tab === 0 && (
          <div className="space-y-6">
            <WorkHoursForm settings={effectiveSettings} isFirstSetup={isFirstSetup} onSave={handleSaveWorkHours} saving={saving} />
            <EffectiveWorkDaysManager companyId={company.id} />
          </div>
        )}
        {tab === 1 && (
          <OvertimeRulesView companyId={company.id} settings={effectiveSettings} onSaveGeneral={handleSaveGeneral} saving={saving} />
        )}
        {tab === 2 && (
          <div>
            <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
              <p className="text-xs text-gray-400">Model upah harian: Upah Per Hari jadi basis hitung Kehadiran, Lembur Biasa, dan Potongan Absen otomatis.</p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" icon={Zap} onClick={handleQuickSetup} disabled={quickSetupDone}>
                  {quickSetupDone ? 'Sudah Di-setup' : 'Setup Cepat (6 Komponen Standar)'}
                </Button>
                <Button variant="primary" size="sm" icon={Plus} onClick={openCreateComponent}>Tambah Manual</Button>
              </div>
            </div>
            <Table>
              <Thead><Tr>
                <Th>Nama Komponen</Th><Th>Tipe</Th><Th>Perhitungan</Th><Th>Nilai</Th><Th>Kena Pajak</Th><Th></Th>
              </Tr></Thead>
              <Tbody>
                {components.length === 0 ? <TableEmpty colSpan={6} /> : components.map((s) => (
                  <Tr key={s.id}>
                    <Td className="font-medium text-gray-900">{s.name}</Td>
                    <Td><Badge color={s.type === 'earning' ? 'bg-green-50 text-green-700 ring-green-200' : s.type === 'deduction' ? 'bg-red-50 text-red-700 ring-red-200' : 'bg-gray-50 text-gray-500 ring-gray-200'}>{s.type === 'earning' ? 'Pendapatan' : s.type === 'deduction' ? 'Potongan' : 'Referensi'}</Badge></Td>
                    <Td className="text-xs">{CALC_TYPE_LABELS[s.calc] || s.calc}</Td>
                    <Td>{AUTO_CALC_TYPES.includes(s.calc) ? <span className="text-gray-400 italic">otomatis</span> : (s.calc === 'percentage' ? `${s.value}%` : fCurrency(s.value))}</Td>
                    <Td>{s.taxable ? 'Ya' : 'Tidak'}</Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => openEditComponent(s)} className="text-gray-300 hover:text-brand"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteComponent(s.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        )}
      </CardBody>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingComponent ? 'Edit Komponen Gaji' : 'Tambah Komponen Gaji'} size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(handleSaveComponent)}>Simpan</Button>
        </>}
      >
        <form className="space-y-3" onSubmit={handleSubmit(handleSaveComponent)}>
          <Input label="Nama Komponen" placeholder="Tunjangan Kehadiran" {...register('name', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Tipe" {...register('type')}>
              <option value="earning">Pendapatan</option>
              <option value="deduction">Potongan</option>
            </Select>
            <Select label="Cara Hitung" {...register('calc')}>
              <optgroup label="Umum">
                <option value="fixed">Nominal Tetap</option>
                <option value="percentage">Persentase (dari Upah x Hari Efektif)</option>
                <option value="per_hari">Per Hari Hadir</option>
              </optgroup>
              <optgroup label="Model Upah Harian">
                <option value="daily_wage_rate">Rate: Upah Per Hari</option>
                <option value="overtime_holiday">Rate: Lembur Merah /jam</option>
                <option value="attendance_earning">Otomatis: Kehadiran (upah x hari hadir)</option>
                <option value="overtime_regular">Otomatis: Lembur Biasa (upah/7 x jam lembur)</option>
                <option value="absence_deduction">Otomatis: Potongan Absen</option>
                <option value="early_leave_deduction">Otomatis: Potongan Izin Pulang</option>
              </optgroup>
            </Select>
          </div>
          {!AUTO_CALC_TYPES.includes(watchCalc) && (
            <Input
              label={watchCalc === 'daily_wage_rate' ? 'Upah Per Hari (Rp)' : watchCalc === 'overtime_holiday' ? 'Rate Lembur Merah per Jam (Rp)' : watchCalc === 'percentage' ? 'Persentase (%)' : 'Nilai (Rp)'}
              type="number" placeholder="0" {...register('value', { required: true })}
            />
          )}
          {AUTO_CALC_TYPES.includes(watchCalc) && (
            <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-2.5">Nilai dihitung otomatis dari data absensi + rate "Upah Per Hari" saat proses payroll. Tidak perlu diisi manual.</p>
          )}
        </form>
      </Modal>
    </Card>
  )
}

function WorkHoursForm({ settings, isFirstSetup, onSave, saving }) {
  const { register, handleSubmit, watch } = useForm({ defaultValues: settings })
  const [workDays, setWorkDays] = useState(settings.workDays)

  // dailyOverrides: { "1": { target_minutes: 480 }, "6": { target_minutes: 300 } }
  // Key = ISO day number (1=Senin..7=Minggu).
  // Hari tanpa override → pakai target default (work_end - work_start dari jam global).
  const [dailyOverrides, setDailyOverrides] = useState(() => {
    // Migrasi format lama {start_time, end_time} → target_minutes
    const raw = settings.dailyHoursOverride || {}
    const converted = {}
    Object.entries(raw).forEach(([day, v]) => {
      if (v.target_minutes != null) converted[day] = { target_minutes: v.target_minutes }
      else if (v.start_time && v.end_time) {
        // hitung menit dari jam lama supaya tidak hilang
        const diff = Math.abs(
          parseInt(v.end_time.split(':')[0]) * 60 + parseInt(v.end_time.split(':')[1]) -
          (parseInt(v.start_time.split(':')[0]) * 60 + parseInt(v.start_time.split(':')[1]))
        )
        converted[day] = { target_minutes: diff }
      }
    })
    return converted
  })

  const globalStart = watch('workStart')
  const globalEnd = watch('workEnd')

  // Hitung default target menit dari jam global (dipakai sebagai placeholder)
  const globalDefaultMinutes = (() => {
    if (!globalStart || !globalEnd) return 480
    const [sh, sm] = globalStart.split(':').map(Number)
    const [eh, em] = globalEnd.split(':').map(Number)
    return Math.abs((eh * 60 + em) - (sh * 60 + sm))
  })()

  const today = new Date().toISOString().slice(0, 10)
  const nextMonthFirst = (() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().slice(0, 10)
  })()

  function toggleDay(i) {
    setWorkDays((prev) => prev.map((v, idx) => (idx === i ? (v === 1 ? 0 : 1) : v)))
  }

  function toggleCustomMinutes(dayIso, checked) {
    setDailyOverrides((prev) => {
      const next = { ...prev }
      if (checked) next[dayIso] = { target_minutes: globalDefaultMinutes }
      else delete next[dayIso]
      return next
    })
  }

  function updateTargetMinutes(dayIso, value) {
    setDailyOverrides((prev) => ({ ...prev, [dayIso]: { target_minutes: parseInt(value) || 0 } }))
  }

  function minutesToHM(min) {
    const h = Math.floor(min / 60), m = min % 60
    return `${h}j${m > 0 ? ` ${m}m` : ''}`
  }

  function submit(form) {
    onSave({ ...form, workDays, daily_hours_override: dailyOverrides, businessDateCutoff: form.businessDateCutoff })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Input label="Jam Masuk (Referensi)" type="time" lang="id-ID" {...register('workStart')} hint="Dipakai sebagai referensi waktu masuk" />
        <Input label="Jam Pulang (Referensi)" type="time" lang="id-ID" {...register('workEnd')} />
        <Input label="Toleransi Telat (menit)" type="number" {...register('lateTolerance')} />
        <Input label="Minimal Lembur (menit)" type="number" {...register('otMinMin')} hint="Default: 60" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Batas Potong Hari (HH:MM)" type="time" lang="id-ID" {...register('businessDateCutoff')}
          hint="Scan sebelum jam ini → dihitung hari kerja sebelumnya. Default 05:00." />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Hari Kerja & Target Menit
          <span className="ml-2 text-gray-400 font-normal">— isi "Menit Khusus" kalau durasi hari itu berbeda dari default ({minutesToHM(globalDefaultMinutes)})</span>
        </label>
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {DAYS.map((d, i) => {
            const dayIso = String(i + 1)
            const active = workDays[i] === 1
            const hasOverride = dailyOverrides[dayIso] != null
            const overrideMin = dailyOverrides[dayIso]?.target_minutes ?? globalDefaultMinutes

            return (
              <div key={d} className={cn('flex items-center gap-3 px-3 py-2.5', !active && 'opacity-40')}>
                <label className="flex items-center gap-2 w-20 flex-shrink-0 cursor-pointer">
                  <input type="checkbox" checked={active} onChange={() => toggleDay(i)} className="w-4 h-4 rounded border-gray-300 text-brand" />
                  <span className="text-xs font-medium text-gray-700">{d}</span>
                </label>
                {active && (
                  <>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer whitespace-nowrap">
                      <input type="checkbox" checked={hasOverride} onChange={(e) => toggleCustomMinutes(dayIso, e.target.checked)} className="w-3.5 h-3.5 rounded border-gray-300 text-amber-500" />
                      Menit khusus
                    </label>
                    {hasOverride ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min="60" max="720" step="30"
                          value={overrideMin}
                          onChange={(e) => updateTargetMinutes(dayIso, e.target.value)}
                          className="w-24 text-xs px-2 py-1.5 border border-gray-300 rounded-md text-center"
                        />
                        <span className="text-xs text-gray-400">menit = {minutesToHM(overrideMin)}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">{minutesToHM(globalDefaultMinutes)} (default)</span>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Contoh: Sabtu centang "Menit khusus" → isi 300 (= 5 jam). Sistem akan menghitung lembur berdasarkan selisih durasi scan vs target ini.
        </p>
      </div>

      <div className="bg-amber-50 text-amber-700 text-xs rounded-lg p-3 ring-1 ring-amber-200">
        <p className="font-medium mb-1">⚠ Perhatikan Tanggal Berlaku</p>
        <p>Data absensi yang sudah dihitung sebelum tanggal ini <b>tidak otomatis diperbarui</b>. Setelah simpan, gunakan tombol <b>"Hitung Ulang"</b> di halaman Absensi untuk memperbarui data historis.</p>
        <p className="mt-1">Untuk perubahan yang berlaku ke data lama, set tanggal ke <b>awal periode yang ingin dihitung ulang</b>.</p>
      </div>
      <Input
        label="Berlaku Mulai Tanggal" type="date"
        defaultValue={isFirstSetup ? today : today}
        {...register('effective_date')}
        hint={isFirstSetup
          ? 'Setup pertama — berlaku mulai hari ini.'
          : 'Ubah ke tanggal lebih awal agar setting berlaku untuk data historis juga.'}
      />
      <div className="flex justify-end">
        <Button variant="primary" icon={Save} type="submit" loading={saving}>Simpan Perubahan</Button>
      </div>
    </form>
  )
}

// Kelola "Hari Kerja Efektif" per bulan — bisa disiapkan di muka di sini, dipakai
// sebagai default otomatis saat proses payroll bulan itu (masih bisa dioverride manual).
function EffectiveWorkDaysManager({ companyId }) {
  const [list, setList] = useState(null)
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [days, setDays] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [companyId])
  async function load() { setList(await getEffectiveWorkDaysList(companyId)) }

  async function handleSave() {
    if (!days) return
    setSaving(true)
    try {
      await saveEffectiveWorkDays(companyId, Number(month), Number(year), Number(days))
      toast.success(`Hari kerja efektif ${MONTHS_ID[month - 1]} ${year} disimpan`)
      setDays('')
      load()
    } catch { toast.error('Gagal menyimpan') } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    await deleteEffectiveWorkDaysEntry(id)
    toast.success('Dihapus')
    load()
  }

  return (
    <div className="border-t border-gray-100 pt-5">
      <p className="text-sm font-medium text-gray-700 mb-1">Hari Kerja Efektif Bulanan</p>
      <p className="text-xs text-gray-400 mb-3">Siapkan di muka supaya saat proses payroll bulan itu, jumlah hari kerja efektif otomatis terisi (tetap bisa diubah manual saat proses).</p>

      <div className="flex flex-wrap items-end gap-2 bg-gray-50 rounded-lg p-3 mb-3">
        <Select label="Bulan" value={month} onChange={(e) => setMonth(e.target.value)} className="w-36">
          {MONTHS_ID.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </Select>
        <Input label="Tahun" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24" />
        <Input label="Jumlah Hari Kerja" type="number" placeholder="mis. 25" value={days} onChange={(e) => setDays(e.target.value)} className="w-36" />
        <Button variant="primary" size="sm" icon={Plus} loading={saving} disabled={!days} onClick={handleSave}>Simpan</Button>
      </div>

      {list && list.length > 0 && (
        <Table>
          <Thead><Tr><Th>Periode</Th><Th>Jumlah Hari Kerja</Th><Th></Th></Tr></Thead>
          <Tbody>
            {list.map((row) => (
              <Tr key={row.id}>
                <Td>{MONTHS_ID[row.period_month - 1]} {row.period_year}</Td>
                <Td className="font-medium">{row.effective_days} hari</Td>
                <Td><button onClick={() => handleDelete(row.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </div>
  )
}

function OvertimeRulesView({ companyId, settings, onSaveGeneral, saving }) {
  const { register, handleSubmit } = useForm({ defaultValues: { otMinMin: settings.otMinMin, otMethod: settings.otMethod } })
  const [tiers, setTiers] = useState(settings.tiers)
  const [addingTier, setAddingTier] = useState(false)
  const [newTier, setNewTier] = useState({ dayType: 'weekday', from: 1, to: '', multiplier: 1.5 })
  const [editingTierId, setEditingTierId] = useState(null)
  const [editTier, setEditTier] = useState({})

  useEffect(() => { setTiers(settings.tiers) }, [settings.tiers])

  async function refreshTiers() {
    // settings.tiers datang dari parent (getWorkSettings, yang juga fetch overtime-rates) —
    // parent belum tentu re-fetch otomatis, jadi kita fetch ulang khusus tier di sini.
    const fresh = await getWorkSettings(companyId)
    setTiers(fresh.tiers)
  }

  async function handleAddTier() {
    try {
      await createOvertimeRateTier(companyId, { ...newTier, tierOrder: tiers.length + 1, to: newTier.to || null })
      toast.success('Tier lembur ditambahkan')
      setAddingTier(false)
      setNewTier({ dayType: 'weekday', from: 1, to: '', multiplier: 1.5 })
      refreshTiers()
    } catch { toast.error('Gagal menambah tier') }
  }

  function startEditTier(t) {
    setEditingTierId(t.id)
    setEditTier({ dayType: t.dayType, from: t.from, to: t.to ?? '', multiplier: t.multiplier })
  }

  async function handleSaveTier(id) {
    try {
      await updateOvertimeRateTier(id, editTier)
      toast.success('Tier lembur diperbarui')
      setEditingTierId(null)
      refreshTiers()
    } catch { toast.error('Gagal menyimpan tier') }
  }

  async function handleDeleteTier(id) {
    await deleteOvertimeRateTier(id)
    toast.success('Tier dihapus')
    refreshTiers()
  }

  return (
    <div className="space-y-5">
      <form className="space-y-4" onSubmit={handleSubmit(onSaveGeneral)}>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Minimal Durasi Lembur (menit)" type="number" {...register('otMinMin')} />
          <Select label="Metode Perhitungan" {...register('otMethod')}>
            <option value="per_hour">Per Jam</option>
            <option value="per_15min">Per 15 Menit</option>
            <option value="flat">Flat</option>
          </Select>
        </div>
        <div className="flex justify-end">
          <Button variant="primary" icon={Save} type="submit" loading={saving}>Simpan Pengaturan Umum</Button>
        </div>
      </form>

      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Tier Multiplier Lembur</p>
          {!addingTier && <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAddingTier(true)}>Tambah Tier</Button>}
        </div>
        <Table>
          <Thead><Tr><Th>Tipe Hari</Th><Th>Jam Ke (dari)</Th><Th>Jam Ke (sampai)</Th><Th>Multiplier</Th><Th></Th></Tr></Thead>
          <Tbody>
            {tiers.length === 0 && !addingTier ? <TableEmpty colSpan={5} message="Belum ada tier lembur" /> : tiers.map((t) => (
              <Tr key={t.id}>
                {editingTierId === t.id ? (
                  <>
                    <Td>
                      <select value={editTier.dayType} onChange={(e) => setEditTier({ ...editTier, dayType: e.target.value })} className="text-xs px-2 py-1 border border-gray-300 rounded-md">
                        <option value="weekday">Hari Kerja</option>
                        <option value="weekend">Akhir Pekan</option>
                        <option value="holiday">Hari Libur</option>
                      </select>
                    </Td>
                    <Td><input type="number" value={editTier.from} onChange={(e) => setEditTier({ ...editTier, from: e.target.value })} className="text-xs w-16 px-2 py-1 border border-gray-300 rounded-md" /></Td>
                    <Td><input type="number" value={editTier.to} onChange={(e) => setEditTier({ ...editTier, to: e.target.value })} placeholder="∞" className="text-xs w-16 px-2 py-1 border border-gray-300 rounded-md" /></Td>
                    <Td><input type="number" step="0.1" value={editTier.multiplier} onChange={(e) => setEditTier({ ...editTier, multiplier: e.target.value })} className="text-xs w-16 px-2 py-1 border border-gray-300 rounded-md" /></Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => handleSaveTier(t.id)} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
                        <button onClick={() => setEditingTierId(null)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                      </div>
                    </Td>
                  </>
                ) : (
                  <>
                    <Td className="capitalize">{t.dayType === 'weekday' ? 'Hari Kerja' : t.dayType === 'weekend' ? 'Akhir Pekan' : 'Hari Libur'}</Td>
                    <Td>{t.from}</Td>
                    <Td>{t.to ?? '∞'}</Td>
                    <Td className="font-medium text-brand">{t.multiplier}x</Td>
                    <Td>
                      <div className="flex gap-1">
                        <button onClick={() => startEditTier(t)} className="text-gray-300 hover:text-brand"><Edit2 size={14} /></button>
                        <button onClick={() => handleDeleteTier(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </Td>
                  </>
                )}
              </Tr>
            ))}
            {addingTier && (
              <Tr>
                <Td>
                  <select value={newTier.dayType} onChange={(e) => setNewTier({ ...newTier, dayType: e.target.value })} className="text-xs px-2 py-1 border border-gray-300 rounded-md">
                    <option value="weekday">Hari Kerja</option>
                    <option value="weekend">Akhir Pekan</option>
                    <option value="holiday">Hari Libur</option>
                  </select>
                </Td>
                <Td><input type="number" value={newTier.from} onChange={(e) => setNewTier({ ...newTier, from: e.target.value })} className="text-xs w-16 px-2 py-1 border border-gray-300 rounded-md" /></Td>
                <Td><input type="number" value={newTier.to} onChange={(e) => setNewTier({ ...newTier, to: e.target.value })} placeholder="∞" className="text-xs w-16 px-2 py-1 border border-gray-300 rounded-md" /></Td>
                <Td><input type="number" step="0.1" value={newTier.multiplier} onChange={(e) => setNewTier({ ...newTier, multiplier: e.target.value })} className="text-xs w-16 px-2 py-1 border border-gray-300 rounded-md" /></Td>
                <Td>
                  <div className="flex gap-1">
                    <button onClick={handleAddTier} className="text-green-500 hover:text-green-600"><Check size={14} /></button>
                    <button onClick={() => setAddingTier(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
                  </div>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </div>
    </div>
  )
}
