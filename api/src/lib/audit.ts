import { PrismaClient } from '@prisma/client'

interface AuditEntry {
  userId: string
  userName: string
  action: string
  entity: string
  entityId?: string
  changes?: Record<string, any>
}

export async function auditLog(prisma: PrismaClient, entry: AuditEntry) {
  try {
    await (prisma as any).auditLog.create({ data: entry })
  } catch (err) {
    console.error('[audit] failed to write audit log:', err)
  }
}

export function diffChanges(before: Record<string, any>, after: Record<string, any>): Record<string, { from: any; to: any }> | null {
  const diff: Record<string, { from: any; to: any }> = {}
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      diff[key] = { from: before[key] ?? null, to: after[key] }
    }
  }
  return Object.keys(diff).length > 0 ? diff : null
}
