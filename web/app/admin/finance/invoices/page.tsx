'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  currency: string
  status: string
  act: { id: string; actCode: string }
  advertiser: { id: string; name: string }
}

const BLANK_PAYMENT = {
  amount: '',
  currency: '',
  paymentDate: '',
  paymentMethod: '',
  transactionReference: '',
  notes: '',
}

function statusBadge(s: string) {
  const cls: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    SENT: 'bg-blue-100 text-blue-700',
    PAID: 'bg-green-100 text-green-700',
    PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
    OVERDUE: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>
      {s}
    </span>
  )
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Payment modal
  const [paymentTarget, setPaymentTarget] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState(BLANK_PAYMENT)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSuccess, setPaymentSuccess] = useState('')

  // Mark sent
  const [markingId, setMarkingId] = useState<string | null>(null)

  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      const { data } = await api.get(`/admin/finance/invoices?${params}`)
      setInvoices(data.invoices || data)
      setTotal(data.total || (data.invoices || data).length)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => { load() }, [load])

  async function markSent(invoice: Invoice) {
    setMarkingId(invoice.id)
    try {
      await api.patch(`/admin/finance/invoices/${invoice.id}`, { action: 'mark_sent' })
      await load()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to mark as sent')
    } finally {
      setMarkingId(null)
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!paymentTarget) return
    setPaymentSaving(true)
    setPaymentError('')
    setPaymentSuccess('')
    try {
      await api.post(`/admin/finance/invoices/${paymentTarget.id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        currency: paymentForm.currency || paymentTarget.currency,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        transactionReference: paymentForm.transactionReference || undefined,
        notes: paymentForm.notes || undefined,
      })
      setPaymentSuccess('Payment recorded successfully')
      setPaymentForm(BLANK_PAYMENT)
      await load()
    } catch (err: any) {
      setPaymentError(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Advertiser Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track invoices and payment records</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-red-700 text-sm">{error}</div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Invoice #', 'Advertiser', 'Act Code', 'Amount', 'Currency', 'Invoice Date', 'Due Date', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : invoices.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No invoices found</td></tr>
              ) : invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900 font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2.5 text-gray-700">{inv.advertiser?.name}</td>
                  <td className="px-4 py-2.5">
                    {inv.act ? (
                      <Link href={`/admin/finance/acts/${inv.act.id}`}
                        className="text-blue-600 hover:text-blue-800 font-mono text-xs">
                        {inv.act.actCode}
                      </Link>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{fmtMoney(inv.amount, inv.currency)}</td>
                  <td className="px-4 py-2.5 text-gray-500">{inv.currency}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{inv.invoiceDate?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{inv.dueDate?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5">{statusBadge(inv.status)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5 items-center">
                      <Link href={`/admin/finance/acts/${inv.act?.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
                        View
                      </Link>
                      {inv.status === 'DRAFT' && (
                        <button
                          onClick={() => markSent(inv)}
                          disabled={markingId === inv.id}
                          className="text-xs text-gray-600 hover:text-gray-800 font-medium border border-gray-300 px-2 py-1 rounded hover:bg-gray-50 disabled:opacity-50">
                          {markingId === inv.id ? '...' : 'Mark Sent'}
                        </button>
                      )}
                      {['SENT', 'PARTIALLY_PAID', 'OVERDUE'].includes(inv.status) && (
                        <button
                          onClick={() => {
                            setPaymentTarget(inv)
                            setPaymentForm({ ...BLANK_PAYMENT, currency: inv.currency })
                            setPaymentError('')
                            setPaymentSuccess('')
                          }}
                          className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-medium px-2 py-1 rounded">
                          Record Payment
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

      {/* Record Payment Modal */}
      {paymentTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setPaymentTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
                <p className="text-xs text-gray-500 mt-0.5">Invoice: {paymentTarget.invoiceNumber}</p>
              </div>
              <button onClick={() => setPaymentTarget(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{paymentError}</div>
            )}
            {paymentSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-700">{paymentSuccess}</div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                  <input required type="number" step="0.01" min="0" value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input value={paymentForm.currency || paymentTarget.currency}
                    onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value.toUpperCase() })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                  <input required type="date" value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method <span className="text-red-500">*</span></label>
                  <input required value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    placeholder="Wire / PayPal / ..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
                <input value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  placeholder="TXN-..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={paymentForm.notes} rows={2}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button type="submit" disabled={paymentSaving}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                {paymentSaving ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
