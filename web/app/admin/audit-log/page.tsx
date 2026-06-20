'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface AuditEntry {
  id: string
  userId: string
  userName: string
  action: string
  entity: string
  entityId: string | null
  changes: Record<string, any> | null
  createdAt: string
}

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [entityFilter, setEntityFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: '30' })
    if (entityFilter) params.set('entity', entityFilter)
    api.get(`/admin/audit-logs?${params}`).then(res => {
      setLogs(res.data.logs)
      setTotal(res.data.total)
    }).finally(() => setLoading(false))
  }, [page, entityFilter])

  const totalPages = Math.ceil(total / 30)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500">History of all changes made by users</p>
        </div>
        <select
          value={entityFilter}
          onChange={e => { setEntityFilter(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All entities</option>
          <option value="Offer">Offer</option>
          <option value="User">User</option>
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Entity</th>
              <th className="px-4 py-3 text-left">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit logs yet</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{log.userName}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${actionColors[log.action] || 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-900">{log.entity}</span>
                  {log.entityId && <span className="text-gray-400 text-xs ml-1">({log.entityId.slice(0, 8)}...)</span>}
                </td>
                <td className="px-4 py-3">
                  {log.changes ? (
                    <div className="space-y-0.5">
                      {Object.entries(log.changes).map(([key, val]) => (
                        <div key={key} className="text-xs">
                          <span className="font-medium text-gray-600">{key}:</span>{' '}
                          {val && typeof val === 'object' && 'from' in val ? (
                            <>
                              <span className="text-red-500 line-through">{String(val.from ?? '—')}</span>
                              {' → '}
                              <span className="text-green-600 font-medium">{String(val.to ?? '—')}</span>
                            </>
                          ) : (
                            <span className="text-gray-700">{String(val)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
          <span>{total} entries</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border disabled:opacity-30">Prev</button>
            <span className="px-3 py-1">Page {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border disabled:opacity-30">Next</button>
          </div>
        </div>
      )}
    </div>
  )
}
