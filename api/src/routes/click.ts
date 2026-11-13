import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function clickRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  async function handleClick(request: any, reply: any) {
    const { offerId } = request.params
    const { pub: publisherId } = request.query
    // Publisher's own tracker click ID (?click_id= or ?p1=); ignored if it is an unresolved macro like [:click_id].
    const rawSub1 = request.query.click_id ?? request.query.p1
    const sub1 = typeof rawSub1 === 'string' && /^[A-Za-z0-9._-]{1,64}$/.test(rawSub1) ? rawSub1 : ''

    const offer = await prisma.offer.findFirst({
      where: { id: offerId, status: 'ACTIVE' },
      select: { id: true, destinationUrl: true, mmpSource: true },
    })

    if (!offer?.destinationUrl) {
      return reply.code(404).type('text/plain').send('Offer not found')
    }

    let clickId: string | null = null
    try {
      const click = await prisma.click.create({
        data: {
          offerId: offer.id,
          publisherId: publisherId || null,
          ip: request.ip || null,
          userAgent: request.headers['user-agent'] || null,
        },
      })
      clickId = click.id
    } catch (err) {
      console.error('[click] failed to log click:', err)
    }

    let dest = offer.destinationUrl
    // Templates like ...&p1={click_id}&p2={pub} get filled in place; otherwise params are appended.
    if (/\{(click_id|pub)\}/.test(dest)) {
      dest = dest
        .replace(/\{click_id\}/g, encodeURIComponent(clickId || ''))
        .replace(/\{pub\}/g, encodeURIComponent(publisherId || ''))
    } else {
      const sep = dest.includes('?') ? '&' : '?'
      if (clickId) dest = `${dest}${sep}click_id=${encodeURIComponent(clickId)}`
      // CityAds echoes `sa` back in its postback to attribute the publisher; Direct S2S partners read utm_content.
      // `sa` carries "<publisherId>_<sub1>" when the publisher supplied p1, so their click ID survives the round trip.
      const sa = sub1 ? `${publisherId}_${sub1}` : publisherId
      if (publisherId) dest = `${dest}${clickId ? '&' : sep}utm_content=${encodeURIComponent(publisherId)}&sa=${encodeURIComponent(sa)}`
    }

    return reply.redirect(302, dest)
  }

  // New clean URL format
  server.get<{ Params: { offerId: string }; Querystring: { pub?: string } }>(
    '/t/:offerId', handleClick
  )

  // Keep old format working so existing links don't break
  server.get<{ Params: { offerId: string }; Querystring: { pub?: string } }>(
    '/cityads/:offerId', handleClick
  )
}
