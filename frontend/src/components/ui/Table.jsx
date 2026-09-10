import { cn } from '../../lib/utils'
import { Inbox, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

export function Table({ children, className }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      <table className={cn('w-full text-sm', className)}>{children}</table>
    </div>
  )
}

export function Thead({ children }) {
  return <thead className="border-b border-gray-100">{children}</thead>
}

export function Th({ children, className, ...props }) {
  return (
    <th className={cn('text-left text-xs font-medium text-gray-500 px-3 py-2.5 whitespace-nowrap', className)} {...props}>
      {children}
    </th>
  )
}

export function Tbody({ children }) {
  return <tbody className="divide-y divide-gray-50">{children}</tbody>
}

export function Tr({ children, className, ...props }) {
  return <tr className={cn('hover:bg-gray-50/70 transition-colors', className)} {...props}>{children}</tr>
}

export function Td({ children, className, ...props }) {
  return <td className={cn('px-3 py-2.5 text-gray-700 align-middle', className)} {...props}>{children}</td>
}

export function TableEmpty({ colSpan, message = 'Tidak ada data' }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 text-center">
        <Inbox className="mx-auto text-gray-300 mb-2" size={32} />
        <p className="text-sm text-gray-400">{message}</p>
      </td>
    </tr>
  )
}

export function Pagination({ page, totalPages, onPageChange, total, perPage }) {
  if (!totalPages || totalPages <= 1) return null
  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)
  return (
    <div className="flex items-center justify-between px-1 pt-3 text-xs text-gray-500">
      <span>Menampilkan {from}-{to} dari {total}</span>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2.5 py-1 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >Prev</button>
        <span className="px-2">{page} / {totalPages}</span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2.5 py-1 rounded-md border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >Next</button>
      </div>
    </div>
  )
}

/** Header kolom yang bisa diklik untuk sort, dipakai bareng useTableControls. */
export function SortableTh({ label, sortKey, sortBy, sortDir, onSort, className }) {
  const active = sortBy === sortKey
  return (
    <Th className={cn('cursor-pointer select-none hover:text-gray-700', className)} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />) : <ArrowUpDown size={11} className="text-gray-300" />}
      </span>
    </Th>
  )
}

/** Dropdown pilih jumlah baris per halaman, dipakai bareng useTableControls. */
export function PageSizeSelector({ value, onChange, options = [10, 25, 50, 100] }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-500">
      <span>Tampilkan</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg bg-white outline-none">
        {options.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <span>baris</span>
    </div>
  )
}
