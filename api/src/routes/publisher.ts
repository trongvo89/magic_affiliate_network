import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient, Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { auditLog } from '../lib/audit'

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

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

  server.addHook('preHandler', async (request: FastifyRequest, reply) => {
    const user = request.user as any
    if (user?.impersonatedBy && request.method !== 'GET') {
      return reply.code(403).send({ error: 'Read-only: admin impersonation mode' })
    }
  })

  server.get<{ Querystring: { from?: string; to?: string; offerId?: string } }>('/stats', async (request) => {
    const { id } = request.user as any
    const { from, to, offerId } = request.query

    const now = new Date()
    const defaultFrom = new Date(now.getTime() - 30 * 86400000)
    const fromDate = parseDate(from) ?? defaultFrom
    const toDate = (() => { const d = parseDate(to) ?? now; d.setHours(23, 59, 59, 999); return d })()

    const dateRange = { gte: fromDate, lte: toDate }
    const convWhere: any = { publisherId: id, eventAt: dateRange }
    const clickWhere: any = { publisherId: id, clickedAt: dateRange }
    if (offerId) { convWhere.offerId = offerId; clickWhere.offerId = offerId }

    const [rangeConv, rangeApproved, rangeClicks, totalApprovedByCur] = await Promise.all([
      prisma.conversion.groupBy({ by: ['currency'], where: convWhere, _sum: { commissionAmount: true }, _count: { _all: true } }),
      prisma.conversion.groupBy({ by: ['currency'], where: { ...convWhere, status: 'APPROVED' }, _sum: { commissionAmount: true }, _count: { _all: true } }),
      prisma.click.count({ where: clickWhere }),
      prisma.conversion.groupBy({ by: ['currency'], where: { publisherId: id, status: 'APPROVED', ...(offerId ? { offerId } : {}) }, _sum: { commissionAmount: true }, _count: { _all: true } }),
    ])

    const totalConversions = rangeConv.reduce((s, r) => s + r._count._all, 0)
    const approvedCount = rangeApproved.reduce((s, r) => s + r._count._all, 0)

    const earnedByCurrency: Record<string, number> = {}
    for (const r of rangeConv) earnedByCurrency[r.currency || 'USD'] = r._sum.commissionAmount ?? 0

    const approvedEarnedByCurrency: Record<string, number> = {}
    for (const r of rangeApproved) approvedEarnedByCurrency[r.currency || 'USD'] = r._sum.commissionAmount ?? 0

    const totalApprovedByCurrency: Record<string, number> = {}
    for (const r of totalApprovedByCur) totalApprovedByCurrency[r.currency || 'USD'] = r._sum.commissionAmount ?? 0

    // Primary currency = the one with the most approved earnings
    const primaryCurrency = Object.entries(approvedEarnedByCurrency).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'USD'
    const approvedEarned = approvedEarnedByCurrency[primaryCurrency] ?? 0

    return {
      range: {
        conversions: totalConversions,
        clicks: rangeClicks,
        earned: earnedByCurrency[primaryCurrency] ?? 0,
        earnedByCurrency,
        approvedConversions: approvedCount,
        approvedEarned,
        approvedEarnedByCurrency,
      },
      totalApproved: totalApprovedByCurrency[primaryCurrency] ?? 0,
      totalApprovedByCurrency,
      primaryCurrency,
      cvr: rangeClicks > 0 ? parseFloat(((approvedCount / rangeClicks) * 100).toFixed(2)) : 0,
      epc: rangeClicks > 0 ? parseFloat((approvedEarned / rangeClicks).toFixed(4)) : 0,
    }
  })

  // Daily time-series for publisher charts
  server.get<{ Querystring: { from?: string; to?: string; offerId?: string } }>('/stats/daily', async (request) => {
    const { id } = request.user as any
    const { from, to, offerId } = request.query
    const now = new Date()
    const fromDate = parseDate(from) ?? new Date(now.getTime() - 30 * 86400000)
    const toDate = (() => { const d = parseDate(to) ?? now; d.setHours(23, 59, 59, 999); return d })()

    const offerFilter = offerId ? Prisma.sql`AND "offerId" = ${offerId}` : Prisma.empty

    const [convRows, clickRows] = await Promise.all([
      prisma.$queryRaw<Array<{ d: string; cur: string; cnt: bigint; comm: number }>>`
        SELECT DATE("eventAt") as d, "currency" as cur, COUNT(*)::int as cnt, COALESCE(SUM("commissionAmount"),0) as comm
        FROM "Conversion" WHERE "publisherId" = ${id} AND "eventAt" >= ${fromDate} AND "eventAt" <= ${toDate} ${offerFilter}
        GROUP BY DATE("eventAt"), "currency" ORDER BY d`,
      prisma.$queryRaw<Array<{ d: string; cnt: bigint }>>`
        SELECT DATE("clickedAt") as d, COUNT(*)::int as cnt
        FROM "Click" WHERE "publisherId" = ${id} AND "clickedAt" >= ${fromDate} AND "clickedAt" <= ${toDate} ${offerFilter}
        GROUP BY DATE("clickedAt") ORDER BY d`,
    ])

    const days = Math.ceil((toDate.getTime() - fromDate.getTime()) / 86400000) + 1
    const map = new Map<string, { date: string; clicks: number; conversions: number; commissionByCurrency: Record<string, number> }>()
    for (let i = 0; i < days; i++) {
      const d = new Date(fromDate.getTime() + i * 86400000).toISOString().slice(0, 10)
      map.set(d, { date: d, clicks: 0, conversions: 0, commissionByCurrency: {} })
    }
    for (const r of convRows) {
      const key = new Date(r.d).toISOString().slice(0, 10)
      const entry = map.get(key)
      if (entry) {
        entry.conversions += Number(r.cnt)
        const cur = r.cur || 'USD'
        entry.commissionByCurrency[cur] = (entry.commissionByCurrency[cur] || 0) + Number(r.comm)
      }
    }
    for (const r of clickRows) {
      const key = new Date(r.d).toISOString().slice(0, 10)
      const entry = map.get(key)
      if (entry) entry.clicks = Number(r.cnt)
    }

    return { daily: Array.from(map.values()) }
  })

  server.get<{ Querystring: { page?: string; limit?: string; offerId?: string; from?: string; to?: string } }>('/conversions', async (request) => {
    const { id } = request.user as any
    const { page = '1', limit = '30', offerId, from, to } = request.query
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const where: any = { publisherId: id }
    if (offerId) where.offerId = offerId
    if (from || to) {
      where.eventAt = {}
      if (from) where.eventAt.gte = new Date(from + 'T00:00:00Z')
      if (to) where.eventAt.lte = new Date(to + 'T23:59:59Z')
    }

    const [conversions, total] = await Promise.all([
      prisma.conversion.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { eventAt: 'desc' },
        include: { offer: { select: { name: true, mmpSource: true } } },
      }),
      prisma.conversion.count({ where }),
    ])

    return { conversions, total, page: parseInt(page), limit: parseInt(limit) }
  })

  server.get<{ Querystring: { offerId?: string; status?: string; from?: string; to?: string } }>(
    '/conversions/export',
    async (request, reply) => {
      const { id } = request.user as any
      const { offerId, status, from, to } = request.query
      const where: any = { publisherId: id }
      if (offerId) where.offerId = offerId
      if (status) where.status = status
      if (from || to) {
        where.eventAt = {}
        const gteDate = parseDate(from); if (gteDate) where.eventAt.gte = gteDate
        const lteDate = parseDate(to); if (lteDate) { lteDate.setHours(23, 59, 59, 999); where.eventAt.lte = lteDate }
      }

      const convs = await prisma.conversion.findMany({
        where,
        orderBy: [{ offerId: 'asc' }, { status: 'asc' }, { eventAt: 'desc' }],
        include: { offer: { select: { name: true } } },
      })

      const esc = (v: any): string => {
        const s = String(v ?? '')
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const header = 'date,offer_id,offer_name,event_type,revenue,commission,currency,status,source_ref_id'
      const rows = convs.map(c => [
        new Date(c.eventAt).toISOString(),
        c.offerId,
        c.offer?.name ?? '',
        c.eventType,
        c.revenue,
        c.commissionAmount,
        c.currency,
        c.status,
        c.sourceRefId,
      ].map(esc).join(','))

      const csv = [header, ...rows].join('\n')
      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', `attachment; filename="my_conversions_${new Date().toISOString().slice(0, 10)}.csv"`)
      return reply.send(csv)
    }
  )

  server.get<{ Querystring: { from?: string; to?: string } }>('/offers-summary', async (request) => {
    const { id } = request.user as any
    const { from, to } = request.query

    const buildRange = () => {
      if (!from && !to) return null
      const r: any = {}
      const gteDate = parseDate(from)
      const lteDate = parseDate(to)
      if (gteDate) r.gte = gteDate
      if (lteDate) { lteDate.setHours(23, 59, 59, 999); r.lte = lteDate }
      if (!r.gte && !r.lte) return null
      return r
    }
    const range = buildRange()
    const convWhere: any = { publisherId: id }
    const clickWhere: any = { publisherId: id }
    if (range) { convWhere.eventAt = range; clickWhere.clickedAt = range }

    const [grouped, clickGroups] = await Promise.all([
      prisma.conversion.groupBy({
        by: ['offerId', 'status'],
        where: convWhere,
        _count: { id: true },
        _sum: { commissionAmount: true, revenue: true },
      }),
      prisma.click.groupBy({
        by: ['offerId'],
        where: clickWhere,
        _count: { id: true },
      }),
    ])

    const convOfferIds = grouped.map(g => g.offerId)
    const clickOfferIds = clickGroups.map(g => g.offerId).filter((oid): oid is string => oid !== null)
    const offerIds = [...new Set([...convOfferIds, ...clickOfferIds])]

    const offers = await prisma.offer.findMany({
      where: { id: { in: offerIds }, status: 'ACTIVE' },
      select: { id: true, name: true, mmpSource: true, currency: true },
    })
    const offerMap = Object.fromEntries(offers.map(o => [o.id, o]))

    const clickMap: Record<string, number> = {}
    for (const g of clickGroups) {
      if (g.offerId) clickMap[g.offerId] = g._count.id
    }

    const summary: Record<string, any> = {}

    for (const offerId of clickOfferIds) {
      const o = offerMap[offerId]
      if (!o) continue
      summary[offerId] = {
        offerId, offerName: o.name, mmpSource: o.mmpSource, currency: o.currency,
        total: 0, approved: 0, pending: 0, rejected: 0, commissionEarned: 0, totalRevenue: 0,
        clicks: clickMap[offerId] ?? 0,
      }
    }

    for (const row of grouped) {
      if (!summary[row.offerId]) {
        const o = offerMap[row.offerId]
        if (!o) continue
        summary[row.offerId] = {
          offerId: row.offerId, offerName: o.name, mmpSource: o.mmpSource, currency: o.currency,
          total: 0, approved: 0, pending: 0, rejected: 0, commissionEarned: 0, totalRevenue: 0,
          clicks: clickMap[row.offerId] ?? 0,
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

    for (const row of Object.values(summary)) {
      const clicks = (row.clicks ?? 0) as number
      row.cvr = clicks > 0 ? parseFloat(((row.approved / clicks) * 100).toFixed(2)) : 0
      row.epc = clicks > 0 ? parseFloat((row.commissionEarned / clicks).toFixed(4)) : 0
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

  server.get('/offers-list', async () => {
    const offers = await prisma.offer.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, appName: true, pubCommissionDisplay: true, currency: true, logoUrl: true },
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
        data.password = await bcrypt.hash(password, 12)
      }

      const before = await prisma.user.findUnique({ where: { id }, select: { postbackUrl: true, name: true } })
      const updated = await prisma.user.update({ where: { id }, data, select: { id: true, email: true, name: true, postbackUrl: true } })
      const changes: Record<string, any> = {}
      if (postbackUrl !== undefined && postbackUrl !== before?.postbackUrl) changes.postbackUrl = { from: before?.postbackUrl, to: postbackUrl }
      if (name && name !== before?.name) changes.name = { from: before?.name, to: name }
      if (Object.keys(changes).length > 0) {
        const user = request.user as any
        await auditLog(prisma, { userId: id, userName: user.name || user.email, action: 'UPDATE', entity: 'User', entityId: id, changes })
      }
      return updated
    }
  )
}
