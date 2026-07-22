'use client'
import { useState, useEffect } from 'react'

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className={`text-xs px-2.5 py-1 rounded border font-medium transition-colors ${copied ? 'bg-green-600 border-green-500 text-white' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'}`}
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}

type ParamRow = { name: string; req: 'Required' | 'Recommended' | 'Optional'; desc: string; example: string }

function ParamTable({ rows }: { rows: ParamRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {['Parameter', 'Required', 'Description', 'Example'].map(h => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(r => (
            <tr key={r.name} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-mono text-orange-700 font-semibold text-xs">{r.name}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  r.req === 'Required' ? 'bg-red-100 text-red-700' :
                  r.req === 'Recommended' ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-100 text-gray-500'
                }`}>{r.req}</span>
              </td>
              <td className="px-4 py-3 text-gray-600 text-xs">{r.desc}</td>
              <td className="px-4 py-3 font-mono text-blue-700 text-xs">{r.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const MMP_TABS = [
  {
    key: 'adjust',
    label: 'Adjust',
    path: '/postback/adjust',
    attrField: 'partner_parameter_1',
    params: [
      { name: 'app_token', req: 'Required', desc: 'App token of the offer registered in Magic system', example: 'abc123xyz' },
      { name: 'transaction_id', req: 'Required', desc: 'Unique conversion/transaction ID (used for deduplication)', example: 'txn_20260629_001' },
      { name: 'partner_parameter_1', req: 'Required', desc: 'Magic Publisher ID — must be passed from click URL {pub} parameter for attribution', example: 'cm9xyzmag...' },
      { name: 'event_token', req: 'Optional', desc: 'Event type identifier. Defaults to "install" if omitted', example: 'loan_approved' },
      { name: 'revenue', req: 'Optional', desc: 'Loan amount / order value (float)', example: '5000000' },
      { name: 'currency', req: 'Optional', desc: 'Currency code (ISO 4217)', example: 'VND' },
      { name: 'created_at', req: 'Optional', desc: 'Event timestamp in ISO 8601 format', example: '2026-06-29T10:00:00Z' },
    ] as ParamRow[],
    example: (origin: string) => `${origin}/postback/adjust?app_token=YOUR_APP_TOKEN&transaction_id=txn_001&partner_parameter_1=PUBLISHER_ID&event_token=loan_approved&revenue=5000000&currency=VND`,
  },
  {
    key: 'appsflyer',
    label: 'AppsFlyer',
    path: '/postback/appsflyer',
    attrField: 'af_sub1',
    params: [
      { name: 'app_id', req: 'Required', desc: 'App ID of the offer registered in Magic system', example: 'vn.shbfinance.app' },
      { name: 'af_tranid', req: 'Required', desc: 'Unique transaction/conversion ID (used for deduplication)', example: 'af_20260629_001' },
      { name: 'af_sub1', req: 'Required', desc: 'Magic Publisher ID — pass from click URL {pub} parameter for attribution', example: 'cm9xyzmag...' },
      { name: 'event_name', req: 'Optional', desc: 'Event type name. Defaults to "install" if omitted', example: 'loan_approved' },
      { name: 'event_revenue', req: 'Optional', desc: 'Loan amount / order value (float)', example: '5000000' },
      { name: 'event_revenue_currency', req: 'Optional', desc: 'Currency code (ISO 4217)', example: 'VND' },
      { name: 'install_time', req: 'Optional', desc: 'Event timestamp in ISO 8601 format', example: '2026-06-29T10:00:00Z' },
    ] as ParamRow[],
    example: (origin: string) => `${origin}/postback/appsflyer?app_id=vn.shbfinance.app&af_tranid=af_001&af_sub1=PUBLISHER_ID&event_name=loan_approved&event_revenue=5000000&event_revenue_currency=VND`,
  },
  {
    key: 'direct',
    label: 'Direct S2S',
    path: '/postback/cityads',
    attrField: 'sa',
    params: [
      { name: 'offer_id', req: 'Required', desc: 'Offer App ID registered in Magic system (provided by Magic team)', example: 'SHB001' },
      { name: 'xid', req: 'Required', desc: 'Unique conversion ID (used for deduplication)', example: 'conv_20260629_001' },
      { name: 'sa', req: 'Required', desc: 'Magic Publisher ID — pass from click URL {pub} parameter for attribution', example: 'cm9xyzmag...' },
      { name: 'action_type', req: 'Optional', desc: 'Event type. Defaults to "conversion" if omitted', example: 'loan_approved' },
      { name: 'order_total', req: 'Optional', desc: 'Loan amount / order value', example: '5000000' },
      { name: 'open_commission', req: 'Optional', desc: 'Commission amount to be paid by advertiser', example: '150000' },
      { name: 'payout_currency', req: 'Optional', desc: 'Currency code (ISO 4217)', example: 'VND' },
      { name: 'status', req: 'Optional', desc: '"approved" or "1" → Approved · "rejected" or "3" → Rejected · else → Pending', example: 'approved' },
      { name: 'conversion_time', req: 'Optional', desc: 'Event timestamp (Unix timestamp or ISO string)', example: '2026-06-29T10:00:00Z' },
    ] as ParamRow[],
    example: (origin: string) => `${origin}/postback/cityads?offer_id=SHB001&xid=conv_001&sa=PUBLISHER_ID&action_type=loan_approved&order_total=5000000&payout_currency=VND&status=approved`,
  },
]

const EVENTS = [
  { name: 'install', desc: 'User installs the app for the first time' },
  { name: 'registration', desc: 'User completes account registration' },
  { name: 'loan_application', desc: 'User submits a loan application' },
  { name: 'loan_approved', desc: 'Loan application is approved by lender' },
  { name: 'first_disbursement', desc: 'First loan disbursement is completed' },
  { name: 'repayment', desc: 'Borrower makes a repayment' },
]

export default function IntegrationDocs() {
  const [activeTab, setActiveTab] = useState('adjust')
  const [origin, setOrigin] = useState('https://your-magic-domain.com')

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const mmp = MMP_TABS.find(m => m.key === activeTab)!

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center font-black text-lg">M</div>
            <span className="text-sm font-medium text-gray-400">Magic Affiliate Network</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Postback Integration Guide</h1>
          <p className="text-gray-400 text-sm">Server-to-Server (S2S) postback documentation for advertiser integration</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Overview */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Overview</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            When a user clicks a Magic tracking link and completes an action on your platform (app install, registration, loan approval, etc.),
            your system should fire a server-to-server (S2S) postback to Magic's endpoint so the conversion is recorded and the publisher is credited.
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { step: '1', title: 'User clicks link', sub: 'Magic tracking link with pub={publisherId}' },
              { step: '2', title: 'User converts', sub: 'Installs app, registers, applies for loan...' },
              { step: '3', title: 'You fire postback', sub: 'POST to Magic endpoint with conversion data' },
            ].map(s => (
              <div key={s.step} className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                <div className="w-7 h-7 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center mx-auto mb-2">{s.step}</div>
                <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Endpoint */}
        <section className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900">Postback Endpoint</h2>
            <p className="text-xs text-gray-400 mt-0.5">Choose your MMP integration method below</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {MMP_TABS.map(m => (
              <button key={m.key} onClick={() => setActiveTab(m.key)}
                className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === m.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                {m.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* URL */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Endpoint URL</p>
              <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-3">
                <span className="text-blue-400 text-xs font-mono font-bold shrink-0">GET / POST</span>
                <code className="text-green-400 text-xs font-mono flex-1 break-all">{origin}{mmp.path}</code>
                <CopyButton text={`${origin}${mmp.path}`} />
              </div>
              <p className="text-xs text-gray-400 mt-2">Parameters can be sent as query string (GET) or JSON/form body (POST). Both accepted.</p>
            </div>

            {/* Attribution */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900">
              <strong>Attribution:</strong> The publisher ID captured in Magic's click URL (<code className="font-mono text-xs bg-blue-100 px-1 rounded">?pub=&#123;publisherId&#125;</code>) must be forwarded in the <code className="font-mono text-xs bg-blue-100 px-1 rounded">{mmp.attrField}</code> parameter of the postback. Without this, the conversion cannot be attributed to a publisher.
            </div>

            {/* Params */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Parameters</p>
              <ParamTable rows={mmp.params} />
            </div>

            {/* Example */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Example Request</p>
              <div className="flex items-start gap-3 bg-gray-900 rounded-lg px-4 py-3">
                <code className="text-green-400 text-xs font-mono flex-1 break-all leading-relaxed">{mmp.example(origin)}</code>
                <CopyButton text={mmp.example(origin)} />
              </div>
            </div>
          </div>
        </section>

        {/* Events */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Recommended Events</h2>
          <p className="text-sm text-gray-500 mb-4">Send a postback for each of these events so Magic can track the full conversion funnel.</p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {EVENTS.map(e => (
              <div key={e.name} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <code className="font-mono text-xs font-semibold text-orange-700 w-40 shrink-0">{e.name}</code>
                <span className="text-sm text-gray-600">{e.desc}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Use these values in the event_name / event_token / action_type field (depending on your MMP).</p>
        </section>

        {/* Response */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Response</h2>
          <p className="text-sm text-gray-600 mb-3">Magic always returns HTTP 200, even if the postback contains an error. This prevents MMP retry loops.</p>
          <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-gray-400 text-xs font-mono">HTTP 200</span>
            <code className="text-green-400 text-xs font-mono">{'{ "ok": true }'}</code>
          </div>
          <p className="text-xs text-gray-400 mt-2">Check Admin → Postback Logs for detailed status of each received postback.</p>
        </section>

        {/* UAT */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">UAT Testing</h2>
          <div className="space-y-3 text-sm text-gray-600">
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">1</div>
              <p>Magic will set up a <strong>test offer</strong> with a dedicated App ID / token. Use this for UAT postbacks.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">2</div>
              <p>Send test postbacks to the <strong>same production endpoint</strong> (no separate UAT environment).</p>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">3</div>
              <p>Verify results in <strong>Admin → Postback Logs</strong> — each inbound request is logged with full payload and result.</p>
            </div>
            <div className="flex gap-3">
              <div className="w-5 h-5 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">4</div>
              <p>Approved test conversions will appear in <strong>Admin → Conversions</strong>. Use <code className="font-mono text-xs bg-gray-100 px-1 rounded">status=approved</code> in the postback to force-approve for testing.</p>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gray-900 rounded-xl p-6 text-white">
          <h2 className="text-lg font-bold mb-2">Contact</h2>
          <p className="text-gray-400 text-sm">For integration support, App ID setup, or testing assistance, please contact the Magic team:</p>
          <p className="text-orange-400 text-sm mt-2 font-medium">vovantrong.89@gmail.com</p>
        </section>

        <p className="text-center text-xs text-gray-400 pb-6">Magic Affiliate Network · Integration Documentation</p>
      </div>
    </div>
  )
}
