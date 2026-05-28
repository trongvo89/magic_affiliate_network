import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient } from '@prisma/client'

async function requireAdmin(request: FastifyRequest, reply: any) {
  try {
    await request.jwtVerify()
    if ((request.user as any).role !== 'ADMIN') return reply.code(403).send({ error: 'Forbidden' })
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

export default async function adminRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  server.addHook('preHandler', requireAdmin)

  // Stats
  server.get('/stats', async () => {
    const now = new Date()
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
    const start7d = new Date(now.getTime() - 7 * 86400000)
    const start30d = new Date(now.getTime() - 30 * 86400000)

    const [today, week, month, pendingPubs] = await Promise.all([
      prisma.conversion.aggregate({ where: { receivedAt: { gte: startOfDay } }, _sum: { revenue: true, commissionAmount: true }, _count: true }),
      prisma.conversion.aggregate({ where: { receivedAt: { gte: start7d } }, _sum: { revenue: true, commissionAmount: true }, _count: true }),
      prisma.conversion.aggregate({ where: { receivedAt: { gte: start30d } }, _sum: { revenue: true, commissionAmount: true }, _count: true }),
      prisma.user.count({ where: { status: 'PENDING', role: 'PUBLISHER' } }),
    ])

    return {
      today: { conversions: today._count, revenue: today._sum.revenue ?? 0, commission: today._sum.commissionAmount ?? 0 },
      week: { conversions: week._count, revenue: week._sum.revenue ?? 0, commission: week._sum.commissionAmount ?? 0 },
      month: { conversions: month._count, revenue: month._sum.revenue ?? 0, commission: month._sum.commissionAmount ?? 0 },
      pendingPublishers: pendingPubs,
    }
  })

  // Conversions list (paginated + filterable)
  server.get<{ Querystring: { page?: string; limit?: string; offerId?: string; publisherId?: string; status?: string; from?: string; to?: string } }>(
    '/conversions',
    async (request) => {
      const { page = '1', limit = '20', offerId, publisherId, status, from, to } = request.query
      const skip = (parseInt(page) - 1) * parseInt(limit)
      const where: any = {}
      if (offerId) where.offerId = offerId
      if (publisherId) where.publisherId = publisherId
      if (status) where.status = status
      if (from || to) where.eventAt = {}
      if (from) where.eventAt.gte = new Date(from)
      if (to) where.eventAt.lte = new Date(to)

      const [conversions, total] = await Promise.all([
        prisma.conversion.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { eventAt: 'desc' },
          include: { offer: { select: { name: true, mmpSource: true } }, publisher: { select: { name: true, email: true } } },
        }),
        prisma.conversion.count({ where }),
      ])

      return { conversions, total, page: parseInt(page), limit: parseInt(limit) }
    }
  )

  // Offers
  server.get('/offers', async () => {
    const offers = await prisma.offer.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { conversions: true } } },
    })
    return offers
  })

  server.post<{ Body: { name: string; appName: string; appId: string; mmpSource: string; commissionType: string; commissionValue: number; currency: string } }>(
    '/offers',
    async (request, reply) => {
      const { name, appName, appId, mmpSource, commissionType, commissionValue, currency } = request.body
      if (!name || !appName || !appId || !mmpSource || !commissionType || commissionValue == null) {
        return reply.code(400).send({ error: 'Missing fields' })
      }
      const offer = await prisma.offer.create({
        data: { name, appName, appId, mmpSource: mmpSource as any, commissionType: commissionType as any, commissionValue, currency: currency || 'USD' },
      })
      return reply.code(201).send(offer)
    }
  )

  server.put<{ Params: { id: string }; Body: Partial<{ name: string; commissionValue: number; status: string }> }>(
    '/offers/:id',
    async (request) => {
      const { id } = request.params
      const { name, commissionValue, status } = request.body
      const data: any = {}
      if (name !== undefined) data.name = name
      if (commissionValue !== undefined) data.commissionValue = commissionValue
      if (status !== undefined) data.status = status
      return prisma.offer.update({ where: { id }, data })
    }
  )

  // Manual conversion create (single)
  server.post<{ Body: { publisherId: string; offerId: string; eventType: string; revenue?: number; eventAt: string; sourceRefId?: string; status?: string } }>(
    '/conversions',
    async (request, reply) => {
      const { publisherId, offerId, eventType, revenue = 0, eventAt, sourceRefId, status = 'PENDING' } = request.body
      if (!publisherId || !offerId || !eventType || !eventAt) {
        return reply.code(400).send({ error: 'Missing required fields: publisherId, offerId, eventType, eventAt' })
      }
      const offer = await prisma.offer.findUnique({ where: { id: offerId } })
      if (!offer) return reply.code(404).send({ error: 'Offer not found' })

      const commissionAmount = offer.commissionType === 'FLAT_CPA'
        ? offer.commissionValue
        : parseFloat((revenue * offer.commissionValue / 100).toFixed(2))

      const conversion = await prisma.conversion.create({
        data: {
          sourceType: offer.mmpSource,
          sourceRefId: sourceRefId || `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          offerId,
          publisherId,
          eventType,
          revenue,
          commissionAmount,
          currency: offer.currency,
          status: status as any,
          rawPayload: { manual: true },
          eventAt: new Date(eventAt),
        },
        include: { offer: { select: { name: true, mmpSource: true } }, publisher: { select: { name: true, email: true } } },
      })
      return reply.code(201).send(conversion)
    }
  )

  // Manual conversion bulk upload (CSV rows as JSON)
  server.post<{ Body: { rows: Array<{ publisherId: string; offerId: string; eventType: string; revenue?: number; eventAt: string; sourceRefId?: string }> } }>(
    '/conversions/bulk',
    async (request, reply) => {
      const { rows } = request.body
      if (!Array.isArray(rows) || rows.length === 0) {
        return reply.code(400).send({ error: 'No rows provided' })
      }
      const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }

      for (const row of rows) {
        try {
          const offer = await prisma.offer.findUnique({ where: { id: row.offerId } })
          if (!offer) throw new Error(`Offer "${row.offerId}" not found`)
          const revenue = row.revenue || 0
          const commissionAmount = offer.commissionType === 'FLAT_CPA'
            ? offer.commissionValue
            : parseFloat((revenue * offer.commissionValue / 100).toFixed(2))

          await prisma.conversion.create({
            data: {
              sourceType: offer.mmpSource,
              sourceRefId: row.sourceRefId || `manual-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              offerId: row.offerId,
              publisherId: row.publisherId,
              eventType: row.eventType,
              revenue,
              commissionAmount,
              currency: offer.currency,
              status: 'PENDING',
              rawPayload: { manual: true, bulk: true },
              eventAt: new Date(row.eventAt),
            },
          })
          results.success++
        } catch (err: any) {
          results.failed++
          results.errors.push(`Row ${results.success + results.failed}: ${err.message}`)
        }
      }
      return results
    }
  )

  // Publishers
  server.get('/publishers', async () => {
    return prisma.user.findMany({
      where: { role: 'PUBLISHER' },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { conversions: true } }, conversions: { select: { commissionAmount: true } } },
    })
  })

  server.put<{ Params: { id: string }; Body: { status: string } }>(
    '/publishers/:id',
    async (request) => {
      const { id } = request.params
      const { status } = request.body
      return prisma.user.update({ where: { id }, data: { status: status as any } })
    }
  )

  // Pending publishers quick list
  server.get('/publishers/pending', async () => {
    return prisma.user.findMany({ where: { status: 'PENDING', role: 'PUBLISHER' }, orderBy: { createdAt: 'asc' } })
  })
}
