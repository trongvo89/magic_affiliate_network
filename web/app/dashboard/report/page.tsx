'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'
import { useLocale } from '@/lib/i18n'

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'


const DISPLAY_CURRENCIES = ['USD', 'VND', 'RUB']

type Rates = Record<string, number>

async function fetchRates(): Promise<Rates> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await res.json()
    if (data.result === 'success') return data.rates
  } catch {}
  return { USD: 1, VND: 25000, RUB: 90 }
}

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Rates): number {
  if (fromCurrency === toCurrency) return amount
  const fromRate = rates[fromCurrency] || 1
  const toRate = rates[toCurrency] || 1
  return (amount / fromRate) * toRate
}

function computePresetDates(preset: Preset): { from: string; to: string } | null {
  const now = new Date()
  const today = toDateStr(now)
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'yesterday': { const y = toDateStr(new Date(now.getTime() - 86400000)); return { from: y, to: y } }
    case 'week': return { from: toDateStr(startOfWeek(now)), to: today }
    case 'month': return { from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
    default: return null
  }
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
  pendingCommission: number
  totalRevenue: number
  clicks: number
  cvr: number
  epc: number
}

interface Conversion {
  id: string
  sourceRefId: string
  status: string
  revenue: number
  commissionAmount: number
  currency: string
  eventAt: string
  offer: { name: string; mmpSource: string }
}

