'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface PaymentRequest {
  id: string
  requestCode: string
  status: string
  amount: number
  currency: string
  method: string
  requestedAt: string
  approvedAt?: string | null
  paidAt?: string | null
  proofUrl?: string | null
  publisher: { id: string; name: string; email: string }
}

const PR_STATUSES = ['REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PROCESSING', 'PAID', 'CANCELLED']

function statusBadge(s: string) {
  const cls: Record<string, string> = {
    REQUESTED: 'bg-blue-100 text-blue-700',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    PROCESSING: 'bg-indigo-100 text-indigo-700',
    PAID: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>
      {s}
    </span>
  )
}

export default function PaymentRequestsPage() {
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Inline action state
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  // For "Mark Paid" — needs proof URL input
  const [paidProof, setPaidProof] = useState<{ id: string; proofUrl: string } | null>(null)

  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/admin/finance/payment-requests?${params}`)
      setRequests(data.requests || data)
      setTotal(data.total || (data.requests || data).length)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load payment requests')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  async function doAction(id: string, action: string, extra?: Record<string, string>) {
    setActionLoading(id)
    try {
      await api.patch(`/admin/finance/payment-requests/${id}`, { action, ...extra })
      await load()
    } catch (err: any) {
      alert(err.response?.data?.error || `Action "${action}" failed`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkPaid(e: React.FormEvent) {
    e.preventDefault()
    if (!paidProof) return
    await doAction(paidProof.id, 'mark_paid', paidProof.proofUrl ? { proofUrl: paidProof.proofUrl } : {})
    setPaidProof(null)
  }

  const pages = Math.ceil(total / limit)
  const isActing = (id: string) => actionLoading === id

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payment Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Publisher withdrawal requests</p>
        </div>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Statuses</option>
          {PR_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Request Code', 'Publisher', 'Amount', 'Currency', 'Method', 'Status', 'Requested', 'Approved', 'Paid', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No payment requests found</td></tr>
              ) : requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900 font-medium">{req.requestCode}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-gray-900">{req.publisher?.name}</p>
                    <p className="text-xs text-gray-500">{req.publisher?.email}</p>
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-gray-900">{fmtMoney(req.amount, req.currency)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{req.currency}</td>
                  <td className="px-4 py-2.5 text-gray-600">{req.method}</td>
                  <td className="px-4 py-2.5">{statusBadge(req.status)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {req.requestedAt ? fmtDate(req.requestedAt) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {req.approvedAt ? fmtDate(req.approvedAt) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {req.paidAt ? fmtDate(req.paidAt) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {req.status === 'REQUESTED' && (
                        <>
                          <button
                            onClick={() => doAction(req.id, 'review')}
                            disabled={isActing(req.id)}
                            className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded font-medium disabled:opacity-50">
                            {isActing(req.id) ? '...' : 'Review'}
                          </button>
                          <button
                            onClick={() => doAction(req.id, 'approve')}
                            disabled={isActing(req.id)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-medium disabled:opacity-50">
                            {isActing(req.id) ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => doAction(req.id, 'reject')}
                            disabled={isActing(req.id)}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-medium disabled:opacity-50">
                            {isActing(req.id) ? '...' : 'Reject'}
                          </button>
                        </>
                      )}
                      {req.status === 'UNDER_REVIEW' && (
                        <>
                          <button
                            onClick={() => doAction(req.id, 'approve')}
                            disabled={isActing(req.id)}
                            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded font-medium disabled:opacity-50">
                            {isActing(req.id) ? '...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => doAction(req.id, 'reject')}
                            disabled={isActing(req.id)}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-medium disabled:opacity-50">
                            {isActing(req.id) ? '...' : 'Reject'}
                          </button>
                        </>
                      )}
                      {req.status === 'APPROVED' && (
                        <button
                          onClick={() => doAction(req.id, 'process')}
                          disabled={isActing(req.id)}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded font-medium disabled:opacity-50">
                          {isActing(req.id) ? '...' : 'Mark Processing'}
                        </button>
                      )}
                      {req.status === 'PROCESSING' && (
                        <button
                          onClick={() => setPaidProof({ id: req.id, proofUrl: '' })}
                          disabled={isActing(req.id)}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded font-medium disabled:opacity-50">
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {pages} ({total} total)</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
              <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Mark Paid Modal */}
      {paidProof && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setPaidProof(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Mark as Paid</h2>
              <button onClick={() => setPaidProof(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <form onSubmit={handleMarkPaid} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proof URL <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={paidProof.proofUrl}
                  onChange={(e) => setPaidProof({ ...paidProof, proofUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                <p className="text-xs text-gray-400 mt-1">Link to payment receipt or transfer confirmation</p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setPaidProof(null)}
                  className="flex-1 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={actionLoading === paidProof.id}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                  {actionLoading === paidProof.id ? 'Processing...' : 'Confirm Paid'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
