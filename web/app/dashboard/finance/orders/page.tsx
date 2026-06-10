'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Order {
  id: string
  orderId: string
  offerId: string
  finalStatus: string
  paymentStatus: string
  revenue: number
  payout: number
  currency: string
  createdAt: string
  act: { actCode: string }
}

const FINAL_STATUS_BADGES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  HOLD: 'bg-orange-100 text-orange-700',
}

const PAYMENT_STATUS_BADGES: Record<string, string> = {
  UNPAID: 'bg-gray-100 text-gray-600',
  NOT_PAYABLE_YET: 'bg-yellow-100 text-yellow-700',
  PAYABLE: 'bg-blue-100 text-blue-700',
  REQUESTED: 'bg-indigo-100 text-indigo-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  PAID: 'bg-green-100 text-green-700',
  HOLD: 'bg-orange-100 text-orange-700',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  NOT_PAYABLE_YET: 'Waiting',
  PAYABLE: 'Available',
}

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'UNPAID', label: 'Unpaid' },
  { value: 'NOT_PAYABLE_YET', label: 'Waiting' },
  { value: 'PAYABLE', label: 'Available' },
  { value: 'REQUESTED', label: 'Requested' },
  { value: 'PROCESSING', label: 'Processing' },
  { value: 'PAID', label: 'Paid' },
  { value: 'HOLD', label: 'Hold' },
]

export default function FinanceOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('')
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string | number> = { page, limit }
      if (paymentStatusFilter) params.paymentStatus = paymentStatusFilter
      const r = await api.get('/publisher/finance/orders', { params })
      setOrders(r.data.orders)
      setTotal(r.data.total)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load orders')
    } finally {
      setLoading(false)
    }
  }, [page, paymentStatusFilter])

  useEffect(() => { load() }, [load])

  // Reset to page 1 when filter changes
  const handleFilterChange = (val: string) => {
    setPaymentStatusFilter(val)
    setPage(1)
  }

  const totalPages = Math.ceil(total / limit)

  const finalBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${FINAL_STATUS_BADGES[s] || 'bg-gray-100 text-gray-600'}`}>
      {s}
    </span>
  )

  const paymentBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_BADGES[s] || 'bg-gray-100 text-gray-600'}`}>
      {PAYMENT_STATUS_LABELS[s] || s}
    </span>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Orders</h1>
        <div className="flex items-center gap-3">
          <select
            value={paymentStatusFilter}
            onChange={e => handleFilterChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          >
            {PAYMENT_STATUS_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Date', 'Act Code', 'Order ID', 'Final Status', 'Payment Status', 'Payout', 'Currency'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{o.act?.actCode || '—'}</td>
                <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{o.orderId}</td>
                <td className="px-4 py-2.5">{finalBadge(o.finalStatus)}</td>
                <td className="px-4 py-2.5">{paymentBadge(o.paymentStatus)}</td>
                <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(o.payout, o.currency)}</td>
                <td className="px-4 py-2.5 text-gray-600">{o.currency}</td>
              </tr>
            ))}
            {orders.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">No orders found</td></tr>
            )}
            {loading && orders.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
