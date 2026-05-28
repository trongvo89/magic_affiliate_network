import { PrismaClient } from '@prisma/client'
import axios from 'axios'

export async function sendOutboundPostback(
  prisma: PrismaClient,
  conversionId: string,
  urlTemplate: string,
  macros: Record<string, string>
) {
  let url = urlTemplate
  for (const [key, val] of Object.entries(macros)) {
    url = url.replace(new RegExp(`\\{${key}\\}`, 'g'), encodeURIComponent(val))
  }

  let status: number | null = null
  try {
    const res = await axios.get(url, { timeout: 10000 })
    status = res.status
  } catch (err: any) {
    status = err.response?.status ?? 0
  }

  await prisma.conversion.update({
    where: { id: conversionId },
    data: {
      postbackSent: true,
      postbackSentAt: new Date(),
      postbackStatus: status,
    },
  }).catch(() => {})
}
