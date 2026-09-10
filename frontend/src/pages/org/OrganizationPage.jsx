import { useEffect, useState } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, GitBranch, Network, Building2 } from 'lucide-react'
import { getCompanies, getOrgTree, createDivision, createDepartment, deleteDivision, deleteDepartment } from '../../api/realService'
import { Card, CardBody, Input, Select } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import { toast } from '../../components/ui/Toast'
import { cn } from '../../lib/utils'

export default function OrganizationPage() {
  const [companies, setCompanies] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [divisions, setDivisions] = useState([])
  const [expandedDivs, setExpandedDivs] = useState({})
  const [newDivName, setNewDivName] = useState('')
  const [addingDivision, setAddingDivision] = useState(false)
  const [newDeptNames, setNewDeptNames] = useState({}) // divId → text input
  const [addingDept, setAddingDept] = useState({}) // divId → bool loading

  useEffect(() => { getCompanies().then((c) => { setCompanies(c); if (c.length) setSelectedId(c[0].id) }) }, [])
  useEffect(() => { if (selectedId) loadTree() }, [selectedId])

  async function loadTree() {
    setDivisions([])
    try {
      const tree = await getOrgTree(selectedId)
      // tree.children berisi divisi; tiap divisi punya children = departemen
      setDivisions(tree.children || [])
      // Expand semua divisi otomatis supaya langsung kelihatan struktur-nya.
      const exp = {}
      ;(tree.children || []).forEach((d) => { exp[d.id] = true })
      setExpandedDivs(exp)
    } catch {}
  }

  async function handleAddDivision() {
    if (!newDivName.trim()) return
    setAddingDivision(true)
    try {
      await createDivision(selectedId, { name: newDivName.trim(), code: newDivName.trim().toUpperCase().replace(/\s+/g, '-').slice(0, 30) })
      toast.success('Divisi ditambahkan')
      setNewDivName('')
      loadTree()
    } catch { toast.error('Gagal menambahkan divisi') } finally { setAddingDivision(false) }
  }

  async function handleDeleteDivision(divId) {
    if (!confirm('Hapus divisi ini? Departemen di dalamnya juga ikut terhapus.')) return
    try { await deleteDivision(divId); toast.success('Divisi dihapus'); loadTree() }
    catch { toast.error('Gagal hapus divisi') }
  }

  async function handleAddDepartment(divId, divisionIdForBackend) {
    const name = newDeptNames[divId]?.trim()
    if (!name) return
    setAddingDept((prev) => ({ ...prev, [divId]: true }))
    try {
      await createDepartment(selectedId, { name, code: name.toUpperCase().replace(/\s+/g, '-').slice(0, 30), division_id: divisionIdForBackend })
      toast.success('Departemen ditambahkan')
      setNewDeptNames((prev) => ({ ...prev, [divId]: '' }))
      loadTree()
    } catch { toast.error('Gagal menambahkan departemen') }
    finally { setAddingDept((prev) => ({ ...prev, [divId]: false })) }
  }

  async function handleDeleteDepartment(deptId) {
    if (!confirm('Hapus departemen ini?')) return
    try { await deleteDepartment(deptId); toast.success('Departemen dihapus'); loadTree() }
    catch { toast.error('Gagal hapus departemen') }
  }

  function toggleDiv(id) { setExpandedDivs((prev) => ({ ...prev, [id]: !prev[id] })) }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Struktur Organisasi</h2>
        <p className="text-sm text-gray-500 mt-0.5">Kelola Divisi dan Departemen per perusahaan</p>
      </div>

      <div className="max-w-xs">
        <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </div>

      <Card>
        <CardBody className="space-y-3">
          {/* Tambah Divisi Baru */}
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-1">
            <Building2 size={15} className="text-brand flex-shrink-0" />
            <input
              placeholder="Nama divisi baru..." value={newDivName}
              onChange={(e) => setNewDivName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddDivision()}
              className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-brand bg-white"
            />
            <Button variant="primary" size="sm" icon={Plus} loading={addingDivision} onClick={handleAddDivision}>Tambah Divisi</Button>
          </div>

          {divisions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">Belum ada divisi — tambahkan divisi pertama di atas.</p>
          )}

          {/* Daftar Divisi */}
          {divisions.map((div) => (
            <div key={div.id} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header Divisi */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 select-none"
                onClick={() => toggleDiv(div.id)}
              >
                {expandedDivs[div.id] ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                <GitBranch size={13} className="text-purple-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-800 flex-1">{div.name}</span>
                <span className="text-xs text-gray-400">{div.children?.length ?? 0} departemen</span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteDivision(div.id) }} className="text-gray-300 hover:text-red-500 ml-2"><Trash2 size={13} /></button>
              </div>

              {/* Departemen dalam Divisi */}
              {expandedDivs[div.id] && (
                <div className="px-3 py-2 space-y-1">
                  {(div.children || []).map((dept) => (
                    <div key={dept.id} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-gray-50 group">
                      <Network size={12} className="text-amber-500 flex-shrink-0" />
                      <span className="text-sm text-gray-700 flex-1">{dept.name}</span>
                      <button onClick={() => handleDeleteDepartment(dept.id)} className="text-gray-200 group-hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  ))}

                  {/* Input tambah departemen per divisi */}
                  <div className="flex items-center gap-2 pt-1 border-t border-gray-100 mt-1">
                    <input
                      placeholder="Nama departemen baru..." value={newDeptNames[div.id] || ''}
                      onChange={(e) => setNewDeptNames((prev) => ({ ...prev, [div.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDepartment(div.id, div.id)}
                      className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-md outline-none focus:border-brand bg-white"
                    />
                    <button
                      onClick={() => handleAddDepartment(div.id, div.id)}
                      disabled={addingDept[div.id]}
                      className="text-xs px-2.5 py-1.5 bg-brand text-white rounded-md hover:bg-brand-dark disabled:opacity-50 flex items-center gap-1"
                    >
                      <Plus size={11} /> Tambah
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
