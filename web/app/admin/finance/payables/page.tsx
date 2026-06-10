'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney } from '@/lib/api'

interface Payable {
  publisher: {
    id: string
    name: string
    email: string
  }
  currency: string
  pending: number
  approved: number
  available: number
  requested: number
  paid: number
  hold: number
}

export default function PayablesPage() {
  const [payables, setPayables] = useState<Payable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/admin/finance/payables')
      .then((r) => {
        setPayables(r.data.payables || r.data)
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Failed to load payables')
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-56" />
          <div className="h-64 bg-gray-200 rounded-xl" />
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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Publisher Payables</h1>
          <p className="text-sm text-gray-500 mt-0.5">Publisher balance summary across all currencies</p>
        </div>
        <span className="text-sm text-gray-500">{payables.length} publisher{payables.length !== 1 ? 's' : ''}</span>
      </div>

      {payables.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          No payable records found
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Publisher</th>
                  <th className="px-4 py-3 text-left font-medium">Currency</th>
                  <th className="px-4 py-3 text-right font-medium">Pending</th>
                  <th className="px-4 py-3 text-right font-medium">Approved</th>
                  <th className="px-4 py-3 text-right font-medium bg-green-50 text-green-700">Available</th>
                  <th className="px-4 py-3 text-right font-medium">Requested</th>
                  <th className="px-4 py-3 text-right font-medium text-blue-600">Paid</th>
                  <th className="px-4 py-3 text-right font-medium text-yellow-600">Hold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payables.map((row, idx) => (
                  <tr key={`${row.publisher.id}-${row.currency}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.publisher.name}</p>
                      <p className="text-xs text-gray-500">{row.publisher.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 font-medium">{row.currency}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtMoney(row.pending || 0, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {fmtMoney(row.approved || 0, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700 bg-green-50/50">
                      {fmtMoney(row.available || 0, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-600">
                      {fmtMoney(row.requested || 0, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-blue-600 font-medium">
                      {fmtMoney(row.paid || 0, row.currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-600">
                      {fmtMoney(row.hold || 0, row.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t border-gray-200">
                {/* Aggregate totals per currency */}
                {Array.from(new Set(payables.map((r) => r.currency))).map((currency) => {
                  const rows = payables.filter((r) => r.currency === currency)
                  const sum = (key: keyof Omit<Payable, 'publisher' | 'currency'>) =>
                    rows.reduce((acc, r) => acc + (r[key] as number || 0), 0)
                  return (
                    <tr key={`total-${currency}`} className="text-xs font-semibold text-gray-700">
                      <td className="px-4 py-2.5 text-gray-500">Total ({currency})</td>
                      <td className="px-4 py-2.5 text-gray-500">{currency}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(sum('pending'), currency)}</td>
                      <td className="px-4 py-2.5 text-right">{fmtMoney(sum('approved'), currency)}</td>
                      <td className="px-4 py-2.5 text-right text-green-700 bg-green-50/50">{fmtMoney(sum('available'), currency)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600">{fmtMoney(sum('requested'), currency)}</td>
                      <td className="px-4 py-2.5 text-right text-blue-600">{fmtMoney(sum('paid'), currency)}</td>
                      <td className="px-4 py-2.5 text-right text-yellow-600">{fmtMoney(sum('hold'), currency)}</td>
                    </tr>
                  )
                })}
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
