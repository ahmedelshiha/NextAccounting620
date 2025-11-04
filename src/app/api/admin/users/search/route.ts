import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/api-wrapper'
import { requireTenantContext } from '@/lib/tenant-utils'
import prisma from '@/lib/prisma'
import { respond } from '@/lib/api-response'
import { hasPermission, PERMISSIONS } from '@/lib/permissions'
import { tenantFilter } from '@/lib/tenant'
import { applyRateLimit, getClientIp } from '@/lib/rate-limit'
import { createHash } from 'crypto'

export const runtime = 'nodejs'
export const revalidate = 30 // ISR: Revalidate every 30 seconds for search results

// Maximum allowed page size (prevent memory abuse)
const MAX_LIMIT = 250
const DEFAULT_LIMIT = 50
const MIN_SEARCH_LENGTH = 2

export interface UserFilterOptions {
  search?: string
  role?: string
  status?: string
  department?: string
  tier?: string
  experienceYears?: { min?: number; max?: number }
  createdAfter?: string
  createdBefore?: string
  sortBy?: 'name' | 'email' | 'createdAt' | 'role' | 'department' | 'tier'
  sortOrder?: 'asc' | 'desc'
  page: number
  limit: number
}

export const GET = withTenantContext(async (request: NextRequest) => {
  const ctx = requireTenantContext()
  const tenantId = ctx.tenantId ?? null

  try {
    const ip = getClientIp(request as unknown as Request)
    const rl = await applyRateLimit(`admin-users-search:${ip}`, 100, 60_000)
    if (rl && rl.allowed === false) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
    }

    if (!ctx.userId) return respond.unauthorized()
    if (!hasPermission(ctx.role ?? '', PERMISSIONS.USERS_MANAGE)) return respond.forbidden('Forbidden')

    // Parse query parameters
    const { searchParams } = new URL(request.url)

    // Validate and sanitize pagination parameters
    const pageParam = parseInt(searchParams.get('page') || '1', 10)
    const limitParam = parseInt(searchParams.get('limit') || DEFAULT_LIMIT.toString(), 10)

    const page = Math.max(1, isNaN(pageParam) ? 1 : pageParam)
    const limit = Math.max(1, Math.min(MAX_LIMIT, isNaN(limitParam) ? DEFAULT_LIMIT : limitParam))

    const filters: UserFilterOptions = {
      search: searchParams.get('search') || undefined,
      role: searchParams.get('role') || undefined,
      status: searchParams.get('status') || undefined,
      department: searchParams.get('department') || undefined,
      tier: searchParams.get('tier') || undefined,
      sortBy: (searchParams.get('sortBy') as any) || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
      page,
      limit
    }

    // Validate sort order
    if (!['asc', 'desc'].includes(filters.sortOrder)) {
      filters.sortOrder = 'desc'
    }

    // Validate sort field
    const validSortFields = ['name', 'email', 'createdAt', 'role', 'department', 'tier']
    if (!validSortFields.includes(filters.sortBy)) {
      filters.sortBy = 'createdAt'
    }

    // Parse date filters
    if (searchParams.get('createdAfter')) {
      const createdAfter = searchParams.get('createdAfter')
      if (createdAfter && !isNaN(Date.parse(createdAfter))) {
        filters.createdAfter = createdAfter
      }
    }
    if (searchParams.get('createdBefore')) {
      const createdBefore = searchParams.get('createdBefore')
      if (createdBefore && !isNaN(Date.parse(createdBefore))) {
        filters.createdBefore = createdBefore
      }
    }

    // Parse experience range with validation
    const minExp = searchParams.get('minExperience')
    const maxExp = searchParams.get('maxExperience')
    if (minExp || maxExp) {
      filters.experienceYears = {
        min: minExp ? Math.max(0, parseInt(minExp, 10)) : undefined,
        max: maxExp ? Math.max(0, parseInt(maxExp, 10)) : undefined
      }
    }

    // Build Prisma where clause
    const where: any = tenantFilter(tenantId)

    // Enhanced full-text search: search across multiple fields
    if (filters.search && filters.search.length >= MIN_SEARCH_LENGTH) {
      const searchTerm = filters.search.trim()
      // Use OR to search across multiple fields for better matching
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { position: { contains: searchTerm, mode: 'insensitive' } },
        { department: { contains: searchTerm, mode: 'insensitive' } }
      ]
    }

    // Add role filter (exact match)
    if (filters.role && filters.role.length > 0) {
      where.role = filters.role
    }

    // Add status filter (exact match)
    if (filters.status && filters.status.length > 0) {
      where.status = filters.status
    }

    // Add department filter (exact match)
    if (filters.department && filters.department.length > 0) {
      where.department = filters.department
    }

    // Add tier filter (exact match)
    if (filters.tier && filters.tier.length > 0) {
      where.tier = filters.tier
    }

    // Add experience range filter (numerical range)
    if (filters.experienceYears) {
      where.experienceYears = {}
      if (filters.experienceYears.min !== undefined) {
        where.experienceYears.gte = filters.experienceYears.min
      }
      if (filters.experienceYears.max !== undefined) {
        where.experienceYears.lte = filters.experienceYears.max
      }
      // Clean up empty object
      if (Object.keys(where.experienceYears).length === 0) {
        delete where.experienceYears
      }
    }

    // Add date range filters
    if (filters.createdAfter || filters.createdBefore) {
      where.createdAt = {}
      if (filters.createdAfter) {
        where.createdAt.gte = new Date(filters.createdAfter)
      }
      if (filters.createdBefore) {
        where.createdAt.lte = new Date(filters.createdBefore)
      }
    }

    // Build sort order - use composite indexes when possible
    const orderBy: any = {}
    if (filters.sortBy) {
      orderBy[filters.sortBy] = filters.sortOrder || 'desc'
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute queries in parallel for better performance
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
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
          hourlyRate: true,
          skills: true,
          certifications: true,
          image: true,
          hireDate: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy,
        skip,
        take: limit
      })
    ])

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    // Build response object with metadata
    const responseData = {
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage,
        hasPreviousPage
      },
      appliedFilters: {
        search: filters.search,
        role: filters.role,
        status: filters.status,
        department: filters.department,
        tier: filters.tier,
        minExperience: filters.experienceYears?.min,
        maxExperience: filters.experienceYears?.max,
        createdAfter: filters.createdAfter,
        createdBefore: filters.createdBefore,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder
      },
      query: {
        searchFieldsUsed: ['name', 'email', 'position', 'department'],
        totalFieldsSearched: filters.search ? 4 : 0
      }
    }

    // Generate ETag from response data for caching
    const etagData = JSON.stringify(responseData)
    const etag = `"${createHash('sha256').update(etagData).digest('hex')}"`

    // Check If-None-Match header for conditional request (304 Not Modified)
    const ifNoneMatch = request.headers.get('if-none-match')
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } })
    }

    // Return response with optimized caching headers
    return NextResponse.json(responseData, {
      headers: {
        ETag: etag,
        // Short cache for search results, with stale-while-revalidate
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        // Additional metadata headers for pagination
        'X-Total-Count': total.toString(),
        'X-Total-Pages': totalPages.toString(),
        'X-Current-Page': page.toString(),
        'X-Page-Size': limit.toString(),
        'X-Has-Next': hasNextPage.toString(),
        'X-Has-Previous': hasPreviousPage.toString(),
        // Indicate which filters were applied
        'X-Filters-Applied': Object.entries(filters)
          .filter(([_, value]) => value !== undefined && value !== null && value !== '')
          .map(([key]) => key)
          .join(',')
      }
    })
  } catch (error: any) {
    console.error('User search error:', error)

    // Return detailed error for debugging but safe message for client
    const errorMessage = process.env.NODE_ENV === 'development'
      ? error.message
      : 'Failed to search users'

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        code: 'SEARCH_ERROR'
      },
      { status: 500 }
    )
  }
})
