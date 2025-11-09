import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/api-wrapper'
import { requireTenantContext } from '@/lib/tenant-utils'
import prisma from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { respond } from '@/lib/api-response'

export const runtime = 'nodejs'

// GET /api/admin/users/[userId]/activity?limit=50&offset=0
export const GET = withTenantContext(async (request: NextRequest, { params }: { params: { userId: string } }) => {
  try {
    const ctx = requireTenantContext()
    if (!ctx.userId) return respond.unauthorized()
    if (!hasPermission(ctx.role, PERMISSIONS.ANALYTICS_VIEW)) return respond.forbidden('Forbidden')

    const { userId } = params
    const tenantId = ctx.tenantId ?? null

    if (!userId || !tenantId) {
      return NextResponse.json({ error: 'Missing userId or tenantId' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200)
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))

    // Fetch audit logs related to this user
    const [activityLogs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where: {
          tenantId,
          OR: [
            { userId }, // User performed the action
            { metadata: { path: ['targetUserId'], equals: userId } } // Action was performed on this user
          ]
        },
        select: {
          id: true,
          action: true,
          resource: true,
          metadata: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.auditLog.count({
        where: {
          tenantId,
          OR: [
            { userId },
            { metadata: { path: ['targetUserId'], equals: userId } }
          ]
        }
      })
    ])

    const formatted = activityLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resource: log.resource || '',
      timestamp: log.createdAt instanceof Date ? log.createdAt.toISOString() : String(log.createdAt),
      actor: log.user ? {
        id: log.user.id,
        name: log.user.name || 'Unknown',
        email: log.user.email,
        avatar: log.user.image
      } : null,
      details: log.metadata || {},
      message: formatActivityMessage(log.action, log.resource || '', log.metadata)
    }))

    return NextResponse.json({
      data: formatted,
      pagination: {
        offset,
        limit,
        total,
        hasMore: offset + limit < total
      }
    })
  } catch (error) {
    console.error('User activity API error:', error)
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 })
  }
})

function formatActivityMessage(action: string, resource: string, metadata: any): string {
  const actionMap: Record<string, string> = {
    'CREATE': 'Created',
    'UPDATE': 'Updated',
    'DELETE': 'Deleted',
    'LOGIN': 'Logged in',
    'LOGOUT': 'Logged out',
    'EXPORT': 'Exported',
    'IMPORT': 'Imported',
    'PERMISSION_GRANTED': 'Permission granted',
    'PERMISSION_REVOKED': 'Permission revoked',
    'PASSWORD_CHANGED': 'Changed password',
    'EMAIL_VERIFIED': 'Verified email',
    'ROLE_CHANGED': 'Role changed',
    'STATUS_CHANGED': 'Status changed',
    'MFA_ENABLED': 'Enabled MFA',
    'MFA_DISABLED': 'Disabled MFA'
  }

  const actionText = actionMap[action] || action
  const resourceText = resource || 'resource'

  if (metadata?.details) {
    return `${actionText} ${resourceText}: ${metadata.details}`
  }

  return `${actionText} ${resourceText}`
}
