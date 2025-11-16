import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import { entityService } from "@/services/entities";
import { logger } from "@/lib/logger";
import { z } from "zod";

// Validation schema for entity creation
const createEntitySchema = z.object({
  country: z.string().length(2),
  name: z.string().min(1).max(255),
  legalForm: z.string().optional(),
  entityType: z.enum(["company", "individual", "freelancer", "partnership"]).optional(),
  activityCode: z.string().optional(),
  fiscalYearStart: z.string().datetime().optional(),
  licenses: z.array(z.object({
    country: z.string(),
    authority: z.string(),
    licenseNumber: z.string(),
    legalForm: z.string().optional(),
    economicZoneId: z.string().optional(),
  })).optional(),
  registrations: z.array(z.object({
    type: z.string(),
    value: z.string(),
    source: z.string().optional(),
  })).optional(),
});

/**
 * GET /api/entities
 * List entities for current tenant
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
    const searchParams = request.nextUrl.searchParams;

    const filters = {
      country: searchParams.get("country") || undefined,
      status: (searchParams.get("status") || undefined) as any,
      search: searchParams.get("search") || undefined,
      skip: searchParams.get("skip") ? parseInt(searchParams.get("skip")!) : 0,
      take: searchParams.get("take") ? parseInt(searchParams.get("take")!) : 50,
    };

    const entities = await entityService.listEntities(tenantId, filters as any);

    return NextResponse.json({
      success: true,
      data: entities,
    });
  } catch (error) {
    logger.error("Error listing entities", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

/**
 * POST /api/entities
 * Create new entity
 */
const _api_POST = async (request: NextRequest) => {
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
    const input = createEntitySchema.parse(body);

    // Create entity
    const entity = await entityService.createEntity(
      tenantId,
      userId,
      {
        ...input,
        fiscalYearStart: input.fiscalYearStart ? new Date(input.fiscalYearStart) : undefined,
        registrations: (input.registrations as any) || undefined,
      } as any
    );

    logger.info("Entity created successfully", {
      entityId: entity.id,
      country: entity.country,
    });

    return NextResponse.json(
      {
        success: true,
        data: entity,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error creating entity", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const GET = withTenantContext(_api_GET, { requireAuth: true });
export const POST = withTenantContext(_api_POST, { requireAuth: true });
