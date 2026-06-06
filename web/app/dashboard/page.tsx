'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Stats {
  range: { conversions: number; clicks: number; earned: number; approvedConversions: number; approvedEarned: number }
  totalApproved: number
  cvr: number
  epc: number
}

interface Conversion {
  id: string
  eventAt: string
  offer: { name: string }
  eventType: string
  revenue: number
  commissionAmount: number
  currency: string
  status: string
}

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => toDateStr(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(() => toDateStr(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, c] = await Promise.all([
        api.get('/publisher/stats', { params: { from, to } }),
        api.get('/publisher/conversions'),
      ])
      setStats(s.data)
      setConversions(c.data.conversions)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      REJECTED: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Overview</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            max={to}
            onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <span className="text-gray-400">→</span>
          <input
            type="date"
            value={to}
            min={from}
            onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          {[
            { label: '7d', days: 7 },
            { label: '30d', days: 30 },
            { label: '90d', days: 90 },
          ].map(({ label, days }) => (
            <button
              key={label}
              onClick={() => { setFrom(toDateStr(new Date(Date.now() - days * 86400000))); setTo(toDateStr(new Date())) }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {label}
            </button>
          ))}
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Clicks', value: stats.range.clicks, format: false, color: 'text-gray-900' },
            { label: 'Conversions', value: stats.range.approvedConversions, format: false, color: 'text-gray-900' },
            { label: 'CVR', value: stats.range.clicks > 0 ? `${stats.cvr}%` : '—', format: false, color: stats.cvr > 0 ? 'text-blue-600' : 'text-gray-400' },
            { label: 'EPC', value: stats.range.clicks > 0 ? `$${stats.epc}` : '—', format: false, color: stats.epc > 0 ? 'text-indigo-600' : 'text-gray-400' },
            { label: 'Earned (range)', value: stats.range.approvedEarned, format: true, color: 'text-green-600' },
            { label: 'Total Approved (all time)', value: stats.totalApproved, format: true, color: 'text-green-700' },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">{card.label}</div>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.format ? fmtMoney(card.value as number) : card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Conversions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Date', 'Offer', 'Event', 'Revenue', 'Commission', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {conversions.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(c.eventAt)}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{c.offer?.name}</td>
                <td className="px-4 py-2.5 text-gray-600 capitalize">{c.eventType}</td>
                <td className="px-4 py-2.5 text-gray-900">{fmtMoney(c.revenue, c.currency)}</td>
                <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(c.commissionAmount, c.currency)}</td>
                <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
              </tr>
            ))}
            {conversions.length === 0 && !loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No conversions yet</td></tr>
            )}
            {loading && conversions.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
