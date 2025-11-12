import { NextRequest, NextResponse } from "next/server";
import { withTenantContext } from "@/lib/api-wrapper";
import { requireTenantContext } from "@/lib/tenant-utils";
import { entityService } from "@/services/entities";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { z } from "zod";
import crypto from "crypto";

// Validation schema for setup wizard
const setupWizardSchema = z.object({
  country: z.string().length(2),
  tab: z.enum(["existing", "new", "individual"]),
  businessName: z.string().min(1).max(255),
  legalForm: z.string().optional(),
  licenseNumber: z.string().optional(),
  economicZoneId: z.string().optional(),
  registrations: z.array(z.object({
    type: z.string(),
    value: z.string(),
  })).optional(),
  consentVersion: z.string(),
  idempotencyKey: z.string().uuid(),
});

/**
 * POST /api/entities/setup
 * Idempotent entity setup endpoint from wizard
 * Returns entity_setup_id for tracking verification job
 */
const _api_POST = async (request: NextRequest) => {
  try {
    const ctx = requireTenantContext();
    const userId = ctx.userId;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const body = await request.json();

    // Validate input
    const input = setupWizardSchema.parse(body);

    // Check idempotency key
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: {
        tenantId_key: {
          tenantId: ctx.tenantId!,
          key: input.idempotencyKey,
        },
      },
    });

    if (existingKey?.entityId) {
      // Already processed - return existing entity
      return NextResponse.json({
        success: true,
        data: {
          entityId: existingKey.entityId,
          setupJobId: existingKey.entityId,
          status: "ALREADY_PROCESSED",
        },
      });
    }

    // Create entity with setup wizard data
    const entity = await entityService.createEntity(
      ctx.tenantId!,
      userId,
      {
        country: input.country,
        name: input.businessName,
        legalForm: input.legalForm,
        entityType: input.tab === "individual" ? "individual" : "company",
        licenses: input.licenseNumber ? [{
          country: input.country,
          authority: "DED", // Will be determined per country
          licenseNumber: input.licenseNumber,
          economicZoneId: input.economicZoneId,
        }] : undefined,
        registrations: input.registrations || [],
      }
    );

    // Record consent
    await prisma.consent.create({
      data: {
        tenantId: ctx.tenantId!,
        entityId: entity.id,
        type: "terms",
        version: input.consentVersion,
        acceptedBy: userId,
        ip: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
        userAgent: request.headers.get("user-agent") || undefined,
      },
    });

    // Mark idempotency key as processed
    if (existingKey) {
      await prisma.idempotencyKey.update({
        where: { id: existingKey.id },
        data: { entityId: entity.id, status: "PROCESSED" },
      });
    } else {
      await prisma.idempotencyKey.create({
        data: {
          tenantId: ctx.tenantId!,
          key: input.idempotencyKey,
          userId: userId,
          entityType: "entity",
          entityId: entity.id,
          status: "PROCESSED",
        },
      });
    }

    // Emit audit event
    await prisma.auditEvent.create({
      data: {
        tenantId: ctx.tenantId!,
        userId: userId,
        type: "entity.setup.requested",
        resource: "entity",
        details: {
          entityId: entity.id,
          country: input.country,
          tab: input.tab,
        },
      },
    });

    logger.info("Entity setup initiated", {
      entityId: entity.id,
      country: input.country,
      tab: input.tab,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          entityId: entity.id,
          setupJobId: entity.id,
          status: "PENDING_VERIFICATION",
          verificationEstimate: "~5 minutes",
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    logger.error("Error in entity setup", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
};

export const POST = withTenantContext(_api_POST, { requireAuth: true });
