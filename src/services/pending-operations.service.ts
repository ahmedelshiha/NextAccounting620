/**
 * Pending Operations Service
 * 
 * Handles fetching and managing pending operations/workflows
 * for the admin users page dashboard.
 * 
 * This service can be extended to connect to real APIs:
 * - GET /api/admin/workflows - List pending workflows
 * - POST /api/admin/workflows/:id/approve - Approve workflow
 * - POST /api/admin/workflows/:id/cancel - Cancel workflow
 */

export interface PendingOperation {
  id: string
  title: string
  description: string
  progress: number
  dueDate?: string
  assignee?: string
  status: 'pending' | 'in-progress' | 'completed'
  actions?: Array<{ label: string; onClick: () => void }>
}

export interface OperationsMetrics {
  totalUsers: number
  pendingApprovals: number
  inProgressWorkflows: number
  dueThisWeek: number
}

/**
 * Fetch pending operations from the API
 *
 * Calls /api/admin/pending-operations to get real pending operations
 * Falls back to mock data only in development if API is unavailable
 */
export async function fetchPendingOperations(
  tenantId: string,
  options?: { limit?: number; offset?: number }
): Promise<PendingOperation[]> {
  try {
    // Build query parameters
    const params = new URLSearchParams()
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())

    // Call the real API endpoint
    const response = await fetch(
      `/api/admin/pending-operations?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    return (data.operations || []).map((op: any) => ({
      id: op.id,
      title: op.title,
      description: op.description,
      progress: op.progress,
      dueDate: op.dueDate,
      assignee: op.assignee,
      status: op.status,
      actions: op.actions
    }))
  } catch (error) {
    // Only use mock data as fallback in development
    if (process.env.NODE_ENV === 'development') {
      return getMockPendingOperations()
    }
    // In production, return empty array
    return []
  }
}

/**
 * Get metrics about operations
 *
 * Calculates metrics from pending operations data
 * In Phase 4b, this will be replaced with dedicated metrics API
 */
export async function fetchOperationsMetrics(
  tenantId: string,
  userCount: number
): Promise<OperationsMetrics> {
  try {
    // Fetch pending operations to calculate metrics
    const operations = await fetchPendingOperations(tenantId, { limit: 100 })

    // Calculate metrics from operations
    const pendingOps = operations.filter(op => op.status === 'pending')
    const inProgressOps = operations.filter(op => op.status === 'in-progress')
    const dueOps = operations.filter(op => {
      if (!op.dueDate) return false
      const dueDate = new Date(op.dueDate)
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)
      return dueDate <= weekFromNow
    })

    return {
      totalUsers: userCount,
      pendingApprovals: pendingOps.length,
      inProgressWorkflows: inProgressOps.length,
      dueThisWeek: dueOps.length
    }
  } catch (error) {
    // Return computed metrics as fallback
    return getMockMetrics(userCount)
  }
}

/**
 * Mock data - Remove when API endpoints are implemented
 */
function getMockPendingOperations(): PendingOperation[] {
  const now = new Date()
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  return [
    {
      id: '1',
      title: 'Onboarding - John Doe',
      description: 'New employee setup and system access provisioning',
      progress: 65,
      dueDate: nextWeek.toISOString(),
      assignee: 'HR Manager',
      status: 'in-progress',
      actions: [
        { label: 'View', onClick: () => {} },
        { label: 'Resume', onClick: () => {} }
      ]
    },
    {
      id: '2',
      title: 'Role Change - Jane Smith',
      description: 'Promotion to Team Lead role',
      progress: 40,
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      assignee: 'Admin',
      status: 'pending',
      actions: [
        { label: 'Review', onClick: () => {} },
        { label: 'Approve', onClick: () => {} }
      ]
    },
    {
      id: '3',
      title: 'Offboarding - Mike Johnson',
      description: 'Employee departure process and data archival',
      progress: 25,
      dueDate: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      assignee: 'IT Manager',
      status: 'pending',
      actions: [
        { label: 'Start', onClick: () => {} },
        { label: 'Details', onClick: () => {} }
      ]
    }
  ]
}

function getMockMetrics(userCount: number): OperationsMetrics {
  return {
    totalUsers: userCount,
    pendingApprovals: Math.max(0, Math.floor(userCount * 0.05)), // ~5% pending
    inProgressWorkflows: Math.max(1, Math.floor(userCount * 0.02)), // ~2% in progress
    dueThisWeek: Math.max(1, Math.floor(userCount * 0.03)) // ~3% due this week
  }
}

/**
 * Approve a pending operation
 */
export async function approvePendingOperation(operationId: string): Promise<void> {
  const response = await fetch(`/api/admin/pending-operations/${operationId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to approve operation: ${response.statusText}`)
  }
}

/**
 * Cancel a pending operation
 */
export async function cancelPendingOperation(operationId: string): Promise<void> {
  const response = await fetch(`/api/admin/pending-operations/${operationId}/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to cancel operation: ${response.statusText}`)
  }
}
