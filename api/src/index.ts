import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'

import postbackRoutes from './routes/postback'
import authRoutes from './routes/auth'
import adminRoutes from './routes/admin'
import publisherRoutes from './routes/publisher'

dotenv.config()

const prisma = new PrismaClient()

const server = Fastify({
  logger: {
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
  },
})

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string; role: string }
    user: { id: string; email: string; role: string }
  }
}

async function start() {
  await server.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })

  await server.register(jwt, {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-in-production',
    sign: { expiresIn: '7d' },
  })

  server.decorate('prisma', prisma)

  await server.register(postbackRoutes, { prefix: '/postback' })
  await server.register(authRoutes, { prefix: '/auth' })
  await server.register(adminRoutes, { prefix: '/admin' })
  await server.register(publisherRoutes, { prefix: '/publisher' })

  server.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

  const port = parseInt(process.env.PORT || '4000')
  const host = process.env.HOST || '0.0.0.0'

  await server.listen({ port, host })
  console.log(`API running on ${host}:${port}`)
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
