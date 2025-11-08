'use client'

import React, { useState, useMemo } from 'react'
import { QuickActionsBar } from '../QuickActionsBar'
import { ImportWizard } from '../ImportWizard'
import OverviewCards from './OverviewCards'
import AdminSidebar from './AdminSidebar'
import DirectoryHeader from './DirectoryHeader'
import UserDirectorySection from './UserDirectorySection'
import BulkActionsPanel from './BulkActionsPanel'
import { BuilderHeaderSlot, BuilderMetricsSlot, BuilderSidebarSlot, BuilderFooterSlot } from './BuilderSlots'
import { useIsBuilderEnabled } from '@/hooks/useIsBuilderEnabled'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import '../styles/admin-users-layout.css'

/**
 * Main layout grid for AdminWorkBench
 * 
 * Layout structure:
 * ┌─────────────────────────────────────────────┐
 * │        Sticky Header: QuickActionsBar        │
 * ├──────────────┬─────────────────────────���──┤
 * │              │                            │
 * │   Sidebar    │     Main Content Area      │
 * │  (Analytics  │   ┌──────────────────┐    │
 * │  + Filters)  │   │   OverviewCards  │    │
 * │              │   ├──────────────────┤    │
 * │              │   │   DirectoryHead  │    │
 * │              │   ├──────────────────┤    │
 * │              │   │  UsersTable      │    │
 * │              │   │  (virtualized)   │    │
 * │              │   └──────────────────┘    │
 * ├──────────────┴────────────────────────────┤
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
  const isBuilderEnabled = useIsBuilderEnabled()

  const selectedCount = useMemo(() => selectedUserIds.size, [selectedUserIds.size])

  const handleClearSelection = () => {
    setSelectedUserIds(new Set())
  }

  const handleAddUser = () => {
    console.log('Add User clicked')
    // TODO: Open add user modal or navigate to add user page
  }

  const handleImport = () => {
    console.log('Import clicked')
    // TODO: Open import wizard
  }

  const handleExport = () => {
    console.log('Export clicked')
    // TODO: Export users
  }

  const handleRefresh = () => {
    console.log('Refresh clicked')
    // TODO: Refresh users data
    window.location.reload()
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
            <DirectoryHeader
              selectedCount={selectedCount}
              onClearSelection={handleClearSelection}
              onSidebarToggle={() => setSidebarOpen(!sidebarOpen)}
            />
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
    </div>
  )
}
