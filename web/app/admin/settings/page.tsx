'use client'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { useLocale } from '@/lib/i18n'

interface PublicConfig {
  trackingDomain: string | null
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`ml-2 text-xs px-2 py-0.5 rounded border transition-colors ${copied ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  )
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">{n}</div>
      <div className="text-sm text-gray-700 leading-relaxed">{children}</div>
    </div>
  )
}

function CodeLine({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3 mt-2">
      <code className="text-green-400 text-xs font-mono flex-1 break-all">{children}</code>
      <CopyButton text={children} />
    </div>
  )
}

type ParamRow = { name: string; required: 'Required' | 'Recommended' | 'Optional'; desc: string; example: string }

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <table className="w-full text-xs mt-3">
      <thead>
        <tr className="bg-gray-50 text-gray-500 uppercase text-[10px]">
          <th className="px-3 py-2 text-left font-medium">Parameter</th>
          <th className="px-3 py-2 text-left font-medium">Required</th>
          <th className="px-3 py-2 text-left font-medium">Description</th>
          <th className="px-3 py-2 text-left font-medium">Example</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {rows.map(r => (
          <tr key={r.name} className="hover:bg-gray-50">
            <td className="px-3 py-2 font-mono text-orange-700 font-semibold">{r.name}</td>
            <td className="px-3 py-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                r.required === 'Required' ? 'bg-red-100 text-red-700' :
                r.required === 'Recommended' ? 'bg-orange-100 text-orange-700' :
                'bg-gray-100 text-gray-500'
              }`}>{r.required}</span>
            </td>
            <td className="px-3 py-2 text-gray-600">{r.desc}</td>
            <td className="px-3 py-2 font-mono text-blue-700">{r.example}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const MMP_CONFIGS = [
  {
    key: 'appsflyer',
    label: 'AppsFlyer',
    path: '/postback/appsflyer',
    events: ['install', 'purchase', 'subscribe', 'af_purchase', 'complete_tutorial'],
    attributionField: 'af_sub1',
    params: [
      { name: 'app_id', required: 'Required', desc: 'App ID registered in Magic (matches offer App ID)', example: 'com.shopee.vn' },
      { name: 'af_tranid', required: 'Required', desc: 'Unique transaction/conversion ID (used for deduplication)', example: 'af_abc123456' },
      { name: 'af_sub1', required: 'Required', desc: 'Magic Publisher ID — pass {sub1} macro from your S2S template', example: 'cm9abc...' },
      { name: 'event_name', required: 'Optional', desc: 'Event type. Defaults to "install"', example: 'purchase' },
      { name: 'event_revenue', required: 'Optional', desc: 'Order/revenue value (float)', example: '75.00' },
      { name: 'event_revenue_currency', required: 'Optional', desc: 'Currency code (ISO 4217). Overridden by offer currency if set', example: 'USD' },
      { name: 'install_time', required: 'Optional', desc: 'Event timestamp (ISO 8601)', example: '2026-06-29T10:00:00Z' },
    ] as ParamRow[],
  },
  {
    key: 'adjust',
    label: 'Adjust',
    path: '/postback/adjust',
    events: ['install', 'purchase', 'revenue', 'reengagement'],
    attributionField: 'partner_parameter_1',
    params: [
      { name: 'app_token', required: 'Required', desc: 'App token registered in Magic (matches offer App ID)', example: 'abc123xyz' },
      { name: 'transaction_id', required: 'Required', desc: 'Unique transaction ID (used for deduplication)', example: 'txn_abc123' },
      { name: 'partner_parameter_1', required: 'Required', desc: 'Magic Publisher ID — set in Adjust Partner Parameters as {publisher_id}', example: 'cm9abc...' },
      { name: 'event_token', required: 'Optional', desc: 'Event type. Defaults to "install"', example: 'purchase' },
      { name: 'revenue', required: 'Optional', desc: 'Order/revenue value (float)', example: '75.00' },
      { name: 'currency', required: 'Optional', desc: 'Currency code (ISO 4217)', example: 'USD' },
      { name: 'created_at', required: 'Optional', desc: 'Event timestamp (ISO 8601)', example: '2026-06-29T10:00:00Z' },
    ] as ParamRow[],
  },
  {
    key: 'cityads',
    label: 'CityAds',
    path: '/postback/cityads',
    events: ['conversion', 'sale', 'lead', 'install', 'registration'],
    attributionField: 'sa',
    params: [
      { name: 'offer_id', required: 'Required', desc: 'Offer App ID in Magic (matches CityAds offer ID)', example: '38407' },
      { name: 'xid', required: 'Recommended', desc: 'Unique conversion ID for deduplication. Falls back to action_id → click_id', example: 'xid_abc123' },
      { name: 'sa', required: 'Required', desc: 'Magic Publisher ID — pass sub-affiliate ID for attribution', example: 'cm9abc...' },
      { name: 'action_type', required: 'Optional', desc: 'Event type. Defaults to "conversion"', example: 'sale' },
      { name: 'open_commission', required: 'Optional', desc: 'Commission amount in source currency (multiplied by exchange rate)', example: '1500.00' },
      { name: 'order_total', required: 'Optional', desc: 'Order/revenue value', example: '850000' },
      { name: 'payout_currency', required: 'Optional', desc: 'Currency code for commission', example: 'RUB' },
      { name: 'status', required: 'Optional', desc: '"1"/"approved" → Approved · "3"/"rejected"/"declined" → Rejected · else → Pending', example: '1' },
      { name: 'conversion_time', required: 'Optional', desc: 'Event timestamp (Unix timestamp or ISO string)', example: '1751194800' },
    ] as ParamRow[],
  },
]

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [apiUrl, setApiUrl] = useState('')
  const [activeTab, setActiveTab] = useState('cityads')
  const { t } = useLocale()

  useEffect(() => {
    api.get('/config/public').then(res => setConfig(res.data)).catch(() => setConfig({ trackingDomain: null }))
    if (typeof window !== 'undefined') {
      setApiUrl(window.location.origin)
    }
  }, [])

  const trackingDomain = config?.trackingDomain
  const activeMmp = MMP_CONFIGS.find(m => m.key === activeTab)!

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-500 mb-8">System configuration and integration setup</p>

      {/* Tracking Domain */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Tracking Domain</h2>
            <p className="text-xs text-gray-400 mt-0.5">{t('adminSettings.trackingDomainDesc')}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${trackingDomain ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {trackingDomain ? t('adminSettings.configured') : t('adminSettings.notConfigured')}
          </span>
        </div>

        <div className="px-6 py-5">
          {trackingDomain ? (
            <div className="mb-5">
              <p className="text-xs text-gray-500 mb-1 font-medium">{t('adminSettings.currentDomain')}</p>
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <code className="text-green-800 text-sm font-mono font-semibold">{trackingDomain}</code>
                <CopyButton text={trackingDomain} />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {t('adminSettings.trackingLinksFormat')} <code className="font-mono">{trackingDomain}/click/t/&#123;offerId&#125;?pub=&#123;pubId&#125;</code>
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-5 text-sm text-yellow-800">
              <p className="font-medium mb-1">{t('adminSettings.noCustomDomain')}</p>
              <p className="text-xs text-yellow-700">{t('adminSettings.usingWebDomain')}</p>
            </div>
          )}

          {/* Setup instructions */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">{t('adminSettings.setupGuide')}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{t('adminSettings.setupGuideDesc')}</p>
            </div>
            <div className="px-4 py-5 space-y-5">
              <Step n={1}>
                <strong>{t('adminSettings.step1')}</strong> — e.g. <code className="font-mono text-xs bg-gray-100 px-1 rounded">trk.yourdomain.com</code>
              </Step>

              <Step n={2}>
                <div>
                  <strong>{t('adminSettings.step2Title')}</strong> {t('adminSettings.step2Note')}
                  <ol className="mt-2 space-y-1 text-gray-600 list-decimal list-inside text-xs">
                    <li>Vào Railway → Project → chọn service <strong>API</strong></li>
                    <li>Tab <strong>Settings</strong> → phần <strong>Domains</strong></li>
                    <li>Click <strong>Add a custom domain</strong></li>
                    <li>Nhập domain tracking của bạn → Railway sẽ cung cấp CNAME target</li>
                  </ol>
                </div>
              </Step>

              <Step n={3}>
                <div>
                  <strong>{t('adminSettings.step3Title')}</strong>:
                  <div className="mt-2 bg-gray-50 rounded-lg p-3 text-xs font-mono space-y-1">
                    <div className="grid grid-cols-4 gap-2 text-gray-500 text-[10px] uppercase mb-1">
                      <span>Type</span><span>Name</span><span>Value</span><span>TTL</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-gray-800">
                      <span>CNAME</span><span>trk</span><span className="text-orange-600 col-span-1 truncate">&#60;railway-cname&#62;.up.railway.app</span><span>300</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{t('adminSettings.step3Desc')}</p>
                </div>
              </Step>

              <Step n={4}>
                <div>
                  <strong>{t('adminSettings.step4Title')}</strong>:
                  <p className="text-xs text-gray-500 mt-1 mb-1">{t('adminSettings.step4Desc1')}</p>
                  <CodeLine>TRACKING_DOMAIN=https://trk.yourdomain.com</CodeLine>
                  <p className="text-xs text-gray-500 mt-2">{t('adminSettings.step4Desc2')}</p>
                </div>
              </Step>

              <Step n={5}>
                <div>
                  <strong>{t('adminSettings.step5Title')}</strong> {t('adminSettings.step5Note')}
                  <p className="text-xs text-gray-500 mt-1 mb-1">{t('adminSettings.step5Desc1')}</p>
                  <CodeLine>CORS_ORIGIN=https://web.railway.app</CodeLine>
                  <p className="text-xs text-gray-400 mt-2">{t('adminSettings.step5Desc2')}</p>
                </div>
              </Step>

              <Step n={6}>
                <div>
                  <strong>{t('adminSettings.step6Title')}</strong>:
                  <ol className="mt-2 space-y-1 text-gray-600 list-decimal list-inside text-xs">
                    <li>Mở Publisher Portal → Offers → copy tracking link</li>
                    <li>Paste vào browser — link phải dùng domain mới, không phải domain web app</li>
                    <li>Truy cập link → phải redirect đúng về merchant, click được log trong hệ thống</li>
                  </ol>
                </div>
              </Step>
            </div>
          </div>
        </div>
      </div>

      {/* API Endpoints info card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Postback Endpoints</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('adminSettings.postbackEndpointsDesc')}</p>
        </div>
        <div className="px-6 py-5 space-y-3 text-sm">
          {[
            { label: 'AppsFlyer', path: '/postback/appsflyer' },
            { label: 'Adjust', path: '/postback/adjust' },
            { label: 'CityAds', path: '/postback/cityads' },
          ].map(({ label, path }) => (
            <div key={label}>
              <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                <code className="text-gray-700 text-xs font-mono flex-1 break-all">{apiUrl}{path}</code>
                <CopyButton text={`${apiUrl}${path}`} />
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 pt-1">{t('adminSettings.referDocs')}</p>
        </div>
      </div>

      {/* Postback API Reference */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Postback API Reference</h2>
              <p className="text-xs text-gray-400 mt-0.5">Full parameter documentation for partner integration</p>
            </div>
            <CopyButton text={`${apiUrl}/docs/integration`} label="📋 Copy partner link" />
          </div>
        </div>

        {/* MMP Tabs */}
        <div className="flex border-b border-gray-100">
          {MMP_CONFIGS.map(m => (
            <button key={m.key} onClick={() => setActiveTab(m.key)}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === m.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Endpoint */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Endpoint</p>
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-4 py-3">
              <span className="text-blue-400 text-xs font-mono font-bold mr-2">GET / POST</span>
              <code className="text-green-400 text-xs font-mono flex-1 break-all">{apiUrl}{activeMmp.path}</code>
              <CopyButton text={`${apiUrl}${activeMmp.path}`} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Parameters can be sent as query string (GET) or request body (POST). Both are accepted.</p>
          </div>

          {/* Attribution note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-800">
            <strong>Attribution:</strong> Pass the Magic Publisher ID in the <code className="font-mono bg-blue-100 px-1 rounded">{activeMmp.attributionField}</code> parameter. The publisher's ID can be found in their profile page (Admin → Publishers).
          </div>

          {/* Parameters */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Parameters</p>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <ParamTable rows={activeMmp.params} />
            </div>
          </div>

          {/* Events */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Common Events</p>
            <div className="flex flex-wrap gap-2">
              {activeMmp.events.map(e => (
                <span key={e} className="px-2.5 py-1 bg-gray-100 rounded-full text-xs font-mono text-gray-700">{e}</span>
              ))}
            </div>
          </div>

          {/* Response */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Response</p>
            <div className="bg-gray-900 rounded-lg px-4 py-3">
              <p className="text-gray-400 text-xs font-mono mb-1">HTTP 200 — always, including on error (to prevent MMP retries)</p>
              <code className="text-green-400 text-xs font-mono">{'{ "ok": true }'}</code>
            </div>
          </div>

          {/* UAT note */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800">
            <strong>UAT Testing:</strong> No separate UAT environment. Use a dedicated test offer (with a distinct App ID) on the production endpoint. Check results in Admin → Conversions and Admin → Postback Logs.
          </div>

          {/* Example URL */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Example Request</p>
            {activeMmp.key === 'appsflyer' && (
              <CodeLine>{`${apiUrl}/postback/appsflyer?app_id=com.example&af_tranid=af_123&af_sub1=PUBLISHER_ID&event_name=purchase&event_revenue=75.00&event_revenue_currency=USD`}</CodeLine>
            )}
            {activeMmp.key === 'adjust' && (
              <CodeLine>{`${apiUrl}/postback/adjust?app_token=abc123&transaction_id=txn_123&partner_parameter_1=PUBLISHER_ID&event_token=purchase&revenue=75.00&currency=USD`}</CodeLine>
            )}
            {activeMmp.key === 'cityads' && (
              <CodeLine>{`${apiUrl}/postback/cityads?offer_id=38407&xid=xid_123&sa=PUBLISHER_ID&action_type=sale&open_commission=1500&payout_currency=RUB&status=1`}</CodeLine>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
