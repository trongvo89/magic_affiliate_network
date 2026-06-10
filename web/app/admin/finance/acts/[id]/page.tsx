'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api, fmtMoney, fmtDate } from '@/lib/api'

interface Act {
  id: string
  actCode: string
  status: string
  advPaymentStatus: string
  periodStart: string
  periodEnd: string
  currency: string
  totalRevenue: number
  totalPayout: number
  totalMargin: number
  advertiser: { id: string; name: string }
  offer: { id: string; name: string }
  invoice?: Invoice | null
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  amount: number
  currency: string
  status: string
  fileUrl?: string
  payments: Payment[]
}

interface Payment {
  id: string
  amount: number
  currency: string
  paymentDate: string
  paymentMethod: string
  transactionReference?: string
  notes?: string
}

interface Order {
  id: string
  orderId: string
  publisher?: { name: string } | null
  trackingStatus: string
  advertiserStatus: string
  finalStatus: string
  paymentStatus: string
  revenue: number
  payout: number
  margin: number
}

interface OrdersData {
  orders: Order[]
  total: number
  approvedCount: number
  rejectedCount: number
  holdCount: number
  pendingCount: number
}

const BLANK_PAYMENT = {
  amount: '',
  currency: '',
  paymentDate: '',
  paymentMethod: '',
  transactionReference: '',
  notes: '',
}

const BLANK_INVOICE = {
  invoiceDate: '',
  dueDate: '',
  amount: '',
  currency: '',
  notes: '',
}

