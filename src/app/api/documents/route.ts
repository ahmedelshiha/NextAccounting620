import { NextRequest, NextResponse } from 'next/server'
import { withTenantContext } from '@/lib/api-wrapper'
import { requireTenantContext } from '@/lib/tenant-utils'
import { prisma } from '@/lib/prisma'
import { logAuditSafe } from '@/lib/observability-helpers'
import { z } from 'zod'

const DocumentFilterSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20).optional(),
  offset: z.coerce.number().min(0).default(0).optional(),
  search: z.string().optional(),
  category: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(['uploadedAt', 'name', 'size']).default('uploadedAt').optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc').optional(),
  avStatus: z.string().optional(),
})

type DocumentFilter = z.infer<typeof DocumentFilterSchema>

async function GET(request: NextRequest) {
  try {
    const { userId, tenantId } = requireTenantContext()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 })
    }

    // Parse and validate query parameters
    const queryParams = Object.fromEntries(request.nextUrl.searchParams)
    const filters = DocumentFilterSchema.parse(queryParams)

    // Build Prisma where clause
    const where: any = {
      tenantId,
      AND: [],
    }

    // Search filter
    if (filters.search) {
      where.AND.push({
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { key: { contains: filters.search, mode: 'insensitive' } },
        ],
      })
    }

    // Category filter
    if (filters.category) {
      // Extract category from key or use a metadata approach
      where.AND.push({
        key: { contains: filters.category, mode: 'insensitive' },
      })
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      const dateFilter: any = {}
      if (filters.startDate) {
        dateFilter.gte = new Date(filters.startDate)
      }
      if (filters.endDate) {
        dateFilter.lte = new Date(filters.endDate)
      }
      where.AND.push({ uploadedAt: dateFilter })
    }

    // Antivirus status filter
    if (filters.avStatus) {
      where.AND.push({ avStatus: filters.avStatus })
    }

    // Remove empty AND array
    if (where.AND.length === 0) {
      delete where.AND
    }

    // Count total documents matching filters
    const total = await prisma.attachment.count({ where })

    // Fetch paginated documents
    const documents = await prisma.attachment.findMany({
      where,
      select: {
        id: true,
        name: true,
        size: true,
        contentType: true,
        key: true,
        url: true,
        uploadedAt: true,
        avStatus: true,
        avThreatName: true,
        provider: true,
        uploader: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        [filters.sortBy || 'uploadedAt']: filters.sortOrder || 'desc',
      },
      take: filters.limit,
      skip: filters.offset,
    })

    // Format response
    const formattedDocuments = documents.map((doc) => ({
      id: doc.id,
      name: doc.name || 'Unknown',
      size: doc.size || 0,
      contentType: doc.contentType || 'application/octet-stream',
      uploadedAt: doc.uploadedAt.toISOString(),
      category: extractCategory(doc.key || ''),
      isQuarantined: doc.avStatus === 'infected',
      avStatus: doc.avStatus,
      avThreatName: doc.avThreatName,
      provider: doc.provider,
      uploadedBy: doc.uploader
        ? {
            id: doc.uploader.id,
            email: doc.uploader.email,
            name: doc.uploader.name,
          }
        : null,
      url: doc.url,
    }))

    // Log access
    await logAuditSafe({
      action: 'documents:list',
      details: {
        count: documents.length,
        total,
        filters: {
          search: filters.search ? true : false,
          category: filters.category || undefined,
          avStatus: filters.avStatus || undefined,
        },
      },
    }).catch(() => {}) // Non-critical logging

    return NextResponse.json(
      {
        documents: formattedDocuments,
        pagination: {
          total,
          limit: filters.limit,
          offset: filters.offset,
          hasMore: filters.offset + filters.limit < total,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: error.errors,
        },
        { status: 400 }
      )
    }

    console.error('Documents list API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export default withTenantContext(GET, { requireAuth: true })

/**
 * Extract category from storage key path
 * Examples:
 *   portal/tax-documents/invoice.pdf → Tax Documents
 *   portal/receipts/receipt-001.pdf → Receipts
 */
function extractCategory(key: string): string {
  const parts = key.split('/')
  if (parts.length < 2) return 'Other'

  const categoryPart = parts[1]
  return categoryPart
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
