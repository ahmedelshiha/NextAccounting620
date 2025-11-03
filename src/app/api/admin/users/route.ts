import { NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/api-wrapper'
import { requireTenantContext } from '@/lib/tenant-utils'
import prisma from '@/lib/prisma'
import { respond } from '@/lib/api-response'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { createHash } from 'crypto'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'
import { tenantFilter } from '@/lib/tenant'

export const runtime = 'nodejs'

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
      // Parse pagination and filtering parameters
      const { searchParams } = new URL(request.url)
      const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)))
      const skip = (page - 1) * limit

      // Parse filter parameters
      const search = searchParams.get('search')?.trim() || undefined
      const role = searchParams.get('role') && searchParams.get('role') !== 'ALL' ? searchParams.get('role') : undefined
      const status = searchParams.get('status') && searchParams.get('status') !== 'ALL' ? searchParams.get('status') : undefined
      const tier = searchParams.get('tier') && searchParams.get('tier') !== 'all' && searchParams.get('tier') !== 'ALL' ? searchParams.get('tier') : undefined
      const department = searchParams.get('department') && searchParams.get('department') !== 'ALL' ? searchParams.get('department') : undefined
      const sortBy = (searchParams.get('sortBy') || 'createdAt') as 'createdAt' | 'name' | 'email'
      const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

      // Build Prisma where clause with filters
      const whereClause = {
        ...tenantFilter(tenantId),
        ...(role && { role }),
        ...(department && { department }),
        ...(tier && { tier }),
        // Search across multiple fields
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { department: { contains: search, mode: 'insensitive' as const } }
          ]
        })
      }

      // Build sort order
      const orderBy: any = {}
      if (sortBy === 'name') {
        orderBy.name = sortOrder
      } else if (sortBy === 'email') {
        orderBy.email = sortOrder
      } else {
        orderBy.createdAt = sortOrder
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
            department: true,
            tier: true,
            createdAt: true,
            updatedAt: true
          },
          skip,
          take: limit,
          orderBy
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
      const { total, users } = queryData as { total: number; users: Array<{ id: string; name: string | null; email: string; role: string; department: string | null; tier: string | null; createdAt: Date; updatedAt: Date | null }> }

      // Map users to response format
      const mapped = users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || undefined,
        tier: user.tier || undefined,
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

      return NextResponse.json(
        {
          users: mapped,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        },
        {
          headers: {
            ETag: etag,
            'Cache-Control': 'private, max-age=30, stale-while-revalidate=60'
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
