'use client'

import React, { useState, useEffect, Suspense, lazy } from 'react'
import { TabNavigation, TabType } from './components/TabNavigation'
import {
  ExecutiveDashboardTab,
  EntitiesTab,
  RbacTab
} from './components/tabs'
import { CreateUserModal } from '@/components/admin/shared/CreateUserModal'
import { useUsersContext } from './contexts/UsersContextProvider'
import { ErrorBoundary } from '@/components/providers/error-boundary'
import { TabSkeleton, DashboardTabSkeleton, MinimalTabSkeleton } from './components/TabSkeleton'
import { toast } from 'sonner'
import { performanceMetrics } from '@/lib/performance/metrics'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { trackEvent } from '@/lib/analytics'

// Dynamic imports for less-frequently used tabs (reduces initial bundle by ~40KB)
const WorkflowsTab = lazy(() => import('./components/tabs/WorkflowsTab').then(m => ({ default: m.WorkflowsTab })))
const BulkOperationsTab = lazy(() => import('./components/tabs/BulkOperationsTab').then(m => ({ default: m.BulkOperationsTab })))
const AuditTab = lazy(() => import('./components/tabs/AuditTab').then(m => ({ default: m.AuditTab })))
const AdminTab = lazy(() => import('./components/tabs/AdminTab').then(m => ({ default: m.AdminTab })))

/**
 * Enterprise Users Page - Phase 4 Implementation
 * 
 * Main orchestrator component that implements the 5-tab interface:
 * 1. Dashboard (Operations overview) - Phase 4a
 * 2. Workflows (Workflow management) - Phase 4b
 * 3. Bulk Operations (Batch operations) - Phase 4c
 * 4. Audit (Compliance & audit trail) - Phase 4d
 * 5. Admin (System configuration) - Phase 4e
 * 
 * Architecture:
 * - Tab-based navigation with React Context
 * - Server-side data fetching via layout.tsx
 * - Client-side state management for filters and selections
 * - Dynamic imports for heavy modals
 * - Performance optimized with code splitting
 * 
 * Timeline: 9 weeks, 195 developer hours
 * Status: Phase 4a in progress
 */
