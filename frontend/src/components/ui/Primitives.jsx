import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

export function Card({ className, children, ...props }) {
  return <div className={cn('bg-white rounded-xl border border-gray-200', className)} {...props}>{children}</div>
}

export function CardHeader({ className, children, ...props }) {
  return <div className={cn('px-4 py-3.5 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap', className)} {...props}>{children}</div>
}

export function CardTitle({ className, children, ...props }) {
  return <h3 className={cn('text-sm font-semibold text-gray-900', className)} {...props}>{children}</h3>
}

export function CardBody({ className, children, ...props }) {
  return <div className={cn('p-4', className)} {...props}>{children}</div>
}

export const Input = forwardRef(({ className, label, error, hint, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>}
    <input
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors bg-white',
        'placeholder:text-gray-400',
        error ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-brand',
        className
      )}
      {...props}
    />
    {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
))
Input.displayName = 'Input'

export const Select = forwardRef(({ className, label, error, children, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>}
    <select
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm border rounded-lg outline-none bg-white transition-colors',
        error ? 'border-red-300' : 'border-gray-300 focus:border-brand',
        className
      )}
      {...props}
    >
      {children}
    </select>
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
))
Select.displayName = 'Select'

export const Textarea = forwardRef(({ className, label, error, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>}
    <textarea
      ref={ref}
      className={cn(
        'w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors resize-none',
        error ? 'border-red-300' : 'border-gray-300 focus:border-brand',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
  </div>
))
Textarea.displayName = 'Textarea'

export function Checkbox({ label, className, ...props }) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer text-sm text-gray-700', className)}>
      <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand" {...props} />
      {label}
    </label>
  )
}

export function Switch({ checked, onChange, label, className }) {
  return (
    <label className={cn('inline-flex items-center gap-2 cursor-pointer', className)}>
      <span className="relative inline-block w-9 h-5">
        <input type="checkbox" className="opacity-0 w-0 h-0 peer" checked={checked} onChange={onChange} />
        <span className="absolute inset-0 bg-gray-300 rounded-full peer-checked:bg-brand transition-colors cursor-pointer before:content-[''] before:absolute before:h-3.5 before:w-3.5 before:left-[3px] before:bottom-[3px] before:bg-white before:rounded-full before:transition-transform peer-checked:before:translate-x-4" />
      </span>
      {label && <span className="text-sm text-gray-700">{label}</span>}
    </label>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="text-center py-12 px-4">
      {Icon && <Icon className="mx-auto text-gray-300 mb-3" size={40} />}
      <p className="text-sm font-medium text-gray-600">{title}</p>
      {description && <p className="text-xs text-gray-400 mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('animate-pulse bg-gray-200 rounded', className)} />
}

export function Divider({ className }) {
  return <div className={cn('h-px bg-gray-100 my-3', className)} />
}
