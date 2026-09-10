import { useEffect, useState, useRef } from 'react'
import { Search, X, ChevronDown } from 'lucide-react'
import { getEmployeeDivisions, getEmployeeDepartments, getEmployees } from '../../api/realService'

export default function EmployeeCascade({ companyId, value, onChange, disabled }) {
  const [divisions,   setDivisions]   = useState([])
  const [departments, setDepartments] = useState([])
  const [employees,   setEmployees]   = useState([])
  const [divId,       setDivId]       = useState('')
  const [dept,        setDept]        = useState('')
  const [search,      setSearch]      = useState('')
  const [open,        setOpen]        = useState(false)
  const [loading,     setLoading]     = useState(false)
  const ref = useRef()

  useEffect(() => {
    setDivId(''); setDept(''); setSearch(''); onChange(null)
    setDivisions([]); setDepartments([]); setEmployees([])
    if (companyId) getEmployeeDivisions(companyId).then(setDivisions).catch(() => {})
  }, [companyId])

  useEffect(() => {
    setDept(''); setSearch(''); onChange(null); setEmployees([])
    if (companyId) getEmployeeDepartments(companyId, divId || null).then(setDepartments).catch(() => {})
  }, [divId])

  useEffect(() => {
    setSearch(''); onChange(null); setEmployees([])
    if (!companyId) return
    setLoading(true)
    const filters = { company_id: companyId, status: 'active', per_page: 200 }
    if (divId) filters.division_id = divId
    if (dept)  filters.department  = dept
    getEmployees(filters)
      .then(emp => setEmployees(Array.isArray(emp) ? emp : emp?.data || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [dept, divId, companyId])

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const filtered = search
    ? employees.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.nik?.includes(search))
    : employees

  const selected = value ? employees.find(e => e.id === value) : null

  return (
    <div className="space-y-2">
      {divisions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Divisi</label>
          <select value={divId} onChange={e => setDivId(e.target.value)} disabled={disabled || !companyId}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 disabled:bg-gray-50">
            <option value="">Semua Divisi</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      )}

      {departments.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Departemen</label>
          <select value={dept} onChange={e => setDept(e.target.value)} disabled={disabled || !companyId}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none focus:border-blue-500 disabled:bg-gray-50">
            <option value="">Semua Departemen</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Karyawan <span className="text-red-500">*</span>
          {loading && <span className="text-gray-400 ml-1">(memuat...)</span>}
          {!loading && employees.length > 0 && <span className="text-gray-400 ml-1">({employees.length})</span>}
        </label>
        <div ref={ref} className="relative">
          <div onClick={() => { if (!disabled && companyId) setOpen(o => !o) }}
            className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg cursor-pointer bg-white transition-colors ${!companyId?'border-gray-200 bg-gray-50 cursor-not-allowed':'border-gray-300 hover:border-blue-400'} ${open?'border-blue-500 ring-1 ring-blue-500':''}`}
          >
            {selected ? (
              <>
                <span className="flex-1 text-gray-800">{selected.name}</span>
                <span className="text-[11px] text-gray-400 font-mono">{selected.nik}</span>
                <button type="button" onClick={e => { e.stopPropagation(); onChange(null); setSearch('') }} className="text-gray-400 hover:text-red-500"><X size={13}/></button>
              </>
            ) : (
              <>
                <Search size={13} className="text-gray-400 shrink-0" />
                <input type="text" value={search} onChange={e => { setSearch(e.target.value); setOpen(true) }}
                  placeholder={companyId ? 'Cari nama / NIK...' : 'Pilih perusahaan dulu'}
                  disabled={!companyId}
                  className="flex-1 outline-none text-sm bg-transparent placeholder-gray-400"
                  onClick={e => e.stopPropagation()} />
                <ChevronDown size={13} className="text-gray-400 shrink-0" />
              </>
            )}
          </div>

          {open && !selected && (
            <div className="absolute z-50 w-full mt-1 bg-white rounded-lg border border-gray-200 shadow-lg max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-gray-400 text-center">{loading ? 'Memuat...' : search ? 'Tidak ditemukan' : 'Pilih divisi/departemen'}</p>
              ) : filtered.slice(0, 80).map(emp => (
                <button key={emp.id} type="button" onClick={() => { onChange(emp.id); setOpen(false); setSearch('') }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 text-left">
                  <div>
                    <p className="font-medium text-gray-800">{emp.name}</p>
                    <p className="text-[11px] text-gray-400">{emp.department || '-'}</p>
                  </div>
                  <span className="text-xs text-gray-400 font-mono shrink-0 ml-2">{emp.nik}</span>
                </button>
              ))}
              {filtered.length > 80 && <p className="px-3 py-2 text-[11px] text-gray-400 text-center border-t">+{filtered.length-80} lainnya</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
