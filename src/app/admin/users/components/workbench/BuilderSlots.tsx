'use client'

import React from 'react'
import { useBuilderContent } from '@/hooks/useBuilderContent'
import { BUILDER_MODELS } from '@/lib/builder-io/config'
import { QuickActionsBar } from '../QuickActionsBar'
import OverviewCards from './OverviewCards'
import AdminSidebar from './AdminSidebar'
import BulkActionsPanel from './BulkActionsPanel'

/**
 * Render Builder.io block content
 *
 * Converts Builder.io block structure to React elements
 */
function renderBuilderBlocks(blocks: any[]): React.ReactNode {
  if (!Array.isArray(blocks)) {
    return null
  }

  return blocks.map((block, idx) => {
    return (
      <div
        key={idx}
        data-builder-block={block.id}
        className={block.className || ''}
        style={block.style || {}}
      >
        {block.children ? renderBuilderBlocks(block.children) : block.content || null}
      </div>
    )
  })
}

/**
 * Builder.io content slot wrapper for header section
 *
 * Renders Builder.io content if available, otherwise renders default QuickActionsBar
 */
export function BuilderHeaderSlot() {
  const { content, isLoading, error, isEnabled } = useBuilderContent(
    BUILDER_MODELS.ADMIN_WORKBENCH_HEADER
  )

  if (!isEnabled) {
    return <QuickActionsBar />
  }

  if (isLoading) {
    return <QuickActionsBar />
  }

  if (error) {
    console.warn(`Failed to load Builder.io header content: ${error}`)
    return <QuickActionsBar />
  }

  if (!content) {
    return <QuickActionsBar />
  }

  return (
    <div data-builder-model={BUILDER_MODELS.ADMIN_WORKBENCH_HEADER} data-testid="builder-header-slot">
      {content.blocks ? renderBuilderBlocks(content.blocks) : <QuickActionsBar />}
    </div>
  )
}

/**
 * Builder.io content slot wrapper for metrics/KPI section
 *
 * Renders Builder.io content if available, otherwise renders default OverviewCards
 */
export function BuilderMetricsSlot() {
  const { content, isLoading, error, isEnabled } = useBuilderContent(
    BUILDER_MODELS.ADMIN_WORKBENCH_METRICS
  )

  if (!isEnabled) {
    return <OverviewCards />
  }

  if (isLoading) {
    return <OverviewCards />
  }

  if (error) {
    console.warn(`Failed to load Builder.io metrics content: ${error}`)
    return <OverviewCards />
  }

  if (!content) {
    return <OverviewCards />
  }

  return (
    <div data-builder-model={BUILDER_MODELS.ADMIN_WORKBENCH_METRICS} data-testid="builder-metrics-slot">
      {content.blocks ? renderBuilderBlocks(content.blocks) : <OverviewCards />}
    </div>
  )
}

/**
 * Builder.io content slot wrapper for sidebar section
 *
 * Renders Builder.io content if available, otherwise renders default AdminSidebar
 */
export function BuilderSidebarSlot(props: Parameters<typeof AdminSidebar>[0]) {
  const { content, isLoading, error, isEnabled } = useBuilderContent(
    BUILDER_MODELS.ADMIN_WORKBENCH_SIDEBAR
  )

  if (!isEnabled) {
    return <AdminSidebar {...props} />
  }

  if (isLoading) {
    return <AdminSidebar {...props} />
  }

  if (error) {
    console.warn(`Failed to load Builder.io sidebar content: ${error}`)
    return <AdminSidebar {...props} />
  }

  if (!content) {
    return <AdminSidebar {...props} />
  }

  return (
    <div data-builder-model={BUILDER_MODELS.ADMIN_WORKBENCH_SIDEBAR} data-testid="builder-sidebar-slot">
      {content.blocks ? renderBuilderBlocks(content.blocks) : <AdminSidebar {...props} />}
    </div>
  )
}

/**
 * Builder.io content slot wrapper for footer section
 *
 * Renders Builder.io content if available, otherwise renders default BulkActionsPanel
 */
export function BuilderFooterSlot(props: Parameters<typeof BulkActionsPanel>[0]) {
  const { content, isLoading, error, isEnabled } = useBuilderContent(
    BUILDER_MODELS.ADMIN_WORKBENCH_FOOTER
  )

  if (!isEnabled) {
    return <BulkActionsPanel {...props} />
  }

  if (isLoading) {
    return <BulkActionsPanel {...props} />
  }

  if (error) {
    console.warn(`Failed to load Builder.io footer content: ${error}`)
    return <BulkActionsPanel {...props} />
  }

  if (!content) {
    return <BulkActionsPanel {...props} />
  }

  return (
    <div data-builder-model={BUILDER_MODELS.ADMIN_WORKBENCH_FOOTER} data-testid="builder-footer-slot">
      {content.blocks ? renderBuilderBlocks(content.blocks) : <BulkActionsPanel {...props} />}
    </div>
  )
}
