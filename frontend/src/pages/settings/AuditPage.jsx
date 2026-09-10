import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { getAuditLogsPaginated } from '../../api/realService'
import { Card, CardBody, Select, EmptyState } from '../../components/ui/Primitives'
import Badge from '../../components/ui/Badge'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination, PageSizeSelector } from '../../components/ui/Table'
import { fDateTime, ROLE_LABELS, ROLE_COLORS } from '../../lib/utils'

const ACTION_COLORS = {
  create: 'bg-green-50 text-green-700 ring-green-200',
  update: 'bg-blue-50 text-blue-700 ring-blue-200',
  delete: 'bg-red-50 text-red-700 ring-red-200',
  approve: 'bg-purple-50 text-purple-700 ring-purple-200',
  reject: 'bg-orange-50 text-orange-700 ring-orange-200',
}
const ACTION_LABELS = { create: 'Buat', update: 'Ubah', delete: 'Hapus', approve: 'Setujui', reject: 'Tolak' }
const ENTITY_LABELS = { payroll: 'Payroll', overtime_request: 'Lembur', employee: 'Karyawan', user: 'User', document: 'Dokumen', company: 'Perusahaan' }

export default function AuditPage() {
  const [logs, setLogs] = useState(null)
  const [total, setTotal] = useState(0)
  const [filterEntity, setFilterEntity] = useState('all')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(25)

  useEffect(() => { setPage(1) }, [filterEntity, perPage])
  useEffect(() => { load() }, [filterEntity, page, perPage])

  async function load() {
    const result = await getAuditLogsPaginated({ entity: filterEntity }, page, perPage)
    setLogs(result.data)
    setTotal(result.total)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-0.5">Riwayat lengkap seluruh transaksi dalam sistem — {total} entri</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)} className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white outline-none max-w-xs">
          <option value="all">Semua Entitas</option>
          <option value="payroll">Payroll</option>
          <option value="overtime_request">Lembur</option>
          <option value="employee">Karyawan</option>
          <option value="user">User</option>
          <option value="document">Dokumen</option>
          <option value="company">Perusahaan</option>
        </select>
        <div className="ml-auto"><PageSizeSelector value={perPage} onChange={setPerPage} /></div>
      </div>

      <Card>
        <CardBody className="p-0 sm:p-4">
          {logs?.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="Tidak ada log ditemukan" />
          ) : (
            <>
              <Table>
                <Thead><Tr><Th>Waktu</Th><Th>User</Th><Th>Role</Th><Th>Aksi</Th><Th>Entitas</Th><Th>Ringkasan</Th><Th>IP</Th></Tr></Thead>
                <Tbody>
                  {!logs ? null : logs.map((l) => (
                    <Tr key={l.id}>
                      <Td className="text-xs text-gray-500 whitespace-nowrap">{fDateTime(l.timestamp)}</Td>
                      <Td className="font-medium text-gray-900">{l.user}</Td>
                      <Td><Badge color={ROLE_COLORS[l.role]}>{ROLE_LABELS[l.role]}</Badge></Td>
                      <Td><Badge color={ACTION_COLORS[l.action]}>{ACTION_LABELS[l.action]}</Badge></Td>
                      <Td className="text-gray-600">{ENTITY_LABELS[l.entity] || l.entity}: <span className="text-gray-400">{l.entityName}</span></Td>
                      <Td className="text-gray-500">{l.summary}</Td>
                      <Td className="font-mono text-xs text-gray-400">{l.ip}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} total={total} perPage={perPage} />
            </>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
