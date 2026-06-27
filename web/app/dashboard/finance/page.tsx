'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, fmtMoney, isImpersonating } from '@/lib/api'

interface Balance {
  pendingAmount: number
  approvedAmount: number
  availableAmount: number
  requestedAmount: number
  paidAmount: number
  holdAmount: number
  currency: string
}

export default function FinanceOverviewPage() {
  const [balance, setBalance] = useState<Balance | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    api.get('/publisher/finance/balance')
      .then(r => setBalance(r.data))
      .catch(err => setError(err.response?.data?.error || err.message || 'Failed to load balance'))
      .finally(() => setLoading(false))
  }, [])

  const cur = balance?.currency || 'USD'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Finances</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {loading && !balance && (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      )}

      {balance && (
        <>
          {/* Balance cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {/* Available for Withdrawal — prominent */}
            <div className="col-span-2 lg:col-span-3 bg-green-50 border-2 border-green-300 rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-green-700 mb-1">Available for Withdrawal</div>
                <div className="text-3xl font-bold text-green-700">{fmtMoney(balance.availableAmount, cur)}</div>
                <div className="text-xs text-green-600 mt-1">Ready to request payment</div>
              </div>
              <div className="text-green-300">
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Pending */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Tracking (Pending)</div>
              <div className="text-2xl font-bold text-gray-700">{fmtMoney(balance.pendingAmount, cur)}</div>
              <div className="text-xs text-gray-400 mt-1">Awaiting advertiser approval</div>
            </div>

            {/* Approved */}
            <div className="bg-white rounded-xl p-5 border border-blue-200">
              <div className="text-xs text-blue-600 mb-1">Approved</div>
              <div className="text-2xl font-bold text-blue-700">{fmtMoney(balance.approvedAmount, cur)}</div>
              <div className="text-xs text-blue-400 mt-1">Approved by advertiser</div>
            </div>

            {/* Requested */}
            <div className="bg-white rounded-xl p-5 border border-yellow-200">
              <div className="text-xs text-yellow-600 mb-1">Requested</div>
              <div className="text-2xl font-bold text-yellow-700">{fmtMoney(balance.requestedAmount, cur)}</div>
              <div className="text-xs text-yellow-400 mt-1">Payment request in progress</div>
            </div>

            {/* Paid */}
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="text-xs text-gray-500 mb-1">Paid</div>
              <div className="text-2xl font-bold text-green-600">{fmtMoney(balance.paidAmount, cur)}</div>
              <div className="text-xs text-gray-400 mt-1">Successfully paid out</div>
            </div>

            {/* On Hold — only show if > 0 */}
            {balance.holdAmount > 0 && (
              <div className="bg-red-50 rounded-xl p-5 border border-red-200">
                <div className="text-xs text-red-600 mb-1">On Hold</div>
                <div className="text-2xl font-bold text-red-700">{fmtMoney(balance.holdAmount, cur)}</div>
                <div className="text-xs text-red-400 mt-1">Under review</div>
              </div>
            )}
          </div>

          {/* No available balance message */}
          {balance.availableAmount === 0 && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm rounded-lg px-4 py-3 mb-6">
              Your approved commission is waiting for advertiser payment before it becomes available for withdrawal.
            </div>
          )}

          {/* Quick links */}
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard/finance/orders"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              View my orders
            </Link>

            {!isImpersonating() && balance.availableAmount > 0 ? (
              <Link
                href="/dashboard/finance/payments/new"
                className="px-4 py-2 text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
              >
                Request payment
              </Link>
            ) : !isImpersonating() ? (
              <span className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed">
                Request payment
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
