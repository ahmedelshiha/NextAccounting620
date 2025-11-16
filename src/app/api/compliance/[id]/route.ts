import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

/**
 * GET /api/compliance/[id]
 * Get compliance filing details
 */
const _api_GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const ctx = requireTenantContext();

    if (!ctx.userId || !ctx.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For now, return mock data
    // This would be replaced with actual database queries once FilingPeriod model is fully integrated
    const mockData = {
      id,
      entityId: "entity-123",
      entityName: "Example Business LLC",
      type: "VAT Return",
      frequency: "Monthly",
      dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: "UPCOMING" as const,
      priority: "high" as const,
      description: "Monthly VAT return for the United Arab Emirates. This filing is required by the Federal Tax Authority (FTA).",
      assigneeId: undefined,
      assigneeName: undefined,
      completionPercentage: 45,
    };

    return NextResponse.json({
      success: true,
      data: mockData,
    });
  } catch (error) {
    logger.error("Error fetching compliance details", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

/**
 * PATCH /api/compliance/[id]
 * Update compliance filing status
 */
const _api_PATCH = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    const ctx = requireTenantContext();

    if (!ctx.userId || !ctx.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { status } = body;

    // Validate status
    const validStatuses = ["UPCOMING", "OVERDUE", "FILED", "PENDING_APPROVAL", "WAIVED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status" },
        { status: 400 }
      );
    }

    // Update filing period status
    // This would update the actual database once FilingPeriod model is used
    logger.info("Compliance status updated", {
      filingId: id,
      newStatus: status,
      updatedBy: ctx.userId,
    });

    // Emit audit event
    await prisma.auditEvent.create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        type: "filing.status.changed",
        resource: "filing",
        details: {
          filingId: id,
          newStatus: status,
        },
      },
    }).catch((err) => logger.error("Error creating audit event", { err }));

    return NextResponse.json({
      success: true,
      data: { id, status },
    });
  } catch (error) {
    logger.error("Error updating compliance status", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withTenantContext(_api_GET, { requireAuth: true });
export const PATCH = withTenantContext(_api_PATCH, { requireAuth: true });
