import { FastifyInstance, FastifyRequest } from 'fastify'
import { PrismaClient, MmpSource, CommType } from '@prisma/client'
import { sendOutboundPostback } from '../lib/outbound-postback'

interface AppsflyerQuery {
  af_tranid?: string
  app_id?: string
  event_name?: string
  event_revenue?: string
  event_revenue_currency?: string
  af_sub1?: string
  advertising_id?: string
  install_time?: string
  [key: string]: string | undefined
}

interface AdjustQuery {
  transaction_id?: string
  app_token?: string
  event_token?: string
  revenue?: string
  currency?: string
  created_at?: string
  partner_parameter_1?: string
  adid?: string
  [key: string]: string | undefined
}

export default async function postbackRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  async function handleAppsFlyer(query: AppsflyerQuery, rawPayload: Record<string, unknown>) {
    const sourceRefId = query.af_tranid
    const appId = query.app_id
    const publisherId = query.af_sub1
    const eventType = query.event_name || 'install'
    const revenue = parseFloat(query.event_revenue || '0') || 0
    const currency = query.event_revenue_currency || 'USD'
    const eventAt = query.install_time ? new Date(query.install_time) : new Date()

    if (!sourceRefId) return { ok: true, reason: 'missing af_tranid' }

    const offer = await prisma.offer.findFirst({ where: { appId, mmpSource: MmpSource.APPSFLYER, status: 'ACTIVE' } })
    if (!offer) return { ok: true, reason: 'offer not found' }

    const publisher = publisherId ? await prisma.user.findUnique({ where: { id: publisherId } }) : null

    const commissionAmount = calculateCommission(offer.commissionType as CommType, offer.commissionValue, revenue)

    try {
      const conversion = await prisma.conversion.create({
        data: {
          sourceType: MmpSource.APPSFLYER,
          sourceRefId,
          offerId: offer.id,
          publisherId: publisher?.id ?? null,
          eventType,
          revenue,
          commissionAmount,
          currency,
          status: 'APPROVED',
          rawPayload: rawPayload as any,
          eventAt,
        },
      })

      if (publisher?.postbackUrl) {
        setImmediate(() => sendOutboundPostback(prisma, conversion.id, publisher.postbackUrl!, {
          click_id: publisher.id,
          payout: String(commissionAmount),
          event: eventType,
          order_id: sourceRefId,
          status: 'approved',
        }))
      }
    } catch (err: any) {
      if (err.code === 'P2002') return { ok: true, reason: 'duplicate' }
      throw err
    }

    return { ok: true }
  }

  async function handleAdjust(query: AdjustQuery, rawPayload: Record<string, unknown>) {
    const sourceRefId = query.transaction_id
    const appToken = query.app_token
    const publisherId = query.partner_parameter_1
    const eventType = query.event_token || 'install'
    const revenue = parseFloat(query.revenue || '0') || 0
    const currency = query.currency || 'USD'
    const eventAt = query.created_at ? new Date(query.created_at) : new Date()

    if (!sourceRefId) return { ok: true, reason: 'missing transaction_id' }

    const offer = await prisma.offer.findFirst({ where: { appId: appToken, mmpSource: MmpSource.ADJUST, status: 'ACTIVE' } })
    if (!offer) return { ok: true, reason: 'offer not found' }

    const publisher = publisherId ? await prisma.user.findUnique({ where: { id: publisherId } }) : null

    const commissionAmount = calculateCommission(offer.commissionType as CommType, offer.commissionValue, revenue)

    try {
      const conversion = await prisma.conversion.create({
        data: {
          sourceType: MmpSource.ADJUST,
          sourceRefId,
          offerId: offer.id,
          publisherId: publisher?.id ?? null,
          eventType,
          revenue,
          commissionAmount,
          currency,
          status: 'APPROVED',
          rawPayload: rawPayload as any,
          eventAt,
        },
      })

      if (publisher?.postbackUrl) {
        setImmediate(() => sendOutboundPostback(prisma, conversion.id, publisher.postbackUrl!, {
          click_id: publisher.id,
          payout: String(commissionAmount),
          event: eventType,
          order_id: sourceRefId,
          status: 'approved',
        }))
      }
    } catch (err: any) {
      if (err.code === 'P2002') return { ok: true, reason: 'duplicate' }
      throw err
    }

    return { ok: true }
  }

  const handler = async (request: FastifyRequest<{ Params: { source: string } }>) => {
    const source = request.params.source.toLowerCase()
    const query = request.query as Record<string, string>
    const body = (request.body as Record<string, unknown>) || {}
    const rawPayload = { ...query, ...body }

    try {
      if (source === 'appsflyer') {
        await handleAppsFlyer(query as AppsflyerQuery, rawPayload)
      } else if (source === 'adjust') {
        await handleAdjust(query as AdjustQuery, rawPayload)
      }
    } catch (err) {
      request.log.error(err, 'postback error')
    }

    return { ok: true }
  }

  server.get<{ Params: { source: string } }>('/:source', handler)
  server.post<{ Params: { source: string } }>('/:source', handler)
}

function calculateCommission(type: CommType, value: number, revenue: number): number {
  if (type === CommType.FLAT_CPA) return value
  return parseFloat((revenue * value / 100).toFixed(2))
}
