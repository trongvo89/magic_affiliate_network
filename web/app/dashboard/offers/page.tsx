'use client'
import { useEffect, useState } from 'react'
import { api, fetchUser } from '@/lib/api'

interface Offer {
  id: string
  name: string
  appName: string
  pubCommissionDisplay: string | null
  currency: string
  logoUrl: string | null
}

export default function PublisherOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [trackingBase, setTrackingBase] = useState('')
  const [pubId, setPubId] = useState('')
  const [deeplinkOfferId, setDeeplinkOfferId] = useState<string | null>(null)
  const [deeplinkUrl, setDeeplinkUrl] = useState('')

  useEffect(() => { fetchUser().then(u => setPubId(u?.id ?? '')) }, [])

  useEffect(() => {
    setLoading(true)
    api.get('/publisher/offers-list')
      .then(r => setOffers(r.data))
      .catch(err => setError(err.response?.data?.error || err.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

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

  function generateDeeplink(offerId: string, url: string) {
    if (typeof window === 'undefined') return ''
    const base = trackingBase || `${window.location.origin}/api-proxy`
    return `${base}/click/t/${offerId}?pub=${pubId}&url=${encodeURIComponent(url)}`
  }

  async function copyText(text: string, id: string) {
    await navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const filtered = offers.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.appName.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Offers</h1>
          <p className="text-sm text-gray-500 mt-0.5">{offers.length} offer{offers.length !== 1 ? 's' : ''} available</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm offer..."
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent" />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {loading && <div className="text-center text-gray-400 py-12">Loading...</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-center text-gray-400 py-12">{search ? 'Không tìm thấy offer nào' : 'Chưa có offer nào'}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(o => (
          <div key={o.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow">
            {/* Header */}
            <div className="p-4 flex items-start gap-4">
              {/* Logo */}
              <div className="w-14 h-14 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {o.logoUrl ? (
                  <img src={o.logoUrl} alt={o.name} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <span className="text-lg font-bold text-gray-300">{o.name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{o.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{o.appName}</p>
                <div className="mt-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-xs font-semibold text-orange-700">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1" />
                    </svg>
                    {o.pubCommissionDisplay || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Tracking link */}
            <div className="px-4 pb-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tracking Link</span>
                  <button onClick={() => copyText(trackingLink(o.id), `link-${o.id}`)}
                    className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                      copied === `link-${o.id}` ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}>
                    {copied === `link-${o.id}` ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
                <code className="text-[11px] font-mono text-gray-500 break-all leading-relaxed">
                  {pubId ? trackingLink(o.id) : '—'}
                </code>
              </div>
            </div>

            {/* Deeplink */}
            <div className="px-4 pb-4">
              <button
                onClick={() => { setDeeplinkOfferId(deeplinkOfferId === o.id ? null : o.id); setDeeplinkUrl('') }}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5 group">
                <svg className={`w-3 h-3 transition-transform ${deeplinkOfferId === o.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Tạo Deeplink
              </button>

              {deeplinkOfferId === o.id && (
                <div className="mt-2.5 bg-orange-50 rounded-lg p-3 border border-orange-100">
                  <input type="url" value={deeplinkUrl}
                    onChange={e => setDeeplinkUrl(e.target.value)}
                    placeholder="Nhập URL đích, vd: https://shopee.vn/product/123"
                    className="w-full text-sm border border-orange-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 placeholder:text-gray-400" />
                  {deeplinkUrl && (
                    <div className="mt-2 bg-white rounded-lg p-2.5 border border-orange-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Deeplink</span>
                        <button onClick={() => copyText(generateDeeplink(o.id, deeplinkUrl), `deep-${o.id}`)}
                          className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-all ${
                            copied === `deep-${o.id}` ? 'bg-green-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                          }`}>
                          {copied === `deep-${o.id}` ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <code className="text-[11px] font-mono text-gray-500 break-all leading-relaxed">
                        {generateDeeplink(o.id, deeplinkUrl)}
                      </code>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
