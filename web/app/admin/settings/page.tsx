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

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [apiUrl, setApiUrl] = useState('')
  const { t } = useLocale()

  useEffect(() => {
    api.get('/config/public').then(res => setConfig(res.data)).catch(() => setConfig({ trackingDomain: null }))
    // Derive the API base URL from the current proxy
    if (typeof window !== 'undefined') {
      // api-proxy rewrites to the API — strip /api-proxy to get the real API URL
      setApiUrl(window.location.origin)
    }
  }, [])

  const trackingDomain = config?.trackingDomain

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
    </div>
  )
}
