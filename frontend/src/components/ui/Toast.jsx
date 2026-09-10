import { create } from 'zustand'
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useEffect } from 'react'

export const useToastStore = create((set) => ({
  toasts: [],
  push: (toast) => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, ...toast }] }))
    return id
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (message) => useToastStore.getState().push({ type: 'success', message }),
  error: (message) => useToastStore.getState().push({ type: 'error', message }),
  warning: (message) => useToastStore.getState().push({ type: 'warning', message }),
  info: (message) => useToastStore.getState().push({ type: 'info', message }),
}

const icons = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
const styles = {
  success: 'bg-green-50 text-green-800 ring-green-200',
  error: 'bg-red-50 text-red-800 ring-red-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  info: 'bg-blue-50 text-blue-800 ring-blue-200',
}

function ToastItem({ id, type, message }) {
  const remove = useToastStore((s) => s.remove)
  const Icon = icons[type]
  useEffect(() => {
    const t = setTimeout(() => remove(id), 4000)
    return () => clearTimeout(t)
  }, [id, remove])
  return (
    <div className={cn('flex items-start gap-2.5 px-4 py-3 rounded-xl ring-1 shadow-sm min-w-[280px] max-w-sm animate-in', styles[type])}>
      <Icon size={18} className="flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{message}</p>
      <button onClick={() => remove(id)} className="flex-shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => <ToastItem key={t.id} {...t} />)}
    </div>
  )
}
