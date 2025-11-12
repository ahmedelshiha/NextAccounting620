import prisma from "@/lib/prisma";
import {
  EntityCreateInput,
  EntityUpdateInput,
  EntityFilters,
  EntityWithRelations,
  EntityLicenseInput,
  EntityRegistrationInput,
  RegistrationType,
  ObligationInput,
} from "@/types/entitySetup";
import {
  validateIdentifier,
  getCountry,
  getObligations,
} from "@/lib/registries/countries";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

export class EntityService {
  /**
   * Create a new entity for a tenant
   */
  async createEntity(
    tenantId: string,
    userId: string,
    input: EntityCreateInput
  ): Promise<EntityWithRelations> {
    try {
      logger.info(`Creating entity for tenant ${tenantId}`, { input });

      // Validate input
      const country = getCountry(input.country);
      if (!country) {
        throw new Error(`Invalid country code: ${input.country}`);
      }

      // Check for duplicates
      const existing = await prisma.entity.findFirst({
        where: {
          tenantId,
          name: input.name,
        },
      });

      if (existing) {
        throw new Error(
          `Entity with name "${input.name}" already exists in this tenant`
        );
      }

      // Create entity with transaction
      const entity = await prisma.$transaction(async (tx) => {
        // Create main entity
        const newEntity = await tx.entity.create({
          data: {
            tenantId,
            country: input.country,
            name: input.name,
            legalForm: input.legalForm,
            status: "ACTIVE",
            fiscalYearStart: input.fiscalYearStart,
            activityCode: input.activityCode,
            metadata: input.metadata || {},
            createdBy: userId,
          },
        });

        // Create licenses if provided
        if (input.licenses && input.licenses.length > 0) {
          await Promise.all(
            input.licenses.map((license) =>
              tx.entityLicense.create({
                data: {
                  entityId: newEntity.id,
                  country: license.country,
                  authority: license.authority,
                  licenseNumber: license.licenseNumber,
                  legalForm: license.legalForm,
                  issuedAt: license.issuedAt,
                  expiresAt: license.expiresAt,
                  economicZoneId: license.economicZoneId,
                  status: license.status || "ACTIVE",
                  metadata: license.metadata || {},
                },
              })
            )
          );
        }

        // Create registrations if provided
        if (input.registrations && input.registrations.length > 0) {
          await Promise.all(
            input.registrations.map((reg) =>
              tx.entityRegistration.create({
                data: {
                  entityId: newEntity.id,
                  type: reg.type,
                  value: reg.value,
                  source: reg.source,
                  status: reg.status || "PENDING",
                  metadata: reg.metadata || {},
                },
                // Note: verifiedAt will be set by verification job
              })
            )
          );
        }

        // Create default obligations for country
        const defaultObligations = getObligations(
          input.country,
          input.entityType || "company"
        );
        await Promise.all(
          defaultObligations.map((obligation) =>
            tx.obligation.create({
              data: {
                entityId: newEntity.id,
                type: obligation.type,
                country: input.country,
                frequency: obligation.frequency,
                ruleConfig: obligation.ruleConfig || {},
                active: true,
              },
            })
          )
        );

        // Create audit log
        await tx.entityAuditLog.create({
          data: {
            entityId: newEntity.id,
            userId,
            action: "CREATE",
            changes: input,
          },
        });

        return newEntity;
      });

      logger.info(`Entity created successfully: ${entity.id}`);
      return this.getEntity(tenantId, entity.id);
    } catch (error) {
      logger.error("Error creating entity", { error, tenantId, input });
      throw error;
    }
  }

