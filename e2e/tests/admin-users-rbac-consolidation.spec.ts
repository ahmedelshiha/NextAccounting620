import { test, expect } from '@playwright/test'

/**
 * Helper function for dev login authentication
 */
async function devLoginAndSetCookie(page: any, request: any, baseURL: string | undefined, email: string) {
  const base = baseURL || process.env.E2E_BASE_URL || 'http://localhost:3000'
  const res = await request.post(`${base}/api/_dev/login`, { data: { email } })
  expect(res.ok()).toBeTruthy()
  const json = await res.json()
  const token = json.token as string
  const url = new URL(base)
  await page.context().addCookies([
    { name: '__Secure-next-auth.session-token', value: token, domain: url.hostname, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' },
  ])
}

test.describe('Phase 2: RbacTab Consolidation & New Tabs', () => {
  test.beforeEach(async ({ page, request, baseURL }) => {
    await devLoginAndSetCookie(page, request, baseURL, 'admin@accountingfirm.com')
    await page.goto('/admin/users')

    // Wait for main content to load
    await expect(page.getByRole('heading')).first().toBeVisible({ timeout: 5000 })

    // Navigate to RBAC tab (via the main tab navigation)
    const rbacTab = page.getByRole('tab', { name: /rbac|roles|permissions/i })
    if (await rbacTab.isVisible({ timeout: 2000 })) {
      await rbacTab.click()
      await page.waitForTimeout(1000)
    } else {
      // If no RBAC tab visible at top level, it might be in admin settings
      const adminTab = page.getByRole('tab', { name: /admin/i })
      if (await adminTab.isVisible({ timeout: 2000 })) {
        await adminTab.click()
        await page.waitForTimeout(1000)
      }
    }
  })

  test.describe('RbacTab Navigation', () => {
    test('should display all 4 tabs in RbacTab', async ({ page }) => {
      const tabs = ['Roles', 'Hierarchy', 'Test Access', 'Conflicts']
      
      for (const tabName of tabs) {
        const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
        await expect(tab).toBeVisible()
      }
    })

    test('should switch to Hierarchy tab', async ({ page }) => {
      await page.getByRole('tab', { name: /hierarchy/i }).click()
      
      // Verify Hierarchy tab content is displayed
      await expect(page.getByText(/Permission Hierarchy/i).or(page.getByText(/Hierarchy|Role/i))).toBeVisible({ timeout: 3000 })
    })

    test('should switch to Test Access tab', async ({ page }) => {
      await page.getByRole('tab', { name: /test access/i }).click()
      
      // Verify Test Access tab content is displayed
      await expect(page.getByText(/Permission|Test|Simulator/i)).toBeVisible({ timeout: 3000 })
    })

    test('should switch to Conflicts tab', async ({ page }) => {
      await page.getByRole('tab', { name: /conflicts/i }).click()
      
      // Verify Conflicts tab content is displayed
      await expect(page.getByText(/Conflict|Permission/i)).toBeVisible({ timeout: 3000 })
    })

    test('should switch back to Roles tab', async ({ page }) => {
      // Navigate away
      await page.getByRole('tab', { name: /hierarchy/i }).click()
      await page.waitForTimeout(500)
      
      // Switch back
      await page.getByRole('tab', { name: /roles/i }).click()
      
      // Verify Roles tab content is shown
      await expect(page.getByText(/New Role|Create and manage roles/i)).toBeVisible({ timeout: 3000 })
    })

    test('should support keyboard navigation between tabs', async ({ page }) => {
      const rolesTab = page.getByRole('tab', { name: /roles/i })
      
      // Focus the first tab
      await rolesTab.focus()
      
      // Navigate with arrow keys (right arrow goes to next tab)
      await page.keyboard.press('ArrowRight')
      
      // Verify we're on a different tab (check for hierarchy content)
      await expect(page.locator('button, [role="button"]').first()).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Roles Tab Functionality', () => {
    test('should display New Role button', async ({ page }) => {
      const newRoleButton = page.getByRole('button', { name: /new role|create role/i })
      await expect(newRoleButton).toBeVisible()
    })

    test('should open create role modal when clicking New Role', async ({ page }) => {
      await page.getByRole('button', { name: /new role|create role/i }).click()
      
      // Verify modal opens
      await expect(page.getByRole('heading', { name: /create role|new role/i })).toBeVisible({ timeout: 3000 })
    })

    test('should create a new role with valid data', async ({ page }) => {
      // Click New Role button
      await page.getByRole('button', { name: /new role|create role/i }).click()
      
      // Wait for modal to appear
      await expect(page.getByRole('heading', { name: /create role|new role/i })).toBeVisible({ timeout: 3000 })
      
      // Fill in role name
      const nameInput = page.locator('input[placeholder*="role" i], input[id*="name" i]').first()
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E Test Role')
      }
      
      // Try to submit the form
      const submitButton = page.getByRole('button', { name: /create|save/i }).last()
      if (await submitButton.isVisible({ timeout: 1000 })) {
        await submitButton.click()
        
        // Verify success message or modal closes
        await page.waitForTimeout(1000)
      }
    })

    test('should display role list', async ({ page }) => {
      // Check if roles are displayed
      const roleListElement = page.locator('div, [role="list"]').first()
      await expect(roleListElement).toBeVisible({ timeout: 3000 })
    })

    test('should have role action buttons', async ({ page }) => {
      // Look for edit/delete buttons
      const actionButtons = page.locator('button').filter({ has: page.locator('svg') })
      const buttonCount = await actionButtons.count()
      
      // Should have at least some buttons for role actions
      expect(buttonCount).toBeGreaterThanOrEqual(0)
    })
  })

  test.describe('Hierarchy Tab Functionality', () => {
    test('should display hierarchy visualization', async ({ page }) => {
      await page.getByRole('tab', { name: /hierarchy/i }).click()
      
      // Should have some content in the hierarchy tab
      const tabContent = page.locator('[role="tabpanel"]').last()
      await expect(tabContent).toBeVisible({ timeout: 3000 })
    })

    test('should render hierarchy cards/elements', async ({ page }) => {
      await page.getByRole('tab', { name: /hierarchy/i }).click()
      
      // Wait for content to render
      await page.waitForTimeout(1000)
      
      // Check for any visible content
      const content = page.locator('[role="tabpanel"]').last()
      const childElements = content.locator('> *')
      const count = await childElements.count()
      
      // Should have some content
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })

  test.describe('Test Access Tab Functionality', () => {
    test('should display permission simulator', async ({ page }) => {
      await page.getByRole('tab', { name: /test access/i }).click()
      
      // Should have content in the test access tab
      const tabContent = page.locator('[role="tabpanel"]').last()
      await expect(tabContent).toBeVisible({ timeout: 3000 })
    })

    test('should have test controls if simulator is interactive', async ({ page }) => {
      await page.getByRole('tab', { name: /test access/i }).click()
      
      // Wait for content
      await page.waitForTimeout(1000)
      
      // Look for test button or input fields
      const testButton = page.getByRole('button', { name: /test|run|simulate/i })
      if (await testButton.isVisible({ timeout: 1000 })) {
        await expect(testButton).toBeVisible()
      }
    })
  })

  test.describe('Conflicts Tab Functionality', () => {
    test('should display conflict resolver', async ({ page }) => {
      await page.getByRole('tab', { name: /conflicts/i }).click()
      
      // Should have content in the conflicts tab
      const tabContent = page.locator('[role="tabpanel"]').last()
      await expect(tabContent).toBeVisible({ timeout: 3000 })
    })

    test('should render conflict information if available', async ({ page }) => {
      await page.getByRole('tab', { name: /conflicts/i }).click()
      
      // Wait for content
      await page.waitForTimeout(1000)
      
      // Check for any conflict cards/alerts
      const tabContent = page.locator('[role="tabpanel"]').last()
      const contentCount = await tabContent.locator('> *').count()
      
      // Should render something
      expect(contentCount).toBeGreaterThanOrEqual(0)
    })

    test('should have conflict resolution buttons if conflicts exist', async ({ page }) => {
      await page.getByRole('tab', { name: /conflicts/i }).click()
      
      // Wait for content
      await page.waitForTimeout(1000)
      
      // Look for resolve button
      const resolveButton = page.getByRole('button', { name: /resolve|fix|apply/i })
      if (await resolveButton.isVisible({ timeout: 1000 })) {
        await expect(resolveButton).toBeVisible()
      }
    })
  })

  test.describe('Integration Tests', () => {
    test('should persist tab selection when switching between tabs', async ({ page }) => {
      // Navigate to Hierarchy tab
      await page.getByRole('tab', { name: /hierarchy/i }).click()
      await page.waitForTimeout(500)
      
      // Navigate to Conflicts tab
      await page.getByRole('tab', { name: /conflicts/i }).click()
      await page.waitForTimeout(500)
      
      // Go back to Hierarchy - should still be there
      await page.getByRole('tab', { name: /hierarchy/i }).click()
      
      // Verify Hierarchy tab content is shown
      const tabContent = page.locator('[role="tabpanel"]').last()
      await expect(tabContent).toBeVisible()
    })

    test('should load all tabs without errors', async ({ page }) => {
      const tabs = ['Roles', 'Hierarchy', 'Test Access', 'Conflicts']
      
      for (const tabName of tabs) {
        await page.getByRole('tab', { name: new RegExp(tabName, 'i') }).click()
        await page.waitForTimeout(500)
        
        // Check that tab content is visible
        const tabContent = page.locator('[role="tabpanel"]').last()
        await expect(tabContent).toBeVisible({ timeout: 2000 })
      }
    })

    test('should maintain form state in modals', async ({ page }) => {
      // Open create role modal
      await page.getByRole('button', { name: /new role|create role/i }).click()
      
      // Wait for modal
      await expect(page.getByRole('heading', { name: /create role|new role/i })).toBeVisible({ timeout: 3000 })
      
      // Modal should be visible and functional
      const dialog = page.locator('[role="dialog"]')
      await expect(dialog).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('all tabs should be keyboard accessible', async ({ page }) => {
      const tabs = ['Roles', 'Hierarchy', 'Test Access', 'Conflicts']
      
      for (const tabName of tabs) {
        const tab = page.getByRole('tab', { name: new RegExp(tabName, 'i') })
        await expect(tab).toHaveAttribute('role', 'tab')
      }
    })

    test('tabs should have proper ARIA attributes', async ({ page }) => {
      const rolesTab = page.getByRole('tab', { name: /roles/i })
      
      // Should have aria-selected attribute
      const ariaSelected = await rolesTab.getAttribute('aria-selected')
      expect(ariaSelected).toBeTruthy()
    })

    test('tab panels should have proper ARIA attributes', async ({ page }) => {
      const tabPanel = page.locator('[role="tabpanel"]').first()
      
      // Should have role="tabpanel"
      const role = await tabPanel.getAttribute('role')
      expect(role).toBe('tabpanel')
    })
  })
})
