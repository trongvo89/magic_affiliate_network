'use client'
import { useEffect, useState } from 'react'
import { api, fetchUser } from '@/lib/api'

interface Offer {
  id: string
  name: string
  appName: string
  pubCommissionDisplay: string | null
  currency: string
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
  const [deeplinkCopied, setDeeplinkCopied] = useState(false)

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
        <h1 className="text-xl font-bold text-gray-900">Offers</h1>
      </div>

      {/* Search bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm offer..."
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      {loading && (
        <div className="text-center text-gray-400 py-12">Loading...</div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          {search ? 'Không tìm thấy offer nào' : 'Chưa có offer nào'}
        </div>
      )}

      {/* Offer cards */}
      <div className="space-y-4">
        {filtered.map(o => (
          <div key={o.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900 text-base">{o.name}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{o.appName}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500 mb-0.5">Commission</div>
                  <div className="font-semibold text-orange-600">
                    {o.pubCommissionDisplay || '—'}
                  </div>
                </div>
              </div>

              {/* Tracking link */}
              <div className="bg-gray-50 rounded-lg p-3 mb-3">
                <div className="text-xs text-gray-500 mb-1.5">Tracking Link</div>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-gray-600 truncate flex-1">
                    {pubId ? trackingLink(o.id) : '—'}
                  </code>
                  <button onClick={() => copyText(trackingLink(o.id), `link-${o.id}`)}
                    className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-md font-medium border transition-colors ${
                      copied === `link-${o.id}` ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}>
                    {copied === `link-${o.id}` ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              {/* Deeplink toggle */}
              <button
                onClick={() => { setDeeplinkOfferId(deeplinkOfferId === o.id ? null : o.id); setDeeplinkUrl(''); setDeeplinkCopied(false) }}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                <svg className={`w-3.5 h-3.5 transition-transform ${deeplinkOfferId === o.id ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Tạo Deeplink
              </button>

              {deeplinkOfferId === o.id && (
                <div className="mt-3 bg-orange-50 rounded-lg p-3 border border-orange-100">
                  <div className="text-xs text-gray-600 mb-2">Nhập URL đích để tạo deeplink tracking:</div>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="url"
                      value={deeplinkUrl}
                      onChange={e => { setDeeplinkUrl(e.target.value); setDeeplinkCopied(false) }}
                      placeholder="https://example.com/product/123"
                      className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  {deeplinkUrl && (
                    <div className="bg-white rounded-lg p-2.5 border border-orange-200">
                      <div className="text-[10px] text-gray-400 mb-1 uppercase font-medium">Deeplink</div>
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-gray-600 truncate flex-1">
                          {generateDeeplink(o.id, deeplinkUrl)}
                        </code>
                        <button
                          onClick={() => { copyText(generateDeeplink(o.id, deeplinkUrl), `deep-${o.id}`); setDeeplinkCopied(true) }}
                          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-md font-medium border transition-colors ${
                            copied === `deep-${o.id}` ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}>
                          {copied === `deep-${o.id}` ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
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
