import { forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

const variants = {
  primary: 'bg-brand text-white hover:bg-brand-dark border-brand',
  secondary: 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300',
  danger: 'bg-red-50 text-red-700 hover:bg-red-100 border-red-200',
  success: 'bg-green-50 text-green-700 hover:bg-green-100 border-green-200',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 border-transparent',
  outline: 'bg-transparent text-brand hover:bg-brand-light border-brand',
}

const sizes = {
  sm: 'text-xs px-2.5 py-1.5 gap-1.5',
  md: 'text-sm px-3.5 py-2 gap-2',
  lg: 'text-sm px-5 py-2.5 gap-2',
}

const Button = forwardRef(({ className, variant = 'secondary', size = 'md', loading, icon: Icon, children, disabled, ...props }, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border font-medium transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]',
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={size === 'sm' ? 14 : 16} /> : Icon && <Icon size={size === 'sm' ? 14 : 16} />}
      {children}
    </button>
  )
})
Button.displayName = 'Button'
export default Button
