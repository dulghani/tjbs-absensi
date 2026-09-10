import { useEffect, useState } from 'react'
import { getCompanies } from '../../api/realService'
import { Select } from '../../components/ui/Primitives'
import CompanyDetail from '../org/CompanyDetail'

export default function WorkSettingsPage() {
  const [companies, setCompanies] = useState([])
  const [selected, setSelected] = useState(null)

  useEffect(() => { getCompanies().then((c) => { setCompanies(c); if (c.length) setSelected(c[0]) }) }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Aturan Kerja</h2>
        <p className="text-sm text-gray-500 mt-0.5">Setting jam kerja dan perhitungan gaji per perusahaan</p>
      </div>

      <Select value={selected?.id || ''} onChange={(e) => setSelected(companies.find((c) => c.id === e.target.value))} className="max-w-xs">
        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>

      {selected && <CompanyDetail key={selected.id} company={selected} />}
    </div>
  )
}
