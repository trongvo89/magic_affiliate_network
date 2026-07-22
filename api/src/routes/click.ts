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
    const sep = dest.includes('?') ? '&' : '?'
    if (publisherId) dest = `${dest}${sep}sa=${encodeURIComponent(publisherId)}`
    if (clickId) dest = `${dest}&click_id=${encodeURIComponent(clickId)}`

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
