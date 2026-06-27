import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { recalculatePublisherBalance } from '../lib/finance'

async function requireActivePublisher(request: FastifyRequest, reply: any) {
  try {
    await request.jwtVerify()
    const user = request.user as any
    if (user.role !== 'PUBLISHER') return reply.code(403).send({ error: 'Forbidden' })
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

export default async function financePublisherRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  server.addHook('preHandler', async (request, reply) => {
    if (request.routerPath?.startsWith('/publisher/finance')) {
      await requireActivePublisher(request, reply)
      const user = request.user as any
      if (user?.impersonatedBy && request.method !== 'GET') {
        return reply.code(403).send({ error: 'Read-only: admin impersonation mode' })
      }
    }
  })

  // GET /publisher/finance/balance
  server.get('/publisher/finance/balance', async (request) => {
    const { id } = request.user as any
    let balance = await prisma.publisherBalance.findUnique({ where: { publisherId: id } })
    if (!balance) {
      await recalculatePublisherBalance(prisma, id)
      balance = await prisma.publisherBalance.findUnique({ where: { publisherId: id } })
    }
    return balance ?? {
      publisherId: id, currency: 'USD',
      pendingAmount: 0, approvedAmount: 0, availableAmount: 0,
      requestedAmount: 0, paidAmount: 0, holdAmount: 0,
    }
  })

  // GET /publisher/finance/orders
  server.get<{ Querystring: { page?: string; limit?: string; paymentStatus?: string } }>(
    '/publisher/finance/orders',
    async (request) => {
      const { id } = request.user as any
      const page = Math.max(1, parseInt(request.query.page || '1'))
      const limit = Math.min(50, parseInt(request.query.limit || '20'))
      const skip = (page - 1) * limit

      const where: any = { publisherId: id }
      if (request.query.paymentStatus) where.paymentStatus = request.query.paymentStatus

      const [orders, total] = await Promise.all([
        prisma.actOrder.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { act: { select: { actCode: true, periodStart: true, periodEnd: true } } },
        }),
        prisma.actOrder.count({ where }),
      ])

      return { orders, total, page, limit }
    }
  )

  // GET /publisher/finance/payment-requests
  server.get<{ Querystring: { page?: string } }>(
    '/publisher/finance/payment-requests',
    async (request) => {
      const { id } = request.user as any
      const page = Math.max(1, parseInt(request.query.page || '1'))
      const limit = 20
      const skip = (page - 1) * limit

      const [requests, total] = await Promise.all([
        prisma.publisherPaymentRequest.findMany({
          where: { publisherId: id },
          orderBy: { requestedAt: 'desc' },
          skip,
          take: limit,
          include: { items: { select: { id: true, payout: true, currency: true, status: true } } },
        }),
        prisma.publisherPaymentRequest.count({ where: { publisherId: id } }),
      ])

      return { requests, total, page, limit }
    }
  )

  // GET /publisher/finance/payment-requests/:id
  server.get<{ Params: { id: string } }>(
    '/publisher/finance/payment-requests/:id',
    async (request, reply) => {
      const { id: publisherId } = request.user as any
      const req = await prisma.publisherPaymentRequest.findFirst({
        where: { id: request.params.id, publisherId },
        include: {
          items: {
            include: {
              actOrder: {
                select: {
                  orderId: true, offerId: true, revenue: true, payout: true,
                  currency: true, finalStatus: true, paymentStatus: true,
                  act: { select: { actCode: true } },
                },
              },
            },
          },
        },
      })
      if (!req) return reply.code(404).send({ error: 'Not found' })
      return req
    }
  )

  // POST /publisher/finance/payment-requests
  server.post<{ Body: { orderIds: string[]; paymentMethod?: string; bankInfo?: string; publisherNote?: string } }>(
    '/publisher/finance/payment-requests',
    async (request, reply) => {
      const { id: publisherId } = request.user as any
      const { orderIds, paymentMethod, bankInfo, publisherNote } = request.body

      if (!Array.isArray(orderIds) || orderIds.length === 0) {
        return reply.code(400).send({ error: 'orderIds must be a non-empty array' })
      }

      // Verify all orders belong to this publisher and are PAYABLE
      const orders = await prisma.actOrder.findMany({
        where: { id: { in: orderIds }, publisherId, paymentStatus: 'PAYABLE' },
      })

      if (orders.length === 0) {
        return reply.code(400).send({ error: 'No payable orders found' })
      }
      if (orders.length !== orderIds.length) {
        return reply.code(400).send({ error: 'Some orders are not payable or do not belong to you' })
      }

      const totalAmount = orders.reduce((sum, o) => sum + o.payout, 0)
      const currency = orders[0].currency

      const requestCode = `REQ-${Date.now()}-${publisherId.slice(-6).toUpperCase()}`

      const paymentRequest = await prisma.$transaction(async (tx) => {
        const req = await tx.publisherPaymentRequest.create({
          data: {
            requestCode,
            publisherId,
            amount: totalAmount,
            currency,
            status: 'REQUESTED',
            paymentMethod,
            bankInfo,
            publisherNote,
          },
        })

        await tx.publisherPaymentItem.createMany({
          data: orders.map((o) => ({
            paymentRequestId: req.id,
            actOrderId: o.id,
            publisherId,
            payout: o.payout,
            currency: o.currency,
            status: 'INCLUDED',
          })),
        })

        await tx.actOrder.updateMany({
          where: { id: { in: orderIds } },
          data: { paymentStatus: 'REQUESTED' },
        })

        return req
      })

      await recalculatePublisherBalance(prisma, publisherId)

      return reply.code(201).send(paymentRequest)
    }
  )
}
