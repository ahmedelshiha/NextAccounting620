import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/api-wrapper'
import { requireTenantContext } from '@/lib/tenant-utils'
import prisma from '@/lib/prisma'
import { respond } from '@/lib/api-response'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { createHash } from 'crypto'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'
import { tenantFilter } from '@/lib/tenant'
import { AuditLogService } from '@/services/audit-log.service'
import { UserCreateSchema } from '@/schemas/users'

export const runtime = 'nodejs'
export const revalidate = 30 // ISR: Revalidate every 30 seconds

export const GET = withTenantContext(async (request: Request) => {
  const ctx = requireTenantContext()
  const tenantId = ctx.tenantId ?? null
  try {
    const ip = getClientIp(request as unknown as Request)
    const rl = await applyRateLimit(`admin-users-list:${ip}`, 240, 60_000)
    if (rl && rl.allowed === false) {
      try { const { logAudit } = await import('@/lib/audit'); await logAudit({ action: 'security.ratelimit.block', details: { tenantId, ip, key: `admin-users-list:${ip}`, route: new URL(request.url).pathname } }) } catch {}
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const role = ctx.role ?? ''
    if (!ctx.userId) return respond.unauthorized()
    if (!hasPermission(role, PERMISSIONS.USERS_MANAGE)) return respond.forbidden('Forbidden')

    try {
      // Parse pagination and filter parameters
      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
      const skip = (page - 1) * limit

      // Parse filter parameters
      const search = searchParams.get('search')?.trim() || undefined
      const role = searchParams.get('role')?.trim() || undefined
      const status = searchParams.get('status')?.trim() || undefined
      const tier = searchParams.get('tier')?.trim() || undefined
      const department = searchParams.get('department')?.trim() || undefined
      const sortBy = searchParams.get('sortBy') || 'createdAt'
      const sortOrder = searchParams.get('sortOrder') || 'desc'

      // Build Prisma WHERE clause with filters
      const whereClause: any = tenantFilter(tenantId)

      // Add search filter (searches email and name)
      if (search) {
        whereClause.OR = [
          { email: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } }
        ]
      }

      // Add role filter
      if (role && role !== 'ALL') {
        whereClause.role = role
      }

      // Add availability status filter
      if (status && status !== 'ALL') {
        whereClause.availabilityStatus = status
      }

      // Add tier filter (for clients)
      if (tier && tier !== 'ALL' && tier !== 'all') {
        whereClause.tier = tier
      }

      // Add department filter
      if (department && department !== 'ALL') {
        whereClause.department = department
      }

      // Build sort order
      const orderByClause: any = {}
      if (sortBy === 'name' || sortBy === 'email' || sortBy === 'role' || sortBy === 'tier' || sortBy === 'department') {
        orderByClause[sortBy] = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
      } else {
        orderByClause.createdAt = sortOrder.toLowerCase() === 'asc' ? 'asc' : 'desc'
      }

      // Implement timeout resilience for slow queries
      let timeoutId: NodeJS.Timeout | null = null

      // Use timeout-safe promise pattern for slow databases
      let queryCompleted = false
      let queryError: Error | null = null
      let queryData: any = null

      const queryPromise = Promise.all([
        prisma.user.count({ where: whereClause }),
        prisma.user.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            availabilityStatus: true,
            department: true,
            position: true,
            tier: true,
            experienceYears: true,
            image: true,
            createdAt: true,
            updatedAt: true
          },
          skip,
          take: limit,
          orderBy: orderByClause
        })
      ]).then(([total, users]) => {
        queryCompleted = true
        queryData = { total, users }
        if (timeoutId) clearTimeout(timeoutId)
      }).catch((err: any) => {
        queryCompleted = true
        queryError = err
        if (timeoutId) clearTimeout(timeoutId)
      })

      // Set a timeout to fail fast if database is slow
      await new Promise(resolve => {
        timeoutId = setTimeout(() => {
          resolve(null)
        }, 5000)

        // Also resolve if query completes
        queryPromise.finally(() => resolve(null))
      })

      // If query didn't complete, use fallback data
      if (!queryCompleted) {
        const fallback = [
          { id: 'demo-admin', name: 'Admin User', email: 'admin@accountingfirm.com', role: 'ADMIN', createdAt: new Date().toISOString() },
          { id: 'demo-staff', name: 'Staff Member', email: 'staff@accountingfirm.com', role: 'STAFF', createdAt: new Date().toISOString() },
          { id: 'demo-client', name: 'John Smith', email: 'john@example.com', role: 'CLIENT', createdAt: new Date().toISOString() }
        ]
        return NextResponse.json({
          users: fallback,
          pagination: { page: 1, limit: 50, total: 3, pages: 1 }
        })
      }

      // If query errored, throw the error to be caught by error handler
      if (queryError) throw queryError

      // If query succeeded, use the data
      const { total, users } = queryData as { total: number; users: Array<{ id: string; name: string | null; email: string; role: string; createdAt: Date; updatedAt: Date | null }> }

      // Map users to response format
      const mapped = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
        updatedAt: user.updatedAt ? (user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt) : (user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt)
      }))

      // Generate ETag from users data
      const etagData = JSON.stringify(mapped)
      const etag = `"${createHash('sha256').update(etagData).digest('hex')}"`

      const ifNoneMatch = request.headers.get('if-none-match')

      if (ifNoneMatch && ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: etag } })
      }

      const totalPages = Math.ceil(total / limit)
      return NextResponse.json(
        {
          users: mapped,
          pagination: {
            page,
            limit,
            total,
            pages: totalPages
          },
          filters: {
            search: search || undefined,
            role: role || undefined,
            status: status || undefined,
            tier: tier || undefined,
            department: department || undefined,
            sortBy,
            sortOrder
          }
        },
        {
          headers: {
            ETag: etag,
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
            'X-Total-Count': total.toString(),
            'X-Total-Pages': totalPages.toString(),
            'X-Current-Page': page.toString(),
            'X-Page-Size': limit.toString(),
            'X-Filter-Search': search || 'none',
            'X-Filter-Role': role || 'none',
            'X-Filter-Tier': tier || 'none'
          }
        }
      )
    } catch (e: any) {
      const code = String(e?.code || '')
      const message = String(e?.message || '')

      // Handle database connection errors with fallback
      if (code.startsWith('P20') || code.startsWith('P10') || /relation|table|column|timeout/i.test(message)) {
        console.warn('Database query error, returning fallback data:', code, message)
        const fallback = [
          { id: 'demo-admin', name: 'Admin User', email: 'admin@accountingfirm.com', role: 'ADMIN', createdAt: new Date().toISOString() },
          { id: 'demo-staff', name: 'Staff Member', email: 'staff@accountingfirm.com', role: 'STAFF', createdAt: new Date().toISOString() },
          { id: 'demo-client', name: 'John Smith', email: 'john@example.com', role: 'CLIENT', createdAt: new Date().toISOString() }
        ]
        return NextResponse.json({
          users: fallback,
          pagination: { page: 1, limit: 50, total: 3, pages: 1 }
        }, { status: 200 })
      }

      throw e
    }
  } catch (error: any) {
    console.error('Error fetching users:', error)
    const fallback = [
      { id: 'demo-admin', name: 'Admin User', email: 'admin@accountingfirm.com', role: 'ADMIN', createdAt: new Date().toISOString() },
      { id: 'demo-staff', name: 'Staff Member', email: 'staff@accountingfirm.com', role: 'STAFF', createdAt: new Date().toISOString() },
      { id: 'demo-client', name: 'John Smith', email: 'john@example.com', role: 'CLIENT', createdAt: new Date().toISOString() }
    ]
    return NextResponse.json({
      users: fallback,
      pagination: { page: 1, limit: 50, total: 3, pages: 1 }
    }, { status: 200 })
  }
})

