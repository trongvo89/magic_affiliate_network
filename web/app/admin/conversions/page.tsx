'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Conversion {
  id: string
  eventAt: string
  sourceType: string
  offer: { name: string; mmpSource: string }
  publisher?: { name: string; email: string } | null
  eventType: string
  revenue: number
  commissionAmount: number
  currency: string
  status: string
  postbackSent: boolean
  postbackStatus?: number | null
  rawPayload: any
}

interface Offer { id: string; name: string }
interface Publisher { id: string; name: string; email: string }

export default function ConversionsPage() {
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [offers, setOffers] = useState<Offer[]>([])
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [filters, setFilters] = useState({ offerId: '', publisherId: '', status: '', from: '', to: '' })
  const [selected, setSelected] = useState<Conversion | null>(null)
  const limit = 20

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filters.offerId) params.set('offerId', filters.offerId)
    if (filters.publisherId) params.set('publisherId', filters.publisherId)
    if (filters.status) params.set('status', filters.status)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const { data } = await api.get(`/admin/conversions?${params}`)
    setConversions(data.conversions)
    setTotal(data.total)
  }

  useEffect(() => { load() }, [page, filters])
  useEffect(() => {
    Promise.all([api.get('/admin/offers'), api.get('/admin/publishers')]).then(([o, p]) => {
      setOffers(o.data)
      setPublishers(p.data)
    })
  }, [])

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      REJECTED: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  const mmpBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s === 'APPSFLYER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{s}</span>
  )

  const pages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Conversions ({total})</h1>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-5 gap-3">
        <select value={filters.offerId} onChange={(e) => { setFilters({ ...filters, offerId: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Offers</option>
          {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={filters.publisherId} onChange={(e) => { setFilters({ ...filters, publisherId: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Publishers</option>
          {publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Date', 'MMP', 'Offer', 'Publisher', 'Event', 'Revenue', 'Commission', 'Status', 'Postback'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(c.eventAt)}</td>
                  <td className="px-4 py-2.5">{mmpBadge(c.sourceType)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.offer?.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.publisher?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{c.eventType}</td>
                  <td className="px-4 py-2.5 text-gray-900">{fmtMoney(c.revenue, c.currency)}</td>
                  <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(c.commissionAmount, c.currency)}</td>
                  <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                  <td className="px-4 py-2.5">
                    {c.postbackSent
                      ? <span className={`text-xs ${c.postbackStatus === 200 ? 'text-green-600' : 'text-red-500'}`}>{c.postbackStatus ?? '?'}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No conversions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
                Previous
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Raw Payload</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-80 text-gray-700">
              {JSON.stringify(selected.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
