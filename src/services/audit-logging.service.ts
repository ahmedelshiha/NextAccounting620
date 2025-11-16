import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * Audit log action types
 */
export enum AuditActionType {
  // User Management
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_ACTIVATED = 'USER_ACTIVATED',
  USER_DEACTIVATED = 'USER_DEACTIVATED',

  // Permission Management
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_REVOKED = 'PERMISSION_REVOKED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  ROLE_CREATED = 'ROLE_CREATED',
  ROLE_UPDATED = 'ROLE_UPDATED',
  ROLE_DELETED = 'ROLE_DELETED',

  // Bulk Operations
  BULK_OPERATION_STARTED = 'BULK_OPERATION_STARTED',
  BULK_OPERATION_COMPLETED = 'BULK_OPERATION_COMPLETED',
  BULK_OPERATION_FAILED = 'BULK_OPERATION_FAILED',

  // Settings
  SETTING_CHANGED = 'SETTING_CHANGED',
  SETTINGS_EXPORTED = 'SETTINGS_EXPORTED',
  SETTINGS_IMPORTED = 'SETTINGS_IMPORTED',

  // System
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  FAILED_LOGIN = 'FAILED_LOGIN',
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',
  MFA_ENABLED = 'MFA_ENABLED',
  MFA_DISABLED = 'MFA_DISABLED',
}

/**
 * Audit log severity levels
 */
export enum AuditSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

/**
 * Audit log entry interface
 */
