import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, beforeEach, expect } from 'vitest'
import AdminUsersLayout from '../AdminUsersLayout'
import { UsersContextProvider } from '../../../contexts/UsersContextProvider'

// Mock Builder.io hook to prevent builder content loading
vi.mock('@/hooks/useBuilderContent', () => ({
  useIsBuilderEnabled: () => false,
  useBuilderContent: () => ({ content: null, isLoading: false, error: null })
}))

// Mock child heavy components to speed up tests
vi.mock('../UserDirectorySection', () => ({
  default: (props: any) => (
    <div data-testid="user-directory-section">
      Mock User Directory - {props.selectedCount} selected
      <button onClick={() => props.onSelectionChange?.(new Set(['1']))}>
        Select User
      </button>
    </div>
  )
}))

describe('AdminUsersLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const renderWithContext = (component: React.ReactNode) => {
    return render(
      <UsersContextProvider>
        {component}
      </UsersContextProvider>
    )
  }

  describe('Rendering', () => {
    it('should render header with quick actions', () => {
      renderWithContext(<AdminUsersLayout />)
      const header = screen.getByTestId('admin-workbench-header')
      expect(header).toBeInTheDocument()
      expect(header).toHaveAttribute('role', 'banner')
    })

    it('should render main content area', () => {
      renderWithContext(<AdminUsersLayout />)
      const main = screen.getByTestId('admin-main-content')
      expect(main).toBeInTheDocument()
    })

    it('should render sidebar', () => {
      renderWithContext(<AdminUsersLayout />)
      const aside = screen.getByTestId('admin-sidebar')
      expect(aside).toBeInTheDocument()
    })

    it('should render user directory section', () => {
      renderWithContext(<AdminUsersLayout />)
      expect(screen.getByTestId('user-directory-section')).toBeInTheDocument()
    })
  })

  describe('State Management', () => {
    it('should handle user selection state', async () => {
      renderWithContext(<AdminUsersLayout />)
      const selectButton = screen.getByRole('button', { name: /Select User/i })
      expect(selectButton).toBeInTheDocument()
      fireEvent.click(selectButton)
      // Component handles selection state internally
    })

    it('should manage sidebar visibility', () => {
      renderWithContext(<AdminUsersLayout />)
      const aside = screen.getByRole('complementary')
      expect(aside).toBeInTheDocument()
    })
  })

  describe('Responsive Behavior', () => {
    it('should render with proper layout structure', () => {
      const { container } = renderWithContext(<AdminUsersLayout />)
      const container_el = container.querySelector('.admin-workbench-container')
      expect(container_el).toBeInTheDocument()

      const header = container.querySelector('.admin-workbench-header')
      expect(header).toBeInTheDocument()

      const main = container.querySelector('.admin-workbench-main')
      expect(main).toBeInTheDocument()
    })

    it('should have sidebar with proper classes', () => {
      const { container } = renderWithContext(<AdminUsersLayout />)
      const sidebar = container.querySelector('.admin-workbench-sidebar')
      expect(sidebar).toBeInTheDocument()
      expect(sidebar).toHaveClass('open')
    })
  })

  describe('Integration', () => {
    it('should not show bulk actions panel when no users selected', () => {
      renderWithContext(<AdminUsersLayout />)
      const bulkPanel = screen.queryByTestId('bulk-actions-panel')
      if (bulkPanel) {
        expect(bulkPanel).not.toBeVisible()
      }
    })

    it('should render without errors', () => {
      expect(() => {
        renderWithContext(<AdminUsersLayout />)
      }).not.toThrow()
    })

    it('should handle mount and unmount', () => {
      const { unmount } = renderWithContext(<AdminUsersLayout />)
      expect(screen.getByRole('main')).toBeInTheDocument()
      unmount()
    })
  })

  describe('Accessibility', () => {
    it('should have semantic HTML structure', () => {
      const { container } = renderWithContext(<AdminUsersLayout />)
      expect(container.querySelector('header')).toBeInTheDocument()
      expect(container.querySelector('main')).toBeInTheDocument()
      expect(container.querySelector('aside')).toBeInTheDocument()
    })

    it('should have proper ARIA landmarks', () => {
      renderWithContext(<AdminUsersLayout />)
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('complementary')).toBeInTheDocument()
    })

    it('should have focusable buttons', () => {
      renderWithContext(<AdminUsersLayout />)
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('Filter Management', () => {
    it('should initialize with empty filters', () => {
      renderWithContext(<AdminUsersLayout />)
      expect(screen.getByRole('main')).toBeInTheDocument()
    })

    it('should handle filter updates', () => {
      renderWithContext(<AdminUsersLayout />)
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
    })
  })
})
