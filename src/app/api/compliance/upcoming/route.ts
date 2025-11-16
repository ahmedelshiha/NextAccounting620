import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * GET /api/compliance/upcoming
 * Get upcoming compliance deadlines for the tenant's entities
 * Supports filtering and pagination
 */
const _api_GET = async (request: NextRequest) => {
  try {
    const ctx = requireTenantContext();
    const userId = ctx.userId;
    const tenantId = ctx.tenantId;

    if (!userId || !tenantId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);
    const status = searchParams.get("status") || "UPCOMING";
    const country = searchParams.get("country");
    const obligationType = searchParams.get("type");

    // Get upcoming filing periods
    const filingPeriods = await prisma.filingPeriod.findMany({
      where: {
        obligation: {
          entity: {
            tenantId: tenantId,
          },
          ...(country && { country }),
          ...(obligationType && { type: obligationType }),
        },
        ...(status && { status }),
        dueAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // Next 90 days
        },
      },
      include: {
        obligation: {
          include: {
            entity: true,
          },
        },
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        dueAt: "asc",
      },
      take: limit,
    });

    // Transform to response format
    const upcomingCompliance = filingPeriods.map((period) => {
      const daysUntilDue = Math.ceil(
        (period.dueAt.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );

      let priority: "high" | "medium" | "low";
      if (daysUntilDue <= 3) {
        priority = "high";
      } else if (daysUntilDue <= 10) {
        priority = "medium";
      } else {
        priority = "low";
      }

      return {
        id: period.id,
        entityId: period.obligation.entityId,
        entityName: period.obligation.entity.name,
        type: period.obligation.type,
        frequency: period.obligation.frequency,
        dueAt: period.dueAt.toISOString(),
        periodStart: period.periodStart.toISOString(),
        periodEnd: period.periodEnd.toISOString(),
        status: period.status,
        priority,
        daysUntilDue,
        assignee: period.assignee,
        notes: period.notes,
        snoozeUntil: period.snoozeUntil?.toISOString() || null,
      };
    });

    logger.info("Fetched upcoming compliance deadlines", {
      tenantId: ctx.tenantId,
      count: upcomingCompliance.length,
    });

    return NextResponse.json({
      success: true,
      data: upcomingCompliance,
      metadata: {
        total: upcomingCompliance.length,
        limit,
      },
    });
  } catch (error) {
    logger.error("Error fetching upcoming compliance", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withTenantContext(_api_GET, { requireAuth: true });
