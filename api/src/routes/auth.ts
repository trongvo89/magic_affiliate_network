import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { sendPasswordResetEmail, isMailConfigured } from '../lib/mailer'

export default async function authRoutes(server: FastifyInstance) {
  const prisma: PrismaClient = (server as any).prisma

  // In-memory brute-force guard: track failed login attempts per email
  const failedAttempts = new Map<string, { count: number; lockedUntil: number }>()

  server.post<{ Body: { email: string; password: string } }>('/login', async (request, reply) => {
    const { email, password } = request.body
    if (!email || !password) return reply.code(400).send({ error: 'Missing credentials' })

    const key = email.toLowerCase()
    const now = Date.now()
    const attempt = failedAttempts.get(key)
    if (attempt && attempt.lockedUntil > now) {
      const wait = Math.ceil((attempt.lockedUntil - now) / 1000)
      return reply.code(429).send({ error: `Too many failed attempts. Try again in ${wait}s.` })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      const cur = failedAttempts.get(key) || { count: 0, lockedUntil: 0 }
      const next = cur.count + 1
      failedAttempts.set(key, { count: next, lockedUntil: next >= 5 ? now + 15 * 60 * 1000 : 0 })
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      const cur = failedAttempts.get(key) || { count: 0, lockedUntil: 0 }
      const next = cur.count + 1
      failedAttempts.set(key, { count: next, lockedUntil: next >= 5 ? now + 15 * 60 * 1000 : 0 })
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    failedAttempts.delete(key)

    if (user.status === 'SUSPENDED') return reply.code(403).send({ error: 'Account suspended' })
    if (user.status === 'PENDING') return reply.code(403).send({ error: 'Account pending approval' })

    const token = server.jwt.sign({ id: user.id, email: user.email, role: user.role })
    const isProduction = process.env.NODE_ENV === 'production'
    reply.setCookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 2 * 60 * 60,
    })
    return { user: { id: user.id, email: user.email, name: user.name, role: user.role, status: user.status } }
  })

  server.post<{ Body: { email: string; password: string; name: string } }>('/register', async (request, reply) => {
    const { email, password, name } = request.body

    if (!email || !password || !name) return reply.code(400).send({ error: 'Missing fields' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ error: 'Invalid email format' })
    if (password.length < 8) return reply.code(400).send({ error: 'Password must be at least 8 characters' })
    if (name.trim().length < 2) return reply.code(400).send({ error: 'Name too short' })

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return reply.code(409).send({ error: 'Email already registered' })

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, password: hashed, name: name.trim(), role: 'PUBLISHER', status: 'PENDING' },
    })

    return reply.code(201).send({ message: 'Registration successful. Wait for admin approval.', userId: user.id })
  })

  server.post<{ Body: { email: string } }>('/forgot-password', async (request, reply) => {
    const { email } = request.body
    if (!email) return reply.code(400).send({ error: 'Email required' })
    if (!isMailConfigured()) return reply.code(503).send({ error: 'Email not configured. Contact your admin.' })

    // Always respond OK so we don't reveal whether an email is registered
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user) return { ok: true }

    const token = randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenAt: expiry },
    })

    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
    try {
      await sendPasswordResetEmail(user.email, `${appUrl}/reset-password?token=${token}`)
    } catch (err) {
      server.log.error(err, 'Failed to send password reset email')
      return reply.code(503).send({ error: 'Failed to send email. Please try again later.' })
    }

    return { ok: true }
  })

  server.post<{ Body: { token: string; password: string } }>('/reset-password', async (request, reply) => {
    const { token, password } = request.body
    if (!token || !password) return reply.code(400).send({ error: 'Token and password required' })
    if (password.length < 8) return reply.code(400).send({ error: 'Password must be at least 8 characters' })

    const user = await prisma.user.findFirst({
      where: { resetToken: token, resetTokenAt: { gt: new Date() } },
    })
    if (!user) return reply.code(400).send({ error: 'Invalid or expired reset link. Please request a new one.' })

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(password, 12), resetToken: null, resetTokenAt: null },
    })

    return { ok: true }
  })

  server.get('/me', async (request, reply) => {
    try {
      await request.jwtVerify()
      const payload = request.user as { id: string; email: string; role: string; impersonatedBy?: string }
      const user = await prisma.user.findUnique({
        where: { id: payload.id },
        select: { id: true, email: true, name: true, role: true, status: true },
      })
      if (!user) return reply.code(401).send({ error: 'User not found' })
      return { user, impersonating: !!payload.impersonatedBy }
    } catch {
      return reply.code(401).send({ error: 'Not authenticated' })
    }
  })

  server.post('/logout', async (_request, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { ok: true }
  })
}
