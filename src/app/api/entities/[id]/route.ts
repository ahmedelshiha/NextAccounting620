import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import { entityService } from "@/services/entities";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Validation schema for entity updates
const updateEntitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  legalForm: z.string().optional(),
  status: z.enum(["ACTIVE", "PENDING", "ARCHIVED", "SUSPENDED"]).optional(),
  activityCode: z.string().optional(),
});

/**
 * GET /api/entities/[id]
 * Get entity details
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

    const entity = await entityService.getEntity(tenantId, params.id);

    return NextResponse.json({
      success: true,
      data: entity,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    logger.error("Error fetching entity", { error, entityId: params.id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

/**
 * PATCH /api/entities/[id]
 * Update entity
 */
const _api_PATCH = async (
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

    const body = await request.json();

    // Validate input
    const input = updateEntitySchema.parse(body);

    // Update entity
    const entity = await entityService.updateEntity(
      tenantId,
      params.id,
      userId,
      input
    );

    logger.info("Entity updated successfully", {
      entityId: entity.id,
    });

    return NextResponse.json({
      success: true,
      data: entity,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    logger.error("Error updating entity", { error, entityId: params.id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

/**
 * DELETE /api/entities/[id]
 * Archive or delete entity
 */
const _api_DELETE = async (
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
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      // Hard delete (requires archived status)
      await entityService.deleteEntity(tenantId, params.id, userId);
    } else {
      // Soft delete (archive)
      await entityService.archiveEntity(tenantId, params.id, userId);
    }

    logger.info("Entity deleted/archived successfully", {
      entityId: params.id,
      permanent,
    });

    return NextResponse.json({
      success: true,
      message: permanent ? "Entity deleted" : "Entity archived",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "Not found or unauthorized" },
        { status: 404 }
      );
    }

    logger.error("Error deleting entity", { error, entityId: params.id });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withTenantContext(_api_GET, { requireAuth: true });
export const PATCH = withTenantContext(_api_PATCH, { requireAuth: true });
export const DELETE = withTenantContext(_api_DELETE, { requireAuth: true });
