import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function clickRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  async function handleClick(request: any, reply: any) {
    const { offerId } = request.params
    const { pub: publisherId } = request.query

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
      if (publisherId) dest = `${dest}${clickId ? '&' : sep}utm_content=${encodeURIComponent(publisherId)}`
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
