import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Bell, LogOut, Building2, ChevronDown, Check, KeyRound, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { cn, ROLE_LABELS, ROLE_COLORS, fRelative } from '../../lib/utils'
import { getNotifications, markNotificationRead, markAllNotificationsRead, changePassword } from '../../api/realService'
import Badge from '../ui/Badge'
import Modal from './../../components/ui/Modal'
import Button from './../../components/ui/Button'
import { toast } from '../ui/Toast'

const PAGE_TITLES = {
  '/dashboard': 'Dashboard', '/companies': 'Perusahaan', '/organization': 'Struktur Organisasi',
  '/employees': 'Karyawan', '/shifts': 'Shift & Kalender', '/attendance': 'Absensi',
  '/device-integration': 'Integrasi Mesin Absensi',
  '/overtime': 'Data Lembur', '/payroll': 'Penggajian', '/documents': 'Dokumen',
  '/reports': 'Laporan', '/work-settings': 'Aturan Kerja', '/work-exceptions': 'Kalender Pengecualian', '/users': 'Manajemen User', '/audit': 'Audit Log',
}

export default function Topbar() {
  const user = useAuthStore((s) => s.user)
  const company = useAuthStore((s) => s.company)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [notifOpen, setNotifOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' })
  const [pwdShow, setPwdShow] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [notifications, setNotifications] = useState([])
  const notifRef = useRef(null)
  const userRef = useRef(null)

  const role = user?.roles?.[0]
  const title = PAGE_TITLES[location.pathname] || 'Dashboard'
  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (user) getNotifications(user.id).then(setNotifications)
  }, [user])

  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleMarkRead(id) {
    await markNotificationRead(id)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }
  async function handleMarkAllRead() {
    await markAllNotificationsRead(user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  async function handleChangePassword() {
    if (pwdForm.newPwd !== pwdForm.confirm) { toast.error('Konfirmasi password tidak cocok'); return }
    if (pwdForm.newPwd.length < 8) { toast.error('Password minimal 8 karakter'); return }
    setPwdSaving(true)
    try {
      await changePassword({
        current_password:      pwdForm.current,
        new_password:          pwdForm.newPwd,
        new_password_confirmation: pwdForm.confirm,
      })
      toast.success('Password berhasil diubah')
      setPwdOpen(false); setPwdForm({ current: '', newPwd: '', confirm: '' })
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Gagal mengubah password')
    } finally { setPwdSaving(false) }
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-5 gap-3 flex-shrink-0 sticky top-0 z-30">
      <h1 className="text-sm font-semibold text-gray-900 flex-1">{title}</h1>

      {company && (
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-brand-light text-brand rounded-full text-xs font-medium">
          <Building2 size={12} /> {company.name}
        </div>
      )}

      <Badge color={ROLE_COLORS[role]}>{ROLE_LABELS[role]}</Badge>

      <div className="relative" ref={notifRef}>
        <button onClick={() => setNotifOpen((o) => !o)} className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500">
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-medium">{unreadCount}</span>
          )}
        </button>
        {notifOpen && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-40">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold">Notifikasi</p>
              {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-xs text-brand hover:underline">Tandai semua dibaca</button>}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Tidak ada notifikasi</p>
              ) : notifications.map((n) => (
                <div key={n.id} onClick={() => handleMarkRead(n.id)} className={cn('px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors', !n.read && 'bg-blue-50/40')}>
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-brand mt-1.5 flex-shrink-0" />}
                    <div className={cn('flex-1 min-w-0', n.read && 'ml-3.5')}>
                      <p className="text-xs font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{fRelative(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="relative" ref={userRef}>
        <button onClick={() => setUserOpen((o) => !o)} className="flex items-center gap-1 p-1 rounded-lg hover:bg-gray-100">
          <div className="w-7 h-7 rounded-full bg-brand-light text-brand flex items-center justify-center text-xs font-semibold">
            {user?.name?.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </button>
        {userOpen && (
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-40">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
            <button onClick={() => { setUserOpen(false); setPwdOpen(true) }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50">
              <KeyRound size={15} className="text-gray-400" /> Ganti Password
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50">
              <LogOut size={15} /> Keluar
            </button>
          </div>
        )}
      </div>

      {/* Modal Ganti Password */}
      <Modal open={pwdOpen} onClose={() => setPwdOpen(false)} title="Ganti Password" size="sm"
        footer={<>
          <Button variant="secondary" onClick={() => setPwdOpen(false)}>Batal</Button>
          <Button variant="primary" loading={pwdSaving} onClick={handleChangePassword}>Simpan</Button>
        </>}
      >
        <div className="space-y-3">
          {[['current','Password Saat Ini'],['newPwd','Password Baru (min. 8 karakter)'],['confirm','Konfirmasi Password Baru']].map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
              <div className="relative">
                <input type={pwdShow ? 'text' : 'password'} value={pwdForm[key]}
                  onChange={e => setPwdForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full px-3 py-2 pr-9 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 bg-white" />
                <button type="button" onClick={() => setPwdShow(s => !s)} className="absolute right-2.5 top-2.5 text-gray-400">
                  {pwdShow ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </header>
  )
}
