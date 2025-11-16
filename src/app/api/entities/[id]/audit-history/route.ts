import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import { entityService } from "@/services/entities";
import { logger } from "@/lib/logger";

/**
 * GET /api/entities/[id]/audit-history
 * Get entity audit history/changelog
 */
const _api_GET = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
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

    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 50;

    // Get audit history
    const history = await entityService.getAuditHistory(
      tenantId,
      params.id,
      limit
    );

    return NextResponse.json({
      success: true,
      data: history,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    logger.error("Error fetching audit history", { error, entityId: params.id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withTenantContext(_api_GET, { requireAuth: true });
