import { cn } from '../../lib/utils'
import { getStatusBadge, getStatusLabel } from '../../lib/utils'

export default function Badge({ status, children, className, color }) {
  const cls = color || (status ? getStatusBadge(status) : 'bg-gray-50 text-gray-600 ring-gray-200')
  const label = children || (status ? getStatusLabel(status) : '')
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap', cls, className)}>
      {label}
    </span>
  )
}