export default function ReportPage() {
  const [data, setData] = useState<OfferSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => { const d = computePresetDates('month'); return d?.from ?? toDateStr(new Date()) })
  const [to, setTo] = useState(() => toDateStr(new Date()))
  const [preset, setPreset] = useState<Preset>('month')
  const [displayCurrency, setDisplayCurrency] = useState('VND')
  const [rates, setRates] = useState<Rates>({ USD: 1 })
  const [ratesLoaded, setRatesLoaded] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportOfferId, setExportOfferId] = useState('')
  const [expandedOffer, setExpandedOffer] = useState<string | null>(null)
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [convTotal, setConvTotal] = useState(0)
  const [convPage, setConvPage] = useState(1)
  const { t } = useLocale()

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'today', label: t('preset.today') },
    { key: 'yesterday', label: t('preset.yesterday') },
    { key: 'week', label: t('preset.week') },
    { key: 'month', label: t('preset.month') },
    { key: 'custom', label: t('preset.custom') },
  ]

  useEffect(() => { fetchRates().then(r => { setRates(r); setRatesLoaded(true) }) }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/publisher/offers-summary', { params: { from, to } })
      setData(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load(); setExpandedOffer(null); setConversions([]) }, [load])

  function applyPreset(p: Preset) {
    setPreset(p)
    const dates = computePresetDates(p)
    if (dates) { setFrom(dates.from); setTo(dates.to) }
  }

  async function toggleOffer(offerId: string, page = 1) {
    if (expandedOffer === offerId && page === 1) {
      setExpandedOffer(null)
      setConversions([])
      return
    }
    setExpandedOffer(offerId)
    setConvLoading(true)
    setConvPage(page)
    try {
      const { data } = await api.get('/publisher/conversions', { params: { offerId, from, to, page, limit: 10 } })
      setConversions(data.conversions)
      setConvTotal(data.total)
    } catch {
      setConversions([])
    } finally {
      setConvLoading(false)
    }
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

  const totalClicks = useMemo(() => data.reduce((s, d) => s + (d.clicks ?? 0), 0), [data])

  const totalPendingCommission = useMemo(() =>
    data.reduce((s, d) => s + convertAmount(d.pendingCommission ?? 0, d.currency, displayCurrency, rates), 0),
    [data, displayCurrency, rates])

  const totalApprovedCommission = useMemo(() =>
    data.reduce((s, d) => s + convertAmount(d.commissionEarned, d.currency, displayCurrency, rates), 0),
    [data, displayCurrency, rates])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">Report</h1>
        <div className="flex items-center gap-2">
          <select value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 font-medium">
            {DISPLAY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {ratesLoaded && <span className="text-[10px] text-gray-400">Live rates</span>}
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {PRESETS.map(({ key, label }) => (
          <button key={key} onClick={() => applyPreset(key)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              preset === key ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}
        {preset === 'custom' && (
          <>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-gray-400">→</span>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {/* KPI cards */}
      {data.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Active Offers</div>
            <div className="text-2xl font-bold text-gray-900">{data.length}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Clicks</div>
            <div className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Conversions</div>
            <div className="text-2xl font-bold text-gray-900">{data.reduce((s, d) => s + d.total, 0)}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              <span className="text-green-600">{data.reduce((s, d) => s + d.approved, 0)} approved</span>
              {' · '}
              <span className="text-yellow-600">{data.reduce((s, d) => s + d.pending, 0)} pending</span>
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-yellow-200">
            <div className="text-xs text-yellow-600 mb-1">Pending Commission</div>
            <div className="text-2xl font-bold text-yellow-600">{fmtMoney(totalPendingCommission, displayCurrency)}</div>
            <div className="text-xs text-gray-400 mt-0.5">awaiting approval</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-green-200">
            <div className="text-xs text-green-600 mb-1">Approved Commission</div>
            <div className="text-2xl font-bold text-green-600">{fmtMoney(totalApprovedCommission, displayCurrency)}</div>
          </div>
        </div>
      )}

      {/* By Offer table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">By Offer</h2>
          <div className="flex items-center gap-2">
            <select value={exportOfferId} onChange={e => setExportOfferId(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-600">
              <option value="">All Offers</option>
              {data.map(row => <option key={row.offerId} value={row.offerId}>{row.offerName}</option>)}
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
              {['Offer ID', 'Offer', 'Clicks', 'Approved', 'Pending', 'Rejected', 'CVR', 'EPC', 'Commission'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map(row => (
              <>
                <tr key={row.offerId} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleOffer(row.offerId)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expandedOffer === row.offerId ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      <code className="text-xs font-mono text-gray-400 truncate max-w-[90px]">{row.offerId}</code>
                      <button onClick={e => { e.stopPropagation(); copyId(row.offerId) }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors whitespace-nowrap ${copiedId === row.offerId ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}>
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
                  <td className="px-4 py-3 text-indigo-600 font-medium">{(row.clicks ?? 0) > 0 ? fmtMoney(row.epc, row.currency) : '—'}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{fmtMoney(convertAmount(row.commissionEarned, row.currency, displayCurrency, rates), displayCurrency)}</td>
                </tr>
                {expandedOffer === row.offerId && (
                  <tr key={`${row.offerId}-detail`}>
                    <td colSpan={9} className="bg-slate-50 px-0 py-0">
                      <div className="px-6 py-4">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Conversion Details</h3>
                        {convLoading ? (
                          <div className="text-center text-gray-400 text-sm py-4">Loading conversions...</div>
                        ) : conversions.length === 0 ? (
                          <div className="text-center text-gray-400 text-sm py-4">No conversions found</div>
                        ) : (
                          <>
                            <table className="w-full text-xs">
                              <thead className="text-gray-400 uppercase">
                                <tr>
                                  {['XID', 'Status', 'Order Value', 'Commission', 'Currency', 'Date'].map(h => (
                                    <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {conversions.map(c => (
                                  <tr key={c.id} className="hover:bg-white">
                                    <td className="px-3 py-2 font-mono text-gray-600 max-w-[200px] truncate" title={c.sourceRefId}>{c.sourceRefId || '—'}</td>
                                    <td className="px-3 py-2">
                                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                        c.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                                        c.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                      }`}>{c.status}</span>
                                    </td>
                                    <td className="px-3 py-2 text-gray-700">{fmtMoney(c.revenue, c.currency)}</td>
                                    <td className="px-3 py-2 font-semibold text-green-700">{fmtMoney(c.commissionAmount, c.currency)}</td>
                                    <td className="px-3 py-2 text-gray-500">{c.currency}</td>
                                    <td className="px-3 py-2 text-gray-500">{fmtDate(c.eventAt)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              {conversions.length > 0 && (() => {
                                const totalRev = conversions.reduce((s, c) => s + c.revenue, 0)
                                const totalComm = conversions.reduce((s, c) => s + c.commissionAmount, 0)
                                const cur = conversions[0]?.currency || 'VND'
                                return (
                                  <tfoot className="bg-gray-100 font-semibold text-xs border-t-2 border-gray-300">
                                    <tr>
                                      <td colSpan={2} className="px-3 py-2 text-gray-900">Total</td>
                                      <td className="px-3 py-2 text-gray-900">{fmtMoney(totalRev, cur)}</td>
                                      <td className="px-3 py-2 text-green-700">{fmtMoney(totalComm, cur)}</td>
                                      <td colSpan={2} className="px-3 py-2"></td>
                                    </tr>
                                  </tfoot>
                                )
                              })()}
                            </table>
                            {convTotal > 10 && (
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                                <span className="text-xs text-gray-400">{convTotal} total conversions</span>
                                <div className="flex gap-1">
                                  {Array.from({ length: Math.ceil(convTotal / 10) }, (_, i) => (
                                    <button key={i} onClick={e => { e.stopPropagation(); toggleOffer(row.offerId, i + 1) }}
                                      className={`px-2.5 py-1 text-xs rounded ${convPage === i + 1 ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                                      {i + 1}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {data.length === 0 && !loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No offer data for this period</td></tr>
            )}
            {loading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            )}
          </tbody>
          {data.length > 0 && (() => {
            const totals = data.reduce((acc, row) => {
              acc.clicks += row.clicks ?? 0
              acc.approved += row.approved
              acc.pending += row.pending
              acc.rejected += row.rejected
              acc.commission += convertAmount(row.commissionEarned, row.currency, displayCurrency, rates)
              return acc
            }, { clicks: 0, approved: 0, pending: 0, rejected: 0, commission: 0 })
            return (
              <tfoot className="bg-gray-100 font-semibold text-sm border-t-2 border-gray-300">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-gray-900">Total</td>
                  <td className="px-4 py-3 text-gray-900">{totals.clicks}</td>
                  <td className="px-4 py-3 text-green-700">{totals.approved}</td>
                  <td className="px-4 py-3 text-yellow-600">{totals.pending}</td>
                  <td className="px-4 py-3 text-red-500">{totals.rejected}</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-gray-400">—</td>
                  <td className="px-4 py-3 text-green-700">{fmtMoney(totals.commission, displayCurrency)}</td>
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>
    </div>
  )
}
