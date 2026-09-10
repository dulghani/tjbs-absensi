import { useState, useEffect, useRef } from 'react'
import { Search, ChevronDown, X } from 'lucide-react'
import { searchEmployees, getEmployeeDepartments, getEmployeeDivisions } from '../../api/realService'
import { cn } from '../../lib/utils'

/**
 * Autocomplete input untuk pilih karyawan.
 * Props:
 *   value          - {id, name, nik} atau null
 *   onChange       - fn({id, name, nik, department, position})
 *   companyId      - UUID perusahaan
 *   userRole       - role user
 *   userDepartment - dept user (untuk auto-filter staff_dept)
 *   placeholder    - teks placeholder
 *   disabled       - boolean
 *   hideFilters    - sembunyikan filter bar internal (kalau filter dikelola di luar)
 *   externalDivId  - division_id dari luar (controlled)
 *   externalDept   - department dari luar (controlled)
 */
export default function EmployeeAutocomplete({
  value, onChange, companyId, userRole, userDepartment,
  placeholder = 'Cari nama atau NIK...', disabled = false,
  hideFilters = false, externalDivId, externalDept,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [divisions, setDivisions] = useState([])
  const [departments, setDepartments] = useState([])
  const [filterDiv, setFilterDiv] = useState('all')
  const [filterDept, setFilterDept] = useState(
    userRole === 'staff_dept' && userDepartment ? userDepartment : 'all'
  )

  const inputRef = useRef(null)
  const containerRef = useRef(null)

  // Kalau ada external filter, pakai itu
  const activeDiv = externalDivId !== undefined ? externalDivId : filterDiv
  const activeDept = externalDept !== undefined ? externalDept : filterDept

  useEffect(() => {
    if (hideFilters || !companyId || companyId === 'all') return
    getEmployeeDivisions(companyId).then(setDivisions).catch(() => {})
    getEmployeeDepartments(companyId).then(setDepartments).catch(() => {})
  }, [companyId, hideFilters])

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!companyId || companyId === 'all') { setResults([]); return }
      setLoading(true)
      try {
        const data = await searchEmployees({
          company_id: companyId,
          q: query,
          division_id: activeDiv !== 'all' ? activeDiv : undefined,
          department: activeDept !== 'all' ? activeDept : undefined,
        })
        setResults(data)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, companyId, activeDiv, activeDept])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(emp) { onChange(emp); setOpen(false); setQuery('') }
  function handleClear() { onChange(null); setQuery(''); inputRef.current?.focus() }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Filter bar interna — hanya tampil kalau hideFilters=false dan bukan staff_dept */}
      {!hideFilters && userRole !== 'staff_dept' && (
        <div className="flex gap-1.5 mb-1.5 flex-wrap">
          {divisions.length > 0 && (
            <select value={filterDiv} onChange={e => setFilterDiv(e.target.value)}
              className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white outline-none text-gray-600">
              <option value="all">Semua Divisi</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          {departments.length > 0 && (
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
              className="text-xs px-2 py-1 border border-gray-200 rounded-md bg-white outline-none text-gray-600">
              <option value="all">Semua Dept</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>
      )}
      {userRole === 'staff_dept' && userDepartment && !hideFilters && (
        <span className="text-xs px-2 py-1 bg-brand-light text-brand rounded-md mb-1.5 inline-block">
          Dept: {userDepartment}
        </span>
      )}

      {/* Search input */}
      <div className="relative">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={value && !open ? `${value.name} (${value.nik})` : query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'w-full pl-8 pr-8 py-1.5 text-sm border rounded-lg outline-none transition-colors bg-white',
            'border-gray-200 focus:border-brand',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        {value
          ? <button onClick={handleClear} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>
          : <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        }
      </div>

      {/* Dropdown results */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-56 overflow-y-auto">
          {loading
            ? <div className="px-3 py-3 text-sm text-gray-400 text-center">Mencari...</div>
            : results.length === 0
              ? <div className="px-3 py-3 text-sm text-gray-400 text-center">
                  {query ? `Tidak ada karyawan "${query}"` : 'Ketik nama atau NIK'}
                </div>
              : results.map(emp => (
                <button key={emp.id} onMouseDown={e => { e.preventDefault(); handleSelect(emp) }}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                      <p className="text-xs text-gray-400">{emp.nik} · {emp.department || '-'} · {emp.position || '-'}</p>
                    </div>
                    {emp.divisionName && (
                      <span className="text-xs text-brand bg-brand-light px-1.5 py-0.5 rounded flex-shrink-0">{emp.divisionName}</span>
                    )}
                  </div>
                </button>
              ))
          }
        </div>
      )}
    </div>
  )
}
