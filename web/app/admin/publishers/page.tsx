'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Publisher {
  id: string
  name: string
  email: string
  status: string
  postbackUrl?: string | null
  createdAt: string
  _count: { conversions: number }
  conversions: { commissionAmount: number }[]
}

interface PubStat {
  publisherId: string
  clicks: number
  approvedConversions: number
  totalCommission: number
  cvr: number
  epc: number
}

export default function PublishersPage() {
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [statsMap, setStatsMap] = useState<Record<string, PubStat>>({})
  const [actionId, setActionId] = useState<string | null>(null)

  async function load() {
    const [{ data: pubs }, { data: stats }] = await Promise.all([
      api.get('/admin/publishers'),
      api.get('/admin/publisher-stats'),
    ])
    setPublishers(pubs)
    const map: Record<string, PubStat> = {}
    for (const s of stats) map[s.publisherId] = s
    setStatsMap(map)
  }
  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: string) {
    setActionId(id)
    await api.put(`/admin/publishers/${id}`, { status })
    await load()
    setActionId(null)
  }

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      ACTIVE: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      SUSPENDED: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Publishers</h1>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Publisher', 'Publisher ID', 'Status', 'Clicks', 'Conversions', 'CVR', 'EPC', 'Earned', 'Joined', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {publishers.map((p) => {
              const st = statsMap[p.id]
              return (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-500">{p.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <code className="text-xs font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{p.id.slice(0, 8)}…</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(p.id)}
                        title="Copy full ID"
                        className="text-gray-400 hover:text-gray-700 text-xs"
                      >⎘</button>
                    </div>
                  </td>
                  <td className="px-4 py-3">{statusBadge(p.status)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{st?.clicks ?? 0}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{st?.approvedConversions ?? 0}</td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${(st?.cvr ?? 0) > 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                      {st?.clicks ? `${st.cvr}%` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${(st?.epc ?? 0) > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                      {st?.clicks ? `$${st.epc}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-green-700">{fmtMoney(st?.totalCommission ?? 0)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {p.status !== 'ACTIVE' && (
                        <button
                          onClick={() => setStatus(p.id, 'ACTIVE')}
                          disabled={actionId === p.id}
                          className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2.5 py-1 rounded-md font-medium"
                        >
                          Approve
                        </button>
                      )}
                      {p.status !== 'SUSPENDED' && (
                        <button
                          onClick={() => setStatus(p.id, 'SUSPENDED')}
                          disabled={actionId === p.id}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2.5 py-1 rounded-md font-medium"
                        >
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {publishers.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No publishers yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