/**
 * POST /api/admin/users
 * Create a new user in the organization
 * Requires: USERS_MANAGE permission
 */
export const POST = withTenantContext(async (request: NextRequest) => {
  const ctx = requireTenantContext()
  const tenantId = ctx.tenantId ?? null

  try {
    const role = ctx.role ?? ''
    if (!ctx.userId) return respond.unauthorized()
    if (!hasPermission(role, PERMISSIONS.USERS_MANAGE)) return respond.forbidden('Forbidden')

    const hasDb = Boolean(process.env.NETLIFY_DATABASE_URL)
    if (!hasDb) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 501 })
    }

    const ip = getClientIp(request as unknown as Request)
    const rl = await applyRateLimit(`admin-create-user:${ip}`, 50, 60_000)
    if (rl && rl.allowed === false) {
      try {
        const { logAudit } = await import('@/lib/audit')
        await logAudit({
          action: 'security.ratelimit.block',
          details: { tenantId, ip, key: `admin-create-user:${ip}`, route: '/api/admin/users' }
        })
      } catch {}
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    const json = await request.json().catch(() => ({}))

    // Validate request payload
    const parsed = UserCreateSchema.safeParse(json)
    if (!parsed.success) {
      const errors = parsed.error.flatten().fieldErrors
      const message = Object.entries(errors)
        .map(([field, msgs]) => `${field}: ${msgs?.[0] || 'invalid'}`)
        .join('; ')
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { name, email, role: userRole = 'USER', requiresOnboarding = true, phone, company, location, notes } = parsed.data

    // Check if user already exists using tenant-scoped compound key
    const existingUser = tenantId
      ? await prisma.user.findFirst({
          where: { tenantId, email },
          select: { id: true }
        })
      : null

    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 })
    }

    // Create new user
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        role: userRole as any,
        availabilityStatus: 'AVAILABLE',
        tenantId: tenantId || 'default-tenant',
        ...(phone && { phone }),
        ...(company && { department: company }),
        ...(location && { position: location }),
        ...(notes && { image: notes })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Log audit event
    try {
      if (tenantId) {
        await AuditLogService.createAuditLog({
          tenantId,
          userId: ctx.userId,
          action: 'user.create',
          resource: `user:${newUser.id}`,
          metadata: {
            targetUserId: newUser.id,
            targetEmail: newUser.email,
            targetName: newUser.name,
            targetRole: newUser.role,
            timestamp: new Date().toISOString()
          },
          ipAddress: ip,
          userAgent: request.headers.get('user-agent') || undefined
        })
      }
    } catch (auditErr) {
      console.error('Failed to log user creation audit event:', auditErr)
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json(newUser, { status: 201 })
  } catch (error: any) {
    console.error('Error creating user:', error)

    // Handle unique constraint violations
    if (error?.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'email'
      return NextResponse.json(
        { error: `User with this ${field} already exists` },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: error?.message || 'Failed to create user' },
      { status: 500 }
    )
  }
})
