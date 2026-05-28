'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Conversion {
  id: string
  eventAt: string
  sourceType: string
  offer: { name: string; mmpSource: string }
  publisher?: { name: string; email: string } | null
  eventType: string
  revenue: number
  commissionAmount: number
  currency: string
  status: string
  postbackSent: boolean
  postbackStatus?: number | null
  rawPayload: any
}

interface Offer { id: string; name: string; commissionType: string }
interface Publisher { id: string; name: string; email: string }

const BLANK_FORM = { publisherId: '', offerId: '', eventType: 'purchase', revenue: '', eventAt: '', sourceRefId: '', status: 'PENDING' }

export default function ConversionsPage() {
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [offers, setOffers] = useState<Offer[]>([])
  const [publishers, setPublishers] = useState<Publisher[]>([])
  const [filters, setFilters] = useState({ offerId: '', publisherId: '', status: '', from: '', to: '' })
  const [selected, setSelected] = useState<Conversion | null>(null)

  // Single manual form
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState(BLANK_FORM)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // CSV upload
  const [showCsv, setShowCsv] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [csvParsed, setCsvParsed] = useState<any[]>([])
  const [csvError, setCsvError] = useState('')
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)

  const limit = 20

  async function load() {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filters.offerId) params.set('offerId', filters.offerId)
    if (filters.publisherId) params.set('publisherId', filters.publisherId)
    if (filters.status) params.set('status', filters.status)
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    const { data } = await api.get(`/admin/conversions?${params}`)
    setConversions(data.conversions)
    setTotal(data.total)
  }

  useEffect(() => { load() }, [page, filters])
  useEffect(() => {
    Promise.all([api.get('/admin/offers'), api.get('/admin/publishers')]).then(([o, p]) => {
      setOffers(o.data)
      setPublishers(p.data)
    })
  }, [])

  async function submitManual(e: React.FormEvent) {
    e.preventDefault()
    setManualSaving(true)
    setManualMsg(null)
    try {
      await api.post('/admin/conversions', {
        publisherId: manualForm.publisherId,
        offerId: manualForm.offerId,
        eventType: manualForm.eventType,
        revenue: manualForm.revenue ? parseFloat(manualForm.revenue) : 0,
        eventAt: manualForm.eventAt,
        sourceRefId: manualForm.sourceRefId || undefined,
        status: manualForm.status,
      })
      setManualMsg({ ok: true, text: 'Conversion added successfully' })
      setManualForm(BLANK_FORM)
      load()
    } catch (err: any) {
      setManualMsg({ ok: false, text: err.response?.data?.error || 'Failed to add conversion' })
    } finally {
      setManualSaving(false)
    }
  }

  function parseCsv(text: string) {
    setCsvError('')
    setCsvResult(null)
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) { setCsvError('File must have a header row and at least one data row'); setCsvParsed([]); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const required = ['publisher_id', 'offer_id', 'event_type', 'event_at']
    const missing = required.filter(r => !headers.includes(r))
    if (missing.length) { setCsvError(`Missing columns: ${missing.join(', ')}`); setCsvParsed([]); return }

    const rows = lines.slice(1).map((line, i) => {
      const vals = line.split(',').map(v => v.trim())
      const row: any = {}
      headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
      return {
        publisherId: row['publisher_id'],
        offerId: row['offer_id'],
        eventType: row['event_type'],
        revenue: row['revenue'] ? parseFloat(row['revenue']) : 0,
        eventAt: row['event_at'],
        sourceRefId: row['source_ref_id'] || undefined,
        _line: i + 2,
      }
    })
    setCsvParsed(rows)
  }

  async function submitCsv() {
    if (!csvParsed.length) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const { data } = await api.post('/admin/conversions/bulk', { rows: csvParsed })
      setCsvResult(data)
      if (data.success > 0) load()
    } catch (err: any) {
      setCsvError(err.response?.data?.error || 'Upload failed')
    } finally {
      setCsvUploading(false)
    }
  }

  function downloadTemplate() {
    const header = 'publisher_id,offer_id,event_type,revenue,event_at,source_ref_id'
    const example = `${publishers[0]?.id || 'PUBLISHER_ID'},${offers[0]?.id || 'OFFER_ID'},purchase,25.50,${new Date().toISOString().slice(0, 10)},ref-001`
    const blob = new Blob([header + '\n' + example], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'conversions_template.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const statusBadge = (s: string) => {
    const cls: Record<string, string> = {
      APPROVED: 'bg-green-100 text-green-700',
      PENDING: 'bg-yellow-100 text-yellow-700',
      REJECTED: 'bg-red-100 text-red-700',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>{s}</span>
  }

  const mmpBadge = (s: string) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s === 'APPSFLYER' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>{s}</span>
  )

  const pages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Conversions ({total})</h1>
        <div className="flex gap-2">
          <button onClick={() => { setShowCsv(true); setCsvText(''); setCsvParsed([]); setCsvError(''); setCsvResult(null) }}
            className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg font-medium">
            Upload CSV
          </button>
          <button onClick={() => { setShowManual(true); setManualForm(BLANK_FORM); setManualMsg(null) }}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">
            + Add Manual
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-5 gap-3">
        <select value={filters.offerId} onChange={(e) => { setFilters({ ...filters, offerId: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Offers</option>
          {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <select value={filters.publisherId} onChange={(e) => { setFilters({ ...filters, publisherId: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Publishers</option>
          {publishers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Statuses</option>
          <option value="APPROVED">Approved</option>
          <option value="PENDING">Pending</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => { setFilters({ ...filters, from: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={(e) => { setFilters({ ...filters, to: e.target.value }); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['Date', 'MMP', 'Offer', 'Publisher', 'Event', 'Revenue', 'Commission', 'Status', 'Postback'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(c)}>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{fmtDate(c.eventAt)}</td>
                  <td className="px-4 py-2.5">{mmpBadge(c.sourceType)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{c.offer?.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.publisher?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize">{c.eventType}</td>
                  <td className="px-4 py-2.5 text-gray-900">{fmtMoney(c.revenue, c.currency)}</td>
                  <td className="px-4 py-2.5 text-green-700 font-medium">{fmtMoney(c.commissionAmount, c.currency)}</td>
                  <td className="px-4 py-2.5">{statusBadge(c.status)}</td>
                  <td className="px-4 py-2.5">
                    {c.postbackSent
                      ? <span className={`text-xs ${c.postbackStatus === 200 ? 'text-green-600' : 'text-red-500'}`}>{c.postbackStatus ?? '?'}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No conversions found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Raw payload modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Raw Payload</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-80 text-gray-700">
              {JSON.stringify(selected.rawPayload, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Add Manual modal */}
      {showManual && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowManual(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Add Manual Conversion</h2>
              <button onClick={() => setShowManual(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {manualMsg && (
              <div className={`rounded-lg p-3 mb-4 text-sm ${manualMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {manualMsg.text}
              </div>
            )}

            <form onSubmit={submitManual} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publisher <span className="text-red-500">*</span></label>
                <select required value={manualForm.publisherId}
                  onChange={(e) => setManualForm({ ...manualForm, publisherId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select publisher...</option>
                  {publishers.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Offer <span className="text-red-500">*</span></label>
                <select required value={manualForm.offerId}
                  onChange={(e) => setManualForm({ ...manualForm, offerId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Select offer...</option>
                  {offers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type <span className="text-red-500">*</span></label>
                  <input required value={manualForm.eventType}
                    onChange={(e) => setManualForm({ ...manualForm, eventType: e.target.value })}
                    placeholder="purchase / install / registration"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue</label>
                  <input type="number" step="0.01" min="0" value={manualForm.revenue}
                    onChange={(e) => setManualForm({ ...manualForm, revenue: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Date <span className="text-red-500">*</span></label>
                  <input required type="date" value={manualForm.eventAt}
                    onChange={(e) => setManualForm({ ...manualForm, eventAt: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={manualForm.status}
                    onChange={(e) => setManualForm({ ...manualForm, status: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Ref ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input value={manualForm.sourceRefId}
                  onChange={(e) => setManualForm({ ...manualForm, sourceRefId: e.target.value })}
                  placeholder="auto-generated if empty"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button type="submit" disabled={manualSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                {manualSaving ? 'Adding...' : 'Add Conversion'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CSV Upload modal */}
      {showCsv && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCsv(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Upload CSV</h2>
              <button onClick={() => setShowCsv(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-xs text-gray-600">
              <p className="font-medium mb-1">Required columns:</p>
              <code className="font-mono">publisher_id, offer_id, event_type, event_at</code>
              <p className="font-medium mt-2 mb-1">Optional columns:</p>
              <code className="font-mono">revenue, source_ref_id</code>
              <p className="mt-2 text-gray-400">event_at format: YYYY-MM-DD &nbsp;|&nbsp; All conversions will be created with status PENDING</p>
            </div>

            <button onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-3 block">
              Download template CSV
            </button>

            <textarea
              value={csvText}
              onChange={(e) => { setCsvText(e.target.value); if (e.target.value) parseCsv(e.target.value) }}
              rows={8}
              placeholder={'publisher_id,offer_id,event_type,revenue,event_at\nPUB_ID,OFFER_ID,purchase,25.50,2026-05-28'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />

            {csvError && <p className="text-red-600 text-sm mb-3">{csvError}</p>}

            {csvParsed.length > 0 && !csvError && (
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-medium text-green-700">{csvParsed.length} rows</span> ready to upload
              </p>
            )}

            {csvResult && (
              <div className={`rounded-lg p-3 mb-3 text-sm ${csvResult.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                <p className="font-medium">Done: {csvResult.success} success, {csvResult.failed} failed</p>
                {csvResult.errors.map((e, i) => <p key={i} className="text-xs mt-1">{e}</p>)}
              </div>
            )}

            <button onClick={submitCsv}
              disabled={csvUploading || csvParsed.length === 0 || !!csvError}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
              {csvUploading ? 'Uploading...' : `Upload ${csvParsed.length > 0 ? `${csvParsed.length} rows` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
