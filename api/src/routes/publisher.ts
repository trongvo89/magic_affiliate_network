import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function requireActivePublisher(request: FastifyRequest, reply: any) {
  try {
    await request.jwtVerify()
    const user = request.user as any
    if (user.role !== 'PUBLISHER') return reply.code(403).send({ error: 'Forbidden' })
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

export default async function publisherRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  server.addHook('preHandler', requireActivePublisher)

  server.get<{ Querystring: { from?: string; to?: string } }>('/stats', async (request) => {
    const { id } = request.user as any
    const { from, to } = request.query

    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 86400000)
    const fromDate = from ? new Date(from) : defaultFrom
    const toDate = to ? (() => { const d = new Date(to); d.setHours(23, 59, 59, 999); return d })() : now

    const dateRange = { gte: fromDate, lte: toDate }

    const [rangeConv, rangeApproved, rangeClicks, totalApprovedAgg] = await Promise.all([
      prisma.conversion.aggregate({ where: { publisherId: id, eventAt: dateRange }, _sum: { commissionAmount: true }, _count: true }),
      prisma.conversion.aggregate({ where: { publisherId: id, status: 'APPROVED', eventAt: dateRange }, _sum: { commissionAmount: true }, _count: true }),
      prisma.click.count({ where: { publisherId: id, clickedAt: dateRange } }),
      prisma.conversion.aggregate({ where: { publisherId: id, status: 'APPROVED' }, _sum: { commissionAmount: true } }),
    ])

    const approvedCount = rangeApproved._count
    const approvedEarned = rangeApproved._sum.commissionAmount ?? 0
    return {
      range: {
        conversions: rangeConv._count,
        clicks: rangeClicks,
        earned: rangeConv._sum.commissionAmount ?? 0,
        approvedConversions: approvedCount,
        approvedEarned,
      },
      totalApproved: totalApprovedAgg._sum.commissionAmount ?? 0,
      cvr: rangeClicks > 0 ? parseFloat(((approvedCount / rangeClicks) * 100).toFixed(2)) : 0,
      epc: rangeClicks > 0 ? parseFloat((approvedEarned / rangeClicks).toFixed(4)) : 0,
    }
  })

  server.get<{ Querystring: { page?: string; limit?: string } }>('/conversions', async (request) => {
    const { id } = request.user as any
    const { page = '1', limit = '30' } = request.query
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [conversions, total] = await Promise.all([
      prisma.conversion.findMany({
        where: { publisherId: id },
        skip,
        take: parseInt(limit),
        orderBy: { eventAt: 'desc' },
        include: { offer: { select: { name: true, mmpSource: true } } },
      }),
      prisma.conversion.count({ where: { publisherId: id } }),
    ])

    return { conversions, total, page: parseInt(page), limit: parseInt(limit) }
  })

  server.get('/offers-summary', async (request) => {
    const { id } = request.user as any

    const grouped = await prisma.conversion.groupBy({
      by: ['offerId', 'status'],
      where: { publisherId: id },
      _count: { id: true },
      _sum: { commissionAmount: true, revenue: true },
    })

    const offerIds = [...new Set(grouped.map(g => g.offerId))]
    const offers = await prisma.offer.findMany({
      where: { id: { in: offerIds } },
      select: { id: true, name: true, mmpSource: true, currency: true },
    })
    const offerMap = Object.fromEntries(offers.map(o => [o.id, o]))

    const summary: Record<string, any> = {}
    for (const row of grouped) {
      if (!summary[row.offerId]) {
        const o = offerMap[row.offerId]
        summary[row.offerId] = {
          offerId: row.offerId,
          offerName: o?.name ?? 'Unknown',
          mmpSource: o?.mmpSource ?? '',
          currency: o?.currency ?? 'USD',
          total: 0, approved: 0, pending: 0, rejected: 0,
          commissionEarned: 0,
          totalRevenue: 0,
        }
      }
      const s = summary[row.offerId]
      s.total += row._count.id
      if (row.status === 'APPROVED') {
        s.approved = row._count.id
        s.commissionEarned = parseFloat((row._sum.commissionAmount ?? 0).toFixed(2))
        s.totalRevenue = parseFloat((row._sum.revenue ?? 0).toFixed(2))
      }
      if (row.status === 'PENDING') s.pending = row._count.id
      if (row.status === 'REJECTED') s.rejected = row._count.id
    }

    return Object.values(summary).sort((a: any, b: any) => b.total - a.total)
  })

  server.get('/cityads-offers', async () => {
    const offers = await prisma.offer.findMany({
      where: { mmpSource: 'CITYADS', status: 'ACTIVE' },
      select: { id: true, name: true, appName: true, pubCommissionDisplay: true },
      orderBy: { createdAt: 'desc' },
    })
    return offers
  })

  server.get('/profile', async (request) => {
    const { id } = request.user as any
    const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true, postbackUrl: true, status: true, createdAt: true } })
    return user
  })

  server.put<{ Body: { name?: string; postbackUrl?: string; password?: string; currentPassword?: string } }>(
    '/profile',
    async (request, reply) => {
      const { id } = request.user as any
      const { name, postbackUrl, password, currentPassword } = request.body

      const data: any = {}
      if (name) data.name = name
      if (postbackUrl !== undefined) data.postbackUrl = postbackUrl

      if (password) {
        if (!currentPassword) return reply.code(400).send({ error: 'Current password required' })
        const user = await prisma.user.findUnique({ where: { id } })
        const valid = await bcrypt.compare(currentPassword, user!.password)
        if (!valid) return reply.code(400).send({ error: 'Invalid current password' })
        data.password = await bcrypt.hash(password, 10)
      }

      const updated = await prisma.user.update({ where: { id }, data, select: { id: true, email: true, name: true, postbackUrl: true } })
      return updated
    }
  )
}
