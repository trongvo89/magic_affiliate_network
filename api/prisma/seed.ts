import { PrismaClient, Role, Status, MmpSource, CommType, OfferStatus, ConvStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Clean up
  await prisma.conversion.deleteMany()
  await prisma.offer.deleteMany()
  await prisma.user.deleteMany()

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password: await bcrypt.hash('Admin123!', 10),
      name: 'Admin',
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
  })

  // Publishers
  const pub1 = await prisma.user.create({
    data: {
      email: 'pub1@test.com',
      password: await bcrypt.hash('Pub123!', 10),
      name: 'Publisher One',
      role: Role.PUBLISHER,
      status: Status.ACTIVE,
      postbackUrl: 'https://tracker.example.com/postback?click_id={click_id}&payout={payout}&event={event}',
    },
  })

  const pub2 = await prisma.user.create({
    data: {
      email: 'pub2@test.com',
      password: await bcrypt.hash('Pub123!', 10),
      name: 'Publisher Two',
      role: Role.PUBLISHER,
      status: Status.PENDING,
    },
  })

  // Offers
  const offer1 = await prisma.offer.create({
    data: {
      name: 'Shopee App VN',
      appName: 'Shopee',
      appId: 'com.shopee.vn',
      mmpSource: MmpSource.APPSFLYER,
      commissionType: CommType.FLAT_CPA,
      commissionValue: 2.0,
      currency: 'USD',
      status: OfferStatus.ACTIVE,
    },
  })

  const offer2 = await prisma.offer.create({
    data: {
      name: 'Gojek',
      appName: 'Gojek',
      appId: 'com.gojek.app',
      mmpSource: MmpSource.ADJUST,
      commissionType: CommType.PERCENT_REVENUE,
      commissionValue: 8.0,
      currency: 'USD',
      status: OfferStatus.ACTIVE,
    },
  })

  // Sample conversions
  const now = new Date()
  const events = ['install', 'purchase', 'registration']
  const statuses = [ConvStatus.APPROVED, ConvStatus.APPROVED, ConvStatus.PENDING, ConvStatus.REJECTED]

  for (let i = 0; i < 30; i++) {
    const daysAgo = Math.floor(Math.random() * 30)
    const eventAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const isOffer1 = i % 2 === 0
    const offer = isOffer1 ? offer1 : offer2
    const publisher = i % 3 === 0 ? pub2 : pub1
    const eventType = events[i % events.length]
    const revenue = isOffer1 ? 0 : parseFloat((Math.random() * 50 + 5).toFixed(2))
    const status = statuses[i % statuses.length]
    const commissionAmount = offer.commissionType === CommType.FLAT_CPA
      ? offer.commissionValue
      : parseFloat((revenue * offer.commissionValue / 100).toFixed(2))

    await prisma.conversion.create({
      data: {
        sourceType: offer.mmpSource,
        sourceRefId: `seed-ref-${i}-${Date.now()}`,
        offerId: offer.id,
        publisherId: publisher.id,
        eventType,
        revenue,
        commissionAmount,
        currency: 'USD',
        status,
        rawPayload: {
          seeded: true,
          index: i,
          app_id: offer.appId,
        },
        postbackSent: status === ConvStatus.APPROVED,
        eventAt,
        receivedAt: eventAt,
      },
    })
  }

  console.log('Seed complete')
  console.log(`Admin: admin@test.com / Admin123!`)
  console.log(`Publisher1: pub1@test.com / Pub123! (ACTIVE)`)
  console.log(`Publisher2: pub2@test.com / Pub123! (PENDING)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
