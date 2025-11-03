import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { prisma } from '@/lib/prisma'
import { authOptions } from '@/lib/auth'

/**
 * POST /api/admin/filter-presets/[id]/set-default
 * Set a filter preset as the default for the entity type
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
    })

    if (!user?.tenantId) {
      return NextResponse.json(
        { error: 'No tenant found' },
        { status: 400 }
      )
    }

    const preset = await prisma.filter_presets.findUnique({
      where: { id: params.id },
    })

    if (!preset) {
      return NextResponse.json(
        { error: 'Preset not found' },
        { status: 404 }
      )
    }

    // Only owner or admin can set as default
    if (preset.createdBy !== session.user.id && !session.user.role?.includes('ADMIN')) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Clear other default presets for the same entity type
    await prisma.filter_presets.updateMany({
      where: {
        tenantId: preset.tenantId,
        entityType: preset.entityType,
        isDefault: true,
        NOT: { id: params.id },
      },
      data: {
        isDefault: false,
      },
    })

    // Set this one as default
    const updatedPreset = await prisma.filter_presets.update({
      where: { id: params.id },
      data: {
        isDefault: true,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      ...updatedPreset,
      filterConfig: JSON.parse(updatedPreset.filterConfig),
    })
  } catch (error) {
    console.error('Failed to set default preset:', error)
    return NextResponse.json(
      { error: 'Failed to set as default' },
      { status: 500 }
    )
  }
}
