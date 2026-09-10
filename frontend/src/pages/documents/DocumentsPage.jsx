import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, FileText, CheckCircle2, Download } from 'lucide-react'
import { getDocuments, createDocument, getCompanies } from '../../api/realService'
import { Card, CardBody, Select, Input, Checkbox, EmptyState } from '../../components/ui/Primitives'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import { Table, Thead, Tbody, Tr, Th, Td, TableEmpty, Pagination, PageSizeSelector, SortableTh } from '../../components/ui/Table'
import { useTableControls } from '../../hooks/useTableControls'
import { fDate } from '../../lib/utils'
import { toast } from '../../components/ui/Toast'

const CATEGORY_OPTIONS = ['Kebijakan', 'Kontrak Kerja', 'Memo Internal', 'Formulir']

export default function DocumentsPage() {
  const [documents, setDocuments] = useState(null)
  const [companies, setCompanies] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm()

  useEffect(() => { getCompanies().then(setCompanies); load() }, [])
  async function load() { setDocuments(await getDocuments()) }
  const tc = useTableControls(documents, { defaultSortBy: 'createdAt', defaultSortDir: 'desc' })

  async function onSubmit(data) {
    try {
      await createDocument({ ...data, requiresAck: data.requiresAck === true || data.requiresAck === 'true', totalTarget: 20 })
      toast.success('Dokumen berhasil diunggah, menunggu approval')
      setModalOpen(false); load()
    } catch { toast.error('Gagal mengunggah dokumen') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Dokumen</h2>
          <p className="text-sm text-gray-500 mt-0.5">Kelola kebijakan, kontrak, dan dokumen internal</p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => { reset({ requiresAck: false }); setModalOpen(true) }}>Tambah Dokumen</Button>
      </div>

      <Card>
        <CardBody className="p-0 sm:p-4">
          {documents && documents.length > 0 && (
            <div className="flex justify-end mb-2"><PageSizeSelector value={tc.perPage} onChange={tc.setPerPage} /></div>
          )}
          <Table>
            <Thead><Tr>
              <Th>No. Dokumen</Th>
              <SortableTh label="Judul" sortKey="title" sortBy={tc.sortBy} sortDir={tc.sortDir} onSort={tc.toggleSort} />
              <Th>Kategori</Th>
              <SortableTh label="Berlaku" sortKey="effectiveDate" sortBy={tc.sortBy} sortDir={tc.sortDir} onSort={tc.toggleSort} />
              <Th>Acknowledgment</Th><Th>Status</Th><Th></Th>
            </Tr></Thead>
            <Tbody>
              {!documents ? null : documents.length === 0 ? <TableEmpty colSpan={7} /> : tc.paginated.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-mono text-xs">{d.number}</Td>
                  <Td className="font-medium text-gray-900">{d.title}</Td>
                  <Td><Badge color="bg-gray-100 text-gray-700 ring-gray-200">{d.category}</Badge></Td>
                  <Td>{fDate(d.effectiveDate)}</Td>
                  <Td>
                    {d.requiresAck ? (
                      <span className="text-xs text-gray-500">{d.ackCount}/{d.totalTarget} <CheckCircle2 size={11} className="inline text-green-500 ml-0.5" /></span>
                    ) : <span className="text-xs text-gray-300">-</span>}
                  </Td>
                  <Td><Badge status={d.status} /></Td>
                  <Td>
                    <div className="flex gap-1">
                      <button className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md"><Download size={14} /></button>
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          <Pagination page={tc.page} totalPages={tc.totalPages} onPageChange={tc.setPage} total={tc.total} perPage={tc.perPage} />
        </CardBody>
      </Card>

      <Modal
        open={modalOpen} onClose={() => setModalOpen(false)} title="Tambah Dokumen Baru"
        footer={<>
          <Button variant="secondary" onClick={() => setModalOpen(false)}>Batal</Button>
          <Button variant="primary" loading={isSubmitting} onClick={handleSubmit(onSubmit)}>Unggah Dokumen</Button>
        </>}
      >
        <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
          <Input label="Judul Dokumen" placeholder="Kebijakan Lembur 2025" {...register('title', { required: true })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Kategori" {...register('category', { required: true })}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
            <Select label="Perusahaan" {...register('company_id', { required: true })}>
              <option value="">-- Pilih --</option>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <Input label="Tanggal Berlaku" type="date" {...register('effectiveDate', { required: true })} />
          <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
            <FileText className="mx-auto text-gray-300 mb-2" size={28} />
            <p className="text-xs text-gray-400">Klik untuk unggah file (PDF, DOCX)</p>
          </div>
          <Checkbox label="Memerlukan acknowledgment/tanda tangan karyawan" {...register('requiresAck')} />
        </form>
      </Modal>
    </div>
  )
}
