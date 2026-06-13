import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient } from '@prisma/client'

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

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

    const [todayByCur, weekByCur, monthByCur, pendingPubs] = await Promise.all([
      prisma.conversion.groupBy({ by: ['currency'], where: { receivedAt: { gte: startOfDay } }, _sum: { revenue: true, commissionAmount: true }, _count: { _all: true } }),
      prisma.conversion.groupBy({ by: ['currency'], where: { receivedAt: { gte: start7d } }, _sum: { revenue: true, commissionAmount: true }, _count: { _all: true } }),
      prisma.conversion.groupBy({ by: ['currency'], where: { receivedAt: { gte: start30d } }, _sum: { revenue: true, commissionAmount: true }, _count: { _all: true } }),
      prisma.user.count({ where: { status: 'PENDING', role: 'PUBLISHER' } }),
    ])

    function buildStats(rows: any[]) {
      const byCurrency: Record<string, { conversions: number; revenue: number; commission: number }> = {}
      let totalConversions = 0
      for (const row of rows) {
        const cur = row.currency || 'USD'
        byCurrency[cur] = {
          conversions: row._count._all,
          revenue: row._sum.revenue ?? 0,
          commission: row._sum.commissionAmount ?? 0,
        }
        totalConversions += row._count._all
      }
      return { conversions: totalConversions, byCurrency }
    }

    return {
      today: buildStats(todayByCur),
      week: buildStats(weekByCur),
      month: buildStats(monthByCur),
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
      if (from || to) {
        where.eventAt = {}
        const gteDate = parseDate(from); if (gteDate) where.eventAt.gte = gteDate
        const lteDate = parseDate(to); if (lteDate) where.eventAt.lte = lteDate
      }

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

  // Export conversions as CSV
  server.get<{ Querystring: { offerId?: string; publisherId?: string; status?: string; from?: string; to?: string } }>(
    '/conversions/export',
    async (request, reply) => {
      const { offerId, publisherId, status, from, to } = request.query
      const where: any = {}
      if (offerId) where.offerId = offerId
      if (publisherId) where.publisherId = publisherId
      if (status) where.status = status
      if (from || to) {
        where.eventAt = {}
        const gteDate = parseDate(from); if (gteDate) where.eventAt.gte = gteDate
        const lteDate = parseDate(to); if (lteDate) { lteDate.setHours(23, 59, 59, 999); where.eventAt.lte = lteDate }
      }

      const convs = await prisma.conversion.findMany({
        where,
        orderBy: [{ offerId: 'asc' }, { status: 'asc' }, { eventAt: 'desc' }],
        include: { offer: { select: { name: true } }, publisher: { select: { name: true, email: true } } },
      })

      const esc = (v: any): string => {
        const s = String(v ?? '')
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const header = 'date,offer_id,offer_name,mmp_source,publisher_id,publisher_name,publisher_email,event_type,revenue,commission,currency,status,source_ref_id'
      const rows = convs.map(c => [
        new Date(c.eventAt).toISOString(),
        c.offerId,
        c.offer?.name ?? '',
        c.sourceType,
        c.publisherId ?? '',
        c.publisher?.name ?? '',
        c.publisher?.email ?? '',
        c.eventType,
        c.revenue,
        c.commissionAmount,
        c.currency,
        c.status,
        c.sourceRefId,
      ].map(esc).join(','))

      const csv = [header, ...rows].join('\n')
      reply.header('Content-Type', 'text/csv')
      reply.header('Content-Disposition', `attachment; filename="conversions_${new Date().toISOString().slice(0, 10)}.csv"`)
      return reply.send(csv)
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

  server.get<{ Querystring: { from?: string; to?: string } }>('/offers-summary', async (request) => {
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
    const convWhere: any = range ? { eventAt: range } : {}
    const clickWhere: any = range ? { clickedAt: range } : {}

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
    const clickOfferIds = clickGroups.map(g => g.offerId).filter((id): id is string => id !== null)
    const offerIds = [...new Set([...convOfferIds, ...clickOfferIds])]

    const [offers, pubGroups] = await Promise.all([
      prisma.offer.findMany({
        where: { id: { in: offerIds } },
        select: { id: true, name: true, mmpSource: true, commissionType: true, commissionValue: true, currency: true, status: true },
      }),
      prisma.conversion.groupBy({
        by: ['offerId', 'publisherId'],
        where: { ...convWhere, offerId: { in: offerIds }, publisherId: { not: null } },
        _count: { id: true },
      }),
    ])

    const offerMap = Object.fromEntries(offers.map(o => [o.id, o]))
    const pubCountMap: Record<string, number> = {}
    for (const row of pubGroups) {
      pubCountMap[row.offerId] = (pubCountMap[row.offerId] ?? 0) + 1
    }
    const clickMap: Record<string, number> = {}
    for (const g of clickGroups) {
      if (g.offerId) clickMap[g.offerId] = g._count.id
    }

    const summary: Record<string, any> = {}

    for (const offerId of clickOfferIds) {
      const o = offerMap[offerId]
      if (!o) continue
      summary[offerId] = {
        offerId, offerName: o.name, mmpSource: o.mmpSource, commissionType: o.commissionType,
        currency: o.currency, offerStatus: o.status,
        total: 0, approved: 0, pending: 0, rejected: 0, commissionPaid: 0, totalRevenue: 0,
        publisherCount: pubCountMap[offerId] ?? 0, clicks: clickMap[offerId] ?? 0,
      }
    }

    for (const row of grouped) {
      if (!summary[row.offerId]) {
        const o = offerMap[row.offerId]
        if (!o) continue
        summary[row.offerId] = {
          offerId: row.offerId, offerName: o.name, mmpSource: o.mmpSource, commissionType: o.commissionType,
          currency: o.currency, offerStatus: o.status,
          total: 0, approved: 0, pending: 0, rejected: 0, commissionPaid: 0, totalRevenue: 0,
          publisherCount: pubCountMap[row.offerId] ?? 0, clicks: clickMap[row.offerId] ?? 0,
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

    for (const row of Object.values(summary)) {
      const clicks = (row.clicks ?? 0) as number
      row.cvr = clicks > 0 ? parseFloat(((row.approved / clicks) * 100).toFixed(2)) : 0
      row.epc = clicks > 0 ? parseFloat((row.commissionPaid / clicks).toFixed(4)) : 0
    }

    return Object.values(summary).sort((a: any, b: any) => b.total - a.total)
  })

  server.get<{ Params: { id: string }; Querystring: { from?: string; to?: string } }>(
    '/offers/:id/publisher-breakdown',
    async (request) => {
      const { id: offerId } = request.params
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
      const clickWhere: any = { offerId }
      const convWhere: any = { offerId, publisherId: { not: null } }
      if (range) { clickWhere.clickedAt = range; convWhere.eventAt = range }

      const [clickGroups, convGroups] = await Promise.all([
        prisma.click.groupBy({ by: ['publisherId'], where: clickWhere, _count: { id: true } }),
        prisma.conversion.groupBy({
          by: ['publisherId', 'status'],
          where: convWhere,
          _count: { id: true },
          _sum: { commissionAmount: true },
        }),
      ])

      const pubIds = [...new Set([
        ...clickGroups.map(g => g.publisherId).filter((id): id is string => id !== null),
        ...convGroups.map(g => g.publisherId).filter((id): id is string => id !== null),
      ])]

      const publishers = await prisma.user.findMany({
        where: { id: { in: pubIds } },
        select: { id: true, name: true, email: true },
      })
      const pubMap = Object.fromEntries(publishers.map(p => [p.id, p]))

      const clickMap: Record<string, number> = {}
      for (const g of clickGroups) {
        if (g.publisherId) clickMap[g.publisherId] = g._count.id
      }

      const convMap: Record<string, { approved: number; pending: number; rejected: number; commission: number }> = {}
      for (const g of convGroups) {
        if (!g.publisherId) continue
        if (!convMap[g.publisherId]) convMap[g.publisherId] = { approved: 0, pending: 0, rejected: 0, commission: 0 }
        if (g.status === 'APPROVED') { convMap[g.publisherId].approved = g._count.id; convMap[g.publisherId].commission = parseFloat((g._sum.commissionAmount ?? 0).toFixed(2)) }
        if (g.status === 'PENDING') convMap[g.publisherId].pending = g._count.id
        if (g.status === 'REJECTED') convMap[g.publisherId].rejected = g._count.id
      }

      return pubIds.map(pubId => {
        const clicks = clickMap[pubId] ?? 0
        const conv = convMap[pubId] ?? { approved: 0, pending: 0, rejected: 0, commission: 0 }
        const pub = pubMap[pubId]
        return {
          publisherId: pubId,
          publisherName: pub?.name ?? 'Unknown',
          publisherEmail: pub?.email ?? '',
          clicks,
          approved: conv.approved,
          pending: conv.pending,
          rejected: conv.rejected,
          commission: conv.commission,
          cvr: clicks > 0 ? parseFloat(((conv.approved / clicks) * 100).toFixed(2)) : 0,
          epc: clicks > 0 ? parseFloat((conv.commission / clicks).toFixed(4)) : 0,
        }
      }).sort((a, b) => (b.approved + b.clicks) - (a.approved + a.clicks))
    }
  )

  server.post<{ Body: { name: string; appName: string; appId: string; mmpSource: string; commissionType: string; commissionValue: number; currency: string; destinationUrl?: string; pubCommissionDisplay?: string } }>(
    '/offers',
    async (request, reply) => {
      const { name, appName, appId, mmpSource, commissionType, commissionValue, currency, destinationUrl, pubCommissionDisplay } = request.body
      if (!name || !appName || !appId || !mmpSource || !commissionType || commissionValue == null) {
        return reply.code(400).send({ error: 'Missing fields' })
      }
      if (!['APPSFLYER', 'ADJUST', 'CITYADS'].includes(mmpSource)) {
        return reply.code(400).send({ error: 'Invalid MMP source' })
      }
      if (!['FLAT_CPA', 'PERCENT_REVENUE'].includes(commissionType)) {
        return reply.code(400).send({ error: 'Invalid commission type' })
      }
      if (commissionType === 'PERCENT_REVENUE' && (commissionValue <= 0 || commissionValue > 100)) {
        return reply.code(400).send({ error: 'Revenue share must be between 0 and 100' })
      }
      if (commissionType === 'FLAT_CPA' && (commissionValue < 0 || commissionValue > 1_000_000)) {
        return reply.code(400).send({ error: 'CPA value out of range' })
      }
      if (destinationUrl) {
        try { new URL(destinationUrl) } catch { return reply.code(400).send({ error: 'Invalid destination URL' }) }
      }
      try {
        const offer = await prisma.offer.create({
          data: { name, appName, appId, mmpSource: mmpSource as any, commissionType: commissionType as any, commissionValue, currency: currency || 'USD', destinationUrl: destinationUrl || null, pubCommissionDisplay: pubCommissionDisplay || null },
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

  server.put<{ Params: { id: string }; Body: Partial<{ name: string; appName: string; appId: string; mmpSource: string; commissionType: string; commissionValue: number; currency: string; status: string; destinationUrl: string | null; pubCommissionDisplay: string | null }> }>(
    '/offers/:id',
    async (request, reply) => {
      const { id } = request.params
      const { name, appName, appId, mmpSource, commissionType, commissionValue, currency, status, destinationUrl, pubCommissionDisplay } = request.body
      const data: any = {}
      if (name !== undefined) data.name = name
      if (appName !== undefined) data.appName = appName
      if (appId !== undefined) data.appId = appId
      if (mmpSource !== undefined) data.mmpSource = mmpSource
      if (commissionType !== undefined) data.commissionType = commissionType
      if (commissionValue !== undefined) data.commissionValue = commissionValue
      if (currency !== undefined) data.currency = currency
      if (status !== undefined) data.status = status
      if (destinationUrl !== undefined) data.destinationUrl = destinationUrl || null
      if (pubCommissionDisplay !== undefined) data.pubCommissionDisplay = pubCommissionDisplay || null
      try {
        return await prisma.offer.update({ where: { id }, data })
      } catch (err: any) {
        if (err.code === 'P2002') {
          return reply.code(400).send({ error: 'An offer with this App ID / CityAds Offer ID already exists' })
        }
        throw err
      }
    }
  )

  server.delete<{ Params: { id: string } }>(
    '/offers/:id',
    async (request, reply) => {
      const { id } = request.params
      await prisma.offer.delete({ where: { id } })
      return reply.code(204).send()
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
      if (rows.length > 500) {
        return reply.code(400).send({ error: 'Bulk limit is 500 rows per request' })
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
  server.post<{ Body: { rows: Array<{ publisherId: string; offerId: string; eventType: string; revenue?: number; eventAt: string; sourceRefId?: string; status?: string }>; validateFrom?: string; validateTo?: string } }>(
    '/conversions/bulk',
    async (request, reply) => {
      const { rows, validateFrom, validateTo } = request.body
      if (!Array.isArray(rows) || rows.length === 0) {
        return reply.code(400).send({ error: 'No rows provided' })
      }
      if (rows.length > 500) {
        return reply.code(400).send({ error: 'Bulk limit is 500 rows per request' })
      }
      const fromDate = parseDate(validateFrom)
      const toDateBound = parseDate(validateTo)
      if (toDateBound) toDateBound.setHours(23, 59, 59, 999)

      const validStatuses = ['PENDING', 'APPROVED', 'REJECTED']
      const results: { success: number; failed: number; errors: string[] } = { success: 0, failed: 0, errors: [] }

      for (const row of rows) {
        try {
          const eventDate = new Date(row.eventAt)
          if (isNaN(eventDate.getTime())) throw new Error('Invalid event_at date')
          if (fromDate && eventDate < fromDate) throw new Error(`event_at ${row.eventAt} is before validateFrom`)
          if (toDateBound && eventDate > toDateBound) throw new Error(`event_at ${row.eventAt} is after validateTo`)

          const offer = await prisma.offer.findUnique({ where: { id: row.offerId } })
          if (!offer) throw new Error(`Offer "${row.offerId}" not found`)
          const revenue = row.revenue || 0
          const commissionAmount = offer.commissionType === 'FLAT_CPA'
            ? offer.commissionValue
            : parseFloat((revenue * offer.commissionValue / 100).toFixed(2))

          const rowStatus = row.status && validStatuses.includes(row.status.toUpperCase())
            ? row.status.toUpperCase()
            : 'PENDING'

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
              status: rowStatus as any,
              rawPayload: { manual: true, bulk: true },
              eventAt: eventDate,
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

  // Per-publisher click + conversion stats (for CVR/EPC)
  server.get<{ Querystring: { from?: string; to?: string } }>('/publisher-stats', async (request) => {
    const { from, to } = request.query
    const clickWhere: any = {}
    const convWhere: any = { publisherId: { not: null }, status: 'APPROVED' }
    if (from || to) {
      const range: any = {}
      const gteDate = parseDate(from); if (gteDate) range.gte = gteDate
      const lteDate = parseDate(to); if (lteDate) { lteDate.setHours(23, 59, 59, 999); range.lte = lteDate }
      if (range.gte || range.lte) { clickWhere.clickedAt = range; convWhere.eventAt = range }
    }

    const [clickGroups, approvedGroups] = await Promise.all([
      prisma.click.groupBy({ by: ['publisherId'], where: clickWhere, _count: { id: true } }),
      prisma.conversion.groupBy({
        by: ['publisherId'],
        where: convWhere,
        _count: { id: true },
        _sum: { commissionAmount: true },
      }),
    ])

    const clickMap: Record<string, number> = {}
    for (const g of clickGroups) {
      if (g.publisherId) clickMap[g.publisherId] = g._count.id
    }
    const approvedMap: Record<string, { count: number; commission: number }> = {}
    for (const g of approvedGroups) {
      if (g.publisherId) approvedMap[g.publisherId] = { count: g._count.id, commission: g._sum.commissionAmount ?? 0 }
    }

    const allIds = [...new Set([...Object.keys(clickMap), ...Object.keys(approvedMap)])]
    return allIds.map(pubId => {
      const clicks = clickMap[pubId] ?? 0
      const approved = approvedMap[pubId] ?? { count: 0, commission: 0 }
      return {
        publisherId: pubId,
        clicks,
        approvedConversions: approved.count,
        totalCommission: approved.commission,
        cvr: clicks > 0 ? parseFloat(((approved.count / clicks) * 100).toFixed(2)) : 0,
        epc: clicks > 0 ? parseFloat((approved.commission / clicks).toFixed(4)) : 0,
      }
    })
  })

  // All users (for team management)
  server.get('/users', async () => {
    return prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    })
  })

  server.put<{ Params: { id: string }; Body: { role?: string; status?: string } }>(
    '/users/:id',
    async (request, reply) => {
      const requesterId = (request.user as any).id
      const { id } = request.params
      const { role, status } = request.body

      if (role && role !== 'ADMIN' && role !== 'PUBLISHER') {
        return reply.code(400).send({ error: 'Invalid role' })
      }

      // Prevent self-demotion
      if (role === 'PUBLISHER' && id === requesterId) {
        return reply.code(400).send({ error: 'Cannot remove your own admin role' })
      }

      // Prevent demoting the last admin
      if (role === 'PUBLISHER') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } })
        if (adminCount <= 1) {
          return reply.code(400).send({ error: 'Cannot demote the last admin' })
        }
      }

      const data: any = {}
      if (role) data.role = role
      if (status) data.status = status

      const updated = await prisma.user.update({
        where: { id },
        data,
        select: { id: true, name: true, email: true, role: true, status: true },
      })

      if (role) {
        console.log(`[audit] admin ${requesterId} changed role of user ${id} to ${role}`)
      }
      if (status) {
        console.log(`[audit] admin ${requesterId} changed status of user ${id} to ${status}`)
      }

      return updated
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

  // Postback logs
  server.get<{ Querystring: { source?: string; result?: string; limit?: string } }>(
    '/postback-logs',
    async (request) => {
      const { source, result, limit = '100' } = request.query
      const where: any = {}
      if (source) where.source = source
      if (result) where.result = result
      const logs = await (prisma as any).postbackLog.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: Math.min(200, parseInt(limit)),
      })
      return logs
    }
  )
}