export interface AuditLogEntry {
  action: string
  userId?: string
  tenantId?: string
  resource?: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Extended audit log entry with additional fields for convenience
 */
export interface AuditLogEntryExtended extends AuditLogEntry {
  severity?: AuditSeverity
  description?: string
  targetUserId?: string
  targetResourceId?: string
  targetResourceType?: string
  changes?: Record<string, any>
}

/**
 * Audit log query filters
 */
export interface AuditLogFilter {
  userId?: string
  tenantId?: string
  action?: string | string[]
  createdAt?: {
    startDate: Date
    endDate: Date
  }
  limit?: number
  offset?: number
}

/**
 * Audit logging service
 */
export class AuditLoggingService {
  /**
   * Log an audit event
   */
  static async logAuditEvent(entry: AuditLogEntryExtended): Promise<void> {
    try {
      const metadata = {
        ...entry.metadata,
        severity: entry.severity || AuditSeverity.INFO,
        description: entry.description,
        targetUserId: entry.targetUserId,
        targetResourceId: entry.targetResourceId,
        targetResourceType: entry.targetResourceType,
        changes: entry.changes,
      }

      await prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId,
          tenantId: entry.tenantId,
          resource: entry.resource,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
          metadata,
        },
      })
    } catch (error) {
      logger.error('Failed to log audit event', {}, error instanceof Error ? error : new Error(String(error)))
      // Don't throw - audit logging failure shouldn't break the application
    }
  }

  /**
   * Log permission change
   */
  static async logPermissionChange(
    userId: string,
    tenantId: string,
    targetUserId: string,
    permissionsAdded: string[],
    permissionsRemoved: string[],
    metadata?: Record<string, any>
  ): Promise<void> {
    const hasChanges = permissionsAdded.length > 0 || permissionsRemoved.length > 0

    if (!hasChanges) return

    const action = permissionsAdded.length > 0 ? AuditActionType.PERMISSION_GRANTED : AuditActionType.PERMISSION_REVOKED

    await this.logAuditEvent({
      action,
      severity: AuditSeverity.INFO,
      userId,
      tenantId,
      targetUserId,
      targetResourceType: 'USER_PERMISSIONS',
      resource: `user:${targetUserId}:permissions`,
      description: `${permissionsAdded.length > 0 ? 'Granted' : 'Revoked'} ${permissionsAdded.length + permissionsRemoved.length} permission(s) for ${targetUserId}`,
      changes: {
        added: permissionsAdded,
        removed: permissionsRemoved,
      },
      metadata,
    })
  }

  /**
   * Log role change
   */
  static async logRoleChange(
    userId: string,
    tenantId: string,
    targetUserId: string,
    fromRole: string,
    toRole: string,
    reason?: string
  ): Promise<void> {
    // Determine severity based on role change
    let severity = AuditSeverity.INFO
    if (['SUPER_ADMIN', 'ADMIN'].includes(toRole)) {
      severity = AuditSeverity.CRITICAL
    }

    await this.logAuditEvent({
      action: AuditActionType.ROLE_CHANGED,
      severity,
      userId,
      tenantId,
      targetUserId,
      targetResourceType: 'USER_ROLE',
      resource: `user:${targetUserId}:role`,
      description: `Changed role for ${targetUserId} from ${fromRole} to ${toRole}${reason ? ` (${reason})` : ''}`,
      changes: {
        fromRole,
        toRole,
      },
      metadata: reason ? { reason } : undefined,
    })
  }

  /**
   * Log settings change
   */
  static async logSettingsChange(
    userId: string,
    tenantId: string,
    section: string,
    changes: Record<string, any>
  ): Promise<void> {
    await this.logAuditEvent({
      action: AuditActionType.SETTING_CHANGED,
      severity: AuditSeverity.INFO,
      userId,
      tenantId,
      targetResourceId: section,
      targetResourceType: 'SETTINGS',
      resource: `settings:${section}`,
      description: `Updated ${section} settings`,
      changes,
    })
  }

  /**
   * Log bulk operation
   */
  static async logBulkOperation(
    userId: string,
    tenantId: string,
    operationType: string,
    affectedUserCount: number,
    status: 'STARTED' | 'COMPLETED' | 'FAILED',
    metadata?: Record<string, any>
  ): Promise<void> {
    const action =
      status === 'STARTED' ? AuditActionType.BULK_OPERATION_STARTED :
      status === 'COMPLETED' ? AuditActionType.BULK_OPERATION_COMPLETED :
      AuditActionType.BULK_OPERATION_FAILED

    const severity =
      status === 'FAILED' ? AuditSeverity.WARNING :
      AuditSeverity.INFO

    await this.logAuditEvent({
      action,
      severity,
      userId,
      tenantId,
      targetResourceType: 'BULK_OPERATION',
      resource: `bulk-operation:${operationType}`,
      description: `${status} bulk operation: ${operationType} affecting ${affectedUserCount} user(s)`,
      metadata: {
        operationType,
        affectedUserCount,
        ...metadata,
      },
    })
  }

  /**
   * Query audit logs
   */
  static async queryAuditLogs(filter: AuditLogFilter): Promise<any[]> {
    const where: any = {}

    if (filter.userId) {
      where.userId = filter.userId
    }

    if (filter.tenantId) {
      where.tenantId = filter.tenantId
    }

    if (filter.action) {
      where.action = Array.isArray(filter.action)
        ? { in: filter.action }
        : filter.action
    }

    if (filter.createdAt) {
      where.createdAt = {
        gte: filter.createdAt.startDate,
        lte: filter.createdAt.endDate,
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filter.limit || 100,
      skip: filter.offset || 0,
    })

    return logs.map(log => ({
      ...log,
      metadata: typeof log.metadata === 'object' ? log.metadata : null,
    }))
  }

  /**
   * Get audit log statistics
   */
  static async getAuditStats(
    tenantId: string,
    dateRange?: { startDate: Date; endDate: Date }
  ): Promise<Record<string, number>> {
    const where: any = { tenantId }

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      }
    }

    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
    })

    const stats: Record<string, number> = {}
    actionCounts.forEach(({ action, _count }) => {
      stats[action] = _count
    })

    return stats
  }

  /**
   * Delete old audit logs (for retention policy)
   */
  static async deleteOldLogs(
    tenantId: string,
    retentionDays: number = 90
  ): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    const result = await prisma.auditLog.deleteMany({
      where: {
        tenantId,
        createdAt: {
          lt: cutoffDate,
        },
      },
    })

    return result.count
  }

  /**
   * Export audit logs
   */
  static async exportAuditLogs(
    tenantId: string,
    filter?: AuditLogFilter
  ): Promise<string> {
    const logs = await this.queryAuditLogs({
      ...filter,
      tenantId,
      limit: 10000, // Max export limit
    })

    // Convert to CSV
    const headers = [
      'Timestamp',
      'Action',
      'User ID',
      'Resource',
      'IP Address',
    ]

    const rows = logs.map(log => [
      log.createdAt.toISOString(),
      log.action,
      log.userId || '',
      log.resource || '',
      log.ipAddress || '',
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n')

    return csv
  }
}
