'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, fmtMoney } from '@/lib/api'

interface DashboardData {
  totalReceivable: number
  totalReceived: number
  totalPayable: number
  totalPaid: number
  pendingRequests: number
  overdueInvoices: number
  actsAwaitingReconciliation: number
  actsAwaitingPayment: number
  currency?: string
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

  const currency = data?.currency || 'USD'

  const cards = [
    {
      label: 'Total Advertiser Receivable',
      value: fmtMoney(data?.totalReceivable ?? 0, currency),
      color: 'bg-blue-50 text-blue-700',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      label: 'Total Advertiser Received',
      value: fmtMoney(data?.totalReceived ?? 0, currency),
      color: 'bg-green-50 text-green-700',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Publisher Payable',
      value: fmtMoney(data?.totalPayable ?? 0, currency),
      color: 'bg-orange-50 text-orange-700',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Total Publisher Paid',
      value: fmtMoney(data?.totalPaid ?? 0, currency),
      color: 'bg-green-50 text-green-700',
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
    {
      label: 'Pending Payment Requests',
      value: String(data?.pendingRequests ?? 0),
      color: 'bg-yellow-50 text-yellow-700',
      isCount: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Overdue Invoices',
      value: String(data?.overdueInvoices ?? 0),
      color: 'bg-red-50 text-red-700',
      isCount: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
    },
    {
      label: 'Acts Awaiting Reconciliation',
      value: String(data?.actsAwaitingReconciliation ?? 0),
      color: 'bg-purple-50 text-purple-700',
      isCount: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      label: 'Acts Awaiting Payment',
      value: String(data?.actsAwaitingPayment ?? 0),
      color: 'bg-indigo-50 text-indigo-700',
      isCount: true,
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
    },
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 leading-snug">{card.label}</p>
              <span className={`p-1.5 rounded-lg ${card.color}`}>{card.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${card.isCount ? 'text-gray-900' : 'text-gray-900'}`}>
              {card.value}
            </p>
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
