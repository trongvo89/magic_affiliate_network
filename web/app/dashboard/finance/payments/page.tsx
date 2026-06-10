'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface PaymentRequest {
  requestCode: string
  amount: number
  currency: string
  paymentMethod?: string
  status: string
  requestedAt: string
  approvedAt?: string
  paidAt?: string
  paymentProofUrl?: string
  statementUrl?: string
}

const STATUS_BADGES: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  PROCESSING: 'bg-indigo-100 text-indigo-700',
  PAID: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-gray-100 text-gray-500',
}

const STATUS_LABELS: Record<string, string> = {
  UNDER_REVIEW: 'Under Review',
}

export default function PaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await api.get('/publisher/finance/payment-requests', { params: { page, limit } })
      setRequests(r.data.requests)
      setTotal(r.data.total)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load payment requests')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / limit)

  const statusBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGES[s] || 'bg-gray-100 text-gray-600'}`}>
      {STATUS_LABELS[s] || s}
    </span>
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Payment Requests</h1>
        <div className="flex items-center gap-3">
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
          <Link
            href="/dashboard/finance/payments/new"
            className="px-4 py-1.5 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
          >
            + New Request
          </Link>
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
              {['Request Code', 'Amount', 'Currency', 'Method', 'Status', 'Requested Date', 'Paid Date', 'Proof'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map(req => (
              <tr key={req.requestCode} className="hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{req.requestCode}</td>
                <td className="px-4 py-2.5 font-medium text-gray-900">{fmtMoney(req.amount, req.currency)}</td>
                <td className="px-4 py-2.5 text-gray-600">{req.currency}</td>
                <td className="px-4 py-2.5 text-gray-600">{req.paymentMethod || '—'}</td>
                <td className="px-4 py-2.5">{statusBadge(req.status)}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(req.requestedAt)}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                  {req.paidAt ? fmtDate(req.paidAt) : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {req.paymentProofUrl ? (
                    <a
                      href={req.paymentProofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-500 hover:text-orange-600 text-xs font-medium underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-gray-300 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && !loading && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No payment requests yet</td></tr>
            )}
            {loading && requests.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading...</td></tr>
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
