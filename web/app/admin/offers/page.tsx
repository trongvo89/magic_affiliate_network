'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney } from '@/lib/api'

interface Offer {
  id: string
  name: string
  appName: string
  appId: string
  mmpSource: string
  commissionType: string
  commissionValue: number
  currency: string
  status: string
  _count: { conversions: number }
}

interface OfferSummary {
  offerId: string
  offerName: string
  mmpSource: string
  commissionType: string
  currency: string
  offerStatus: string
  total: number
  approved: number
  pending: number
  rejected: number
  commissionPaid: number
  totalRevenue: number
  publisherCount: number
}

const empty = { name: '', appName: '', appId: '', mmpSource: 'APPSFLYER', commissionType: 'FLAT_CPA', commissionValue: '', currency: 'USD' }

export default function OffersPage() {
  const [tab, setTab] = useState<'manage' | 'performance'>('manage')
  const [offers, setOffers] = useState<Offer[]>([])
  const [summary, setSummary] = useState<OfferSummary[]>([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ ...empty })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadingPerf, setLoadingPerf] = useState(false)

  async function loadOffers() {
    const { data } = await api.get('/admin/offers')
    setOffers(data)
  }

  async function loadSummary() {
    setLoadingPerf(true)
    try {
      const { data } = await api.get('/admin/offers-summary')
      setSummary(data)
    } finally {
      setLoadingPerf(false)
    }
  }

  useEffect(() => { loadOffers() }, [])

  useEffect(() => {
    if (tab === 'performance' && summary.length === 0) loadSummary()
  }, [tab])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await api.post('/admin/offers', { ...form, commissionValue: parseFloat(form.commissionValue) })
      setShowModal(false)
      setForm({ ...empty })
      await loadOffers()
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create offer')
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(offer: Offer) {
    await api.put(`/admin/offers/${offer.id}`, { status: offer.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' })
    await loadOffers()
  }

  const mmpBadge = (s: string) => {
    const styles: Record<string, string> = {
      APPSFLYER: 'bg-blue-100 text-blue-700',
      ADJUST: 'bg-purple-100 text-purple-700',
      CITYADS: 'bg-orange-100 text-orange-700',
    }
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  const totalCommission = summary.reduce((s, d) => s + d.commissionPaid, 0)
  const totalRevenue = summary.reduce((s, d) => s + d.totalRevenue, 0)
  const totalConversions = summary.reduce((s, d) => s + d.total, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Offers</h1>
          <div className="flex rounded-lg bg-gray-100 p-0.5 text-sm">
            <button
              onClick={() => setTab('manage')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${tab === 'manage' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Manage
            </button>
            <button
              onClick={() => setTab('performance')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${tab === 'performance' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Performance
            </button>
          </div>
        </div>
        {tab === 'manage' && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            + New Offer
          </button>
        )}
        {tab === 'performance' && (
          <button
            onClick={loadSummary}
            disabled={loadingPerf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${loadingPerf ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loadingPerf ? 'Loading...' : 'Refresh'}
          </button>
        )}
      </div>

      {tab === 'manage' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Name', 'App', 'MMP', 'Commission', 'Currency', 'Conversions', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {offers.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{o.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <div>{o.appName}</div>
                    <div className="text-xs text-gray-400 font-mono">{o.appId}</div>
                  </td>
                  <td className="px-4 py-3">{mmpBadge(o.mmpSource)}</td>
                  <td className="px-4 py-3 text-gray-900">
                    {o.commissionType === 'FLAT_CPA' ? `$${o.commissionValue.toFixed(2)} CPA` : `${o.commissionValue}% Rev`}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.currency}</td>
                  <td className="px-4 py-3 text-gray-900 font-medium">{o._count.conversions}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${o.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(o)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {o.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
              {offers.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No offers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'performance' && (
        <>
          {summary.length > 0 && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Offers with Activity', value: summary.length, fmt: false, color: 'text-gray-900' },
                { label: 'Total Conversions', value: totalConversions, fmt: false, color: 'text-gray-900' },
                { label: 'Total Revenue', value: totalRevenue, fmt: true, color: 'text-blue-700' },
                { label: 'Commission Paid', value: totalCommission, fmt: true, color: 'text-green-600' },
              ].map((card) => (
                <div key={card.label} className="bg-white rounded-xl p-5 border border-gray-200">
                  <div className="text-xs text-gray-500 mb-1">{card.label}</div>
                  <div className={`text-2xl font-bold ${card.color}`}>
                    {card.fmt ? fmtMoney(card.value as number) : card.value}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  {['Offer', 'MMP', 'Publishers', 'Total', 'Approved', 'Pending', 'Rejected', 'Revenue', 'Commission Paid'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.map((row) => (
                  <tr key={row.offerId} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{row.offerName}</div>
                      <span className={`text-xs ${row.offerStatus === 'ACTIVE' ? 'text-green-600' : 'text-gray-400'}`}>{row.offerStatus}</span>
                    </td>
                    <td className="px-4 py-3">{mmpBadge(row.mmpSource)}</td>
                    <td className="px-4 py-3 text-gray-700 font-medium">{row.publisherCount}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.total}</td>
                    <td className="px-4 py-3 font-medium text-green-700">{row.approved}</td>
                    <td className="px-4 py-3 font-medium text-yellow-600">{row.pending}</td>
                    <td className="px-4 py-3 font-medium text-red-500">{row.rejected}</td>
                    <td className="px-4 py-3 text-blue-700 font-medium">{fmtMoney(row.totalRevenue, row.currency)}</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmtMoney(row.commissionPaid, row.currency)}</td>
                  </tr>
                ))}
                {summary.length === 0 && !loadingPerf && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No conversion data yet</td></tr>
                )}
                {loadingPerf && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Offer</h2>
            {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              {[
                { label: 'Offer Name', key: 'name', placeholder: 'e.g. Shopee App VN' },
                { label: 'App Name', key: 'appName', placeholder: 'e.g. Shopee' },
                {
                  label: form.mmpSource === 'CITYADS' ? 'CityAds Offer ID' : 'App ID / App Token',
                  key: 'appId',
                  placeholder: form.mmpSource === 'CITYADS' ? 'e.g. 12345' : 'com.example.app',
                },
              ].map((f) => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                  <input
                    type="text"
                    required
                    value={(form as any)[f.key]}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">MMP Source</label>
                  <select
                    value={form.mmpSource}
                    onChange={(e) => setForm({ ...form, mmpSource: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="APPSFLYER">AppsFlyer</option>
                    <option value="ADJUST">Adjust</option>
                    <option value="CITYADS">CityAds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Type</label>
                  <select
                    value={form.commissionType}
                    onChange={(e) => setForm({ ...form, commissionType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="FLAT_CPA">Flat CPA</option>
                    <option value="PERCENT_REVENUE">% Revenue</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.commissionValue}
                    onChange={(e) => setForm({ ...form, commissionValue: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={form.commissionType === 'FLAT_CPA' ? '2.00' : '8'}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <select
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="VND">VND</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setError('') }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {saving ? 'Creating...' : 'Create Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
