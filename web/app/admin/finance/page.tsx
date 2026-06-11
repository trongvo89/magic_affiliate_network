'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, fmtMoney } from '@/lib/api'

interface DashboardData {
  receivableByCurrency: Record<string, number>
  receivedByCurrency: Record<string, number>
  payableByCurrency: Record<string, number>
  paidByCurrency: Record<string, number>
  pendingRequests: number
  overdueInvoices: number
  actsAwaitingReconciliation: number
  actsAwaitingPayment: number
}

function CurrencyAmounts({ map, color }: { map: Record<string, number>; color: string }) {
  const entries = Object.entries(map)
  if (entries.length === 0) return <span className={`text-2xl font-bold ${color}`}>{fmtMoney(0)}</span>
  return (
    <div className="space-y-0.5">
      {entries.map(([cur, amt]) => (
        <div key={cur} className={`text-xl font-bold ${color}`}>
          {fmtMoney(amt, cur)} <span className="text-xs font-normal text-gray-400">{cur}</span>
        </div>
      ))}
    </div>
  )
}

export default function FinanceDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/finance/dashboard')
      .then((r) => setData(r.data))
      .catch((err) => setError(err.response?.data?.error || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      </div>
    )
  }

  const countCards = [
    { label: 'Pending Payment Requests', value: data?.pendingRequests ?? 0, color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Overdue Invoices', value: data?.overdueInvoices ?? 0, color: 'bg-red-50 text-red-700' },
    { label: 'Acts Awaiting Reconciliation', value: data?.actsAwaitingReconciliation ?? 0, color: 'bg-purple-50 text-purple-700' },
    { label: 'Acts Awaiting Payment', value: data?.actsAwaitingPayment ?? 0, color: 'bg-indigo-50 text-indigo-700' },
  ]

  const subPages = [
    { href: '/admin/finance/advertisers', label: 'Advertisers', description: 'Manage advertiser accounts and billing info' },
    { href: '/admin/finance/acts', label: 'Settlement Acts', description: 'Manage advertiser settlement acts and CSV reconciliation' },
    { href: '/admin/finance/invoices', label: 'Invoices', description: 'Track advertiser invoices and payment records' },
    { href: '/admin/finance/payables', label: 'Publisher Payables', description: 'View publisher balance and available amounts' },
    { href: '/admin/finance/payment-requests', label: 'Payment Requests', description: 'Approve and process publisher withdrawal requests' },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Finance Dashboard</h1>
      </div>

      {/* Advertiser & Publisher Money Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 mb-3">Advertiser Receivable</p>
          <CurrencyAmounts map={data?.receivableByCurrency ?? {}} color="text-blue-700" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 mb-3">Advertiser Received</p>
          <CurrencyAmounts map={data?.receivedByCurrency ?? {}} color="text-green-700" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 mb-3">Publisher Payable</p>
          <CurrencyAmounts map={data?.payableByCurrency ?? {}} color="text-orange-700" />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-xs font-medium text-gray-500 mb-3">Publisher Paid Out</p>
          <CurrencyAmounts map={data?.paidByCurrency ?? {}} color="text-green-700" />
        </div>
      </div>

      {/* Count Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {countCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-medium text-gray-500 mb-3">{card.label}</p>
            <p className={`text-2xl font-bold text-gray-900`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-page Links */}
      <h2 className="text-base font-semibold text-gray-700 mb-3">Finance Modules</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {subPages.map((page) => (
          <Link key={page.href} href={page.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:border-orange-300 hover:shadow-sm transition-all group">
            <p className="font-semibold text-gray-900 group-hover:text-orange-600 mb-1">{page.label}</p>
            <p className="text-xs text-gray-500">{page.description}</p>
            <div className="mt-3 text-xs font-medium text-orange-500 group-hover:text-orange-600">Open &rarr;</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