export function EnterpriseUsersPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard')
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false)
  // Performance: start render measure (ended in effects below)
  performanceMetrics.startMeasure('admin-users-page:render')

  const context = useUsersContext()

  // Initialize tab from URL query (?tab=...) and apply role filter (?role=...)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab') as TabType | null
      const roleParam = params.get('role') as string | null
      const isRetireEntitiesTabEnabled = isFeatureEnabled('retireEntitiesTab', false)

      let tabToSet: TabType = 'dashboard'
      const validTabs: TabType[] = ['dashboard', 'entities', 'workflows', 'bulk-operations', 'audit', 'rbac', 'admin']
      const validRoles = ['ALL', 'ADMIN', 'TEAM_LEAD', 'TEAM_MEMBER', 'STAFF', 'CLIENT']

      if (tab && (validTabs as string[]).includes(tab)) {
        // If Entities tab is requested but feature flag is enabled, redirect to Dashboard
        if (tab === 'entities' && isRetireEntitiesTabEnabled) {
          tabToSet = 'dashboard'
          // Track legacy redirect for telemetry
          trackEvent('users.redirect_legacy', { from: 'entities', to: 'dashboard' })
        } else {
          tabToSet = tab
        }
      }

      // Apply role filter if provided in URL
      if (roleParam && validRoles.includes(roleParam) && context.setRoleFilter) {
        context.setRoleFilter(roleParam as any)
      }

      setActiveTab(tabToSet)
    }
  }, [])

  // End render measure on initial mount and tab/user changes
  useEffect(() => {
    performanceMetrics.endMeasure('admin-users-page:render', {
      tab: activeTab,
      users: Array.isArray(context.users) ? context.users.length : 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, context.users?.length])

  // Handler for Add User action
  const handleAddUser = () => {
    setIsCreateUserModalOpen(true)
  }

  // Handler for successful user creation
  const handleUserCreated = (userId: string) => {
    toast.success('User created successfully')
    setIsCreateUserModalOpen(false)
    // Trigger refresh of users list
    context.refreshUsers?.()
  }

  // Handler for Import action
  const handleImport = () => {
    toast.info('Import CSV feature coming in Phase 4c (Bulk Operations)')
    setActiveTab('bulk-operations')
  }

  // Handler for Bulk Operation action
  const handleBulkOperation = () => {
    toast.info('Bulk Operations feature coming in Phase 4c')
    setActiveTab('bulk-operations')
  }

  // Handler for Export action
  const handleExport = async () => {
    const toastId = toast.loading('Preparing export...')
    try {
      // Build CSV headers
      const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Created At', 'Last Login']

      // Build CSV rows
      const rows = context.users.map(user => [
        user.id,
        user.name || '',
        user.email,
        user.role,
        user.isActive ? 'ACTIVE' : 'INACTIVE',
        new Date(user.createdAt).toLocaleDateString(),
        user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'
      ])

      // Create CSV content
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => {
          const value = String(cell || '')
          return value.includes(',') || value.includes('"') ? `"${value.replace(/"/g, '""')}"` : value
        }).join(','))
      ].join('\n')

      // Create and trigger download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link.setAttribute('href', url)
      link.setAttribute('download', `users-export-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'

      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast.dismiss(toastId)
      toast.success(`Exported ${context.users.length} users successfully`)
    } catch (error) {
      console.error('Export error:', error)
      toast.dismiss(toastId)
      toast.error('Failed to export users')
    }
  }

  // Handler for Refresh action
  const handleRefresh = async () => {
    const toastId = toast.loading('Refreshing data...')
    try {
      // Trigger data refresh through context or API
      if (context.refreshUsers) {
        await context.refreshUsers()
      }

      toast.dismiss(toastId)
      toast.success('Data refreshed successfully')
    } catch (error) {
      console.error('Refresh error:', error)
      toast.dismiss(toastId)
      toast.error('Failed to refresh data')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Navigation */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="bg-white min-h-[calc(100vh-100px)]">
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load dashboard</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<DashboardTabSkeleton />}>
              <ExecutiveDashboardTab
                users={context.users}
                stats={context.stats}
                isLoading={context.usersLoading || context.isLoading}
                onAddUser={handleAddUser}
                onImport={handleImport}
                onBulkOperation={handleBulkOperation}
                onExport={handleExport}
                onRefresh={handleRefresh}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Entities Tab */}
        {activeTab === 'entities' && !isFeatureEnabled('retireEntitiesTab', false) && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load entities</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <EntitiesTab />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Workflows Tab */}
        {activeTab === 'workflows' && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load workflows</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<MinimalTabSkeleton />}>
              <WorkflowsTab />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Bulk Operations Tab */}
        {activeTab === 'bulk-operations' && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load bulk operations</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <BulkOperationsTab />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load audit logs</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <AuditTab />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* RBAC Tab */}
        {activeTab === 'rbac' && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load RBAC settings</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <RbacTab />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* Admin Settings Tab */}
        {activeTab === 'admin' && (
          <ErrorBoundary
            fallback={({ error, resetError }) => (
              <div className="p-8 text-center">
                <div className="inline-block">
                  <div className="text-red-600 text-lg font-semibold mb-2">Failed to load admin settings</div>
                  <p className="text-gray-600 text-sm mb-4">{error?.message}</p>
                  <button
                    onClick={resetError}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense fallback={<TabSkeleton />}>
              <AdminTab />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={isCreateUserModalOpen}
        onClose={() => setIsCreateUserModalOpen(false)}
        onSuccess={handleUserCreated}
        mode="create"
        showPasswordGeneration={true}
      />

      {/* Error message display */}
      {context.errorMsg && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg">
          {context.errorMsg}
        </div>
      )}
    </div>
  )
}
