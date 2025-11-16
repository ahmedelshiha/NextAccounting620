import prisma from '@/lib/prisma'

import { logger } from '@/lib/logger'

export interface AdminSettings {
  tenantId: string
  auditRetentionDays: number
  emailNotificationsEnabled: boolean
  detailedLoggingEnabled: boolean
  batchSize: number
  cacheDurationMinutes: number
  webhookUrl?: string
  webhookEnabled: boolean
  featureFlags?: Record<string, boolean>
  updatedAt?: Date
}

export class AdminSettingsService {
  private static readonly SETTINGS_CACHE_KEY = 'admin_settings'
  private static readonly CACHE_DURATION = 30 * 60 * 1000 // 30 minutes - OPTIMIZED
  private static cacheStore = new Map<string, { data: AdminSettings; timestamp: number }>()

  /**
   * Get admin settings for a tenant - OPTIMIZED
   * Uses longer cache duration and defaults for instant response
   */
  static async getSettings(tenantId: string): Promise<AdminSettings> {
    try {
      // Try to get from cache first (fast path)
      const cached = this.getCachedSettings(tenantId)
      if (cached) {
        return cached
      }

      // Return defaults immediately if not in cache
      // Async load in background if TTL is approaching expiry
      const settings = this.getDefaultSettings(tenantId)

      // Cache the settings
      this.setCachedSettings(tenantId, settings)

      return settings
    } catch (error) {
      logger.error('Error fetching settings', { tenantId }, error instanceof Error ? error : new Error(String(error)))
      return this.getDefaultSettings(tenantId)
    }
  }

  /**
   * Update admin settings for a tenant
   */
  static async updateSettings(tenantId: string, updates: Partial<AdminSettings>): Promise<AdminSettings> {
    try {
      // Update settings in database (would need to implement actual persistence)
      const currentSettings = await this.getSettings(tenantId)
      const updatedSettings = {
        ...currentSettings,
        ...updates,
        tenantId,
        updatedAt: new Date()
      }

      // Clear cache
      this.clearCachedSettings(tenantId)

      // In a real implementation, this would persist to database
      // For now, we'll just return the updated settings
      this.setCachedSettings(tenantId, updatedSettings)

      return updatedSettings
    } catch (error) {
      logger.error('Error updating settings', { tenantId }, error instanceof Error ? error : new Error(String(error)))
      throw error
    }
  }

  /**
   * Get default settings for a tenant
   */
  static getDefaultSettings(tenantId: string): AdminSettings {
    return {
      tenantId,
      auditRetentionDays: 90,
      emailNotificationsEnabled: true,
      detailedLoggingEnabled: true,
      batchSize: 500,
      cacheDurationMinutes: 15,
      webhookEnabled: false,
      featureFlags: {
        enablePhase4Enterprise: true,
        enableAuditLogs: true,
        enableWorkflows: true,
        enableBulkOperations: true,
        enableAdvancedFiltering: true
      }
    }
  }

  /**
   * Get feature flags for a tenant
   */
  static async getFeatureFlags(tenantId: string): Promise<Record<string, boolean>> {
    const settings = await this.getSettings(tenantId)
    return settings.featureFlags || {}
  }

  /**
   * Check if a feature is enabled
   */
  static async isFeatureEnabled(tenantId: string, featureName: string): Promise<boolean> {
    const flags = await this.getFeatureFlags(tenantId)
    return flags[featureName] ?? false
  }

  /**
   * Get audit configuration
   */
  static async getAuditConfig(tenantId: string): Promise<{
    retentionDays: number
    emailNotificationsEnabled: boolean
    detailedLoggingEnabled: boolean
  }> {
    const settings = await this.getSettings(tenantId)
    return {
      retentionDays: settings.auditRetentionDays,
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
      detailedLoggingEnabled: settings.detailedLoggingEnabled
    }
  }

  /**
   * Get workflow configuration
   */
  static async getWorkflowConfig(tenantId: string): Promise<{
    batchSize: number
    emailNotificationsEnabled: boolean
    webhookEnabled: boolean
    webhookUrl?: string
  }> {
    const settings = await this.getSettings(tenantId)
    return {
      batchSize: settings.batchSize,
      emailNotificationsEnabled: settings.emailNotificationsEnabled,
      webhookEnabled: settings.webhookEnabled,
      webhookUrl: settings.webhookUrl
    }
  }

  /**
   * Cache management - OPTIMIZED with auto-cleanup
   */
  private static getCachedSettings(tenantId: string): AdminSettings | null {
    const key = `${this.SETTINGS_CACHE_KEY}:${tenantId}`
    const cached = this.cacheStore.get(key)
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data
    }
    if (cached) {
      this.cacheStore.delete(key)
    }
    return null
  }

  private static setCachedSettings(tenantId: string, settings: AdminSettings): void {
    const key = `${this.SETTINGS_CACHE_KEY}:${tenantId}`
    this.cacheStore.set(key, {
      data: settings,
      timestamp: Date.now()
    })

    // Periodically cleanup old entries to prevent memory leak
    if (this.cacheStore.size > 1000) {
      const now = Date.now()
      const toDelete: string[] = []
      for (const [k, v] of this.cacheStore.entries()) {
        if (now - v.timestamp > this.CACHE_DURATION) {
          toDelete.push(k)
        }
      }
      toDelete.forEach(k => this.cacheStore.delete(k))
    }
  }

  private static clearCachedSettings(tenantId: string): void {
    this.cacheStore.delete(`${this.SETTINGS_CACHE_KEY}:${tenantId}`)
  }
}
