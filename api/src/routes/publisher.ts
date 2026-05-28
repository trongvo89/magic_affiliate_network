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

  server.get('/stats', async (request) => {
    const { id } = request.user as any
    const now = new Date()
    const start30d = new Date(now.getTime() - 30 * 86400000)
    const start7d = new Date(now.getTime() - 7 * 86400000)
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)

    const [today, week, month, approved] = await Promise.all([
      prisma.conversion.aggregate({ where: { publisherId: id, receivedAt: { gte: startOfDay } }, _sum: { commissionAmount: true }, _count: true }),
      prisma.conversion.aggregate({ where: { publisherId: id, receivedAt: { gte: start7d } }, _sum: { commissionAmount: true }, _count: true }),
      prisma.conversion.aggregate({ where: { publisherId: id, receivedAt: { gte: start30d } }, _sum: { commissionAmount: true }, _count: true }),
      prisma.conversion.aggregate({ where: { publisherId: id, status: 'APPROVED' }, _sum: { commissionAmount: true } }),
    ])

    return {
      today: { conversions: today._count, earned: today._sum.commissionAmount ?? 0 },
      week: { conversions: week._count, earned: week._sum.commissionAmount ?? 0 },
      month: { conversions: month._count, earned: month._sum.commissionAmount ?? 0 },
      totalApproved: approved._sum.commissionAmount ?? 0,
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
