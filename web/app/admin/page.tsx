'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Stats {
  today: { conversions: number; revenue: number; commission: number }
  pendingPublishers: number
}

interface Conversion {
  id: string
  eventAt: string
  sourceType: string
  offer: { name: string; mmpSource: string }
  publisher?: { name: string } | null
  eventType: string
  revenue: number
  commissionAmount: number
  currency: string
  status: string
  postbackStatus?: number | null
}

interface Publisher {
  id: string
  name: string
  email: string
  status: string
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [pending, setPending] = useState<Publisher[]>([])
  const [approving, setApproving] = useState<string | null>(null)

  async function load() {
    const [s, c, p] = await Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/conversions?limit=20'),
      api.get('/admin/publishers/pending'),
    ])
    setStats(s.data)
    setConversions(c.data.conversions)
    setPending(p.data)
  }

  useEffect(() => { load() }, [])

  async function approvePub(id: string) {
    setApproving(id)
    await api.put(`/admin/publishers/${id}`, { status: 'ACTIVE' })
    await load()
    setApproving(null)
  }

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

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Conversions Today', value: stats.today.conversions, format: false },
            { label: 'Revenue Today', value: stats.today.revenue, format: true },
            { label: 'Commission Owed', value: stats.today.commission, format: true },
            { label: 'Pending Publishers', value: stats.pendingPublishers, format: false },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">{card.label}</div>
              <div className="text-2xl font-bold text-gray-900">
                {card.format ? fmtMoney(card.value as number) : card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Conversions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['Time', 'Source', 'Offer', 'Publisher', 'Event', 'Revenue', 'Commission', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {conversions.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(c.eventAt)}</td>
                    <td className="px-4 py-2.5">{mmpBadge(c.sourceType)}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.offer?.name}</td>
                    <td className="px-4 py-2.5 text-gray-600">{c.publisher?.name || '—'}</td>
                    <td className="px-4 py-2.5 text-gray-600 capitalize">{c.eventType}</td>
                    <td className="px-4 py-2.5 text-gray-900">{fmtMoney(c.revenue, c.currency)}</td>
                    <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(c.commissionAmount, c.currency)}</td>
                    <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                  </tr>
                ))}
                {conversions.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No conversions yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
          </div>
          <div className="p-3 space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.email}</div>
                </div>
                <button
                  onClick={() => approvePub(p.id)}
                  disabled={approving === p.id}
                  className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  {approving === p.id ? '...' : 'Approve'}
                </button>
              </div>
            ))}
            {pending.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No pending approvals</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
