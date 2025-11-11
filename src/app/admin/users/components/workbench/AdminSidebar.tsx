'use client'

import React, { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from '@/components/ui/collapsible'
import RoleDistributionChart from '../RoleDistributionChart'
import UserGrowthChart from '../UserGrowthChart'
import RecentActivityFeed from '../RecentActivityFeed'
import { useUsersContext } from '../../contexts/UsersContextProvider'

interface AdminSidebarProps {
  onClose?: () => void
}

/**
 * Left sidebar with analytics and widgets
 *
 * Features:
 * - Collapsible analytics sections with proper width transitions
 * - Analytics widgets (charts, stats)
 * - Recent activity list
 * - Responsive drawer on mobile/tablet
 * - Proper layout expansion when sidebar collapses
 *
 * Note: Filters have been moved to the main filter bar in the header
 */
export default function AdminSidebar({
  onClose
}: AdminSidebarProps) {
  const context = useUsersContext()
  const [expandedSections, setExpandedSections] = useState({
    analytics: true,
    activity: true
  })
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Generate role distribution data from users
  const roleDistributionData = useMemo(() => {
    const users = Array.isArray(context.users) ? context.users : []
    const distribution: Record<string, number> = {}

    users.forEach((user) => {
      const role = user.role || 'UNKNOWN'
      distribution[role] = (distribution[role] || 0) + 1
    })

    return Object.keys(distribution).length > 0 ? distribution : undefined
  }, [context.users])

  // Generate user growth data (last 6 months)
  const userGrowthData = useMemo(() => {
    const users = Array.isArray(context.users) ? context.users : []

    // Create monthly growth data for last 6 months
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    const monthlyData: Record<string, number> = {}

    months.forEach((month) => {
      monthlyData[month] = 0
    })

    // Simple distribution for demo (would be calculated from createdAt in production)
    const usersPerMonth = Math.ceil(users.length / 6)
    months.forEach((month, index) => {
      monthlyData[month] = Math.min(usersPerMonth + index * 2, users.length)
    })

    return {
      labels: months,
      values: months.map((month) => monthlyData[month])
    }
  }, [context.users])

  const toggleSection = useCallback((section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }))
  }, [])

  const toggleSidebarCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  return (
    <div className="admin-sidebar-wrapper" data-collapsed={isCollapsed}>
      {/* Header with collapse/close buttons */}
      <div className="admin-sidebar-header">
        <h3 className="admin-sidebar-title">
          Analytics
        </h3>
        <div className="admin-sidebar-header-actions">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebarCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!isCollapsed}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            className="admin-sidebar-toggle-btn"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Sidebar content */}
      <div className="admin-sidebar-content">
        {/* Analytics Section */}
        <Collapsible open={expandedSections.analytics}>
          <CollapsibleTrigger
            onClick={() => toggleSection('analytics')}
            className="admin-sidebar-trigger"
          >
            <h3 className="admin-sidebar-section-title">Analytics</h3>
            <svg
              className={`admin-sidebar-trigger-icon ${expandedSections.analytics ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </CollapsibleTrigger>

          <CollapsibleContent className="admin-sidebar-content-inner">
            <div className="admin-sidebar-charts-container">
              <div className="admin-sidebar-chart">
                <RoleDistributionChart
                  data={roleDistributionData}
                  loading={context.isLoading}
                />
              </div>
              <div className="admin-sidebar-chart">
                <UserGrowthChart
                  data={userGrowthData}
                  loading={context.isLoading}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Activity Section */}
        <Collapsible open={expandedSections.activity}>
          <CollapsibleTrigger
            onClick={() => toggleSection('activity')}
            className="admin-sidebar-trigger"
          >
            <h3 className="admin-sidebar-section-title">Recent Activity</h3>
            <svg
              className={`admin-sidebar-trigger-icon ${expandedSections.activity ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </CollapsibleTrigger>

          <CollapsibleContent className="admin-sidebar-content-inner">
            <div className="admin-sidebar-activity">
              <RecentActivityFeed
                limit={5}
                showViewAll={true}
                onViewAll={() => console.log('View all activity')}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <style jsx>{`
        .admin-sidebar-wrapper {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          padding: 1rem;
          gap: 0.5rem;
          transition: all 300ms ease-in-out;
          overflow: hidden;
        }

        .admin-sidebar-wrapper[data-collapsed="true"] {
          padding: 0.75rem 0.5rem;
          opacity: 0.95;
        }

        .admin-sidebar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid #e5e7eb;
          gap: 0.5rem;
          transition: all 300ms ease-in-out;
          flex-shrink: 0;
        }

        .admin-sidebar-wrapper[data-collapsed="true"] .admin-sidebar-header {
          padding-bottom: 0.5rem;
          border-bottom: none;
        }

        .admin-sidebar-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: opacity 300ms ease-in-out;
        }

        .admin-sidebar-wrapper[data-collapsed="true"] .admin-sidebar-title {
          opacity: 0;
          width: 0;
          visibility: hidden;
        }

        .admin-sidebar-header-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .admin-sidebar-toggle-btn {
          transition: transform 300ms ease-in-out;
          flex-shrink: 0;
        }

        .admin-sidebar-content {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          flex: 1;
          overflow-y: auto;
          transition: opacity 300ms ease-in-out;
          min-height: 0;
        }

        .admin-sidebar-wrapper[data-collapsed="true"] .admin-sidebar-content {
          opacity: 0;
          visibility: hidden;
          overflow: hidden;
        }

        .admin-sidebar-trigger {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.5rem 0;
          cursor: pointer;
          transition: background-color 200ms ease;
          border-radius: 0.375rem;
          gap: 0.5rem;
        }

        .admin-sidebar-trigger:hover {
          background-color: #f3f4f6;
          padding-left: 0.25rem;
          padding-right: 0.25rem;
        }

        .admin-sidebar-section-title {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
          flex: 1;
          text-align: left;
        }

        .admin-sidebar-trigger-icon {
          width: 1rem;
          height: 1rem;
          transition: transform 300ms ease-in-out;
          color: #6b7280;
          flex-shrink: 0;
        }

        .admin-sidebar-content-inner {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-top: 0.75rem;
          padding: 0.75rem;
          background-color: #f9fafb;
          border-radius: 0.375rem;
          animation: slideDown 300ms ease-in-out;
        }

        .admin-sidebar-charts-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .admin-sidebar-chart {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          padding: 0.75rem;
          background-color: white;
        }

        .admin-sidebar-activity {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #e5e7eb;
          background-color: white;
          overflow: hidden;
        }

        /* Scrollbar styling */
        .admin-sidebar-content::-webkit-scrollbar {
          width: 6px;
        }

        .admin-sidebar-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .admin-sidebar-content::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 3px;
        }

        .admin-sidebar-content::-webkit-scrollbar-thumb:hover {
          background-color: #94a3b8;
        }

        /* Chart container styles - Global scope */
        :global(.role-distribution-chart-container),
        :global(.user-growth-chart-container) {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          width: 100%;
        }

        :global(.role-distribution-chart-title),
        :global(.user-growth-chart-title) {
          font-size: 0.875rem;
          font-weight: 600;
          color: #111827;
          margin: 0;
        }

        :global(.role-distribution-chart-body),
        :global(.user-growth-chart-body) {
          width: 100%;
          height: auto;
        }

        /* Animation */
        @keyframes slideDown {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 100%;
          }
        }

        /* Reduce motion preference */
        @media (prefers-reduced-motion: reduce) {
          .admin-sidebar-wrapper,
          .admin-sidebar-header,
          .admin-sidebar-title,
          .admin-sidebar-toggle-btn,
          .admin-sidebar-content,
          .admin-sidebar-trigger,
          .admin-sidebar-content-inner {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
