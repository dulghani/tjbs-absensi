import { useState, useMemo, useEffect } from 'react'

/**
 * Hook reusable untuk sorting + pagination di halaman tabel manapun.
 * Dipakai di: EmployeesPage, UsersPage, PayrollPage, DocumentsPage, AuditPage, AttendancePage.
 *
 * @param {Array|null} data - data mentah (belum di-sort/paginate), null kalau masih loading
 * @param {Object} opts
 * @param {string} opts.defaultSortBy - key kolom default untuk sort awal
 * @param {'asc'|'desc'} opts.defaultSortDir
 * @param {number} opts.defaultPerPage
 * @param {Array} opts.resetDeps - kalau salah satu berubah, page direset ke 1 (biasanya filter)
 */
export function useTableControls(data, { defaultSortBy = null, defaultSortDir = 'asc', defaultPerPage = 25, resetDeps = [] } = {}) {
  const [sortBy, setSortBy] = useState(defaultSortBy)
  const [sortDir, setSortDir] = useState(defaultSortDir)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(defaultPerPage)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, resetDeps)

  const sorted = useMemo(() => {
    if (!data) return []
    if (!sortBy) return [...data]
    const arr = [...data]
    arr.sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (av == null) av = ''
      if (bv == null) bv = ''
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return arr
  }, [data, sortBy, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage))
  const paginated = useMemo(() => sorted.slice((page - 1) * perPage, page * perPage), [sorted, page, perPage])

  function toggleSort(key) {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortBy(key); setSortDir('asc') }
  }

  return { sortBy, sortDir, toggleSort, page, setPage, perPage, setPerPage, paginated, totalPages, total: sorted.length }
}
