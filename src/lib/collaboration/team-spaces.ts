import { z } from 'zod'

/**
 * Team Spaces Service
 * Enables shared workspaces for team collaboration, document sharing, and auditor access
 */

export const TeamSpaceSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  type: z.enum(['TEAM', 'PROJECT', 'AUDIT', 'FILING', 'CLIENT_PORTAL']),
  ownerId: z.string(),
  members: z.array(z.object({
    userId: z.string(),
    role: z.enum(['OWNER', 'EDITOR', 'VIEWER', 'AUDITOR', 'REDACTED_VIEWER']),
    addedAt: z.date(),
    addedBy: z.string(),
    permissions: z.array(z.enum([
      'VIEW',
      'EDIT',
      'DELETE',
      'SHARE',
      'MANAGE_MEMBERS',
      'MANAGE_SETTINGS',
      'EXPORT',
      'AUDIT_LOG_ACCESS',
    ])).optional(),
  })),
  documents: z.array(z.string()).optional(), // Document IDs
  linkedFilings: z.array(z.string()).optional(), // Filing IDs
  visibility: z.enum(['PRIVATE', 'TEAM', 'PUBLIC']).default('PRIVATE'),
  redactionSettings: z.object({
    enabled: z.boolean().default(false),
    redactedFields: z.array(z.string()).default([]), // Field names to redact
    redactedForRoles: z.array(z.string()).default([]), // Roles that see redacted content
  }).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export const SpaceMemberSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  userId: z.string(),
  role: z.enum(['OWNER', 'EDITOR', 'VIEWER', 'AUDITOR', 'REDACTED_VIEWER']),
  permissions: z.array(z.string()),
  joinedAt: z.date(),
  addedBy: z.string(),
})

export const AuditorLinkSchema = z.object({
  id: z.string(),
  spaceId: z.string(),
  auditorId: z.string(),
  auditorEmail: z.string().email(),
  scope: z.enum(['FULL', 'ENTITY', 'FILING', 'CUSTOM']),
  accessStartDate: z.date(),
  accessEndDate: z.date().optional(),
  canDownload: z.boolean().default(false),
  canExport: z.boolean().default(false),
  restrictedEntities: z.array(z.string()).optional(), // Entity IDs auditor can see
  restrictedFilings: z.array(z.string()).optional(), // Filing types auditor can see
  restrictedDocumentTypes: z.array(z.string()).optional(), // Document types auditor can see
  auditTrail: z.boolean().default(true), // Can auditor see audit trail?
  notifyOnChanges: z.boolean().default(false),
  createdAt: z.date(),
  updatedAt: z.date(),
})

export type TeamSpace = z.infer<typeof TeamSpaceSchema>
export type SpaceMember = z.infer<typeof SpaceMemberSchema>
export type AuditorLink = z.infer<typeof AuditorLinkSchema>

/**
 * Permission matrix for space roles
 */
const SPACE_ROLE_PERMISSIONS: Record<string, string[]> = {
  OWNER: [
    'VIEW', 'EDIT', 'DELETE', 'SHARE',
    'MANAGE_MEMBERS', 'MANAGE_SETTINGS', 'EXPORT', 'AUDIT_LOG_ACCESS'
  ],
  EDITOR: [
    'VIEW', 'EDIT', 'SHARE', 'EXPORT'
  ],
  VIEWER: [
    'VIEW'
  ],
  AUDITOR: [
    'VIEW', 'AUDIT_LOG_ACCESS'
  ],
  REDACTED_VIEWER: [
    'VIEW', 'AUDIT_LOG_ACCESS'
  ],
}

/**
 * Gets permissions for a space role
 */
export function getSpaceRolePermissions(role: string): string[] {
  return SPACE_ROLE_PERMISSIONS[role] || []
}

/**
 * Checks if a user has permission in a space
 */
export function hasSpacePermission(
  role: string,
  permission: string
): boolean {
  const permissions = getSpaceRolePermissions(role)
  return permissions.includes(permission)
}

/**
 * Default permissions for different space types
 */
export function getDefaultSpaceRoles(spaceType: 'TEAM' | 'PROJECT' | 'AUDIT' | 'FILING' | 'CLIENT_PORTAL'): Record<string, string[]> {
  const baseRoles = {
    OWNER: ['OWNER'],
    EDITOR: ['EDITOR'],
    VIEWER: ['VIEWER'],
  }

  switch (spaceType) {
    case 'AUDIT':
      return {
        ...baseRoles,
        AUDITOR: ['AUDITOR'],
        REDACTED_VIEWER: ['REDACTED_VIEWER'],
      }
    case 'FILING':
      return {
        ...baseRoles,
        AUDITOR: ['AUDITOR'],
      }
    case 'CLIENT_PORTAL':
      return {
        CLIENT: ['VIEWER'],
        SUPPORT: ['EDITOR'],
        ADMIN: ['OWNER'],
      }
    default:
      return baseRoles
  }
}

