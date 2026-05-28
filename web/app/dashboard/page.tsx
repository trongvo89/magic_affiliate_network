'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Stats {
  month: { conversions: number; earned: number }
  totalApproved: number
}

interface Conversion {
  id: string
  eventAt: string
  offer: { name: string; mmpSource: string }
  eventType: string
  revenue: number
  commissionAmount: number
  currency: string
  status: string
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [conversions, setConversions] = useState<Conversion[]>([])

  useEffect(() => {
    Promise.all([api.get('/publisher/stats'), api.get('/publisher/conversions')]).then(([s, c]) => {
      setStats(s.data)
      setConversions(c.data.conversions)
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

  const pendingEarned = conversions.filter(c => c.status === 'PENDING').reduce((s, c) => s + c.commissionAmount, 0)

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-gray-900 mb-6">My Overview</h1>

      {stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Conversions (30d)', value: stats.month.conversions, format: false, color: 'text-gray-900' },
            { label: 'Earned Pending', value: pendingEarned, format: true, color: 'text-yellow-600' },
            { label: 'Earned Approved', value: stats.totalApproved, format: true, color: 'text-green-600' },
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
              {['Date', 'Offer', 'MMP', 'Event', 'Revenue', 'Commission', 'Status'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {conversions.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(c.eventAt)}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{c.offer?.name}</td>
                <td className="px-4 py-2.5">{mmpBadge(c.offer?.mmpSource)}</td>
                <td className="px-4 py-2.5 text-gray-600 capitalize">{c.eventType}</td>
                <td className="px-4 py-2.5 text-gray-900">{fmtMoney(c.revenue, c.currency)}</td>
                <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(c.commissionAmount, c.currency)}</td>
                <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
              </tr>
            ))}
            {conversions.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No conversions yet</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
