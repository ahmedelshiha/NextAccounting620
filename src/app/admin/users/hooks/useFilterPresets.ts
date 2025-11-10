'use client'

import { useState, useCallback, useEffect } from 'react'
import { FilterState } from './useFilterState'

export interface FilterPreset {
  id: string
  name: string
  description?: string
  filters: FilterState
  createdAt: string
  updatedAt: string
  isPinned: boolean
}

const STORAGE_KEY = 'user-directory-filter-presets'
const MAX_PRESETS = 20

/**
 * Hook to manage filter presets (save, load, delete)
 * Persists presets to localStorage
 */
export function useFilterPresets() {
  const [presets, setPresets] = useState<FilterPreset[]>([])
  const [isLoaded, setIsLoaded] = useState(false)

  // Load presets from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as FilterPreset[]
        setPresets(parsed)
      }
    } catch (error) {
      console.error('Failed to load filter presets:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save presets to localStorage
  const saveToStorage = useCallback((presetsToSave: FilterPreset[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(presetsToSave))
    } catch (error) {
      console.error('Failed to save filter presets:', error)
    }
  }, [])

  // Create a new preset
  const createPreset = useCallback(
    (name: string, filters: FilterState, description?: string) => {
      if (presets.length >= MAX_PRESETS) {
        throw new Error(`Maximum of ${MAX_PRESETS} presets allowed`)
      }

      if (!name.trim()) {
        throw new Error('Preset name cannot be empty')
      }

      const now = new Date().toISOString()
      const newPreset: FilterPreset = {
        id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: name.trim(),
        description,
        filters,
        createdAt: now,
        updatedAt: now,
        isPinned: false
      }

      const updated = [newPreset, ...presets]
      setPresets(updated)
      saveToStorage(updated)

      return newPreset
    },
    [presets, saveToStorage]
  )

  // Update an existing preset
  const updatePreset = useCallback(
    (id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>) => {
      const preset = presets.find(p => p.id === id)
      if (!preset) {
        throw new Error(`Preset with id ${id} not found`)
      }

      if (updates.name !== undefined && !updates.name.trim()) {
        throw new Error('Preset name cannot be empty')
      }

      const updated = presets.map(p =>
        p.id === id
          ? {
              ...p,
              ...updates,
              updatedAt: new Date().toISOString()
            }
          : p
      )

      setPresets(updated)
      saveToStorage(updated)

      return updated.find(p => p.id === id)!
    },
    [presets, saveToStorage]
  )

  // Delete a preset
  const deletePreset = useCallback(
    (id: string) => {
      const updated = presets.filter(p => p.id !== id)
      setPresets(updated)
      saveToStorage(updated)
    },
    [presets, saveToStorage]
  )

  // Pin/unpin a preset
  const togglePin = useCallback(
    (id: string) => {
      const preset = presets.find(p => p.id === id)
      if (!preset) return

      return updatePreset(id, { isPinned: !preset.isPinned })
    },
    [presets, updatePreset]
  )

  // Get preset by id
  const getPreset = useCallback(
    (id: string) => {
      return presets.find(p => p.id === id)
    },
    [presets]
  )

  // Get pinned presets (sorted by date)
  const getPinnedPresets = useCallback(() => {
    return presets
      .filter(p => p.isPinned)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [presets])

  // Get all presets sorted by date
  const getAllPresets = useCallback(() => {
    return [...presets].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
  }, [presets])

  // Clear all presets
  const clearAllPresets = useCallback(() => {
    setPresets([])
    saveToStorage([])
  }, [saveToStorage])

  return {
    presets,
    isLoaded,
    createPreset,
    updatePreset,
    deletePreset,
    togglePin,
    getPreset,
    getPinnedPresets,
    getAllPresets,
    clearAllPresets
  }
}
