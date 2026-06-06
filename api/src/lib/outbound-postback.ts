import { PrismaClient } from '@prisma/client'
import axios from 'axios'

// Block private/loopback IP ranges to prevent SSRF
const PRIVATE_IP_RE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|0\.0\.0\.0)/i

function isAllowedPostbackUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    if (!['http:', 'https:'].includes(u.protocol)) return false
    if (PRIVATE_IP_RE.test(u.hostname)) return false
    return true
  } catch {
    return false
  }
}

export async function sendOutboundPostback(
  prisma: PrismaClient,
  conversionId: string,
  urlTemplate: string,
  macros: Record<string, string>
) {
  if (!isAllowedPostbackUrl(urlTemplate)) {
    await prisma.conversion.update({
      where: { id: conversionId },
      data: { postbackSent: true, postbackSentAt: new Date(), postbackStatus: 0 },
    }).catch(() => {})
    return
  }

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
