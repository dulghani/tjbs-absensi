import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Factory } from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import { realLogin } from '../../api/realService'
import Button from '../../components/ui/Button'
import { Input } from '../../components/ui/Primitives'
import { toast } from '../../components/ui/Toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setCompany = useAuthStore((s) => s.setCompany)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { user, company, token } = await realLogin({ email, password })
      setAuth(user, token)
      if (company) setCompany(company)
      toast.success(`Selamat datang, ${user.name}`)
      navigate('/dashboard')
    } catch (err) {
      toast.error(err?.message || err?.errors?.email?.[0] || 'Email atau password salah')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-5">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 p-8">
        <div className="text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-brand flex items-center justify-center mx-auto mb-3">
            <Factory size={20} className="text-white" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">OutsourceHR</h1>
          <p className="text-xs text-gray-400 mt-1">Sistem Manajemen SDM Outsourcing</p>
        </div>

        <form className="space-y-3 mb-2" onSubmit={handleLogin}>
          <Input label="Email" type="email" placeholder="admin@outsourcehr.local" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="primary" className="w-full mt-2" size="lg" loading={loading}>
            Masuk
          </Button>
        </form>
        <p className="text-center text-[11px] text-gray-400 mt-4">
          Akun awal: admin@outsourcehr.local / password (dari <code>php artisan db:seed</code>)
        </p>
      </div>
    </div>
  )
}
