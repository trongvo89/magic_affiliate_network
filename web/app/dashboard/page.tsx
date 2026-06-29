'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { api, fmtMoney } from '@/lib/api'
import { useLocale } from '@/lib/i18n'
import { PerformanceChart, CommissionChart } from '@/components/DailyChart'

interface Stats {
  range: {
    conversions: number
    clicks: number
    earned: number
    earnedByCurrency: Record<string, number>
    approvedConversions: number
    approvedEarned: number
    approvedEarnedByCurrency: Record<string, number>
  }
  totalApproved: number
  totalApprovedByCurrency: Record<string, number>
  primaryCurrency: string
  cvr: number
  epc: number
}

interface DailyPoint {
  date: string
  clicks: number
  conversions: number
  commissionByCurrency: Record<string, number>
  [key: string]: any
}

interface OfferOption {
  offerId: string
  offerName: string
}

type Rates = Record<string, number>
const DISPLAY_CURRENCIES = ['USD', 'VND', 'RUB']

async function fetchRates(): Promise<Rates> {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD')
    const data = await res.json()
    if (data.result === 'success') return data.rates
  } catch {}
  return { USD: 1, VND: 25000, RUB: 90 }
}

function convertByCurrency(byCurrency: Record<string, number>, targetCurrency: string, rates: Rates): number {
  let total = 0
  for (const [cur, amt] of Object.entries(byCurrency)) {
    const fromRate = rates[cur] || 1
    const toRate = rates[targetCurrency] || 1
    total += (amt / fromRate) * toRate
  }
  return total
}

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

function startOfWeek(d: Date) {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

type Preset = 'today' | 'yesterday' | 'week' | 'month' | 'custom'


function computePresetDates(preset: Preset): { from: string; to: string } | null {
  const now = new Date()
  const today = toDateStr(now)
  switch (preset) {
    case 'today': return { from: today, to: today }
    case 'yesterday': {
      const y = toDateStr(new Date(now.getTime() - 86400000))
      return { from: y, to: y }
    }
    case 'week': return { from: toDateStr(startOfWeek(now)), to: today }
    case 'month': return { from: toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), to: today }
    default: return null
  }
}

export default function DashboardPage() {
  const { t } = useLocale()

  const PRESETS: { key: Preset; label: string }[] = [
    { key: 'today', label: t('preset.today') },
    { key: 'yesterday', label: t('preset.yesterday') },
    { key: 'week', label: t('preset.week') },
    { key: 'month', label: t('preset.month') },
    { key: 'custom', label: t('preset.custom') },
  ]

  const [stats, setStats] = useState<Stats | null>(null)
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => toDateStr(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(() => toDateStr(new Date()))
  const [preset, setPreset] = useState<Preset>('month')
  const [displayCurrency, setDisplayCurrency] = useState('VND')
  const [rates, setRates] = useState<Rates>({ USD: 1 })
  const [ratesLoaded, setRatesLoaded] = useState(false)
  const [offerId, setOfferId] = useState('')
  const [offers, setOffers] = useState<OfferOption[]>([])

  // Initialize with "Tháng này" preset
  useEffect(() => {
    const dates = computePresetDates('month')
    if (dates) { setFrom(dates.from); setTo(dates.to) }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = { from, to }
      if (offerId) params.offerId = offerId
      const [s, d] = await Promise.all([
        api.get('/publisher/stats', { params }),
        api.get('/publisher/stats/daily', { params }),
      ])
      setStats(s.data)
      setDaily(d.data.daily)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [from, to, offerId])

  // Load offer list for dropdown
  useEffect(() => {
    api.get('/publisher/offers-summary', { params: { from, to } })
      .then(r => {
        const list = (r.data as any[]).map((o: any) => ({ offerId: o.offerId, offerName: o.offerName }))
        setOffers(list)
      })
      .catch(() => {})
  }, [from, to])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchRates().then(r => { setRates(r); setRatesLoaded(true) }) }, [])

  function applyPreset(p: Preset) {
    setPreset(p)
    const dates = computePresetDates(p)
    if (dates) { setFrom(dates.from); setTo(dates.to) }
  }

  const openCommission = useMemo(() =>
    stats ? convertByCurrency(stats.range.earnedByCurrency, displayCurrency, rates) : 0,
    [stats, displayCurrency, rates])

  const totalApproved = useMemo(() =>
    stats ? convertByCurrency(stats.totalApprovedByCurrency, displayCurrency, rates) : 0,
    [stats, displayCurrency, rates])

  const convertedDaily = useMemo(() => daily.map(({ commissionByCurrency, ...rest }) => ({
    ...rest,
    commission: convertByCurrency(commissionByCurrency || {}, displayCurrency, rates),
  })), [daily, displayCurrency, rates])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900">My Overview</h1>
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

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap mb-6">
        {/* Time presets */}
        {PRESETS.map(({ key, label }) => (
          <button key={key}
            onClick={() => applyPreset(key)}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              preset === key
                ? 'bg-orange-500 text-white border-orange-500'
                : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            {label}
          </button>
        ))}

        {/* Custom date inputs */}
        {preset === 'custom' && (
          <>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            <span className="text-gray-400">→</span>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          </>
        )}

        <div className="w-px h-6 bg-gray-200" />

        {/* Campaign filter */}
        <select value={offerId} onChange={e => setOfferId(e.target.value)}
          className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900">
          <option value="">{t('dashboard.allCampaigns')}</option>
          {offers.map(o => <option key={o.offerId} value={o.offerId}>{o.offerName}</option>)}
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Clicks</div>
            <div className="text-2xl font-bold text-gray-900">{stats.range.clicks.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Conversions</div>
            <div className="text-2xl font-bold text-gray-900">{stats.range.conversions.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-0.5">CVR: {stats.cvr > 0 ? `${stats.cvr}%` : '—'}</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Open Commission</div>
            <div className="text-2xl font-bold text-orange-600">{fmtMoney(openCommission, displayCurrency)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stats.range.conversions} conversions</div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Total Approved</div>
            <div className="text-2xl font-bold text-green-700">{fmtMoney(totalApproved, displayCurrency)}</div>
            <div className="text-xs text-gray-400 mt-0.5">all time</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Clicks & Conversions</h2>
        {daily.length > 0 ? (
          <PerformanceChart data={convertedDaily} lines={[
            { key: 'clicks', color: '#3b82f6', label: 'Clicks' },
            { key: 'conversions', color: '#f97316', label: 'Conversions' },
          ]} />
        ) : (
          <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm">
            {loading ? 'Loading...' : 'No data for selected period'}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily Commission — {displayCurrency}</h2>
        {daily.length > 0 ? (
          <CommissionChart data={convertedDaily} dataKey="commission" label="Commission" color="#22c55e" />
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
            {loading ? 'Loading...' : 'No data for selected period'}
          </div>
        )}
      </div>
    </div>
  )
}
