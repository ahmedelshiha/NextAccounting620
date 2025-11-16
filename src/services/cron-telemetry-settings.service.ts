import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { CronTelemetrySettings, CronTelemetrySettingsSchema } from '@/schemas/settings/cron-telemetry'

export async function getCronTelemetrySettings(tenantId: string): Promise<CronTelemetrySettings> {
  try {
    const setting = await prisma.cronTelemetrySettings.findFirst({
      where: { tenantId },
    })

    if (!setting) {
      return getDefaultSettings()
    }

    const data: any = {
      performance: setting.performance ? JSON.parse(JSON.stringify(setting.performance)) : undefined,
      reliability: setting.reliability ? JSON.parse(JSON.stringify(setting.reliability)) : undefined,
      monitoring: setting.monitoring ? JSON.parse(JSON.stringify(setting.monitoring)) : undefined,
      status: setting.status ? JSON.parse(JSON.stringify(setting.status)) : undefined,
      scheduling: setting.scheduling ? JSON.parse(JSON.stringify(setting.scheduling)) : undefined,
    }

    const parsed = CronTelemetrySettingsSchema.safeParse(data)
    return parsed.success ? parsed.data : getDefaultSettings()
  } catch (error) {
    logger.error('Error loading cron telemetry settings', {}, error instanceof Error ? error : new Error(String(error)))
    return getDefaultSettings()
  }
}

export async function updateCronTelemetrySettings(
  tenantId: string,
  updates: Partial<CronTelemetrySettings>
): Promise<CronTelemetrySettings> {
  try {
    const current = await getCronTelemetrySettings(tenantId)
    const merged = { ...current, ...updates }
    const parsed = CronTelemetrySettingsSchema.safeParse(merged)

    if (!parsed.success) {
      throw new Error(`Invalid settings: ${parsed.error.message}`)
    }

    const existing = await prisma.cronTelemetrySettings.findFirst({
      where: { tenantId },
    })

    if (existing) {
      await prisma.cronTelemetrySettings.update({
        where: { id: existing.id },
        data: {
          performance: parsed.data.performance as any,
          reliability: parsed.data.reliability as any,
          monitoring: parsed.data.monitoring as any,
          status: parsed.data.status as any,
          scheduling: parsed.data.scheduling as any,
        },
      })
    } else {
      await prisma.cronTelemetrySettings.create({
        data: {
          tenantId,
          performance: parsed.data.performance as any,
          reliability: parsed.data.reliability as any,
          monitoring: parsed.data.monitoring as any,
          status: parsed.data.status as any,
          scheduling: parsed.data.scheduling as any,
        },
      })
    }

    return parsed.data
  } catch (error) {
    logger.error('Error updating cron telemetry settings', {}, error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

export function getDefaultSettings(): CronTelemetrySettings {
  return {
    performance: {
      globalConcurrency: 10,
      tenantConcurrency: 3,
      batchSize: 100,
      processingTimeoutMs: 60000,
    },
    reliability: {
      maxRetries: 3,
      backoffThresholdPercent: 10,
      backoffMultiplier: 2.0,
      minBackoffMs: 500,
      maxBackoffMs: 60000,
    },
    monitoring: {
      enableDetailedLogging: true,
      errorRateAlertThreshold: 5,
      failedCountAlertThreshold: 100,
      enableMetricsCollection: true,
      metricsRetentionDays: 30,
    },
    status: {
      remindersEnabled: true,
      remindersEnabledPerTenant: {},
      maintenanceMode: false,
      maintenanceModeMessage: 'Reminders service is under maintenance',
    },
    scheduling: {
      cronSchedule: '0 9 * * *',
      runTimeWindowHours: 24,
      prioritizeFailedReminders: true,
    },
  }
}
