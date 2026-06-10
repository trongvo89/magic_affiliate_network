'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, fmtMoney } from '@/lib/api'

interface Balance {
  availableAmount: number
  currency: string
}

interface Order {
  id: string
  orderId: string
  payout: number
  currency: string
  act: { actCode: string }
}

export default function NewPaymentRequestPage() {
  const router = useRouter()
  const [balance, setBalance] = useState<Balance | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [paymentMethod, setPaymentMethod] = useState('')
  const [bankInfo, setBankInfo] = useState('')
  const [publisherNote, setPublisherNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    Promise.all([
      api.get('/publisher/finance/balance'),
      api.get('/publisher/finance/orders', { params: { paymentStatus: 'PAYABLE', limit: 50 } }),
    ])
      .then(([b, o]) => {
        setBalance(b.data)
        setOrders(o.data.orders || [])
      })
      .catch(err => setError(err.response?.data?.error || err.message || 'Failed to load data'))
      .finally(() => setLoading(false))
  }, [])

  const allSelected = orders.length > 0 && selectedIds.size === orders.length

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(orders.map(o => o.id)))
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectedOrders = orders.filter(o => selectedIds.has(o.id))
  const selectedTotal = selectedOrders.reduce((sum, o) => sum + o.payout, 0)
  const currency = balance?.currency || (orders[0]?.currency ?? 'USD')

  const handleSubmit = async () => {
    setSubmitError('')
    if (selectedIds.size === 0) {
      setSubmitError('Please select at least one order.')
      return
    }
    if (!paymentMethod.trim()) {
      setSubmitError('Please enter a payment method.')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/publisher/finance/payment-requests', {
        orderIds: Array.from(selectedIds),
        paymentMethod: paymentMethod.trim(),
        bankInfo: bankInfo.trim(),
        publisherNote: publisherNote.trim(),
      })
      router.push('/dashboard/finance/payments')
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || err.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-gray-400 py-12">Loading...</div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
        <Link href="/dashboard/finance/payments" className="text-sm text-orange-500 hover:text-orange-600">
          ← Back to payment requests
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/finance/payments" className="text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Request Payment</h1>
      </div>

      {/* Available balance */}
      {balance && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div>
            <div className="text-xs text-green-600 font-medium mb-0.5">Available for Withdrawal</div>
            <div className="text-2xl font-bold text-green-700">{fmtMoney(balance.availableAmount, balance.currency)}</div>
          </div>
        </div>
      )}

      {/* No available orders */}
      {orders.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center mb-6">
          <div className="text-gray-400 mb-4">No available orders for withdrawal</div>
          <Link
            href="/dashboard/finance/payments"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            ← Back
          </Link>
        </div>
      ) : (
        <>
          {/* Order selection table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
            <div className="p-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 text-sm">Select orders to include</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left font-medium">Order ID</th>
                  <th className="px-4 py-3 text-left font-medium">Act Code</th>
                  <th className="px-4 py-3 text-left font-medium">Payout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => toggleOne(o.id)}
                    className={`cursor-pointer transition-colors ${selectedIds.has(o.id) ? 'bg-orange-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(o.id)}
                        onChange={() => toggleOne(o.id)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                      />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-gray-700 text-xs">{o.orderId}</td>
                    <td className="px-4 py-2.5 font-mono text-gray-600 text-xs">{o.act?.actCode || '—'}</td>
                    <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(o.payout, o.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Selected total */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {selectedIds.size} order{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <span className="text-base font-bold text-gray-900">
                Total: {fmtMoney(selectedTotal, currency)}
              </span>
            </div>
          </div>

          {/* Payment details form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 space-y-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-3">Payment details</h2>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                placeholder="e.g. Bank Transfer, USDT, PayPal"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Bank / Wallet Info
              </label>
              <textarea
                value={bankInfo}
                onChange={e => setBankInfo(e.target.value)}
                rows={4}
                placeholder={'e.g.\n{\n  "bank": "ABC Bank",\n  "account": "1234567890",\n  "name": "John Doe"\n}'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
              />
              <p className="text-xs text-gray-400 mt-1">Paste your bank account or wallet details here.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Note (optional)
              </label>
              <textarea
                value={publisherNote}
                onChange={e => setPublisherNote(e.target.value)}
                rows={2}
                placeholder="Any additional notes for the admin..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-y"
              />
            </div>
          </div>

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
              {submitError}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <Link
              href="/dashboard/finance/payments"
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
