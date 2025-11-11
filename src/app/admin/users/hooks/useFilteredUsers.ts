'use client'

import { useCallback, useMemo } from 'react'
import useSWR, { SWRConfiguration } from 'swr'
import React from 'react'
import { UserItem } from '../contexts/UserDataContext'
import {
  filterResultsCache,
  createFilterCacheKey,
  CacheManager
} from '@/app/admin/users/utils/cache-manager'
import { globalPerformanceMonitor } from '@/app/admin/users/utils/performance-monitor'

export interface FilterOptions {
  search?: string
  role?: string | string[]
  status?: string | string[]
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilteredUsersResponse {
  data: UserItem[]
  total: number
  page: number
  limit: number
  totalPages: number
  isStale?: boolean
  staleSince?: FilteredUsersResponse
}

/**
 * Hook for fetching filtered users with SWR and caching
 * Implements Stale-While-Revalidate pattern for optimal performance
 */
export function useFilteredUsers(
  filters: FilterOptions = {},
  options: SWRConfiguration & {
    enabled?: boolean
    useCache?: boolean
    cacheTtl?: number
  } = {}
) {
  const {
    enabled = true,
    useCache = true,
    cacheTtl = 5 * 60 * 1000, // 5 minutes
    ...swrOptions
  } = options

  // Create cache key from filters
  const cacheKey = useMemo(
    () => createFilterCacheKey(filters, filters.page, filters.limit),
    [filters]
  )

  // Fetcher function
  const fetcher = useCallback(async (key: string): Promise<FilteredUsersResponse> => {
    const opId = `fetch-users-${Date.now()}`
    globalPerformanceMonitor.startTimer(opId)

    try {
      // Check if we have cached data
      const cached = useCache 
        ? filterResultsCache.getWithStale<FilteredUsersResponse>(key)
        : { data: null, isStale: false }

      // If we have fresh cached data, return it
      if (cached.data && !cached.isStale) {
        globalPerformanceMonitor.endTimer(opId, 'fetch-users-cached', 'success', {
          cached: true
        })
        return cached.data
      }

      // Build query params
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.role) {
        const roles = Array.isArray(filters.role) ? filters.role : [filters.role]
        roles.forEach(r => params.append('role', r))
      }
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        statuses.forEach(s => params.append('status', s))
      }
      if (filters.page) params.append('page', String(filters.page))
      if (filters.limit) params.append('limit', String(filters.limit))
      if (filters.sortBy) params.append('sortBy', filters.sortBy)
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder)

      const response = await fetch(`/api/admin/users?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`)
      }

      const data = await response.json() as FilteredUsersResponse

      // Cache the result
      if (useCache) {
        filterResultsCache.set(key, data, { ttl: cacheTtl })
      }

      globalPerformanceMonitor.endTimer(opId, 'fetch-users-api', 'success', {
        count: data.data.length,
        total: data.total
      })

      // Return stale data with new data if available
      if (cached.data && cached.isStale) {
        return {
          ...data,
          isStale: true,
          staleSince: cached.data
        }
      }

      return data
    } catch (error) {
      globalPerformanceMonitor.endTimer(opId, 'fetch-users-api', 'error', {
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }, [useCache, filters, cacheTtl])

  // Use SWR for data fetching
  const { data, error, isLoading, mutate } = useSWR<FilteredUsersResponse | undefined>(
    enabled ? cacheKey : null,
    enabled ? fetcher : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      focusThrottleInterval: 30000, // 30 seconds
      dedupingInterval: 30000, // 30 seconds
      ...swrOptions
    }
  )

  // Invalidate cache when filters change
  const invalidateCache = useCallback(() => {
    if (useCache) {
      filterResultsCache.invalidate(cacheKey)
    }
  }, [useCache, cacheKey])

  // Manual refresh
  const refresh = useCallback(() => {
    invalidateCache()
    mutate()
  }, [invalidateCache, mutate])

  // Preload next page
  const preloadNextPage = useCallback(async () => {
    if (!data || !data.totalPages || data.page >= data.totalPages) {
      return
    }

    const nextPage = (data.page || 1) + 1
    const nextCacheKey = createFilterCacheKey(
      { ...filters, page: nextPage },
      nextPage,
      filters.limit
    )

    // Check if already cached
    if (filterResultsCache.has(nextCacheKey)) {
      return
    }

    try {
      const params = new URLSearchParams()
      if (filters.search) params.append('search', filters.search)
      if (filters.role) {
        const roles = Array.isArray(filters.role) ? filters.role : [filters.role]
        roles.forEach(r => params.append('role', r))
      }
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
        statuses.forEach(s => params.append('status', s))
      }
      params.append('page', String(nextPage))
      if (filters.limit) params.append('limit', String(filters.limit))

      const response = await fetch(`/api/admin/users?${params}`)
      if (!response.ok) return

      const nextData = await response.json() as FilteredUsersResponse
      filterResultsCache.set(nextCacheKey, nextData, { ttl: cacheTtl })
    } catch (error) {
      console.warn('Failed to preload next page:', error)
    }
  }, [data, filters, cacheTtl])

  return {
    // Data
    users: data?.data ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    isStale: (data as any)?.isStale ?? false,

    // Loading states
    isLoading,
    isValidating: isLoading || (!error && !data),
    error,

    // Methods
    mutate,
    refresh,
    invalidateCache,
    preloadNextPage
  }
}

/**
 * Hook for optimized infinite scroll with SWR
 */
export function useInfiniteFilteredUsers(
  filters: Omit<FilterOptions, 'page' | 'limit'>,
  pageSize = 50
) {
  const [allUsers, setAllUsers] = React.useState<UserItem[]>([])
  const [page, setPage] = React.useState(1)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)

  const { users, total, isLoading, refresh } = useFilteredUsers(
    { ...filters, page, limit: pageSize },
    { useCache: true }
  )

  // Load more
  const loadMore = React.useCallback(() => {
    if (isLoadingMore || !users.length) return
    
    setIsLoadingMore(true)
    setPage(p => p + 1)
    setIsLoadingMore(false)
  }, [isLoadingMore, users.length])

  // Accumulate users
  React.useEffect(() => {
    if (users.length > 0) {
      setAllUsers(prev => {
        const ids = new Set(prev.map(u => u.id))
        const newUsers = users.filter(u => !ids.has(u.id))
        return [...prev, ...newUsers]
      })
    }
  }, [users])

  // Calculate if we have more to load
  const hasMore = allUsers.length < total

  return {
    users: allUsers,
    total,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    refresh,
    reset: () => {
      setAllUsers([])
      setPage(1)
      refresh()
    }
  }
}
