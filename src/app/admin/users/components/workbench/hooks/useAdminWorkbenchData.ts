'use client'

import { useQuery, useMutation, useQueryClient } from 'react-query'
import { getUsers, GetUsersParams, GetUsersResponse } from '../api/users'
import { getStats, StatsResponse } from '../api/stats'
import { applyBulkAction, previewBulkAction, undoBulkAction, BulkActionPayload, BulkActionResponse } from '../api/bulkActions'

/**
 * Hook to fetch users with caching and filtering
 *
 * @param params - Query parameters for filtering, sorting, pagination
 * @returns Query result with users data and loading/error states
 */
export function useUsers(params: GetUsersParams = {}) {
  return useQuery<GetUsersResponse, Error>(
    ['users', params],
    () => getUsers(params),
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false
    }
  )
}

/**
 * Hook to fetch dashboard statistics
 *
 * @returns Query result with stats data and loading/error states
 */
export function useStats() {
  return useQuery<StatsResponse, Error>(
    ['stats'],
    () => getStats(),
    {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      retry: 2,
      refetchOnWindowFocus: false
    }
  )
}

/**
 * Hook to apply bulk actions
 *
 * Invalidates users cache after successful mutation
 *
 * @returns Mutation function and state
 */
export function useBulkAction() {
  const queryClient = useQueryClient()

  return useMutation<BulkActionResponse, Error, BulkActionPayload>(
    (payload) => applyBulkAction(payload),
    {
      onSuccess: () => {
        // Invalidate users cache to trigger refetch
        queryClient.invalidateQueries('users')
      },
      retry: 1
    }
  )
}

/**
 * Hook to preview bulk actions
 *
 * Does not modify data, only previews changes
 *
 * @returns Mutation function and state
 */
export function useBulkActionPreview() {
  return useMutation((payload: BulkActionPayload) => previewBulkAction(payload), {
    retry: 1
  })
}

/**
 * Hook to undo bulk actions
 *
 * Invalidates users cache after successful undo
 *
 * @returns Mutation function and state
 */
export function useUndoBulkAction() {
  const queryClient = useQueryClient()

  return useMutation<{ success: boolean }, Error, string>(
    (operationId) => undoBulkAction(operationId),
    {
      onSuccess: () => {
        // Invalidate users cache to trigger refetch
        queryClient.invalidateQueries('users')
      },
      retry: 1
    }
  )
}
