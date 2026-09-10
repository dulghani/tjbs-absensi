import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import {
  Plus, Fingerprint, Wifi, WifiOff, RefreshCw, Link2, Trash2, MapPin,
  Clock, CheckCircle2, XCircle, AlertTriangle, ChevronRight, Users, UploadCloud, FileSpreadsheet, Calendar, ArrowUpRight,
} from 'lucide-react'
import {
  getDevices, createDevice, updateDevice, deleteDevice, testDeviceConnection,
  syncDeviceNow, getSyncLogs, getSyncCoverage, getDeviceMappings, addDeviceMapping, removeDeviceMapping,
  importEmployeesToDevice, syncEmployeesFromApi,
} from '../../api/realService'
import { getCompanies, getEmployees, getEmployeeDivisions } from '../../api/realService'
import { Card, CardHeader, CardTitle, CardBody, Input, Select, EmptyState } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal, { ConfirmModal } from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from '../../components/ui/Table'
import { fDateTime, fDate, cn } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

const SYNC_STATUS_CONFIG = {
  success: { label: 'Berhasil', color: 'bg-green-50 text-green-700 ring-green-200', icon: CheckCircle2 },
  partial: { label: 'Sebagian', color: 'bg-amber-50 text-amber-700 ring-amber-200', icon: AlertTriangle },
  failed: { label: 'Gagal', color: 'bg-red-50 text-red-700 ring-red-200', icon: XCircle },
  never: { label: 'Belum pernah', color: 'bg-gray-50 text-gray-500 ring-gray-200', icon: Clock },
  running: { label: 'Berjalan', color: 'bg-blue-50 text-blue-700 ring-blue-200', icon: RefreshCw },
}

