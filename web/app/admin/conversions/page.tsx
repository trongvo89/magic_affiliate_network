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

function getAdvCommission(c: Conversion, exchangeRate: number): number {
  if (c.sourceType === 'CITYADS') {
    const raw = c.rawPayload || {}
    const openComm = parseFloat(raw.open_commission || '0') || 0
    return openComm * exchangeRate
  }
  return c.revenue
}

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
  const [exporting, setExporting] = useState(false)
  const [exchangeRate, setExchangeRate] = useState(1)

  // Edit conversion modal
  const [editing, setEditing] = useState<Conversion | null>(null)
  const [editForm, setEditForm] = useState({ revenue: '', commissionAmount: '', currency: '' })
  const [editSaving, setEditSaving] = useState(false)

  // Single manual form
  const [showManual, setShowManual] = useState(false)
  const [manualForm, setManualForm] = useState(BLANK_FORM)
  const [manualSaving, setManualSaving] = useState(false)
  const [manualMsg, setManualMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Fix CityAds
  const [fixing, setFixing] = useState(false)
  const [fixResult, setFixResult] = useState<{ updated: number; total: number } | null>(null)

  async function fixCityAds() {
    if (!confirm('Recalculate all CityAds conversions with current exchange rate?')) return
    setFixing(true)
    try {
      const { data } = await api.post('/admin/fix-cityads-conversions')
      setFixResult({ updated: data.updated, total: data.total })
      load()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Fix failed')
    } finally {
      setFixing(false)
    }
  }

  // CSV modal
  const [showCsv, setShowCsv] = useState(false)
  const [csvTab, setCsvTab] = useState<'create' | 'update'>('create')
  const [csvText, setCsvText] = useState('')
  const [csvParsed, setCsvParsed] = useState<any[]>([])
  const [csvError, setCsvError] = useState('')
  const [csvUploading, setCsvUploading] = useState(false)
  const [csvResult, setCsvResult] = useState<{ success: number; failed: number; errors: string[] } | null>(null)
  const [csvValidateFrom, setCsvValidateFrom] = useState('')
  const [csvValidateTo, setCsvValidateTo] = useState('')
  const [csvOfferLock, setCsvOfferLock] = useState('')

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
    if (data.cityadsExchangeRate) setExchangeRate(data.cityadsExchangeRate)
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

  function openEdit(c: Conversion) {
    setEditing(c)
    setEditForm({ revenue: String(c.revenue), commissionAmount: String(c.commissionAmount), currency: c.currency })
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setEditSaving(true)
    try {
      const { data } = await api.put(`/admin/conversions/${editing.id}`, {
        revenue: parseFloat(editForm.revenue),
        commissionAmount: parseFloat(editForm.commissionAmount),
        currency: editForm.currency,
      })
      setConversions(prev => prev.map(c => c.id === editing.id ? { ...c, revenue: data.revenue, commissionAmount: data.commissionAmount, currency: data.currency } : c))
      setEditing(null)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Update failed')
    } finally {
      setEditSaving(false)
    }
  }

  async function exportCsv() {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filters.offerId) params.set('offerId', filters.offerId)
      if (filters.publisherId) params.set('publisherId', filters.publisherId)
      if (filters.status) params.set('status', filters.status)
      if (filters.from) params.set('from', filters.from)
      if (filters.to) params.set('to', filters.to)
      const { data } = await api.get(`/admin/conversions/export?${params}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `conversions_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.response?.data?.error || 'Export failed')
    } finally {
      setExporting(false)
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
    setCsvValidateFrom(''); setCsvValidateTo(''); setCsvOfferLock('')
  }

  function parseCsvCreate(text: string, valFrom = csvValidateFrom, valTo = csvValidateTo, offerLock = csvOfferLock) {
    setCsvError(''); setCsvResult(null)
    const lines = text.trim().split('\n').filter(Boolean)
    if (lines.length < 2) { setCsvError('Cần ít nhất 1 dòng dữ liệu sau header'); setCsvParsed([]); return }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
    const hasPublisher = headers.includes('publisher_id') || headers.includes('publisher_email')
    const hasOffer = !!offerLock || headers.includes('offer_id') || headers.includes('offer_name')
    if (!hasPublisher) { setCsvError('Thiếu cột: publisher_id hoặc publisher_email'); setCsvParsed([]); return }
    if (!hasOffer) { setCsvError('Thiếu cột: offer_id hoặc offer_name (hoặc chọn offer ở ô bên trên)'); setCsvParsed([]); return }
    const missingCols = ['event_type', 'event_at'].filter(r => !headers.includes(r))
    if (missingCols.length) { setCsvError(`Thiếu cột: ${missingCols.join(', ')}`); setCsvParsed([]); return }

    const pubEmailMap: Record<string, string> = {}
    for (const p of publishers) pubEmailMap[p.email.toLowerCase()] = p.id
    const offerNameMap: Record<string, string> = {}
    for (const o of offers) offerNameMap[o.name.toLowerCase()] = o.id

    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
    const fromDate = valFrom ? new Date(valFrom) : null
    const toDate = valTo ? new Date(valTo + 'T23:59:59') : null

    const errors: string[] = []
    const rows: any[] = []

    lines.slice(1).forEach((line, lineIdx) => {
      const vals = line.split(',').map(v => v.trim())
      const row: any = {}
      headers.forEach((h, idx) => { row[h] = vals[idx] || '' })

      let publisherId = row['publisher_id'] || ''
      if (!publisherId && row['publisher_email']) {
        publisherId = pubEmailMap[row['publisher_email'].toLowerCase()] || ''
        if (!publisherId) { errors.push(`Row ${lineIdx + 2}: publisher_email "${row['publisher_email']}" not found`); return }
      }
      if (!publisherId) { errors.push(`Row ${lineIdx + 2}: missing publisher_id or publisher_email`); return }

      let offerId = offerLock || row['offer_id'] || ''
      if (!offerId && row['offer_name']) {
        offerId = offerNameMap[row['offer_name'].toLowerCase()] || ''
        if (!offerId) { errors.push(`Row ${lineIdx + 2}: offer_name "${row['offer_name']}" not found`); return }
      }
      if (!offerId) { errors.push(`Row ${lineIdx + 2}: missing offer_id or offer_name`); return }

      const eventDate = new Date(row['event_at'])
      if (isNaN(eventDate.getTime())) { errors.push(`Row ${lineIdx + 2}: invalid event_at date`); return }
      if (fromDate && eventDate < fromDate) { errors.push(`Row ${lineIdx + 2}: event_at ngoài khoảng (trước ${valFrom})`); return }
      if (toDate && eventDate > toDate) { errors.push(`Row ${lineIdx + 2}: event_at ngoài khoảng (sau ${valTo})`); return }

      const status = row['status']?.toUpperCase()
      rows.push({
        publisherId,
        offerId,
        eventType: row['event_type'],
        revenue: row['revenue'] ? parseFloat(row['revenue']) : 0,
        eventAt: row['event_at'],
        sourceRefId: row['source_ref_id'] || undefined,
        status: validStatuses.includes(status) ? status : 'PENDING',
      })
    })

    if (errors.length) { setCsvError(errors.join('\n')); setCsvParsed([]); return }
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

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setCsvText(text)
      if (csvTab === 'create') parseCsvCreate(text, csvValidateFrom, csvValidateTo, csvOfferLock)
      else parseCsvUpdate(text)
    }
    reader.readAsText(file)
  }

  async function submitCsv() {
    if (!csvParsed.length) return
    setCsvUploading(true)
    setCsvResult(null)
    try {
      const endpoint = csvTab === 'create' ? '/admin/conversions/bulk' : '/admin/conversions/bulk-status'
      const body: any = { rows: csvParsed }
      if (csvTab === 'create' && csvValidateFrom) body.validateFrom = csvValidateFrom
      if (csvTab === 'create' && csvValidateTo) body.validateTo = csvValidateTo
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
      const offerCols = csvOfferLock ? '' : ',offer_id,offer_name'
      const header = `publisher_id,publisher_email${offerCols},event_type,revenue,event_at,source_ref_id,status`
      const offerVals = csvOfferLock ? '' : `,${offers[0]?.id || 'OFFER_ID'},`
      const example = `${publishers[0]?.id || 'PUBLISHER_ID'},${offerVals},purchase,25.50,${new Date().toISOString().slice(0, 10)},ref-001,APPROVED`
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
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${s === 'APPSFLYER' ? 'bg-blue-100 text-blue-700' : s === 'ADJUST' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>{s}</span>
  )

  const pages = Math.ceil(total / limit)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Conversions ({total})</h1>
        <div className="flex gap-2">
          <button onClick={exportCsv} disabled={exporting}
            className="flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-600 px-3 py-1.5 rounded-lg font-medium">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button onClick={() => { setShowCsv(true); resetCsv(); setCsvTab('create') }}
            className="text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg font-medium">
            Upload CSV
          </button>
          <button onClick={() => { setShowManual(true); setManualForm(BLANK_FORM); setManualMsg(null) }}
            className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium">
            + Add Manual
          </button>
          <button onClick={fixCityAds} disabled={fixing}
            className="text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
            {fixing ? 'Fixing...' : 'Fix CityAds Rates'}
          </button>
        </div>
      </div>

      {fixResult && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3 mb-4">
          Fixed {fixResult.updated}/{fixResult.total} CityAds conversions with exchange rate.
          <button onClick={() => setFixResult(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

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
                {['Date', 'MMP', 'Offer', 'Publisher', 'Event', 'Revenue', 'Adv Comm', 'Pub Comm', 'Magic Comm', 'Status', 'Actions', 'Postback'].map((h) => (
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
                  <td className="px-4 py-2.5 text-blue-700 font-medium cursor-pointer" onClick={() => setSelected(c)}>{fmtMoney(getAdvCommission(c, exchangeRate), c.currency)}</td>
                  <td className="px-4 py-2.5 text-orange-600 font-medium cursor-pointer" onClick={() => setSelected(c)}>{fmtMoney(c.commissionAmount, c.currency)}</td>
                  <td className="px-4 py-2.5 font-medium cursor-pointer" onClick={() => setSelected(c)}>
                    <span className={(getAdvCommission(c, exchangeRate) - c.commissionAmount) >= 0 ? 'text-green-700' : 'text-red-600'}>
                      {fmtMoney(getAdvCommission(c, exchangeRate) - c.commissionAmount, c.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(c)}>{statusBadge(c.status)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1">
                      {c.status !== 'APPROVED' && (
                        <button onClick={() => updateStatus(c.id, 'APPROVED')} disabled={updatingId === c.id}
                          className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-1 rounded font-medium">✓</button>
                      )}
                      {c.status !== 'PENDING' && (
                        <button onClick={() => updateStatus(c.id, 'PENDING')} disabled={updatingId === c.id}
                          className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded font-medium">~</button>
                      )}
                      {c.status !== 'REJECTED' && (
                        <button onClick={() => updateStatus(c.id, 'REJECTED')} disabled={updatingId === c.id}
                          className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-medium">✕</button>
                      )}
                      <button onClick={() => openEdit(c)} title="Edit values"
                        className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">✎</button>
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
                <tr><td colSpan={12} className="px-4 py-8 text-center text-gray-400">No conversions found</td></tr>
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

      {/* Edit conversion modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Edit Conversion</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="text-xs text-gray-500 mb-4">
              <span className="font-medium">{editing.offer?.name}</span> &middot; {editing.sourceRefId?.slice(0, 20)}...
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Order Value (Revenue)</label>
                <input type="number" step="any" min="0" required value={editForm.revenue}
                  onChange={e => setEditForm(f => ({ ...f, revenue: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission (Publisher)</label>
                <input type="number" step="any" min="0" required value={editForm.commissionAmount}
                  onChange={e => setEditForm(f => ({ ...f, commissionAmount: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select value={editForm.currency} onChange={e => setEditForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="VND">VND</option>
                  <option value="USD">USD</option>
                  <option value="RUB">RUB</option>
                </select>
              </div>
              <button type="submit" disabled={editSaving}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm">
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
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
          <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
                Tạo conversion mới
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
                <code className="font-mono">event_type, event_at</code>
                <p className="font-medium mt-2 mb-1">Publisher (một trong hai):</p>
                <code className="font-mono">publisher_id</code> <span className="text-gray-400">hoặc</span> <code className="font-mono">publisher_email</code>
                {!csvOfferLock && (
                  <>
                    <p className="font-medium mt-2 mb-1">Offer (một trong hai — bỏ qua nếu chọn offer ở dưới):</p>
                    <code className="font-mono">offer_id</code> <span className="text-gray-400">hoặc</span> <code className="font-mono">offer_name</code>
                  </>
                )}
                <p className="font-medium mt-2 mb-1">Cột tùy chọn:</p>
                <code className="font-mono">revenue, source_ref_id, status</code>
                <p className="mt-1 text-gray-400">status: PENDING (mặc định) · APPROVED · REJECTED</p>
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
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mb-4 block">
              Download template CSV
            </button>

            {/* Offer lock + date range validation (create only) */}
            {csvTab === 'create' && (
              <div className="mb-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">
                    Áp dụng cho offer <span className="text-gray-400 font-normal">(tùy chọn — bỏ qua cột offer trong CSV)</span>
                  </label>
                  <select value={csvOfferLock}
                    onChange={e => {
                      const v = e.target.value
                      setCsvOfferLock(v)
                      if (csvText) parseCsvCreate(csvText, csvValidateFrom, csvValidateTo, v)
                    }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Tất cả / lấy từ CSV —</option>
                    {offers.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-1.5">Kiểm tra ngày <span className="text-gray-400 font-normal">(tùy chọn — từ chối dòng ngoài khoảng)</span></p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
                      <input type="date" value={csvValidateFrom}
                        onChange={e => {
                          const v = e.target.value
                          setCsvValidateFrom(v)
                          if (csvText) parseCsvCreate(csvText, v, csvValidateTo, csvOfferLock)
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
                      <input type="date" value={csvValidateTo}
                        onChange={e => {
                          const v = e.target.value
                          setCsvValidateTo(v)
                          if (csvText) parseCsvCreate(csvText, csvValidateFrom, v, csvOfferLock)
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* File upload */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Chọn file CSV:</label>
              <input type="file" accept=".csv,text/csv" onChange={handleCsvFile}
                className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white hover:file:bg-gray-50 cursor-pointer w-full" />
            </div>
            <p className="text-xs text-gray-400 mb-2">hoặc paste trực tiếp:</p>

            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value)
                if (e.target.value) {
                  if (csvTab === 'create') parseCsvCreate(e.target.value, csvValidateFrom, csvValidateTo, csvOfferLock)
                  else parseCsvUpdate(e.target.value)
                } else {
                  setCsvParsed([]); setCsvError('')
                }
              }}
              rows={6}
              placeholder={csvTab === 'create'
                ? (csvOfferLock
                  ? 'publisher_email,event_type,revenue,event_at,status\njohn@example.com,purchase,25.50,2026-05-28,APPROVED'
                  : 'publisher_email,offer_name,event_type,revenue,event_at,status\njohn@example.com,Shopee VN CPS,purchase,25.50,2026-05-28,APPROVED')
                : 'source_ref_id,status\nref-001,APPROVED\nref-002,REJECTED'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />

            {csvError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                {csvError.split('\n').map((line, i) => (
                  <p key={i} className="text-red-600 text-xs">{line}</p>
                ))}
              </div>
            )}

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
