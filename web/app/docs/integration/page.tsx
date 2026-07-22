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

const PARAMS: ParamRow[] = [
  { name: 'offer_id', req: 'Required', desc: 'Offer App ID registered in Magic system (provided by Magic team)', example: 'SHB001' },
  { name: 'transaction_id', req: 'Required', desc: 'Unique conversion ID — used for deduplication. Must be unique per event. Recommended format: {lead_id}_{event}', example: 'LEAD_98765_loan_application' },
  { name: 'pub', req: 'Recommended', desc: 'Magic Publisher ID — captured from the "sa" parameter appended by Magic to the destination URL. Required for publisher attribution.', example: 'cmq0zoz6w...' },
  { name: 'event', req: 'Optional', desc: 'Event type name. Defaults to "conversion" if omitted.', example: 'loan_approved' },
  { name: 'revenue', req: 'Optional', desc: 'Loan amount or order value (numeric float)', example: '5000000' },
  { name: 'currency', req: 'Optional', desc: 'Currency code (ISO 4217). Defaults to VND if omitted.', example: 'VND' },
  { name: 'status', req: 'Optional', desc: '"approved" or "1" → Approved · "rejected" or "3" → Rejected · omit → Pending', example: 'approved' },
  { name: 'timestamp', req: 'Optional', desc: 'Event time as Unix timestamp (seconds) or ISO 8601 string. Defaults to now.', example: '2026-06-29T10:00:00Z' },
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
  const [origin, setOrigin] = useState('https://your-magic-domain.com')

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin)
  }, [])

  const endpoint = `${origin}/postback/s2s`
  const example = `${endpoint}?offer_id=SHB001&transaction_id=conv_001&pub=PUBLISHER_ID&event=loan_approved&revenue=5000000&currency=VND&status=approved`

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
              { step: '1', title: 'User clicks link', sub: 'Magic redirects to your URL, appending sa={publisherId} and click_id={uniqueClickId}' },
              { step: '2', title: 'User converts', sub: 'Installs app, registers, applies for loan...' },
              { step: '3', title: 'You fire postback', sub: 'Send S2S request to Magic with pub={sa} and your transaction_id' },
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
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Postback Endpoint</h2>
            <p className="text-xs text-gray-400 mt-0.5">Universal S2S endpoint — works with any traffic source or MMP</p>
          </div>

          {/* URL */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Endpoint URL</p>
            <div className="flex items-center gap-3 bg-gray-900 rounded-lg px-4 py-3">
              <span className="text-blue-400 text-xs font-mono font-bold shrink-0">GET / POST</span>
              <code className="text-green-400 text-xs font-mono flex-1 break-all">{endpoint}</code>
              <CopyButton text={endpoint} />
            </div>
            <p className="text-xs text-gray-400 mt-2">Parameters can be sent as query string (GET) or JSON/form body (POST). Both are accepted.</p>
          </div>

          {/* Attribution note */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-900 space-y-2">
            <p><strong>Attribution:</strong> When a user clicks a Magic tracking link, Magic automatically appends two parameters to your destination URL:</p>
            <ul className="list-disc list-inside text-xs space-y-1 ml-2">
              <li><code className="font-mono bg-blue-100 px-1 rounded">sa=&#123;publisherId&#125;</code> — Magic Publisher ID. Capture this and return it as <code className="font-mono bg-blue-100 px-1 rounded">pub=</code> in the postback.</li>
              <li><code className="font-mono bg-blue-100 px-1 rounded">click_id=&#123;uniqueClickId&#125;</code> — Unique ID per click, generated by Magic. Useful for session-level tracking.</li>
            </ul>
            <p className="text-xs"><strong>Without <code className="font-mono bg-blue-100 px-1 rounded">pub</code>, conversions cannot be attributed to publishers.</strong></p>
          </div>

          {/* Params */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Parameters</p>
            <ParamTable rows={PARAMS} />
          </div>

          {/* Example */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Example Request</p>
            <div className="flex items-start gap-3 bg-gray-900 rounded-lg px-4 py-3">
              <code className="text-green-400 text-xs font-mono flex-1 break-all leading-relaxed">{example}</code>
              <CopyButton text={example} />
            </div>
          </div>
        </section>

        {/* Events */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Recommended Events</h2>
          <p className="text-sm text-gray-500 mb-4">Send a postback for each of these events so Magic can track the full conversion funnel. Pass the event name in the <code className="font-mono text-xs bg-gray-100 px-1 rounded">event</code> parameter.</p>
          <div className="divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
            {EVENTS.map(e => (
              <div key={e.name} className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50">
                <code className="font-mono text-xs font-semibold text-orange-700 w-44 shrink-0">{e.name}</code>
                <span className="text-sm text-gray-600">{e.desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Response */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Response</h2>
          <p className="text-sm text-gray-600 mb-3">Magic always returns HTTP 200. This prevents unnecessary retry loops on your side.</p>
          <div className="bg-gray-900 rounded-lg px-4 py-3 flex items-center gap-3">
            <span className="text-gray-400 text-xs font-mono">HTTP 200</span>
            <code className="text-green-400 text-xs font-mono">{'{ "ok": true }'}</code>
          </div>
          <p className="text-xs text-gray-400 mt-2">Detailed status of each received postback is available in Admin → Postback Logs.</p>
        </section>

        {/* UAT */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">UAT Testing</h2>
          <div className="space-y-3 text-sm text-gray-600">
            {[
              'Magic will provide a <strong>test offer ID</strong> for UAT. Use this <code class="font-mono text-xs bg-gray-100 px-1 rounded">offer_id</code> when sending test postbacks.',
              'Send test postbacks to the <strong>same production endpoint</strong> — there is no separate UAT environment.',
              'Verify results in <strong>Admin → Postback Logs</strong> — each inbound request is logged with full payload and processing result.',
              'Use <code class="font-mono text-xs bg-gray-100 px-1 rounded">status=approved</code> in the postback to force-approve a conversion during testing.',
            ].map((text, i) => (
              <div key={i} className="flex gap-3">
                <div className="w-5 h-5 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</div>
                <p dangerouslySetInnerHTML={{ __html: text }} />
              </div>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="bg-gray-900 rounded-xl p-6 text-white">
          <h2 className="text-lg font-bold mb-2">Contact</h2>
          <p className="text-gray-400 text-sm">For integration support, offer ID setup, or testing assistance, please contact the Magic team:</p>
          <p className="text-orange-400 text-sm mt-2 font-medium">vovantrong.89@gmail.com</p>
        </section>

        <p className="text-center text-xs text-gray-400 pb-6">Magic Affiliate Network · Integration Documentation</p>
      </div>
    </div>
  )
}
