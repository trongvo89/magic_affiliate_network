import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function clickRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  server.get<{ Params: { offerId: string }; Querystring: { pub?: string } }>(
    '/cityads/:offerId',
    async (request, reply) => {
      const { offerId } = request.params
      const { pub: publisherId } = request.query

      const offer = await prisma.offer.findFirst({
        where: { id: offerId, mmpSource: 'CITYADS', status: 'ACTIVE' },
        select: { id: true, destinationUrl: true },
      })

      if (!offer?.destinationUrl) {
        return reply.code(404).type('text/plain').send('Offer not found')
      }

      // Log click fire-and-forget — don't block redirect
      setImmediate(async () => {
        try {
          await prisma.click.create({
            data: {
              offerId: offer.id,
              publisherId: publisherId || null,
              ip: request.ip || null,
              userAgent: request.headers['user-agent'] || null,
            },
          })
        } catch (_) {}
      })

      let dest = offer.destinationUrl
      if (publisherId) {
        const sep = dest.includes('?') ? '&' : '?'
        dest = `${dest}${sep}sa=${encodeURIComponent(publisherId)}`
      }

      return reply.redirect(302, dest)
    }
  )
}
