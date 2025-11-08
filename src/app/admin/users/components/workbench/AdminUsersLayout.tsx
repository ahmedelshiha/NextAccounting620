'use client'

import React, { useState, useMemo } from 'react'
import { QuickActionsBar } from '../QuickActionsBar'
import { ImportWizard } from '../ImportWizard'
import { CreateUserModal } from '@/components/admin/shared/CreateUserModal'
import OverviewCards from './OverviewCards'
import AdminSidebar from './AdminSidebar'
import UserDirectorySection from './UserDirectorySection'
import BulkActionsPanel from './BulkActionsPanel'
import { BuilderHeaderSlot, BuilderMetricsSlot, BuilderSidebarSlot, BuilderFooterSlot } from './BuilderSlots'
import { useIsBuilderEnabled } from '@/hooks/useIsBuilderEnabled'
import { useUsersContext } from '../../contexts/UsersContextProvider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import '../styles/admin-users-layout.css'

/**
 * Main layout grid for AdminWorkBench
 * 
 * Layout structure:
 * ┌─────────────────────────────────────────────┐
 * │        Sticky Header: QuickActionsBar        │
 * ├──────────────┬─────────────────��───────������─┤
 * │              │                            │
 * │   Sidebar    │     Main Content Area      │
 * │  (Analytics  │   ┌──────────────────��    │
 * │  + Filters)  │   │   OverviewCards  │    │
 * │              │   ├──────────────────┤    │
 * │              │   │   DirectoryHead  │    │
 * │              │   ├──────────────────┤    │
 * │              │   │  UsersTable      │    │
 * │              │   │  (virtualized)   │    │
 * │              │   └──────────────────┘    │
 * ├──────────────┴──────────���─────────────────┤
 * │  Sticky Footer: BulkActionsPanel (if sel) │
 * └────────────────���────────────────────────────┘
 * 
 * Responsive breakpoints:
 * - Desktop (≥1400px): Sidebar visible, 3-column layout
 * - Tablet (768-1399px): Sidebar hidden, drawer toggle
 * - Mobile (<768px): Full-width, sidebar as drawer
 */
export default function AdminUsersLayout() {
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filters, setFilters] = useState<Record<string, any>>({})
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const isBuilderEnabled = useIsBuilderEnabled()
  const context = useUsersContext()

  const selectedCount = useMemo(() => selectedUserIds.size, [selectedUserIds.size])

  const handleClearSelection = () => {
    setSelectedUserIds(new Set())
  }

  const handleAddUser = () => {
    console.log('Add User clicked')
    setShowCreateUserModal(true)
  }

  const handleUserCreated = (userId: string) => {
    toast.success('User created successfully')
    setShowCreateUserModal(false)
    // Trigger refresh of users list
    context.refreshUsers?.()
  }

  const handleImport = () => {
    console.log('Import clicked')
    setShowImportWizard(true)
  }

  const handleExport = async () => {
    const toastId = toast.loading('Preparing export...')
    try {
      // Build CSV headers
      const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Created At', 'Last Login']

      // Build CSV rows
      const rows = (Array.isArray(context.users) ? context.users : []).map(user => [
        user.id,
        user.name || '',
        user.email,
        user.role,
        user.status || 'ACTIVE',
        new Date(user.createdAt).toLocaleDateString(),
        user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : 'Never'
      ])

      // Create CSV content with proper escaping
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    const toastId = toast.loading('Refreshing data...')
    try {
      // Trigger data refresh through context
      if (context.refreshUsers) {
        await context.refreshUsers()
      }

      toast.dismiss(toastId)
      toast.success('Data refreshed successfully')
    } catch (error) {
      console.error('Refresh error:', error)
      toast.dismiss(toastId)
      toast.error('Failed to refresh data')
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleImportComplete = (results: any) => {
    setShowImportWizard(false)
    toast.success(`Imported ${results.successfulRows} users successfully`)
  }

  return (
    <div className="admin-workbench-container">
      {/* Sticky Header - Builder.io slot with fallback */}
      <header className="admin-workbench-header" role="banner" data-testid="admin-workbench-header">
        {isBuilderEnabled ? <BuilderHeaderSlot /> : (
          <QuickActionsBar
            onAddUser={handleAddUser}
            onImport={handleImport}
            onExport={handleExport}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
      </header>

      {/* Main Content Area */}
      <div className="admin-workbench-main">
        {/* Left Sidebar - Analytics & Filters (hidden on tablet/mobile) - Builder.io slot with fallback */}
        <aside className={`admin-workbench-sidebar ${sidebarOpen ? 'open' : 'closed'}`} data-testid="admin-sidebar">
          {isBuilderEnabled ? (
            <BuilderSidebarSlot
              onFilterChange={setFilters}
              onClose={() => setSidebarOpen(false)}
            />
          ) : (
            <AdminSidebar
              onFilterChange={setFilters}
              onClose={() => setSidebarOpen(false)}
            />
          )}
        </aside>

        {/* Main Content */}
        <main className="admin-workbench-content" data-testid="admin-main-content">
          {/* KPI Metric Cards - Builder.io slot with fallback */}
          <div className="admin-workbench-metrics">
            {isBuilderEnabled ? <BuilderMetricsSlot /> : <OverviewCards />}
          </div>

          {/* User Directory Section */}
          <div className="admin-workbench-directory">
            <UserDirectorySection
              selectedUserIds={selectedUserIds}
              onSelectionChange={setSelectedUserIds}
              filters={filters}
            />
          </div>
        </main>
      </div>

      {/* Sticky Footer - Bulk Operations (only visible when users selected) - Builder.io slot with fallback */}
      {selectedCount > 0 && (
        <footer className="admin-workbench-footer" data-testid="bulk-actions-panel">
          {isBuilderEnabled ? (
            <BuilderFooterSlot
              selectedCount={selectedCount}
              selectedUserIds={selectedUserIds}
              onClear={handleClearSelection}
            />
          ) : (
            <BulkActionsPanel
              selectedCount={selectedCount}
              selectedUserIds={selectedUserIds}
              onClear={handleClearSelection}
            />
          )}
        </footer>
      )}

      {/* Import Wizard Modal */}
      <Dialog open={showImportWizard} onOpenChange={setShowImportWizard}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Users</DialogTitle>
          </DialogHeader>
          <ImportWizard onImportComplete={handleImportComplete} />
        </DialogContent>
      </Dialog>

      {/* Create User Modal */}
      <CreateUserModal
        isOpen={showCreateUserModal}
        onClose={() => setShowCreateUserModal(false)}
        onSuccess={handleUserCreated}
        mode="create"
      />
    </div>
  )
}
