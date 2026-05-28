import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

export default async function authRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  server.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
    const { email, password } = request.body

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return reply.code(401).send({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return reply.code(401).send({ error: 'Invalid credentials' })

    if (user.status === 'SUSPENDED') return reply.code(403).send({ error: 'Account suspended' })

    const token = server.jwt.sign({ id: user.id, email: user.email, role: user.role })
    return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status } }
  })

  server.post<{ Body: { email: string; password: string; name: string } }>('/register', async (request, reply) => {
    const { email, password, name } = request.body

    if (!email || !password || !name) return reply.code(400).send({ error: 'Missing fields' })
    if (password.length < 8) return reply.code(400).send({ error: 'Password too short' })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { email, password: hashed, name, role: 'PUBLISHER', status: 'PENDING' },
    })

    return reply.code(201).send({ message: 'Registration successful. Wait for admin approval.', userId: user.id })
  })
}
