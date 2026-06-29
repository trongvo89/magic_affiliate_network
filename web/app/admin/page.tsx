'use client'
import { useEffect, useState, useMemo } from 'react'
import { api, fmtMoney } from '@/lib/api'
import { PerformanceChart, CommissionChart } from '@/components/DailyChart'

interface CurrencyStats {
  conversions: number
  revenue: number
  commission: number
}

interface PeriodStats {
  conversions: number
  byCurrency: Record<string, CurrencyStats>
}

interface Stats {
  today: PeriodStats
  week: PeriodStats
  month: PeriodStats
  openCommissionByCurrency: Record<string, number>
  pendingPublishers: number
}

interface DailyPoint {
  date: string
  clicks: number
  conversions: number
  commissionByCurrency: Record<string, number>
  revenue: number
  [key: string]: any
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

function convertAmount(amount: number, fromCurrency: string, toCurrency: string, rates: Rates): number {
  if (fromCurrency === toCurrency) return amount
  const fromRate = rates[fromCurrency] || 1
  const toRate = rates[toCurrency] || 1
  return (amount / fromRate) * toRate
}

function convertByCurrency(byCurrency: Record<string, number>, targetCurrency: string, rates: Rates): number {
  let total = 0
  for (const [cur, amt] of Object.entries(byCurrency)) {
    total += convertAmount(amt, cur, targetCurrency, rates)
  }
  return total
}

function aggregatePeriod(period: PeriodStats, targetCurrency: string, rates: Rates) {
  let totalCommission = 0, totalRevenue = 0, totalConversions = 0
  for (const [cur, s] of Object.entries(period.byCurrency)) {
    totalCommission += convertAmount(s.commission, cur, targetCurrency, rates)
    totalRevenue += convertAmount(s.revenue, cur, targetCurrency, rates)
    totalConversions += s.conversions
  }
  return { commission: totalCommission, revenue: totalRevenue, conversions: totalConversions }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [daily, setDaily] = useState<DailyPoint[]>([])
  const [activePublishers, setActivePublishers] = useState(0)
  const [displayCurrency, setDisplayCurrency] = useState('VND')
  const [rates, setRates] = useState<Rates>({ USD: 1 })
  const [ratesLoaded, setRatesLoaded] = useState(false)
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  const defaultTo = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [selectedOffer, setSelectedOffer] = useState('')
  const [offers, setOffers] = useState<Array<{ offerId: string; offerName: string }>>([])

  useEffect(() => {
    api.get('/admin/offers-summary').then(r => setOffers(r.data || []))
    fetchRates().then(r => { setRates(r); setRatesLoaded(true) })
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('from', dateFrom)
    if (dateTo) params.set('to', dateTo)
    if (selectedOffer) params.set('offerId', selectedOffer)
    const qs = params.toString() ? `?${params.toString()}` : ''
    Promise.all([
      api.get(`/admin/stats${qs}`),
      api.get(`/admin/stats/daily${qs}`),
    ]).then(([s, d]) => {
      setStats(s.data)
      setDaily(d.data.daily)
      setActivePublishers(d.data.activePublishers)
    })
  }, [dateFrom, dateTo, selectedOffer])

  const monthAgg = useMemo(() => stats ? aggregatePeriod(stats.month, displayCurrency, rates) : null, [stats, displayCurrency, rates])
  const todayAgg = useMemo(() => stats ? aggregatePeriod(stats.today, displayCurrency, rates) : null, [stats, displayCurrency, rates])
  const openCommission = useMemo(() => stats ? convertByCurrency(stats.openCommissionByCurrency, displayCurrency, rates) : 0, [stats, displayCurrency, rates])

  const convertedDaily = useMemo(() => daily.map(({ commissionByCurrency, ...rest }) => ({
    ...rest,
    commission: convertByCurrency(commissionByCurrency || {}, displayCurrency, rates),
  })), [daily, displayCurrency, rates])

  const totalClicks = daily.reduce((s, d) => s + d.clicks, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Currency:</span>
          <select value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 font-medium">
            {DISPLAY_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {ratesLoaded && <span className="text-[10px] text-gray-400">Live rates</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-xl border border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">From:</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-900" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">To:</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-900" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Offer:</span>
          <select value={selectedOffer} onChange={e => setSelectedOffer(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 max-w-[200px]">
            <option value="">All Offers</option>
            {offers.map(o => <option key={o.offerId} value={o.offerId}>{o.offerName}</option>)}
          </select>
        </div>
      </div>

      {stats && monthAgg && todayAgg && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Clicks</div>
            <div className="text-2xl font-bold text-gray-900">{totalClicks.toLocaleString()}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Conversions</div>
            <div className="text-2xl font-bold text-gray-900">{monthAgg.conversions.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-0.5">Today: {todayAgg.conversions}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Open Commission</div>
            <div className="text-2xl font-bold text-orange-600">{fmtMoney(openCommission, displayCurrency)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Approved Commission</div>
            <div className="text-2xl font-bold text-green-700">{fmtMoney(monthAgg.commission, displayCurrency)}</div>
            <div className="text-xs text-gray-400 mt-0.5">Today: {fmtMoney(todayAgg.commission, displayCurrency)}</div>
          </div>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="text-xs text-gray-500 mb-1">Publishers</div>
            <div className="text-2xl font-bold text-gray-900">{activePublishers}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stats.pendingPublishers} pending</div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Clicks & Conversions</h2>
        <PerformanceChart data={convertedDaily} lines={[
          { key: 'clicks', color: '#3b82f6', label: 'Clicks' },
          { key: 'conversions', color: '#f97316', label: 'Conversions' },
        ]} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Daily Commission — {displayCurrency}</h2>
        <CommissionChart data={convertedDaily} dataKey="commission" label="Commission" color="#22c55e" />
      </div>
    </div>
  )
}
