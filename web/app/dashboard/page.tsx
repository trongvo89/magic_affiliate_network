'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { api, fmtMoney } from '@/lib/api'
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
  commission: number
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

function aggregateByCurrency(byCurrency: Record<string, number>, targetCurrency: string, rates: Rates): number {
  let total = 0
  for (const [cur, amt] of Object.entries(byCurrency)) {
    const fromRate = rates[cur] || 1
    const toRate = rates[targetCurrency] || 1
    total += (amt / fromRate) * toRate
  }
  return total
}

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [from, setFrom] = useState(() => toDateStr(new Date(Date.now() - 30 * 86400000)))
  const [to, setTo] = useState(() => toDateStr(new Date()))
  const [displayCurrency, setDisplayCurrency] = useState('VND')
  const [rates, setRates] = useState<Rates>({ USD: 1 })
  const [ratesLoaded, setRatesLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, d] = await Promise.all([
        api.get('/publisher/stats', { params: { from, to } }),
        api.get('/publisher/stats/daily', { params: { from, to } }),
      ])
      setStats(s.data)
      setDaily(d.data.daily)
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])
  useEffect(() => { fetchRates().then(r => { setRates(r); setRatesLoaded(true) }) }, [])

  const rangeEarned = useMemo(() =>
    stats ? aggregateByCurrency(stats.range.approvedEarnedByCurrency, displayCurrency, rates) : 0,
    [stats, displayCurrency, rates])

  const totalApproved = useMemo(() =>
    stats ? aggregateByCurrency(stats.totalApprovedByCurrency, displayCurrency, rates) : 0,
    [stats, displayCurrency, rates])

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Overview</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
          {[{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }].map(({ label, days }) => (
            <button key={label}
              onClick={() => { setFrom(toDateStr(new Date(Date.now() - days * 86400000))); setTo(toDateStr(new Date())) }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              {label}
            </button>
          ))}
          <div className="w-px h-6 bg-gray-200" />
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
            <div className="text-xs text-gray-500 mb-1">Earned (range)</div>
            <div className="text-2xl font-bold text-green-600">{fmtMoney(rangeEarned, displayCurrency)}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stats.range.approvedConversions} approved</div>
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
          <PerformanceChart data={daily} lines={[
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
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily Commission</h2>
        {daily.length > 0 ? (
          <CommissionChart data={daily} dataKey="commission" label="Commission" color="#22c55e" />
        ) : (
          <div className="h-[220px] flex items-center justify-center text-gray-400 text-sm">
            {loading ? 'Loading...' : 'No data for selected period'}
          </div>
        )}
      </div>
    </div>
  )
}
