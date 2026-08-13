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

interface CityAdsQuery {
  xid?: string
  click_id?: string
  action_id?: string
  offer_id?: string
  action_type?: string
  payout?: string
  payout_currency?: string
  open_commission?: string
  order_amount?: string
  order_total?: string
  order_total_currency?: string
  order_id?: string
  sa?: string
  status?: string
  conversion_time?: string
  [key: string]: string | undefined
}

export default async function postbackRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  async function logPostback(data: {
    source: string
    rawQuery: Record<string, unknown>
    result: 'ok' | 'error'
    reason?: string
    conversionId?: string
    offerId?: string
    publisherId?: string
    xid?: string
    status?: string
  }) {
    try {
      await (prisma as any).postbackLog.create({ data })
    } catch {
      // Non-fatal — don't let logging failure break postback processing
    }
  }

  async function handleAppsFlyer(query: AppsflyerQuery, rawPayload: Record<string, unknown>) {
    const sourceRefId = query.af_tranid
    const appId = query.app_id
    const publisherId = query.af_sub1
    const eventType = query.event_name || 'install'
    const revenue = parseFloat(query.event_revenue || '0') || 0
    const rawCurrency = query.event_revenue_currency || null
    const eventAt = query.install_time ? new Date(query.install_time) : new Date()

    if (!sourceRefId) {
      await logPostback({ source: 'appsflyer', rawQuery: rawPayload, result: 'error', reason: 'missing af_tranid' })
      return { ok: true, reason: 'missing af_tranid' }
    }

    const offer = await prisma.offer.findFirst({ where: { appId, mmpSource: MmpSource.APPSFLYER, status: 'ACTIVE' }, select: { id: true, name: true, currency: true, commissionType: true, commissionValue: true } })
    if (!offer) {
      await logPostback({ source: 'appsflyer', rawQuery: rawPayload, result: 'error', reason: `offer not found: appId=${appId}` })
      return { ok: true, reason: 'offer not found' }
    }

    const currency = offer.currency || rawCurrency || 'USD'
    const publisher = publisherId ? await prisma.user.findUnique({ where: { id: publisherId } }) : null
    const commissionAmount = calculateCommission(offer.commissionType as CommType, offer.commissionValue, revenue)
    const status = determineStatus({ publisherId, publisher, commissionType: offer.commissionType as CommType, revenue })

    try {
      const conversion = await prisma.conversion.create({
        data: {
          sourceType: MmpSource.APPSFLYER, sourceRefId,
          offerId: offer.id, publisherId: publisher?.id ?? null,
          eventType, revenue, commissionAmount, currency, status,
          rawPayload: rawPayload as any, eventAt,
        },
      })
      await logPostback({ source: 'appsflyer', rawQuery: rawPayload, result: 'ok', conversionId: conversion.id, offerId: offer.id, publisherId: publisher?.id, xid: sourceRefId, status })

      if (publisher?.postbackUrl) {
        setImmediate(() => sendOutboundPostback(prisma, conversion.id, publisher.postbackUrl!, {
          click_id: publisher.id, payout: String(commissionAmount), event: eventType,
          order_id: sourceRefId, status: status.toLowerCase(), offer_id: offer.id, offer_name: offer.name,
        }))
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        await logPostback({ source: 'appsflyer', rawQuery: rawPayload, result: 'error', reason: 'duplicate xid', xid: sourceRefId, offerId: offer.id })
        return { ok: true, reason: 'duplicate' }
      }
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
    const rawCurrency = query.currency || null
    const eventAt = query.created_at ? new Date(query.created_at) : new Date()

    if (!sourceRefId) {
      await logPostback({ source: 'adjust', rawQuery: rawPayload, result: 'error', reason: 'missing transaction_id' })
      return { ok: true, reason: 'missing transaction_id' }
    }

    const offer = await prisma.offer.findFirst({ where: { appId: appToken, mmpSource: MmpSource.ADJUST, status: 'ACTIVE' }, select: { id: true, name: true, currency: true, commissionType: true, commissionValue: true } })
    if (!offer) {
      await logPostback({ source: 'adjust', rawQuery: rawPayload, result: 'error', reason: `offer not found: appToken=${appToken}` })
      return { ok: true, reason: 'offer not found' }
    }

    const currency = offer.currency || rawCurrency || 'USD'

    const publisher = publisherId ? await prisma.user.findUnique({ where: { id: publisherId } }) : null
    const commissionAmount = calculateCommission(offer.commissionType as CommType, offer.commissionValue, revenue)
    const status = determineStatus({ publisherId, publisher, commissionType: offer.commissionType as CommType, revenue })

    try {
      const conversion = await prisma.conversion.create({
        data: {
          sourceType: MmpSource.ADJUST, sourceRefId,
          offerId: offer.id, publisherId: publisher?.id ?? null,
          eventType, revenue, commissionAmount, currency, status,
          rawPayload: rawPayload as any, eventAt,
        },
      })
      await logPostback({ source: 'adjust', rawQuery: rawPayload, result: 'ok', conversionId: conversion.id, offerId: offer.id, publisherId: publisher?.id, xid: sourceRefId, status })

      if (publisher?.postbackUrl) {
        setImmediate(() => sendOutboundPostback(prisma, conversion.id, publisher.postbackUrl!, {
          click_id: publisher.id, payout: String(commissionAmount), event: eventType,
          order_id: sourceRefId, status: status.toLowerCase(), offer_id: offer.id, offer_name: offer.name,
        }))
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        await logPostback({ source: 'adjust', rawQuery: rawPayload, result: 'error', reason: 'duplicate xid', xid: sourceRefId, offerId: offer.id })
        return { ok: true, reason: 'duplicate' }
      }
      throw err
    }

    return { ok: true }
  }

  async function handleCityAds(query: CityAdsQuery, rawPayload: Record<string, unknown>) {
    const rawXid = query.xid || query.action_id || query.click_id
    const appId = query.offer_id
    const publisherId = query.sa
    const eventType = query.action_type || 'conversion'
    const openCommission = parseFloat(query.open_commission || '0') || 0
    const payout = parseFloat(query.payout || '0') || 0
    const exchangeRate = parseFloat(process.env.CITYADS_EXCHANGE_RATE || '1')
    const orderTotal = parseFloat(query.order_total || '0') || 0
    const revenue = orderTotal
    const networkCommission = payout > 0 ? payout : (openCommission * exchangeRate)
    const rawCurrency = query.payout_currency || query.order_total_currency || null
    const conversionTime = query.conversion_time || query.click_time || ''
    const eventAt = conversionTime
      ? (/^\d+$/.test(conversionTime) ? new Date(Number(conversionTime) * 1000) : new Date(conversionTime))
      : new Date()

    // xid can be empty for CPL actions — synthesize a dedup key from available fields
    const sourceRefId = (rawXid && rawXid.trim())
      ? rawXid.trim()
      : `${appId || 'noOffer'}_${publisherId || 'noPub'}_${conversionTime || Date.now()}`

    const offer = await prisma.offer.findFirst({ where: { appId, mmpSource: MmpSource.CITYADS, status: 'ACTIVE' }, select: { id: true, name: true, currency: true, commissionType: true, commissionValue: true } })
    if (!offer) {
      await logPostback({ source: 'cityads', rawQuery: rawPayload, result: 'error', reason: `offer not found: offer_id=${appId} (check CityAds Offer ID in offer settings)`, xid: sourceRefId })
      return { ok: true, reason: 'offer not found' }
    }

    const currency = offer.currency || rawCurrency || 'USD'
    const publisher = publisherId ? await prisma.user.findUnique({ where: { id: publisherId } }) : null

    const commissionAmount = networkCommission > 0
      ? calculateCommission(offer.commissionType as CommType, offer.commissionValue, networkCommission)
      : 0
    const status = determineCityAdsStatus({
      publisherId, publisher, cityAdsStatus: query.status,
      commissionType: offer.commissionType as CommType, revenue: networkCommission,
    })

    if (publisherId && !publisher) {
      await logPostback({ source: 'cityads', rawQuery: rawPayload, result: 'error', reason: `publisher not found: sa=${publisherId}`, xid: sourceRefId, offerId: offer.id })
    }

    try {
      const conversion = await prisma.conversion.create({
        data: {
          sourceType: MmpSource.CITYADS, sourceRefId,
          offerId: offer.id, publisherId: publisher?.id ?? null,
          eventType, revenue, commissionAmount, currency, status,
          rawPayload: rawPayload as any, eventAt,
        },
      })
      await logPostback({ source: 'cityads', rawQuery: rawPayload, result: 'ok', conversionId: conversion.id, offerId: offer.id, publisherId: publisher?.id, xid: sourceRefId, status })

      if (publisher?.postbackUrl) {
        setImmediate(() => sendOutboundPostback(prisma, conversion.id, publisher.postbackUrl!, {
          click_id: publisher.id, payout: String(commissionAmount), event: eventType,
          order_id: sourceRefId, status: status.toLowerCase(), offer_id: offer.id, offer_name: offer.name,
        }))
      }
    } catch (err: any) {
      if (err.code === 'P2002') {
        await logPostback({ source: 'cityads', rawQuery: rawPayload, result: 'error', reason: 'duplicate xid', xid: sourceRefId, offerId: offer.id })
        return { ok: true, reason: 'duplicate' }
      }
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
      } else if (source === 'cityads') {
        await handleCityAds(query as CityAdsQuery, rawPayload)
      } else if (source === 's2s') {
        await handleS2S(query as S2SQuery, rawPayload)
      } else {
        await logPostback({ source, rawQuery: rawPayload, result: 'error', reason: `unknown source: ${source}` })
      }
    } catch (err) {
      request.log.error(err, 'postback error')
      await logPostback({ source, rawQuery: rawPayload, result: 'error', reason: String(err) })
    }

    return { ok: true }
  }

  interface S2SQuery {
    offer_id?: string
    transaction_id?: string
    pub?: string
    event?: string
    revenue?: string
    currency?: string
    status?: string
    timestamp?: string
    [key: string]: string | undefined
  }

  async function handleS2S(query: S2SQuery, rawPayload: Record<string, unknown>) {
  const sourceRefId = query.transaction_id
  const offerId = query.offer_id
  const publisherId = query.pub
  const eventType = query.event || 'conversion'
  const revenue = parseFloat(query.revenue || '0') || 0
  const rawCurrency = query.currency || null
  const rawTs = query.timestamp ? query.timestamp.replace(/[{}]/g, '') : null
  const parsedTs = rawTs ? (isNaN(Number(rawTs)) ? new Date(rawTs) : new Date(Number(rawTs) * 1000)) : null
  const eventAt = (parsedTs && !isNaN(parsedTs.getTime())) ? parsedTs : new Date()

  if (!sourceRefId) {
    await logPostback({ source: 's2s', rawQuery: rawPayload, result: 'error', reason: 'missing transaction_id' })
    return { ok: true }
  }
  if (!offerId) {
    await logPostback({ source: 's2s', rawQuery: rawPayload, result: 'error', reason: 'missing offer_id' })
    return { ok: true }
  }

  const offer = await prisma.offer.findFirst({ where: { appId: offerId, status: 'ACTIVE' }, select: { id: true, name: true, currency: true, commissionType: true, commissionValue: true, mmpSource: true } })
  if (!offer) {
    await logPostback({ source: 's2s', rawQuery: rawPayload, result: 'error', reason: `offer not found: offer_id=${offerId}` })
    return { ok: true }
  }

  const currency = offer.currency || rawCurrency || 'USD'
  const publisher = publisherId ? await prisma.user.findUnique({ where: { id: publisherId } }) : null
  const commissionAmount = calculateCommission(offer.commissionType as CommType, offer.commissionValue, revenue)

  const rawStatus = (query.status || '').toLowerCase()
  let status: 'APPROVED' | 'PENDING' | 'REJECTED'
  if (rawStatus === 'approved' || rawStatus === '1') status = 'APPROVED'
  else if (rawStatus === 'rejected' || rawStatus === '3' || rawStatus === 'declined') status = 'REJECTED'
  else status = determineStatus({ publisherId, publisher, commissionType: offer.commissionType as CommType, revenue })

  try {
    const conversion = await prisma.conversion.create({
      data: {
        sourceType: offer.mmpSource, sourceRefId,
        offerId: offer.id, publisherId: publisher?.id ?? null,
        eventType, revenue, commissionAmount, currency, status,
        rawPayload: rawPayload as any, eventAt,
      },
    })
    await logPostback({ source: 's2s', rawQuery: rawPayload, result: 'ok', conversionId: conversion.id, offerId: offer.id, publisherId: publisher?.id, xid: sourceRefId, status })

    if (publisher?.postbackUrl) {
      setImmediate(() => sendOutboundPostback(prisma, conversion.id, publisher.postbackUrl!, {
        click_id: publisher.id, payout: String(commissionAmount), event: eventType,
        order_id: sourceRefId, status: status.toLowerCase(), offer_id: offer.id, offer_name: offer.name,
      }))
    }
  } catch (err: any) {
    if (err.code === 'P2002') {
      await logPostback({ source: 's2s', rawQuery: rawPayload, result: 'error', reason: 'duplicate transaction_id', xid: sourceRefId, offerId: offer.id })
      return { ok: true }
    }
    throw err
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

function determineStatus({
  publisherId,
  publisher,
  commissionType,
  revenue,
}: {
  publisherId: string | undefined
  publisher: { id: string } | null
  commissionType: CommType
  revenue: number
}): 'APPROVED' | 'PENDING' {
  // Publisher ID passed but not found in DB → wrong attribution
  if (publisherId && !publisher) return 'PENDING'
  // No publisher ID at all → cannot attribute commission
  if (!publisherId) return 'PENDING'
  // PERCENT_REVENUE but revenue = 0 → commission would be $0, data incomplete
  if (commissionType === CommType.PERCENT_REVENUE && revenue === 0) return 'PENDING'
  return 'APPROVED'
}

function determineCityAdsStatus({
  publisherId,
  publisher,
  cityAdsStatus,
  commissionType,
  revenue,
}: {
  publisherId: string | undefined
  publisher: { id: string } | null
  cityAdsStatus: string | undefined
  commissionType: CommType
  revenue: number
}): 'APPROVED' | 'PENDING' | 'REJECTED' {
  if (!publisherId || (publisherId && !publisher)) return 'PENDING'
  if (commissionType === CommType.PERCENT_REVENUE && revenue === 0) return 'PENDING'
  const s = (cityAdsStatus || '').toLowerCase()
  if (s === '1' || s === 'approved') return 'APPROVED'
  if (s === '3' || s === 'rejected' || s === 'declined') return 'REJECTED'
  return 'PENDING'
}