  /**
   * Get entity by ID with all relations
   */
  async getEntity(tenantId: string, entityId: string): Promise<EntityWithRelations> {
    const entity = await prisma.entity.findUniqueOrThrow({
      where: { id: entityId },
      include: {
        licenses: true,
        registrations: true,
        obligations: {
          include: {
            periods: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    // Security: verify tenant access
    if (entity.tenantId !== tenantId) {
      throw new Error("Unauthorized access to entity");
    }

    return entity;
  }

  /**
   * List entities with filters
   */
  async listEntities(
    tenantId: string,
    filters?: EntityFilters
  ): Promise<EntityWithRelations[]> {
    const where: Prisma.EntityWhereInput = { tenantId };

    if (filters?.country) {
      where.country = filters.country;
    }
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.search) {
      where.name = {
        contains: filters.search,
        mode: "insensitive",
      };
    }

    return prisma.entity.findMany({
      where,
      include: {
        licenses: true,
        registrations: true,
        obligations: {
          include: {
            periods: true,
          },
        },
      },
      orderBy: filters?.orderBy || { createdAt: "desc" },
      skip: filters?.skip,
      take: filters?.take,
    });
  }

  /**
   * Update entity
   */
  async updateEntity(
    tenantId: string,
    entityId: string,
    userId: string,
    input: EntityUpdateInput
  ): Promise<EntityWithRelations> {
    // Verify access
    const entity = await this.getEntity(tenantId, entityId);

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const changes = {} as Record<string, unknown>;

        // Track changes for audit
        if (input.name && input.name !== entity.name) {
          changes.name = { from: entity.name, to: input.name };
        }
        if (input.legalForm && input.legalForm !== entity.legalForm) {
          changes.legalForm = { from: entity.legalForm, to: input.legalForm };
        }
        if (input.status && input.status !== entity.status) {
          changes.status = { from: entity.status, to: input.status };
        }

        // Update entity
        const updated = await tx.entity.update({
          where: { id: entityId },
          data: {
            name: input.name,
            legalForm: input.legalForm,
            status: input.status,
            activityCode: input.activityCode,
            metadata: input.metadata,
            updatedBy: userId,
          },
        });

        // Create audit log
        if (Object.keys(changes).length > 0) {
          await tx.entityAuditLog.create({
            data: {
              entityId,
              userId,
              action: "UPDATE",
              changes,
            },
          });
        }

        return updated;
      });

      return this.getEntity(tenantId, updated.id);
    } catch (error) {
      logger.error("Error updating entity", { error, entityId, userId });
      throw error;
    }
  }

  /**
   * Add license to entity
   */
  async addLicense(
    tenantId: string,
    entityId: string,
    userId: string,
    input: EntityLicenseInput
  ): Promise<void> {
    // Verify access
    await this.getEntity(tenantId, entityId);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.entityLicense.create({
          data: {
            entityId,
            country: input.country,
            authority: input.authority,
            licenseNumber: input.licenseNumber,
            legalForm: input.legalForm,
            issuedAt: input.issuedAt,
            expiresAt: input.expiresAt,
            economicZoneId: input.economicZoneId,
            status: input.status || "ACTIVE",
            metadata: input.metadata || {},
          },
        });

        // Audit log
        await tx.entityAuditLog.create({
          data: {
            entityId,
            userId,
            action: "ADD_LICENSE",
            changes: input,
          },
        });
      });
    } catch (error) {
      logger.error("Error adding license", { error, entityId });
      throw error;
    }
  }

  /**
   * Add registration (TRN, ZATCA, ETA, etc.) to entity
   */
  async addRegistration(
    tenantId: string,
    entityId: string,
    userId: string,
    type: RegistrationType,
    value: string,
    source?: string
  ): Promise<void> {
    // Verify access
    const entity = await this.getEntity(tenantId, entityId);

    // Validate registration value format
    const isValid = validateIdentifier(type, value, entity.country);
    if (!isValid) {
      throw new Error(`Invalid ${type} format for country ${entity.country}`);
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Check for duplicates
        const existing = await tx.entityRegistration.findFirst({
          where: {
            entityId,
            type,
          },
        });

        if (existing) {
          throw new Error(`Entity already has a ${type} registration`);
        }

        await tx.entityRegistration.create({
          data: {
            entityId,
            type,
            value,
            source,
            status: "PENDING",
          },
        });

        // Audit log
        await tx.entityAuditLog.create({
          data: {
            entityId,
            userId,
            action: "ADD_REGISTRATION",
            changes: { type, value, source },
          },
        });
      });
    } catch (error) {
      logger.error("Error adding registration", { error, entityId, type });
      throw error;
    }
  }

  /**
   * Archive entity (soft delete)
   */
  async archiveEntity(
    tenantId: string,
    entityId: string,
    userId: string
  ): Promise<void> {
    // Verify access
    await this.getEntity(tenantId, entityId);

    try {
      await prisma.$transaction(async (tx) => {
        await tx.entity.update({
          where: { id: entityId },
          data: {
            status: "ARCHIVED",
            updatedBy: userId,
          },
        });

        // Audit log
        await tx.entityAuditLog.create({
          data: {
            entityId,
            userId,
            action: "ARCHIVE",
            changes: { status: { from: "ACTIVE", to: "ARCHIVED" } },
          },
        });
      });
    } catch (error) {
      logger.error("Error archiving entity", { error, entityId });
      throw error;
    }
  }

  /**
   * Get entity audit history
   */
  async getAuditHistory(
    tenantId: string,
    entityId: string,
    limit = 50
  ): Promise<Array<{
    id: string;
    action: string;
    userId: string;
    changes: unknown;
    createdAt: Date;
  }>> {
    // Verify access
    await this.getEntity(tenantId, entityId);

    return prisma.entityAuditLog.findMany({
      where: { entityId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        userId: true,
        changes: true,
        createdAt: true,
      },
    });
  }

  /**
   * Verify entity registrations (called by verification job)
   */
  async verifyRegistrations(
    tenantId: string,
    entityId: string,
    verificationResults: Record<string, boolean>
  ): Promise<void> {
    // Verify access
    await this.getEntity(tenantId, entityId);

    try {
      await prisma.$transaction(async (tx) => {
        for (const [type, verified] of Object.entries(verificationResults)) {
          await tx.entityRegistration.updateMany({
            where: {
              entityId,
              type: type as RegistrationType,
            },
            data: {
              status: verified ? "VERIFIED" : "FAILED",
              verifiedAt: verified ? new Date() : undefined,
            },
          });
        }

        // Audit log
        await tx.entityAuditLog.create({
          data: {
            entityId,
            userId: "system", // System user for verification jobs
            action: "VERIFY_REGISTRATIONS",
            changes: verificationResults,
          },
        });
      });
    } catch (error) {
      logger.error("Error verifying registrations", { error, entityId });
      throw error;
    }
  }

  /**
   * Get entities by registration value (used for duplicate detection)
   */
  async findByRegistration(
    tenantId: string,
    type: RegistrationType,
    value: string
  ): Promise<EntityWithRelations[]> {
    return prisma.entity.findMany({
      where: {
        tenantId,
        registrations: {
          some: {
            type,
            value,
          },
        },
      },
      include: {
        licenses: true,
        registrations: true,
        obligations: {
          include: {
            periods: true,
          },
        },
      },
    });
  }

  /**
   * Delete entity (hard delete - use with caution)
   */
  async deleteEntity(
    tenantId: string,
    entityId: string,
    userId: string
  ): Promise<void> {
    // Verify access and that entity is archived
    const entity = await this.getEntity(tenantId, entityId);
    if (entity.status !== "ARCHIVED") {
      throw new Error("Can only delete archived entities");
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Create final audit log before deletion
        await tx.entityAuditLog.create({
          data: {
            entityId,
            userId,
            action: "DELETE",
            changes: { status: entity.status },
          },
        });

        // Delete entity (cascade will handle related records)
        await tx.entity.delete({
          where: { id: entityId },
        });
      });
    } catch (error) {
      logger.error("Error deleting entity", { error, entityId });
      throw error;
    }
  }
}

export const entityService = new EntityService();