function statusBadge(s: string) {
  const cls: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    UPLOADED: 'bg-blue-100 text-blue-700',
    RECONCILED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-green-100 text-green-700',
    LOCKED: 'bg-green-100 text-green-700',
    INVOICE_SENT: 'bg-yellow-100 text-yellow-700',
    PAYMENT_PENDING: 'bg-yellow-100 text-yellow-700',
    PAID: 'bg-green-100 text-green-700',
    CLOSED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls[s] || 'bg-gray-100 text-gray-600'}`}>
      {s}
    </span>
  )
}

function orderStatusBadge(s: string, type: 'tracking' | 'adv' | 'final' | 'payment') {
  const greenSet = new Set(['APPROVED', 'VALID', 'PAID', 'SETTLED'])
  const redSet = new Set(['REJECTED', 'INVALID', 'FRAUD', 'CANCELLED'])
  const yellowSet = new Set(['HOLD', 'PENDING', 'REVIEW'])
  let cls = 'bg-gray-100 text-gray-600'
  if (greenSet.has(s)) cls = 'bg-green-100 text-green-700'
  else if (redSet.has(s)) cls = 'bg-red-100 text-red-700'
  else if (yellowSet.has(s)) cls = 'bg-yellow-100 text-yellow-700'
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{s || '—'}</span>
}

export default function ActDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [act, setAct] = useState<Act | null>(null)
  const [actLoading, setActLoading] = useState(true)
  const [actError, setActError] = useState('')

  const [orders, setOrders] = useState<Order[]>([])
  const [ordersData, setOrdersData] = useState<Partial<OrdersData>>({})
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersPage, setOrdersPage] = useState(1)
  const ordersLimit = 50

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // CSV upload
  const [uploadLoading, setUploadLoading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ matched?: number; unmatched?: number; errors?: string[] } | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Order inline actions
  const [orderAction, setOrderAction] = useState<{ id: string; type: 'reject' | 'hold'; reason: string } | null>(null)
  const [orderActionLoading, setOrderActionLoading] = useState(false)

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState(BLANK_INVOICE)
  const [invoiceSaving, setInvoiceSaving] = useState(false)
  const [invoiceError, setInvoiceError] = useState('')

  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState(BLANK_PAYMENT)
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const loadAct = useCallback(async () => {
    setActLoading(true)
    setActError('')
    try {
      const { data } = await api.get(`/admin/finance/acts/${id}`)
      setAct(data)
    } catch (err: any) {
      setActError(err.response?.data?.error || 'Failed to load act')
    } finally {
      setActLoading(false)
    }
  }, [id])

  const loadOrders = useCallback(async () => {
    if (!id) return
    setOrdersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(ordersPage), limit: String(ordersLimit) })
      const { data } = await api.get(`/admin/finance/acts/${id}/orders?${params}`)
      setOrders(data.orders || data)
      setOrdersData(data)
    } catch {
      // silently fail orders load
    } finally {
      setOrdersLoading(false)
    }
  }, [id, ordersPage])

  useEffect(() => { loadAct() }, [loadAct])
  useEffect(() => { loadOrders() }, [loadOrders])

  async function doAction(action: string) {
    setActionLoading(true)
    setActionError('')
    try {
      await api.patch(`/admin/finance/acts/${id}/status`, { action })
      await loadAct()
    } catch (err: any) {
      setActionError(err.response?.data?.error || `Action "${action}" failed`)
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadLoading(true)
    setUploadError('')
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(`/admin/finance/acts/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setUploadResult(data)
      await loadAct()
      await loadOrders()
    } catch (err: any) {
      setUploadError(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploadLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleOrderAction(orderId: string, action: 'approve' | 'reject' | 'hold', reason?: string) {
    setOrderActionLoading(true)
    try {
      await api.patch(`/admin/finance/acts/${id}/orders/${orderId}`, { action, reason })
      await loadOrders()
    } catch (err: any) {
      alert(err.response?.data?.error || 'Action failed')
    } finally {
      setOrderActionLoading(false)
      setOrderAction(null)
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault()
    setInvoiceSaving(true)
    setInvoiceError('')
    try {
      await api.post(`/admin/finance/acts/${id}/invoice`, {
        invoiceDate: invoiceForm.invoiceDate,
        dueDate: invoiceForm.dueDate,
        amount: parseFloat(invoiceForm.amount),
        currency: invoiceForm.currency || act?.currency,
        notes: invoiceForm.notes || undefined,
      })
      setShowInvoiceModal(false)
      setInvoiceForm(BLANK_INVOICE)
      await loadAct()
    } catch (err: any) {
      setInvoiceError(err.response?.data?.error || 'Failed to create invoice')
    } finally {
      setInvoiceSaving(false)
    }
  }

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!act?.invoice) return
    setPaymentSaving(true)
    setPaymentError('')
    try {
      await api.post(`/admin/finance/invoices/${act.invoice.id}/payments`, {
        amount: parseFloat(paymentForm.amount),
        currency: paymentForm.currency || act.currency,
        paymentDate: paymentForm.paymentDate,
        paymentMethod: paymentForm.paymentMethod,
        transactionReference: paymentForm.transactionReference || undefined,
        notes: paymentForm.notes || undefined,
      })
      setShowPaymentModal(false)
      setPaymentForm(BLANK_PAYMENT)
      await loadAct()
    } catch (err: any) {
      setPaymentError(err.response?.data?.error || 'Failed to record payment')
    } finally {
      setPaymentSaving(false)
    }
  }

  if (actLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-40 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    )
  }

  if (actError || !act) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{actError || 'Act not found'}</div>
        <button onClick={() => router.back()} className="mt-4 text-sm text-gray-500 hover:text-gray-700">← Back</button>
      </div>
    )
  }

  const isLocked = ['LOCKED', 'INVOICE_SENT', 'PAYMENT_PENDING', 'PAID', 'CLOSED'].includes(act.status)
  const ordersTotal = ordersData.total || orders.length
  const ordersPages = Math.ceil(ordersTotal / ordersLimit)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
        <h1 className="text-xl font-bold text-gray-900">Act: <span className="font-mono">{act.actCode}</span></h1>
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{actionError}</div>
      )}

      {/* Act Summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Act Summary</h2>
          <div className="flex gap-2 items-center">
            {statusBadge(act.status)}
            {act.advPaymentStatus && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">{act.advPaymentStatus}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Advertiser</p>
            <p className="text-sm font-medium text-gray-900">{act.advertiser?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Offer</p>
            <p className="text-sm font-medium text-gray-900">{act.offer?.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Period</p>
            <p className="text-sm font-medium text-gray-900">
              {act.periodStart?.slice(0, 10)} – {act.periodEnd?.slice(0, 10)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Currency</p>
            <p className="text-sm font-medium text-gray-900">{act.currency}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Total Revenue</p>
            <p className="text-lg font-bold text-gray-900">{fmtMoney(act.totalRevenue || 0, act.currency)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Total Payout</p>
            <p className="text-lg font-bold text-gray-900">{fmtMoney(act.totalPayout || 0, act.currency)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-0.5">Total Margin</p>
            <p className="text-lg font-bold text-green-700">{fmtMoney(act.totalMargin || 0, act.currency)}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {(act.status === 'DRAFT' || act.status === 'UPLOADED') && (
            <label className={`inline-flex items-center gap-1.5 text-sm border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-lg font-medium cursor-pointer ${uploadLoading ? 'opacity-50' : ''}`}>
              {uploadLoading ? 'Uploading...' : 'Upload CSV'}
              <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} disabled={uploadLoading} />
            </label>
          )}
          {act.status === 'RECONCILED' && (
            <button onClick={() => doAction('approve')} disabled={actionLoading}
              className="text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
              {actionLoading ? 'Processing...' : 'Approve Act'}
            </button>
          )}
          {act.status === 'APPROVED' && (
            <button onClick={() => doAction('lock')} disabled={actionLoading}
              className="text-sm bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium">
              {actionLoading ? 'Processing...' : 'Lock Act'}
            </button>
          )}
          {act.status === 'LOCKED' && !act.invoice && (
            <button onClick={() => { setShowInvoiceModal(true); setInvoiceForm({ ...BLANK_INVOICE, currency: act.currency, amount: String(act.totalRevenue || '') }); setInvoiceError('') }}
              className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium">
              Create Invoice
            </button>
          )}
        </div>

        {/* Upload result */}
        {(uploadResult || uploadError) && (
          <div className={`mt-3 rounded-lg p-3 text-sm ${uploadError ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
            {uploadError ? uploadError : (
              <div>
                <p className="font-medium">Upload complete: {uploadResult?.matched ?? 0} matched, {uploadResult?.unmatched ?? 0} unmatched</p>
                {uploadResult?.errors?.map((e, i) => <p key={i} className="text-xs mt-1 text-red-600">{e}</p>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Orders</h2>
            {(ordersData.approvedCount !== undefined) && (
              <div className="flex gap-3 mt-1">
                <span className="text-xs text-green-600 font-medium">{ordersData.approvedCount ?? 0} Approved</span>
                <span className="text-xs text-red-600 font-medium">{ordersData.rejectedCount ?? 0} Rejected</span>
                <span className="text-xs text-yellow-600 font-medium">{ordersData.holdCount ?? 0} Hold</span>
                <span className="text-xs text-gray-500 font-medium">{ordersData.pendingCount ?? 0} Pending</span>
              </div>
            )}
          </div>
          <span className="text-sm text-gray-500">{ordersTotal} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                {['#', 'Order ID', 'Publisher', 'Tracking', 'Adv Status', 'Final', 'Payment', 'Revenue', 'Payout', 'Margin', !isLocked && 'Actions'].filter(Boolean).map((h) => (
                  <th key={String(h)} className="px-4 py-3 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ordersLoading ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">Loading orders...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-8 text-center text-gray-400">No orders found. Upload a CSV to populate orders.</td></tr>
              ) : orders.map((order, idx) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-400 text-xs">{(ordersPage - 1) * ordersLimit + idx + 1}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{order.orderId}</td>
                  <td className="px-4 py-2.5 text-gray-700">{order.publisher?.name || '—'}</td>
                  <td className="px-4 py-2.5">{orderStatusBadge(order.trackingStatus, 'tracking')}</td>
                  <td className="px-4 py-2.5">{orderStatusBadge(order.advertiserStatus, 'adv')}</td>
                  <td className="px-4 py-2.5">{orderStatusBadge(order.finalStatus, 'final')}</td>
                  <td className="px-4 py-2.5">{orderStatusBadge(order.paymentStatus, 'payment')}</td>
                  <td className="px-4 py-2.5 text-gray-900">{fmtMoney(order.revenue || 0, act.currency)}</td>
                  <td className="px-4 py-2.5 text-gray-900">{fmtMoney(order.payout || 0, act.currency)}</td>
                  <td className="px-4 py-2.5 text-green-700">{fmtMoney(order.margin || 0, act.currency)}</td>
                  {!isLocked && (
                    <td className="px-4 py-2.5">
                      {orderAction?.id === order.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            autoFocus
                            type="text"
                            placeholder={`Reason for ${orderAction.type}...`}
                            value={orderAction.reason}
                            onChange={(e) => setOrderAction({ ...orderAction, reason: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                          <button
                            onClick={() => handleOrderAction(order.id, orderAction.type, orderAction.reason)}
                            disabled={orderActionLoading}
                            className="text-xs bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white px-2 py-1 rounded">
                            OK
                          </button>
                          <button onClick={() => setOrderAction(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleOrderAction(order.id, 'approve')}
                            disabled={orderActionLoading}
                            className="text-xs bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-2 py-1 rounded font-medium">
                            ✓
                          </button>
                          <button
                            onClick={() => setOrderAction({ id: order.id, type: 'reject', reason: '' })}
                            className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-2 py-1 rounded font-medium">
                            ✕
                          </button>
                          <button
                            onClick={() => setOrderAction({ id: order.id, type: 'hold', reason: '' })}
                            className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-700 px-2 py-1 rounded font-medium">
                            ~
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ordersPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">Page {ordersPage} of {ordersPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setOrdersPage((p) => Math.max(1, p - 1))} disabled={ordersPage === 1}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Previous</button>
              <button onClick={() => setOrdersPage((p) => Math.min(ordersPages, p + 1))} disabled={ordersPage === ordersPages}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Invoice Section */}
      {act.invoice && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Invoice</h2>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              act.invoice.status === 'PAID' ? 'bg-green-100 text-green-700'
              : act.invoice.status === 'OVERDUE' ? 'bg-red-100 text-red-700'
              : act.invoice.status === 'SENT' ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
            }`}>{act.invoice.status}</span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Invoice Number</p>
              <p className="text-sm font-medium text-gray-900">{act.invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Invoice Date</p>
              <p className="text-sm font-medium text-gray-900">{act.invoice.invoiceDate?.slice(0, 10)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Due Date</p>
              <p className="text-sm font-medium text-gray-900">{act.invoice.dueDate?.slice(0, 10)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Amount</p>
              <p className="text-sm font-bold text-gray-900">{fmtMoney(act.invoice.amount, act.invoice.currency)}</p>
            </div>
          </div>

          {act.invoice.fileUrl && (
            <a href={act.invoice.fileUrl} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium mr-4">
              View Invoice File
            </a>
          )}

          <button
            onClick={() => { setShowPaymentModal(true); setPaymentForm({ ...BLANK_PAYMENT, currency: act.currency }); setPaymentError('') }}
            className="text-sm bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-medium mt-2">
            Record Payment
          </button>

          {/* Recorded Payments */}
          {act.invoice.payments && act.invoice.payments.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Recorded Payments</p>
              <div className="space-y-2">
                {act.invoice.payments.map((pmt) => (
                  <div key={pmt.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{fmtMoney(pmt.amount, pmt.currency)}</p>
                      <p className="text-xs text-gray-500">{pmt.paymentMethod} · {pmt.paymentDate?.slice(0, 10)}</p>
                      {pmt.transactionReference && <p className="text-xs text-gray-400 font-mono">{pmt.transactionReference}</p>}
                    </div>
                    {pmt.notes && <p className="text-xs text-gray-500 max-w-xs text-right">{pmt.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowInvoiceModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Create Invoice</h2>
              <button onClick={() => setShowInvoiceModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {invoiceError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{invoiceError}</div>
            )}

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date <span className="text-red-500">*</span></label>
                  <input required type="date" value={invoiceForm.invoiceDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoiceDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date <span className="text-red-500">*</span></label>
                  <input required type="date" value={invoiceForm.dueDate}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                  <input required type="number" step="0.01" min="0" value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input value={invoiceForm.currency || act.currency}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, currency: e.target.value.toUpperCase() })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={invoiceForm.notes} rows={3}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button type="submit" disabled={invoiceSaving}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                {invoiceSaving ? 'Creating...' : 'Create Invoice'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowPaymentModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            {paymentError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{paymentError}</div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount <span className="text-red-500">*</span></label>
                  <input required type="number" step="0.01" min="0" value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                  <input value={paymentForm.currency || act.currency}
                    onChange={(e) => setPaymentForm({ ...paymentForm, currency: e.target.value.toUpperCase() })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date <span className="text-red-500">*</span></label>
                  <input required type="date" value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method <span className="text-red-500">*</span></label>
                  <input required value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    placeholder="Wire / PayPal / ..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference</label>
                <input value={paymentForm.transactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, transactionReference: e.target.value })}
                  placeholder="TXN-..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={paymentForm.notes} rows={2}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
              </div>
              <button type="submit" disabled={paymentSaving}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm">
                {paymentSaving ? 'Recording...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
