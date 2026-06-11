import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { parse } from 'csv-parse/sync'
import {
  recalculatePublisherBalance,
  releasePublisherPayables,
  recordAdvertiserPayment,
  approvePublisherPaymentRequest,
  rejectPublisherPaymentRequest,
  markPublisherPaymentPaid,
} from '../lib/finance'

async function requireAdmin(request: FastifyRequest, reply: any) {
  try {
    await request.jwtVerify()
    if ((request.user as any).role !== 'ADMIN') return reply.code(403).send({ error: 'Forbidden' })
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

function recalcActTotals(prisma: PrismaClient, actId: string) {
  return prisma.actOrder.aggregate({
    where: { actId },
    _sum: { revenue: true, payout: true, margin: true },
  }).then(agg =>
    prisma.settlementAct.update({
      where: { id: actId },
      data: {
        totalRevenue: agg._sum.revenue ?? 0,
        totalPayout: agg._sum.payout ?? 0,
        grossMargin: agg._sum.margin ?? 0,
      },
    })
  )
}

export default async function financeAdminRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  server.addHook('preHandler', requireAdmin)

  // ─── Advertisers ─────────────────────────────────────────────────────────────

  server.get('/admin/finance/advertisers', async () => {
    return prisma.advertiser.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, currency: true },
    })
  })

  server.post<{ Body: { name: string; email?: string; currency?: string } }>(
    '/admin/finance/advertisers',
    async (request, reply) => {
      const { name, email, currency } = request.body
      if (!name) return reply.code(400).send({ error: 'name is required' })
      const advertiser = await prisma.advertiser.create({
        data: { name, email: email ?? null, currency: currency ?? 'USD' },
      })
      return reply.code(201).send(advertiser)
    }
  )

  server.patch<{ Params: { id: string }; Body: { name?: string; email?: string; currency?: string } }>(
    '/admin/finance/advertisers/:id',
    async (request, reply) => {
      const { name, email, currency } = request.body
      const advertiser = await prisma.advertiser.update({
        where: { id: request.params.id },
        data: {
          ...(name !== undefined && { name }),
          ...(email !== undefined && { email }),
          ...(currency !== undefined && { currency }),
        },
      }).catch(() => null)
      if (!advertiser) return reply.code(404).send({ error: 'Not found' })
      return advertiser
    }
  )

  server.delete<{ Params: { id: string } }>(
    '/admin/finance/advertisers/:id',
    async (request, reply) => {
      await prisma.advertiser.delete({ where: { id: request.params.id } }).catch(() => null)
      return reply.code(204).send()
    }
  )

  // ─── Settlement Acts ──────────────────────────────────────────────────────────

  server.get<{ Querystring: { page?: string; limit?: string; status?: string } }>(
    '/admin/finance/acts',
    async (request) => {
      const { page = '1', limit = '20', status } = request.query
      const skip = (parseInt(page) - 1) * parseInt(limit)
      const where: any = {}
      if (status) where.status = status

      const [acts, total] = await Promise.all([
        prisma.settlementAct.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            advertiser: { select: { id: true, name: true } },
            offer: { select: { id: true, name: true } },
            _count: { select: { orders: true } },
          },
        }),
        prisma.settlementAct.count({ where }),
      ])

      return { acts, total, page: parseInt(page), limit: parseInt(limit) }
    }
  )

  server.post<{
    Body: {
      advertiserId: string
      offerId: string
      periodStart: string
      periodEnd: string
      currency?: string
      actCode?: string
    }
  }>('/admin/finance/acts', async (request, reply) => {
    const { advertiserId, offerId, periodStart, periodEnd, currency, actCode } = request.body
    if (!advertiserId || !offerId || !periodStart || !periodEnd) {
      return reply.code(400).send({ error: 'advertiserId, offerId, periodStart, periodEnd are required' })
    }

    const offer = await prisma.offer.findUnique({ where: { id: offerId }, select: { name: true } })
    if (!offer) return reply.code(404).send({ error: 'Offer not found' })
    const advertiser = await prisma.advertiser.findUnique({ where: { id: advertiserId } })
    if (!advertiser) return reply.code(404).send({ error: 'Advertiser not found' })

    const startDate = new Date(periodStart)
    const yyyy = startDate.getFullYear()
    const mm = String(startDate.getMonth() + 1).padStart(2, '0')
    const offerSlug = offer.name.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 20).toUpperCase()
    const generatedCode = actCode ?? `ACT-${yyyy}-${mm}-${offerSlug}`

    const act = await prisma.settlementAct.create({
      data: {
        actCode: generatedCode,
        advertiserId,
        offerId,
        periodStart: startDate,
        periodEnd: new Date(periodEnd),
        currency: currency ?? 'USD',
        createdBy: (request.user as any).id,
      },
    })
    return reply.code(201).send(act)
  })

  server.get<{ Params: { id: string } }>('/admin/finance/acts/:id', async (request, reply) => {
    const { id } = request.params
    const act = await prisma.settlementAct.findUnique({
      where: { id },
      include: {
        advertiser: true,
        offer: { select: { id: true, name: true, mmpSource: true } },
        invoice: true,
        _count: { select: { orders: true } },
      },
    })
    if (!act) return reply.code(404).send({ error: 'Act not found' })
    return act
  })

  server.patch<{ Params: { id: string }; Body: { action: string } }>(
    '/admin/finance/acts/:id/status',
    async (request, reply) => {
      const { id } = request.params
      const { action } = request.body

      const act = await prisma.settlementAct.findUnique({ where: { id } })
      if (!act) return reply.code(404).send({ error: 'Act not found' })

      const now = new Date()
      let updateData: any = {}

      if (action === 'reconcile') {
        if (act.status !== 'UPLOADED') {
          return reply.code(409).send({ error: 'Act must be in UPLOADED status to mark as reconciled' })
        }
        updateData = { status: 'RECONCILED' }
      } else if (action === 'approve') {
        if (!['UPLOADED', 'RECONCILED'].includes(act.status)) {
          return reply.code(409).send({ error: 'Act must be in UPLOADED or RECONCILED status to approve' })
        }
        const approvedOrderCount = await prisma.actOrder.count({
          where: { actId: id, finalStatus: 'APPROVED' },
        })
        if (approvedOrderCount === 0) {
          return reply.code(409).send({ error: 'Act must have at least 1 APPROVED order to approve' })
        }
        updateData = { status: 'APPROVED' }
      } else if (action === 'lock') {
        if (act.status !== 'APPROVED') {
          return reply.code(409).send({ error: 'Act must be in APPROVED status to lock' })
        }
        updateData = { status: 'LOCKED', lockedAt: now }
      } else if (action === 'close') {
        if (act.status !== 'PAID') {
          return reply.code(409).send({ error: 'Act must be in PAID status to close' })
        }
        updateData = { status: 'CLOSED', closedAt: now }
      } else if (action === 'cancel') {
        if (!['DRAFT', 'UPLOADED'].includes(act.status)) {
          return reply.code(409).send({ error: 'Only DRAFT or UPLOADED acts can be cancelled' })
        }
        updateData = { status: 'CANCELLED' }
      } else {
        return reply.code(400).send({ error: 'Invalid action. Use: approve, lock, close, cancel' })
      }

      const updated = await prisma.settlementAct.update({ where: { id }, data: updateData })
      return updated
    }
  )

  // ─── CSV Upload & Reconciliation ─────────────────────────────────────────────

  server.post<{ Params: { id: string } }>(
    '/admin/finance/acts/:id/upload',
    async (request, reply) => {
      const { id } = request.params

      const act = await prisma.settlementAct.findUnique({ where: { id } })
      if (!act) return reply.code(404).send({ error: 'Act not found' })
      if (!['DRAFT', 'UPLOADED'].includes(act.status)) {
        return reply.code(409).send({ error: 'Act must be in DRAFT or UPLOADED status' })
      }

      const contentType = request.headers['content-type'] ?? ''
      if (!contentType.includes('text/csv') && !contentType.includes('application/octet-stream') && !contentType.includes('multipart/form-data')) {
        return reply.code(400).send({ error: 'Expected CSV content' })
      }

      const rawBody = (request.body as Buffer | string)
      if (!rawBody) return reply.code(400).send({ error: 'No file content received' })

      const csvText = Buffer.isBuffer(rawBody) ? rawBody.toString('utf-8') : String(rawBody)

      if (Buffer.byteLength(csvText, 'utf-8') > 5 * 1024 * 1024) {
        return reply.code(400).send({ error: 'File exceeds 5MB limit' })
      }

      let rows: Record<string, string>[]
      try {
        rows = parse(csvText, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }) as Record<string, string>[]
      } catch (err: any) {
        return reply.code(400).send({ error: `CSV parse error: ${err.message}` })
      }

      if (rows.length > 10000) {
        return reply.code(400).send({ error: 'CSV exceeds 10,000 row limit' })
      }

      const APPROVED_STATUSES = new Set(['approved', '1', 'accept', 'accepted'])
      const REJECTED_STATUSES = new Set(['rejected', 'declined', '3', 'reject', 'decline'])

      let matched = 0
      let unmatched = 0
      const createdOrders: any[] = []

      for (const row of rows) {
        const orderId = row['order_id'] ?? row['orderId'] ?? ''
        const advertiserStatus = row['status'] ?? ''
        const revenue = parseFloat(row['revenue'] ?? '0') || 0
        const payout = parseFloat(row['payout'] ?? '0') || 0
        const margin = revenue - payout
        const rejectReason = row['reject_reason'] ?? row['rejectReason'] ?? null

        if (!orderId) continue

        const statusLower = advertiserStatus.toLowerCase().trim()
        let finalStatus: 'APPROVED' | 'REJECTED' | 'PENDING'
        if (APPROVED_STATUSES.has(statusLower)) {
          finalStatus = 'APPROVED'
        } else if (REJECTED_STATUSES.has(statusLower)) {
          finalStatus = 'REJECTED'
        } else {
          finalStatus = 'PENDING'
        }

        // Try to match with an internal Conversion via sourceRefId
        const conversion = await prisma.conversion.findFirst({
          where: { sourceRefId: orderId },
          select: { id: true, publisherId: true, status: true },
        })

        let publisherId: string | null = null
        let conversionId: string | null = null
        let trackingStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null = null

        if (conversion) {
          matched++
          publisherId = conversion.publisherId
          conversionId = conversion.id
          trackingStatus = conversion.status as 'PENDING' | 'APPROVED' | 'REJECTED'
        } else {
          unmatched++
        }

        const existing = await prisma.actOrder.findFirst({ where: { actId: id, orderId } })

        let order: any
        if (existing) {
          order = await prisma.actOrder.update({
            where: { id: existing.id },
            data: {
              advertiserStatus,
              revenue,
              payout,
              margin,
              finalStatus,
              rejectReason: rejectReason || null,
              trackingStatus,
              publisherId,
              conversionId,
            },
          })
        } else {
          order = await prisma.actOrder.create({
            data: {
              actId: id,
              orderId,
              offerId: act.offerId,
              advertiserStatus,
              revenue,
              payout,
              margin,
              currency: act.currency,
              finalStatus,
              rejectReason: rejectReason || null,
              trackingStatus,
              publisherId,
              conversionId,
              paymentStatus: 'NOT_PAYABLE_YET',
            },
          })
        }
        createdOrders.push(order)
      }

      // Update act status and totals
      const updateData: any = {}
      if (act.status === 'DRAFT') updateData.status = 'UPLOADED'

      await prisma.settlementAct.update({ where: { id }, data: updateData })
      await recalcActTotals(prisma, id)

      return {
        matched,
        unmatched,
        total: rows.length,
        orders: createdOrders.slice(0, 100),
      }
    }
  )

  // ─── Act Orders ───────────────────────────────────────────────────────────────

  server.get<{ Params: { id: string }; Querystring: { page?: string; limit?: string; finalStatus?: string } }>(
    '/admin/finance/acts/:id/orders',
    async (request, reply) => {
      const { id } = request.params
      const { page = '1', limit = '50', finalStatus } = request.query

      const act = await prisma.settlementAct.findUnique({ where: { id }, select: { id: true } })
      if (!act) return reply.code(404).send({ error: 'Act not found' })

      const skip = (parseInt(page) - 1) * parseInt(limit)
      const where: any = { actId: id }
      if (finalStatus) where.finalStatus = finalStatus

      const [orders, total] = await Promise.all([
        prisma.actOrder.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'asc' },
          include: {
            publisher: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.actOrder.count({ where }),
      ])

      return { orders, total, page: parseInt(page), limit: parseInt(limit) }
    }
  )

  server.patch<{ Params: { id: string; orderId: string }; Body: { finalStatus: string; rejectReason?: string } }>(
    '/admin/finance/acts/:id/orders/:orderId',
    async (request, reply) => {
      const { id, orderId } = request.params
      const { finalStatus, rejectReason } = request.body

      const act = await prisma.settlementAct.findUnique({ where: { id }, select: { id: true, status: true } })
      if (!act) return reply.code(404).send({ error: 'Act not found' })
      if (act.status === 'LOCKED') return reply.code(409).send({ error: 'Cannot modify orders of a LOCKED act' })

      const order = await prisma.actOrder.findFirst({ where: { id: orderId, actId: id } })
      if (!order) return reply.code(404).send({ error: 'Order not found' })

      if (!['PENDING', 'APPROVED', 'REJECTED', 'HOLD'].includes(finalStatus)) {
        return reply.code(400).send({ error: 'Invalid finalStatus' })
      }

      const updated = await prisma.actOrder.update({
        where: { id: orderId },
        data: {
          finalStatus: finalStatus as any,
          rejectReason: rejectReason ?? null,
        },
      })

      await recalcActTotals(prisma, id)

      return updated
    }
  )

  // ─── Invoices ─────────────────────────────────────────────────────────────────

  server.post<{
    Params: { id: string }
    Body: { invoiceDate: string; dueDate?: string; amount: number; notes?: string }
  }>('/admin/finance/acts/:id/invoice', async (request, reply) => {
    const { id } = request.params
    const { invoiceDate, dueDate, amount, notes } = request.body

    const act = await prisma.settlementAct.findUnique({ where: { id }, include: { advertiser: true } })
    if (!act) return reply.code(404).send({ error: 'Act not found' })
    const invoicableStatuses = ['APPROVED', 'LOCKED', 'INVOICE_SENT', 'PAYMENT_PENDING', 'PAID']
    if (!invoicableStatuses.includes(act.status)) {
      return reply.code(409).send({ error: 'Act must be APPROVED or LOCKED to create invoice' })
    }

    if (!invoiceDate || amount == null) {
      return reply.code(400).send({ error: 'invoiceDate and amount are required' })
    }

    const existing = await prisma.advertiserInvoice.findUnique({ where: { actId: id } })
    if (existing) return reply.code(409).send({ error: 'Invoice already exists for this act' })

    const invoiceNumber = `INV-${act.actCode}`

    const invoice = await prisma.advertiserInvoice.create({
      data: {
        actId: id,
        advertiserId: act.advertiserId,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        amount,
        currency: act.currency,
        notes: notes ?? null,
        status: 'SENT',
      },
    })

    await prisma.settlementAct.update({ where: { id }, data: { status: 'INVOICE_SENT' } })

    return reply.code(201).send(invoice)
  })

  server.get<{ Querystring: { page?: string; limit?: string } }>(
    '/admin/finance/invoices',
    async (request) => {
      const { page = '1', limit = '20' } = request.query
      const skip = (parseInt(page) - 1) * parseInt(limit)

      const [invoices, total] = await Promise.all([
        prisma.advertiserInvoice.findMany({
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            act: { select: { actCode: true } },
            advertiser: { select: { name: true } },
          },
        }),
        prisma.advertiserInvoice.count(),
      ])

      return { invoices, total, page: parseInt(page), limit: parseInt(limit) }
    }
  )

  server.patch<{
    Params: { id: string }
    Body: { fileUrl?: string; status?: string; notes?: string; dueDate?: string }
  }>('/admin/finance/invoices/:id', async (request, reply) => {
    const { id } = request.params
    const { fileUrl, status, notes, dueDate } = request.body

    const invoice = await prisma.advertiserInvoice.findUnique({ where: { id } })
    if (!invoice) return reply.code(404).send({ error: 'Invoice not found' })

    const data: any = {}
    if (fileUrl !== undefined) data.fileUrl = fileUrl
    if (status !== undefined) data.status = status
    if (notes !== undefined) data.notes = notes
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null

    const updated = await prisma.advertiserInvoice.update({ where: { id }, data })
    return updated
  })

  server.post<{
    Params: { id: string }
    Body: {
      amount: number
      currency: string
      paymentDate: string
      paymentMethod?: string
      transactionReference?: string
      notes?: string
      proofFileUrl?: string
    }
  }>('/admin/finance/invoices/:id/payments', async (request, reply) => {
    const { id } = request.params
    const { amount, currency, paymentDate, paymentMethod, transactionReference, notes, proofFileUrl } = request.body

    if (!amount || !currency || !paymentDate) {
      return reply.code(400).send({ error: 'amount, currency, paymentDate are required' })
    }

    const invoice = await prisma.advertiserInvoice.findUnique({ where: { id } })
    if (!invoice) return reply.code(404).send({ error: 'Invoice not found' })

    await recordAdvertiserPayment(prisma, id, {
      amount,
      currency,
      paymentDate: new Date(paymentDate),
      paymentMethod,
      transactionReference,
      proofFileUrl,
      notes,
      createdBy: (request.user as any).id,
    })

    return reply.code(201).send({ success: true })
  })

  // ─── Publisher Payables ───────────────────────────────────────────────────────

  server.get('/admin/finance/payables', async () => {
    const balances = await prisma.publisherBalance.findMany({
      where: {
        OR: [
          { pendingAmount: { gt: 0 } },
          { approvedAmount: { gt: 0 } },
          { availableAmount: { gt: 0 } },
          { requestedAmount: { gt: 0 } },
          { paidAmount: { gt: 0 } },
          { holdAmount: { gt: 0 } },
        ],
      },
      include: {
        publisher: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
    return balances
  })

  server.post<{ Body: { actId: string } }>(
    '/admin/finance/payables/release',
    async (request, reply) => {
      const { actId } = request.body
      if (!actId) return reply.code(400).send({ error: 'actId is required' })

      const act = await prisma.settlementAct.findUnique({ where: { id: actId } })
      if (!act) return reply.code(404).send({ error: 'Act not found' })

      await releasePublisherPayables(prisma, actId)
      return { success: true }
    }
  )

  // ─── Publisher Payment Requests ───────────────────────────────────────────────

  server.get<{ Querystring: { page?: string; limit?: string; status?: string } }>(
    '/admin/finance/payment-requests',
    async (request) => {
      const { page = '1', limit = '20', status } = request.query
      const skip = (parseInt(page) - 1) * parseInt(limit)
      const where: any = {}
      if (status) where.status = status

      const [requests, total] = await Promise.all([
        prisma.publisherPaymentRequest.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            publisher: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.publisherPaymentRequest.count({ where }),
      ])

      return { requests, total, page: parseInt(page), limit: parseInt(limit) }
    }
  )

  server.patch<{
    Params: { id: string }
    Body: { action: string; reason?: string; proofUrl?: string }
  }>('/admin/finance/payment-requests/:id', async (request, reply) => {
    const { id } = request.params
    const { action, reason, proofUrl } = request.body

    const paymentRequest = await prisma.publisherPaymentRequest.findUnique({ where: { id } })
    if (!paymentRequest) return reply.code(404).send({ error: 'Payment request not found' })

    const adminId = (request.user as any).id

    if (action === 'approve') {
      await approvePublisherPaymentRequest(prisma, id, adminId)
    } else if (action === 'reject') {
      if (!reason) return reply.code(400).send({ error: 'reason is required for rejection' })
      await rejectPublisherPaymentRequest(prisma, id, adminId, reason)
    } else if (action === 'mark_processing') {
      await prisma.publisherPaymentRequest.update({
        where: { id },
        data: { status: 'PROCESSING' },
      })
    } else if (action === 'mark_paid') {
      await markPublisherPaymentPaid(prisma, id, adminId, proofUrl)
    } else {
      return reply.code(400).send({ error: 'Invalid action. Use: approve, reject, mark_processing, mark_paid' })
    }

    const updated = await prisma.publisherPaymentRequest.findUnique({ where: { id } })
    return updated
  })

  // ─── Finance Dashboard ────────────────────────────────────────────────────────

  server.get('/admin/finance/dashboard', async () => {
    const now = new Date()

    const [
      receivableByCur,
      receivedByCur,
      balances,
      pendingRequests,
      overdueInvoices,
      actsAwaitingReconciliation,
      actsAwaitingPayment,
    ] = await Promise.all([
      prisma.advertiserInvoice.groupBy({
        by: ['currency'],
        where: { status: { notIn: ['RECEIVED', 'CANCELLED'] } },
        _sum: { amount: true },
      }),
      prisma.advertiserPayment.groupBy({
        by: ['currency'],
        _sum: { amount: true },
      }),
      prisma.publisherBalance.findMany({
        select: { currency: true, availableAmount: true, requestedAmount: true, paidAmount: true },
      }),
      prisma.publisherPaymentRequest.count({
        where: { status: { in: ['REQUESTED', 'UNDER_REVIEW'] } },
      }),
      prisma.advertiserInvoice.count({
        where: {
          dueDate: { lt: now },
          status: { notIn: ['RECEIVED', 'CANCELLED'] },
        },
      }),
      prisma.settlementAct.count({ where: { status: 'UPLOADED' } }),
      prisma.settlementAct.count({
        where: { status: 'INVOICE_SENT', advertiserPaymentStatus: 'UNPAID' },
      }),
    ])

    // Build per-currency maps
    const receivableByCurrency: Record<string, number> = {}
    for (const r of receivableByCur) receivableByCurrency[r.currency] = r._sum.amount ?? 0

    const receivedByCurrency: Record<string, number> = {}
    for (const r of receivedByCur) receivedByCurrency[r.currency] = r._sum.amount ?? 0

    const payableByCurrency: Record<string, number> = {}
    const paidByCurrency: Record<string, number> = {}
    for (const b of balances) {
      const cur = b.currency || 'USD'
      payableByCurrency[cur] = (payableByCurrency[cur] ?? 0) + b.availableAmount + b.requestedAmount
      paidByCurrency[cur] = (paidByCurrency[cur] ?? 0) + b.paidAmount
    }

    return {
      receivableByCurrency,
      receivedByCurrency,
      payableByCurrency,
      paidByCurrency,
      pendingRequests,
      overdueInvoices,
      actsAwaitingReconciliation,
      actsAwaitingPayment,
    }
  })
}