export default function DeviceIntegrationPage() {
  const [devices, setDevices] = useState(null)
  const [companies, setCompanies] = useState([])
  const [divisions, setDivisions] = useState([])
  const [filterCompany, setFilterCompany] = useState('all')
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [testingId, setTestingId] = useState(null)
  const [syncingId, setSyncingId] = useState(null)
  const [uploadingDeviceId, setUploadingDeviceId] = useState(null)

  // useForm HARUS di atas watchCompanyId — watch() dari hook ini belum ada kalau dipanggil dulu
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm()
  const watchCompanyId = watch('company_id')

  useEffect(() => { getCompanies().then(setCompanies); load() }, [])
  useEffect(() => { load() }, [filterCompany])
  useEffect(() => {
    if (watchCompanyId) getEmployeeDivisions(watchCompanyId).then(setDivisions).catch(() => setDivisions([]))
    else setDivisions([])
  }, [watchCompanyId])
  async function load() {
    const data = await getDevices(filterCompany)
    setDevices(data)
    if (data.length && !selectedDevice) setSelectedDevice(data[0])
    if (selectedDevice) {
      const updated = data.find((d) => d.id === selectedDevice.id)
      if (updated) setSelectedDevice(updated)
    }
  }

  function openCreate() { setEditing(null); reset({ sync_mode: 'scheduled', sync_interval_minutes: 15 }); setModalOpen(true) }
  function openEdit(d) { setEditing(d); reset({ ...d, api_key: '' }); setModalOpen(true) }

  async function onSubmit(data) {
    try {
      if (editing) { await updateDevice(editing.id, data); toast.success('Pengaturan mesin diperbarui') }
      else { await createDevice({ ...data, sync_interval_minutes: Number(data.sync_interval_minutes) }); toast.success('Mesin absensi berhasil ditambahkan') }
      setModalOpen(false); load()
    } catch { toast.error('Gagal menyimpan pengaturan mesin') }
  }

  async function handleTest(device) {
    setTestingId(device.id)
    try {
      const result = await testDeviceConnection(device.id)
      result.success ? toast.success(`${result.message} · ${result.record_count_today} log hari ini`) : toast.error(result.message)
    } finally { setTestingId(null) }
  }

  async function handleSync(device) {
    setSyncingId(device.id)
    try {
      const result = await syncDeviceNow(device.id)
      toast.success(result.message || 'Sync selesai')
      load()
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Gagal sinkronisasi')
    } finally { setSyncingId(null) }
  }

  async function handleDelete() {
    await deleteDevice(deleteTarget.id)
    toast.success('Mesin absensi dihapus')
    setDeleteTarget(null)
    if (selectedDevice?.id === deleteTarget.id) setSelectedDevice(null)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Integrasi Mesin Absensi</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola koneksi mesin fingerprint & sinkronisasi log kehadiran</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCompany}
            onChange={e => { setFilterCompany(e.target.value); setSelectedDevice(null) }}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-brand"
          >
            <option value="all">Semua Perusahaan</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button variant="primary" icon={Plus} onClick={openCreate}>Tambah Mesin</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Device list */}
        <div className="lg:col-span-1 space-y-2.5">
          {!devices ? null : devices.length === 0 ? (
            <Card><EmptyState icon={Fingerprint} title="Belum ada mesin terhubung" description="Tambahkan mesin fingerprint pertama Anda" /></Card>
          ) : devices.map((d) => {
            const statusCfg = SYNC_STATUS_CONFIG[d.last_sync_status] || SYNC_STATUS_CONFIG.never
            return (
              <Card
                key={d.id}
                className={cn(
                  'p-3.5 transition-all',
                  selectedDevice?.id === d.id && 'ring-2 ring-brand border-transparent',
                  uploadingDeviceId && uploadingDeviceId !== d.id ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
                )}
                onClick={() => { if (!uploadingDeviceId) setSelectedDevice(d) }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center flex-shrink-0">
                    <Fingerprint size={16} className="text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.name}</p>
                    <p className="text-xs text-gray-400 truncate">{d.companyName}{d.lineName ? ` · ${d.lineName}` : ''}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <statusCfg.icon size={11} className={statusCfg.color.includes('green') ? 'text-green-600' : statusCfg.color.includes('red') ? 'text-red-600' : statusCfg.color.includes('amber') ? 'text-amber-600' : 'text-gray-400'} />
                      <span className="text-[11px] text-gray-400">{statusCfg.label}</span>
                      {d.status === 'inactive' && <Badge color="bg-gray-100 text-gray-500 ring-gray-200">Nonaktif</Badge>}
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-gray-300 flex-shrink-0 mt-1" />
                </div>
              </Card>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2">
          {selectedDevice ? (
            <DeviceDetail
              key={selectedDevice.id}
              device={selectedDevice}
              onEdit={() => openEdit(selectedDevice)}
              onDelete={() => setDeleteTarget(selectedDevice)}
              onTest={() => handleTest(selectedDevice)}
              onSync={() => handleSync(selectedDevice)}
              testing={testingId === selectedDevice.id}
              syncing={syncingId === selectedDevice.id}
              onMappingChanged={load}
              onUploadStateChange={(isUploading) => setUploadingDeviceId(isUploading ? selectedDevice.id : null)}
            />
          ) : (
            <Card><EmptyState icon={Fingerprint} title="Pilih mesin untuk melihat detail" /></Card>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Mesin Absensi' : 'Tambah Mesin Absensi Baru'}
        subtitle="Kredensial didapat dari dashboard Fingerspot Cloud Anda"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Simpan</Button>
        </>}
      >
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Nama Mesin" placeholder="Mesin Absen Gerbang Utama" {...register('name', { required: true })} error={errors.name && 'Wajib diisi'} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Perusahaan" {...register('company_id', { required: true })}>
              <option value="">-- Pilih --</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Divisi (opsional)" {...register('division_id')}>
              <option value="">-- Tidak ada / Pilih nanti --</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          </div>
          <Input label="Lokasi / Keterangan" placeholder="Lobby depan, Gedung A Lt.2, dll" {...register('location')} />
          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1.5"><Link2 size={13} /> Kredensial Fingerspot Cloud</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Cloud ID" placeholder="C2636CF4DB102128" {...register('cloud_id', { required: true })} />
              <Input label="API Key" type="password" placeholder={editing ? 'Kosongkan jika tidak diubah' : 'B6OVA7F8GORAGVTL'} {...register('api_key', { required: !editing })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label="Mode Sinkronisasi" {...register('sync_mode')}>
              <option value="scheduled">Otomatis Terjadwal</option>
              <option value="manual">Manual Saja</option>
            </Select>
            <Input label="Interval (menit)" type="number" min={5} {...register('sync_interval_minutes')} />
          </div>
          <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-3 ring-1 ring-blue-200">
            <p className="font-medium mb-1">Petunjuk setelah mesin ditambahkan:</p>
            <p>1. Klik <b>"Buat Karyawan dari Log"</b> setelah sync pertama — semua karyawan di mesin ini otomatis terbuat</p>
            <p>2. <b>Divisi</b> yang dipilih di atas menentukan divisi karyawan yang dibuat dari mesin ini</p>
            <p>3. Jabatan &amp; detail lain dilengkapi manual di menu <b>Karyawan → Edit</b> atau lewat Bulk Set Jabatan</p>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} danger
        title="Hapus Mesin" message={`Hapus koneksi ke "${deleteTarget?.name}"? Log absensi yang sudah tersinkron tidak akan terhapus.`}
      />
    </div>
  )
}

function DeviceDetail({ device, onEdit, onDelete, onTest, onSync, testing, syncing, onMappingChanged, onUploadStateChange }) {
  const [tab, setTab] = useState(0)
  const [rangeModalOpen, setRangeModalOpen] = useState(false)
  const [rangeSyncing, setRangeSyncing] = useState(false)
  const [employeeSyncing, setEmployeeSyncing] = useState(false)
  const statusCfg = SYNC_STATUS_CONFIG[device.last_sync_status] || SYNC_STATUS_CONFIG.never

  async function handleRangeSync(from, to) {
    setRangeSyncing(true)
    try {
      const result = await syncDeviceNow(device.id, { from, to })
      toast.success(result.message)
      setRangeModalOpen(false)
      onMappingChanged?.()
    } catch (err) {
      toast.error(err?.message || 'Gagal sync range tanggal')
    } finally {
      setRangeSyncing(false)
    }
  }

  async function handleSyncEmployeesApi() {
    setEmployeeSyncing(true)
    try {
      const res = await syncEmployeesFromApi(device.id)
      toast.success(`Sync karyawan selesai: ${res.created} baru, ${res.updated} diperbarui, ${res.skipped} dilewati`)
      onMappingChanged?.()
    } catch (err) {
      toast.error(err?.message || 'Gagal sync karyawan. Pastikan endpoint Fingerspot mendukung data karyawan.')
    } finally {
      setEmployeeSyncing(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{device.name}</CardTitle>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><MapPin size={11} /> {device.location || '-'} · {device.companyName}</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="secondary" size="sm" icon={Wifi} loading={testing} onClick={onTest}>Test Koneksi</Button>
          <Button variant="secondary" size="sm" icon={Users} loading={employeeSyncing} onClick={handleSyncEmployeesApi}>Buat Karyawan dari Log</Button>
          <Button variant="secondary" size="sm" icon={Calendar} onClick={() => setRangeModalOpen(true)}>Sync Range/Backdate</Button>
          <Button variant="primary" size="sm" icon={RefreshCw} loading={syncing} onClick={onSync}>Sync Sekarang</Button>
        </div>
      </CardHeader>

      <div className="px-4 pt-3 pb-1 flex items-center gap-4 flex-wrap text-xs text-gray-500 border-b border-gray-100">
        <span className="flex items-center gap-1.5">
          <statusCfg.icon size={13} className={statusCfg.color.includes('green') ? 'text-green-600' : statusCfg.color.includes('red') ? 'text-red-600' : statusCfg.color.includes('amber') ? 'text-amber-600' : 'text-gray-400'} />
          Status terakhir: <Badge color={statusCfg.color}>{statusCfg.label}</Badge>
        </span>
        <span>Sync terakhir: {device.last_synced_at ? fDateTime(device.last_synced_at) : 'Belum pernah'}</span>
        <span>Mode: {device.sync_mode === 'scheduled' ? `Otomatis tiap ${device.sync_interval_minutes} menit` : 'Manual'}</span>
      </div>

      {device.last_sync_error && (
        <div className="mx-4 mt-3 bg-red-50 text-red-700 text-xs rounded-lg p-2.5 ring-1 ring-red-200 flex items-start gap-1.5">
          <XCircle size={13} className="mt-0.5 flex-shrink-0" /> {device.last_sync_error}
        </div>
      )}

      <div className="flex border-b border-gray-100 px-4 mt-1">
        {['Riwayat Sync', 'Pemetaan PIN', 'Pengaturan'].map((t, i) => (
          <button key={t} onClick={() => setTab(i)} className={cn('px-3.5 py-2.5 text-sm border-b-2 transition-colors', tab === i ? 'border-brand text-brand font-medium' : 'border-transparent text-gray-500 hover:text-gray-800')}>{t}</button>
        ))}
      </div>

      <CardBody>
        {tab === 0 && <SyncLogsTab deviceId={device.id} />}
        {tab === 1 && <MappingTab deviceId={device.id} onChanged={onMappingChanged} />}
        {tab === 2 && <SettingsTab device={device} onEdit={onEdit} onDelete={onDelete} />}
      </CardBody>

      <RangeSyncModal open={rangeModalOpen} onClose={() => setRangeModalOpen(false)} onSync={handleRangeSync} loading={rangeSyncing} />
    </Card>
  )
}

function RangeSyncModal({ open, onClose, onSync, loading }) {
  const today = new Date().toISOString().slice(0, 10)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)

  return (
    <Modal
      open={open} onClose={onClose} title="Sync Range Tanggal / Backdate" size="sm"
      subtitle="Untuk tarik ulang data lama atau isi tanggal yang terlewat"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Batal</Button>
        <Button variant="primary" loading={loading} onClick={() => onSync(from, to)}>Mulai Sync</Button>
      </>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Dari Tanggal" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={today} />
          <Input label="Sampai Tanggal" type="date" value={to} onChange={(e) => setTo(e.target.value)} max={today} />
        </div>
        <div className="bg-blue-50 text-blue-700 text-xs rounded-lg p-3 ring-1 ring-blue-200">
          Aman untuk backdate — data yang sudah pernah sync sebelumnya otomatis di-skip (tidak akan dobel), jadi bisa jalankan berkali-kali kalau perlu.
        </div>
      </div>
    </Modal>
  )
}

function SyncLogsTab({ deviceId }) {
  const [logs, setLogs] = useState(null)
  const [coverage, setCoverage] = useState(null)
  useEffect(() => {
    getSyncLogs(deviceId).then(setLogs)
    const to = new Date().toISOString().slice(0, 10)
    const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10)
    getSyncCoverage(deviceId, from, to).then(setCoverage)
  }, [deviceId])

  return (
    <div>
      {coverage && (
        <div className="mb-5">
          <p className="text-xs font-medium text-gray-500 mb-2">Status Sync 30 Hari Terakhir</p>
          <div className="flex gap-0.5">
            {coverage.map((c, i) => {
              const cfg = SYNC_STATUS_CONFIG[c.status] || SYNC_STATUS_CONFIG.never
              const dotColor = c.status === 'success' ? 'bg-green-500' : c.status === 'partial' ? 'bg-amber-500' : c.status === 'failed' ? 'bg-red-500' : 'bg-gray-200'
              // Bar terakhir (kanan) → tooltip rata kanan; bar awal (kiri) → rata kiri; tengah → rata tengah
              const total = coverage.length
              const tooltipPos = i < 5
                ? 'left-0'
                : i > total - 6
                  ? 'right-0'
                  : 'left-1/2 -translate-x-1/2'
              return (
                <div key={c.date} className="flex-1 group relative">
                  <div className={cn('h-6 rounded-sm', dotColor)} />
                  <div className={cn(
                    'opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-1',
                    'bg-gray-800 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none',
                    tooltipPos
                  )}>
                    {fDate(c.date)}: {cfg.label}
                    {c.records_inserted > 0 && ` · ${c.records_inserted} masuk`}
                    {c.records_unmapped > 0 && ` · ${c.records_unmapped} unmapped`}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Berhasil</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Sebagian</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Gagal</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" />Belum sync</span>
          </div>
        </div>
      )}

      <Table>
        <Thead><Tr><Th>Tanggal</Th><Th>Status</Th><Th>Fetched</Th><Th>Masuk</Th><Th>Skip</Th><Th>Unmapped</Th><Th>Durasi</Th></Tr></Thead>
        <Tbody>
          {!logs ? null : logs.length === 0 ? <TableEmpty colSpan={7} message="Belum ada riwayat sync" /> : logs.map((l) => {
            const cfg = SYNC_STATUS_CONFIG[l.status] || SYNC_STATUS_CONFIG.never
            const durationSec = l.finished_at ? Math.round((new Date(l.finished_at) - new Date(l.started_at)) / 1000) : null
            return (
              <Tr key={l.id}>
                <Td>{fDateTime(l.started_at)}</Td>
                <Td><Badge color={cfg.color}>{cfg.label}</Badge></Td>
                <Td>{l.records_fetched}</Td>
                <Td className="text-green-600">{l.records_inserted}</Td>
                <Td className="text-gray-400">{l.records_skipped}</Td>
                <Td className={l.records_unmapped > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}>{l.records_unmapped}</Td>
                <Td className="text-gray-400">{durationSec != null ? `${durationSec}s` : '-'}</Td>
              </Tr>
            )
          })}
        </Tbody>
      </Table>
    </div>
  )
}

function MappingTab({ deviceId, onChanged }) {
  const [mappings, setMappings] = useState(null)
  const [employees, setEmployees] = useState([])
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  useEffect(() => { load(); getEmployees({}).then(setEmployees) }, [deviceId])
  async function load() { setMappings(await getDeviceMappings(deviceId)) }

  async function onSubmit(data) {
    try {
      await addDeviceMapping(deviceId, data)
      toast.success('Pemetaan PIN disimpan')
      reset({ device_pin: '', employee_id: '' })
      load(); onChanged?.()
    } catch { toast.error('Gagal menyimpan pemetaan') }
  }

  async function handleRemove(id) {
    await removeDeviceMapping(deviceId, id)
    toast.success('Pemetaan dihapus')
    load(); onChanged?.()
  }

  return (
    <div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex items-end gap-2 mb-4 bg-gray-50 rounded-xl p-3">
        <div className="flex-1"><Input label="PIN di Mesin" placeholder="1001" {...register('device_pin', { required: true })} /></div>
        <div className="flex-[2]">
          <Select label="Karyawan" {...register('employee_id', { required: true })}>
            <option value="">-- Pilih Karyawan --</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.nik})</option>)}
          </Select>
        </div>
        <Button type="submit" variant="primary" icon={Plus} loading={isSubmitting}>Tambah</Button>
      </form>

      <Table>
        <Thead><Tr><Th>PIN Mesin</Th><Th>Karyawan</Th><Th>NIK</Th><Th></Th></Tr></Thead>
        <Tbody>
          {!mappings ? null : mappings.length === 0 ? (
            <TableEmpty colSpan={4} message="Belum ada PIN yang dipetakan — log dari PIN ini akan ditandai 'unmapped' saat sync" />
          ) : mappings.map((m) => (
            <Tr key={m.id}>
              <Td className="font-mono">{m.device_pin}</Td>
              <Td className="font-medium text-gray-900">{m.employeeName}</Td>
              <Td className="text-gray-400">{m.employeeNik}</Td>
              <Td><button onClick={() => handleRemove(m.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button></Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  )
}

function SettingsTab({ device, onEdit, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs text-gray-400 mb-0.5">Cloud ID</p><p className="font-mono text-gray-700">{device.cloud_id}</p></div>
        <div><p className="text-xs text-gray-400 mb-0.5">API Key</p><p className="font-mono text-gray-700">••••••••{device.api_key?.slice(-4)}</p></div>
        <div><p className="text-xs text-gray-400 mb-0.5">Timezone</p><p className="text-gray-700">{device.timezone}</p></div>
        <div><p className="text-xs text-gray-400 mb-0.5">Status</p><Badge status={device.status} /></div>
        <div><p className="text-xs text-gray-400 mb-0.5">Divisi</p><p className="text-gray-700">{device.divisionName || <span className="text-gray-300 italic">Belum dipilih</span>}</p></div>
        <div><p className="text-xs text-gray-400 mb-0.5">Lokasi</p><p className="text-gray-700">{device.location || '-'}</p></div>
      </div>
      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Button variant="secondary" onClick={onEdit}>Edit Pengaturan</Button>
        <Button variant="danger" icon={Trash2} onClick={onDelete}>Hapus Mesin</Button>
      </div>
    </div>
  )
}
