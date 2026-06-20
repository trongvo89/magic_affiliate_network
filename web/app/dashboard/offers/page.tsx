'use client'
import { useEffect, useState, useCallback } from 'react'
import { api, fmtMoney, getUser } from '@/lib/api'

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10)
}

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
  clicks: number
  cvr: number
  epc: number
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportOfferId, setExportOfferId] = useState('')
  const [trackingBase, setTrackingBase] = useState('')
  const [from, setFrom] = useState(() => toDateStr(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(() => toDateStr(new Date()))
  const pubId = getUser()?.id ?? ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [summaryRes, cityAdsRes] = await Promise.all([
        api.get('/publisher/offers-summary', { params: { from, to } }),
        api.get('/publisher/cityads-offers'),
      ])
      setData(summaryRes.data)
      setCityAdsOffers(cityAdsRes.data)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    api.get('/config/public').then(res => {
      if (res.data.trackingDomain) setTrackingBase(res.data.trackingDomain)
    }).catch(() => {})
  }, [])

  function trackingLink(offerId: string) {
    if (typeof window === 'undefined') return ''
    const base = trackingBase || `${window.location.origin}/api-proxy`
    return `${base}/click/t/${offerId}?pub=${pubId}`
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ from, to })
      if (exportOfferId) params.set('offerId', exportOfferId)
      const { data } = await api.get(`/publisher/conversions/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `my_conversions_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Export failed')
    } finally {
      setExporting(false)
    }
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
  const totalClicks = data.reduce((s, d) => s + (d.clicks ?? 0), 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Offers Performance</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          <span className="text-gray-400">→</span>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(({ label, days }) => (
            <button key={label}
              onClick={() => { setFrom(toDateStr(new Date(Date.now() - days * 86400000))); setTo(toDateStr(new Date())) }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >{label}</button>
          ))}
          <button onClick={load} disabled={loading}
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
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {data.length > 0 && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Offers', value: data.length, fmt: false, color: 'text-gray-900' },
            { label: 'Clicks', value: totalClicks, fmt: false, color: 'text-gray-900' },
            { label: 'Approved Conversions', value: data.reduce((s, d) => s + d.approved, 0), fmt: false, color: 'text-gray-900' },
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
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">By Offer</h2>
          <div className="flex items-center gap-2">
            <select value={exportOfferId} onChange={e => setExportOfferId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-gray-600">
              <option value="">All Offers</option>
              {data.map(row => (
                <option key={row.offerId} value={row.offerId}>{row.offerName}</option>
              ))}
            </select>
            <button onClick={exportCsv} disabled={exporting}
              className="flex items-center gap-1.5 text-sm border border-gray-200 hover:bg-gray-50 disabled:opacity-50 text-gray-600 px-3 py-1.5 rounded-lg font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              {['Offer ID', 'Offer', 'Clicks', 'Approved', 'Pending', 'Rejected', 'CVR', 'EPC', 'Commission Earned'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((row) => (
              <tr key={row.offerId} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <code className="text-xs font-mono text-gray-400 truncate max-w-[90px]">{row.offerId}</code>
                    <button onClick={() => copyId(row.offerId)} className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap ${copiedId === row.offerId ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
                      {copiedId === row.offerId ? '✓' : 'Copy'}
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.offerName}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{row.clicks ?? 0}</td>
                <td className="px-4 py-3 font-medium text-green-700">{row.approved}</td>
                <td className="px-4 py-3 font-medium text-yellow-600">{row.pending}</td>
                <td className="px-4 py-3 font-medium text-red-500">{row.rejected}</td>
                <td className="px-4 py-3 text-blue-600 font-medium">{(row.clicks ?? 0) > 0 ? `${row.cvr}%` : '—'}</td>
                <td className="px-4 py-3 text-indigo-600 font-medium">{(row.clicks ?? 0) > 0 ? `$${row.epc}` : '—'}</td>
                <td className="px-4 py-3 font-semibold text-green-700">{fmtMoney(row.commissionEarned, row.currency)}</td>
              </tr>
            ))}
            {data.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No offer data for this period</td></tr>
            )}
            {loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
