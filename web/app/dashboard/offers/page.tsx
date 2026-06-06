'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, fmtMoney, getUser } from '@/lib/api'

interface OfferSummary {
  offerId: string
  offerName: string
  mmpSource: string
  currency: string
  total: number
  approved: number
  pending: number
  rejected: number
  commissionEarned: number
  totalRevenue: number
}

interface CityAdsOffer {
  id: string
  name: string
  appName: string
  pubCommissionDisplay: string | null
}

export default function PublisherOffersPage() {
  const [data, setData] = useState<OfferSummary[]>([])
  const [cityAdsOffers, setCityAdsOffers] = useState<CityAdsOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const pubId = getUser()?.id ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, cityAdsRes] = await Promise.all([
        api.get('/publisher/offers-summary'),
        api.get('/publisher/cityads-offers'),
      ])
      setData(summaryRes.data)
      setCityAdsOffers(cityAdsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function trackingLink(offerId: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/api-proxy/click/cityads/${offerId}?pub=${pubId}`
  }

  async function copyLink(offerId: string) {
    const link = trackingLink(offerId)
    await navigator.clipboard.writeText(link)
    setCopied(offerId)
    setTimeout(() => setCopied(null), 2000)
  }

  const mmpBadge = (s: string) => {
    const styles: Record<string, string> = {
      APPSFLYER: 'bg-blue-100 text-blue-700',
      ADJUST: 'bg-purple-100 text-purple-700',
      CITYADS: 'bg-orange-100 text-orange-700',
    }
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[s] ?? 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  const totalCommission = data.reduce((s, d) => s + d.commissionEarned, 0)
  const totalConversions = data.reduce((s, d) => s + d.total, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Offers Performance</h1>
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {data.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Active Offers', value: data.length, fmt: false, color: 'text-gray-900' },
            { label: 'Total Conversions', value: totalConversions, fmt: false, color: 'text-gray-900' },
            { label: 'Commission Earned', value: totalCommission, fmt: true, color: 'text-green-600' },
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

      {cityAdsOffers.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Tracking Links</h2>
            <p className="text-xs text-gray-400 mt-0.5">Copy your unique link for each offer and use it to drive traffic</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Offer', 'Commission', 'Your Tracking Link'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cityAdsOffers.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{o.name}</div>
                    <div className="text-xs text-gray-400">{o.appName}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {o.pubCommissionDisplay || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-gray-500 truncate max-w-xs">
                        {pubId ? trackingLink(o.id) : '—'}
                      </span>
                      <button
                        onClick={() => copyLink(o.id)}
                        className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-md font-medium border transition-colors ${
                          copied === o.id
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {copied === o.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">By Offer</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Offer', 'MMP', 'Total', 'Approved', 'Pending', 'Rejected', 'Commission Earned'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row) => (
              <tr key={row.offerId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{row.offerName}</td>
                <td className="px-4 py-3">{mmpBadge(row.mmpSource)}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.total}</td>
                <td className="px-4 py-3 font-medium text-green-700">{row.approved}</td>
                <td className="px-4 py-3 font-medium text-yellow-600">{row.pending}</td>
                <td className="px-4 py-3 font-medium text-red-500">{row.rejected}</td>
                <td className="px-4 py-3 font-semibold text-green-700">{fmtMoney(row.commissionEarned, row.currency)}</td>
              </tr>
            ))}
            {data.length === 0 && !loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No offer data yet</td></tr>
            )}
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
