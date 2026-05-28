'use client'
import { useEffect, useState } from 'react'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Conversion {
  id: string
  eventAt: string
  sourceType: string
  sourceRefId: string
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
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Single manual form
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState(BLANK_FORM)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // CSV modal
  const [showCsv, setShowCsv] = useState(false)
  const [csvTab, setCsvTab] = useState<'create' | 'update'>('create')
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

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id)
    try {
      await api.put(`/admin/conversions/${id}`, { status })
      setConversions(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    } finally {
      setUpdatingId(null)
    }
  }

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

  function resetCsv() {
    setCsvText(''); setCsvParsed([]); setCsvError(''); setCsvResult(null)
  }

  function parseCsvCreate(text: string) {
    setCsvError(''); setCsvResult(null)
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) { setCsvError('Cần ít nhất 1 dòng dữ liệu sau header'); setCsvParsed([]); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const required = ['publisher_id', 'offer_id', 'event_type', 'event_at']
    const missing = required.filter(r => !headers.includes(r))
    if (missing.length) { setCsvError(`Thiếu cột: ${missing.join(', ')}`); setCsvParsed([]); return }
    const rows = lines.slice(1).map((line) => {
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
      }
    })
    setCsvParsed(rows)
  }

  function parseCsvUpdate(text: string) {
    setCsvError(''); setCsvResult(null)
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) { setCsvError('Cần ít nhất 1 dòng dữ liệu sau header'); setCsvParsed([]); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    if (!headers.includes('status')) { setCsvError('Thiếu cột: status'); setCsvParsed([]); return }
    if (!headers.includes('source_ref_id') && !headers.includes('id')) {
      setCsvError('Cần cột source_ref_id hoặc id'); setCsvParsed([]); return
    }
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(',').map(v => v.trim())
      const row: any = {}
      headers.forEach((h, idx) => { row[h] = vals[idx] || '' })
      return {
        id: row['id'] || undefined,
        sourceRefId: row['source_ref_id'] || undefined,
        status: row['status']?.toUpperCase(),
      }
    }).filter(r => validStatuses.includes(r.status))
    if (!rows.length) { setCsvError('Không có dòng hợp lệ (status phải là PENDING/APPROVED/REJECTED)'); setCsvParsed([]); return }
    setCsvParsed(rows)
  }

  async function submitCsv() {
    if (!csvParsed.length) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const endpoint = csvTab === 'create' ? '/admin/conversions/bulk' : '/admin/conversions/bulk-status'
      const body = csvTab === 'create' ? { rows: csvParsed } : { rows: csvParsed }
      const { data } = await api.post(endpoint, body)
      setCsvResult(data)
      if (data.success > 0) load()
    } catch (err: any) {
      setCsvError(err.response?.data?.error || 'Upload thất bại')
    } finally {
      setCsvUploading(false)
    }
  }

  function downloadTemplate() {
    let content: string
    if (csvTab === 'create') {
      const header = 'publisher_id,offer_id,event_type,revenue,event_at,source_ref_id'
      const example = `${publishers[0]?.id || 'PUBLISHER_ID'},${offers[0]?.id || 'OFFER_ID'},purchase,25.50,${new Date().toISOString().slice(0, 10)},ref-001`
      content = header + '\n' + example
    } else {
      const header = 'source_ref_id,status'
      const example = 'ref-001,APPROVED\nref-002,REJECTED\nref-003,PENDING'
      content = header + '\n' + example
    }
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = csvTab === 'create' ? 'conversions_template.csv' : 'status_update_template.csv'
    a.click()
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
          <button onClick={() => { setShowCsv(true); resetCsv(); setCsvTab('create') }}
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
                {['Date', 'MMP', 'Offer', 'Publisher', 'Event', 'Revenue', 'Commission', 'Status', 'Actions', 'Postback'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap cursor-pointer" onClick={() => setSelected(c)}>{fmtDate(c.eventAt)}</td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(c)}>{mmpBadge(c.sourceType)}</td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 cursor-pointer" onClick={() => setSelected(c)}>{c.offer?.name}</td>
                  <td className="px-4 py-2.5 text-gray-600 cursor-pointer" onClick={() => setSelected(c)}>{c.publisher?.name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-600 capitalize cursor-pointer" onClick={() => setSelected(c)}>{c.eventType}</td>
                  <td className="px-4 py-2.5 text-gray-900 cursor-pointer" onClick={() => setSelected(c)}>{fmtMoney(c.revenue, c.currency)}</td>
                  <td className="px-4 py-2.5 text-green-700 font-medium cursor-pointer" onClick={() => setSelected(c)}>{fmtMoney(c.commissionAmount, c.currency)}</td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(c)}>{statusBadge(c.status)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {c.status !== 'APPROVED' && (
                        <button
                          onClick={() => updateStatus(c.id, 'APPROVED')}
                          disabled={updatingId === c.id}
                          className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-1 rounded font-medium"
                        >✓</button>
                      )}
                      {c.status !== 'PENDING' && (
                        <button
                          onClick={() => updateStatus(c.id, 'PENDING')}
                          disabled={updatingId === c.id}
                          className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded font-medium"
                        >~</button>
                      )}
                      {c.status !== 'REJECTED' && (
                        <button
                          onClick={() => updateStatus(c.id, 'REJECTED')}
                          disabled={updatingId === c.id}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-medium"
                        >✕</button>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {c.postbackSent
                      ? <span className={`text-xs ${c.postbackStatus === 200 ? 'text-green-600' : 'text-red-500'}`}>{c.postbackStatus ?? '?'}</span>
                      : <span className="text-xs text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No conversions found</td></tr>
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
              <h2 className="text-lg font-bold text-gray-900">Conversion Detail</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-2 mb-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Ref ID</span><code className="text-xs font-mono text-gray-700">{selected.sourceRefId}</code></div>
              <div className="flex justify-between"><span className="text-gray-500">Status</span>{statusBadge(selected.status)}</div>
            </div>
            <pre className="bg-gray-50 rounded-lg p-4 text-xs font-mono overflow-auto max-h-64 text-gray-700">
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
                    placeholder="purchase / install"
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

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => { setCsvTab('create'); resetCsv() }}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${csvTab === 'create' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Tạo mới (Pending)
              </button>
              <button
                onClick={() => { setCsvTab('update'); resetCsv() }}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${csvTab === 'update' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                Cập nhật trạng thái
              </button>
            </div>

            {csvTab === 'create' ? (
              <div className="bg-gray-50 rounded-lg p-3 mb-3 text-xs text-gray-600">
                <p className="font-medium mb-1">Cột bắt buộc:</p>
                <code className="font-mono">publisher_id, offer_id, event_type, event_at</code>
                <p className="font-medium mt-2 mb-1">Cột tùy chọn:</p>
                <code className="font-mono">revenue, source_ref_id</code>
                <p className="mt-1 text-gray-400">Tất cả sẽ được tạo với trạng thái PENDING</p>
              </div>
            ) : (
              <div className="bg-blue-50 rounded-lg p-3 mb-3 text-xs text-blue-700">
                <p className="font-medium mb-1">Upload kết quả từ advertiser — cột bắt buộc:</p>
                <code className="font-mono">source_ref_id, status</code>
                <p className="mt-1">hoặc dùng <code className="font-mono">id</code> thay cho <code className="font-mono">source_ref_id</code></p>
                <p className="mt-1 text-blue-500">status hợp lệ: APPROVED · REJECTED · PENDING</p>
              </div>
            )}

            <button onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-3 block">
              Download template CSV
            </button>

            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value)
                if (e.target.value) {
                  csvTab === 'create' ? parseCsvCreate(e.target.value) : parseCsvUpdate(e.target.value)
                } else {
                  setCsvParsed([]); setCsvError('')
                }
              }}
              rows={8}
              placeholder={csvTab === 'create'
                ? 'publisher_id,offer_id,event_type,revenue,event_at\nPUB_ID,OFFER_ID,purchase,25.50,2026-05-28'
                : 'source_ref_id,status\nref-001,APPROVED\nref-002,REJECTED'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />

            {csvError && <p className="text-red-600 text-sm mb-3">{csvError}</p>}

            {csvParsed.length > 0 && !csvError && (
              <p className="text-sm text-gray-600 mb-3">
                <span className="font-medium text-green-700">{csvParsed.length} dòng</span> sẵn sàng upload
              </p>
            )}

            {csvResult && (
              <div className={`rounded-lg p-3 mb-3 text-sm ${csvResult.failed === 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                <p className="font-medium">Kết quả: {csvResult.success} thành công, {csvResult.failed} thất bại</p>
                {csvResult.errors.map((e, i) => <p key={i} className="text-xs mt-1">{e}</p>)}
              </div>
            )}

            <button onClick={submitCsv}
              disabled={csvUploading || csvParsed.length === 0 || !!csvError}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
              {csvUploading ? 'Đang upload...' : `Upload ${csvParsed.length > 0 ? `${csvParsed.length} dòng` : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
