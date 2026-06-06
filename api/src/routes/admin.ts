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

  server.get('/offers-summary', async () => {
    const grouped = await prisma.conversion.groupBy({
      by: ['offerId', 'status'],
      _count: { id: true },
      _sum: { commissionAmount: true, revenue: true },
    })

    const offerIds = [...new Set(grouped.map(g => g.offerId))]

    const [offers, pubGroups] = await Promise.all([
      prisma.offer.findMany({
        where: { id: { in: offerIds } },
        select: { id: true, name: true, mmpSource: true, commissionType: true, commissionValue: true, currency: true, status: true },
      }),
      prisma.conversion.groupBy({
        by: ['offerId', 'publisherId'],
        where: { offerId: { in: offerIds }, publisherId: { not: null } },
        _count: { id: true },
      }),
    ])

    const offerMap = Object.fromEntries(offers.map(o => [o.id, o]))
    const pubCountMap: Record<string, number> = {}
    for (const row of pubGroups) {
      pubCountMap[row.offerId] = (pubCountMap[row.offerId] ?? 0) + 1
    }

    const summary: Record<string, any> = {}
    for (const row of grouped) {
      if (!summary[row.offerId]) {
        const o = offerMap[row.offerId]
        summary[row.offerId] = {
          offerId: row.offerId,
          offerName: o?.name ?? 'Unknown',
          mmpSource: o?.mmpSource ?? '',
          commissionType: o?.commissionType ?? '',
          currency: o?.currency ?? 'USD',
          offerStatus: o?.status ?? '',
          total: 0, approved: 0, pending: 0, rejected: 0,
          commissionPaid: 0,
          totalRevenue: 0,
          publisherCount: pubCountMap[row.offerId] ?? 0,
        }
      }
      const s = summary[row.offerId]
      s.total += row._count.id
      if (row.status === 'APPROVED') {
        s.approved = row._count.id
        s.commissionPaid = parseFloat((row._sum.commissionAmount ?? 0).toFixed(2))
        s.totalRevenue = parseFloat((row._sum.revenue ?? 0).toFixed(2))
      }
      if (row.status === 'PENDING') s.pending = row._count.id
      if (row.status === 'REJECTED') s.rejected = row._count.id
    }

    return Object.values(summary).sort((a: any, b: any) => b.total - a.total)
  })

  server.post<{ Body: { name: string; appName: string; appId: string; mmpSource: string; commissionType: string; commissionValue: number; currency: string; destinationUrl?: string } }>(
    '/offers',
    async (request, reply) => {
      const { name, appName, appId, mmpSource, commissionType, commissionValue, currency, destinationUrl } = request.body
      if (!name || !appName || !appId || !mmpSource || !commissionType || commissionValue == null) {
        return reply.code(400).send({ error: 'Missing fields' })
      }
      try {
        const offer = await prisma.offer.create({
          data: { name, appName, appId, mmpSource: mmpSource as any, commissionType: commissionType as any, commissionValue, currency: currency || 'USD', destinationUrl: destinationUrl || null },
        })
        return reply.code(201).send(offer)
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.code(400).send({ error: 'An offer with this App ID / CityAds Offer ID already exists' })
        }
        throw err
      }
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

  // Update single conversion status
  server.put<{ Params: { id: string }; Body: { status: string } }>(
    '/conversions/:id',
    async (request, reply) => {
      const { id } = request.params
      const { status } = request.body
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(status)) {
        return reply.code(400).send({ error: 'Invalid status' })
      }
      const conversion = await prisma.conversion.update({
        where: { id },
        data: { status: status as any },
        include: { offer: { select: { name: true, mmpSource: true } }, publisher: { select: { name: true, email: true } } },
      })
      return conversion
    }
  )

  // Bulk status update by sourceRefId or id
  server.put<{ Body: { rows: Array<{ id?: string; sourceRefId?: string; status: string }> } }>(
    '/conversions/bulk-status',
    async (request, reply) => {
      const { rows } = request.body
      if (!Array.isArray(rows) || rows.length === 0) {
        return reply.code(400).send({ error: 'No rows provided' })
      }
      const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }

      for (const row of rows) {
        try {
          if (!['PENDING', 'APPROVED', 'REJECTED'].includes(row.status)) throw new Error(`Invalid status "${row.status}"`)
          if (!row.id && !row.sourceRefId) throw new Error('Must provide id or source_ref_id')

          const where = row.id ? { id: row.id } : { sourceType_sourceRefId: undefined as any }
          if (row.sourceRefId && !row.id) {
            const existing = await prisma.conversion.findFirst({ where: { sourceRefId: row.sourceRefId } })
            if (!existing) throw new Error(`source_ref_id "${row.sourceRefId}" not found`)
            await prisma.conversion.update({ where: { id: existing.id }, data: { status: row.status as any } })
          } else {
            await prisma.conversion.update({ where: { id: row.id }, data: { status: row.status as any } })
          }
          results.success++
        } catch (err: any) {
          results.failed++
          results.errors.push(`Row ${results.success + results.failed}: ${err.message}`)
        }
      }
      return results
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
