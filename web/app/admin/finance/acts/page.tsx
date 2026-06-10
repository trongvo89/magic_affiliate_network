'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Act {
  id: string
  actCode: string
  status: string
  advPaymentStatus: string
  periodStart: string
  periodEnd: string
  currency: string
  totalRevenue: number
  totalPayout: number
  totalMargin: number
  advertiser: { id: string; name: string }
  offer: { id: string; name: string }
}

interface Advertiser { id: string; name: string }
interface Offer { id: string; name: string }

const BLANK_FORM = {
  advertiserId: '',
  offerId: '',
  periodStart: '',
  periodEnd: '',
  currency: 'USD',
  actCode: '',
}

const ACT_STATUSES = [
  'DRAFT', 'UPLOADED', 'RECONCILED', 'APPROVED', 'LOCKED',
  'INVOICE_SENT', 'PAYMENT_PENDING', 'PAID', 'CLOSED', 'CANCELLED',
]

function statusBadge(s: string) {
  const cls: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    UPLOADED: 'bg-blue-100 text-blue-700',
    RECONCILED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
    LOCKED: 'bg-green-100 text-green-700',
    INVOICE_SENT: 'bg-yellow-100 text-yellow-700',
    PAYMENT_PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    CLOSED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>
      {s}
    </span>
  )
}

function advPaymentBadge(s: string) {
  const cls: Record<string, string> = {
    UNPAID: 'bg-gray-100 text-gray-600',
    INVOICED: 'bg-blue-100 text-blue-700',
    PARTIALLY_PAID: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>
      {s || '—'}
    </span>
  )
}

export default function ActsPage() {
  const [acts, setActs] = useState<Act[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [advertisers, setAdvertisers] = useState<Advertiser[]>([])
  const [offers, setOffers] = useState<Offer[]>([])

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const limit = 20

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) })
      if (statusFilter) params.set('status', statusFilter)
      const { data } = await api.get(`/admin/finance/acts?${params}`)
      setActs(data.acts || data)
      setTotal(data.total || (data.acts || data).length)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load acts')
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    Promise.all([
      api.get('/admin/finance/advertisers'),
      api.get('/admin/offers'),
    ]).then(([a, o]) => {
      setAdvertisers(a.data)
      setOffers(o.data)
    }).catch(() => {})
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      await api.post('/admin/finance/acts', {
        advertiserId: form.advertiserId,
        offerId: form.offerId,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        currency: form.currency,
        actCode: form.actCode || undefined,
      })
      setShowCreate(false)
      setForm(BLANK_FORM)
      load()
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to create act')
    } finally {
      setSaving(false)
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Settlement Acts</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage advertiser reconciliation acts</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setForm(BLANK_FORM); setFormError('') }}
          className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium">
          + Create Act
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
          <option value="">All Statuses</option>
          {ACT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
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
                {['Act Code', 'Advertiser', 'Offer', 'Period', 'Currency', 'Revenue', 'Payout', 'Margin', 'Status', 'Adv Payment', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : acts.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No acts found</td></tr>
              ) : acts.map((act) => (
                <tr key={act.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{act.actCode}</td>
                  <td className="px-4 py-2.5 text-gray-700">{act.advertiser?.name}</td>
                  <td className="px-4 py-2.5 text-gray-700">{act.offer?.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                    {act.periodStart ? act.periodStart.slice(0, 10) : '—'} – {act.periodEnd ? act.periodEnd.slice(0, 10) : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{act.currency}</td>
                  <td className="px-4 py-2.5 text-gray-900">{fmtMoney(act.totalRevenue || 0, act.currency)}</td>
                  <td className="px-4 py-2.5 text-gray-900">{fmtMoney(act.totalPayout || 0, act.currency)}</td>
                  <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(act.totalMargin || 0, act.currency)}</td>
                  <td className="px-4 py-2.5">{statusBadge(act.status)}</td>
                  <td className="px-4 py-2.5">{advPaymentBadge(act.advPaymentStatus)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1.5 items-center">
                      <Link href={`/admin/finance/acts/${act.id}`}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
                        View
                      </Link>
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

      {/* Create Act Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Create Settlement Act</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{formError}</div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Advertiser <span className="text-red-500">*</span></label>
                <select required value={form.advertiserId}
                  onChange={(e) => setForm({ ...form, advertiserId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Select advertiser...</option>
                  {advertisers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offer <span className="text-red-500">*</span></label>
                <select required value={form.offerId}
                  onChange={(e) => setForm({ ...form, offerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option value="">Select offer...</option>
                  {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Start <span className="text-red-500">*</span></label>
                  <input required type="date" value={form.periodStart}
                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period End <span className="text-red-500">*</span></label>
                  <input required type="date" value={form.periodEnd}
                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    placeholder="USD"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Act Code <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input value={form.actCode}
                    onChange={(e) => setForm({ ...form, actCode: e.target.value })}
                    placeholder="auto-generated"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <button type="submit" disabled={saving}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                {saving ? 'Creating...' : 'Create Act'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