/**
 * Determines visibility options based on space type
 */
export function getVisibilityOptions(spaceType: string): string[] {
  if (spaceType === 'CLIENT_PORTAL') {
    return ['PUBLIC'] // Client portals are typically public
  }
  if (spaceType === 'AUDIT') {
    return ['PRIVATE'] // Audit spaces are always private
  }
  return ['PRIVATE', 'TEAM']
}

/**
 * Applies redaction to data based on user role and redaction settings
 */
export function applyRedaction(
  data: Record<string, any>,
  userRole: string,
  redactionSettings?: {
    enabled: boolean
    redactedFields: string[]
    redactedForRoles: string[]
  }
): Record<string, any> {
  if (!redactionSettings?.enabled) {
    return data
  }

  // If user role is in redacted roles, apply redaction
  if (!redactionSettings.redactedForRoles.includes(userRole)) {
    return data
  }

  // Create redacted copy
  const redacted = { ...data }

  // Redact specified fields
  for (const field of redactionSettings.redactedFields) {
    if (field in redacted) {
      const value = redacted[field]
      if (typeof value === 'string') {
        redacted[field] = `[REDACTED] (${value.length} chars)`
      } else if (typeof value === 'number') {
        redacted[field] = '[REDACTED]'
      } else {
        redacted[field] = '[REDACTED]'
      }
    }
  }

  return redacted
}

/**
 * Validates auditor access to specific resources
 */
export function validateAuditorAccess(
  auditorLink: Partial<AuditorLink>,
  resourceType: 'ENTITY' | 'FILING' | 'DOCUMENT',
  resourceId: string
): boolean {
  if (!auditorLink) {
    return false
  }

  // Check access dates
  const now = new Date()
  if (auditorLink.accessStartDate && now < auditorLink.accessStartDate) {
    return false
  }
  if (auditorLink.accessEndDate && now > auditorLink.accessEndDate) {
    return false
  }

  // Check scope
  if (auditorLink.scope === 'FULL') {
    return true
  }

  // Check resource-specific restrictions
  switch (resourceType) {
    case 'ENTITY':
      return !auditorLink.restrictedEntities?.length ||
        auditorLink.restrictedEntities.includes(resourceId)
    case 'FILING':
      return !auditorLink.restrictedFilings?.length ||
        auditorLink.restrictedFilings.includes(resourceId)
    case 'DOCUMENT':
      return !auditorLink.restrictedDocumentTypes?.length ||
        auditorLink.restrictedDocumentTypes.includes(resourceId)
    default:
      return false
  }
}

/**
 * Determines visible fields based on auditor link restrictions
 */
export function filterVisibleFields(
  data: Record<string, any>,
  auditorLink: Partial<AuditorLink>,
  fieldMapping: Record<string, string> = {}
): Record<string, any> {
  const filtered: Record<string, any> = {}

  for (const [key, value] of Object.entries(data)) {
    const fieldType = fieldMapping[key] || 'general'

    // Always allow audit trail fields
    if (key === 'auditTrail' || key === 'createdAt' || key === 'updatedAt') {
      filtered[key] = value
      continue
    }

    // Check if field type is restricted
    if (fieldType && auditorLink.restrictedDocumentTypes?.includes(fieldType)) {
      filtered[key] = '[AUDITOR_RESTRICTED]'
    } else {
      filtered[key] = value
    }
  }

  return filtered
}

/**
 * Generates audit log entry for space activity
 */
export function generateSpaceAuditLog(
  action: string,
  userId: string,
  spaceId: string,
  details?: Record<string, any>
): Record<string, any> {
  return {
    id: Math.random().toString(36).substr(2, 9),
    action,
    userId,
    spaceId,
    details,
    timestamp: new Date(),
    ipAddress: undefined, // Will be set by API middleware
  }
}

/**
 * Validates member permissions for an action
 */
export function validateMemberPermission(
  member: Partial<SpaceMember>,
  requiredPermission: string
): boolean {
  if (!member?.permissions) {
    const rolePermissions = getSpaceRolePermissions(member?.role || 'VIEWER')
    return rolePermissions.includes(requiredPermission)
  }
  return member.permissions.includes(requiredPermission)
}
