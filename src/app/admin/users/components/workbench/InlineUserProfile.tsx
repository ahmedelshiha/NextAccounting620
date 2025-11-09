"use client"

import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useUsersContext } from '../../contexts/UsersContextProvider'
import { OverviewTab } from '../UserProfileDialog/OverviewTab'
import { DetailsTab } from '../UserProfileDialog/DetailsTab'
import { ActivityTab } from '../UserProfileDialog/ActivityTab'
import { SettingsTab } from '../UserProfileDialog/SettingsTab'
import { useUserActions } from '../../hooks/useUserActions'
import { toast } from 'sonner'
import UnifiedPermissionModal from '@/components/admin/permissions/UnifiedPermissionModal'
import type { Permission } from '@/lib/permissions'

export default function InlineUserProfile({ onBack }: { onBack: () => void }) {
  const {
    selectedUser,
    activeTab,
    setActiveTab,
    editMode,
    setEditMode,
    setSelectedUser,
    editForm,
    setUpdating,
    updating,
    permissionModalOpen,
    setPermissionModalOpen
  } = useUsersContext()

  const { updateUser } = useUserActions({
    onSuccess: (message) => {
      toast.success(message)
      setEditMode(false)
    },
    onError: (error) => {
      toast.error(error)
    }
  })

  const handleBack = useCallback(() => {
    setEditMode(false)
    setActiveTab('overview')
    setSelectedUser(null as any)
    onBack()
  }, [onBack, setActiveTab, setEditMode, setSelectedUser])

  const handleSaveProfile = useCallback(async () => {
    if (!editForm?.name?.trim()) {
      toast.error('Full name is required')
      return
    }
    if (selectedUser?.id) {
      setUpdating(true)
      try {
        await updateUser(selectedUser.id, editForm)
      } catch (error) {
        console.error('Update failed:', error)
      } finally {
        setUpdating(false)
      }
    }
  }, [selectedUser?.id, editForm, updateUser, setUpdating])

  if (!selectedUser) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleBack} className="mb-2">
            ← Back to dashboard List
          </Button>
        </div>
        {editMode && activeTab === 'details' && (
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={handleSaveProfile}
              disabled={updating}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {updating ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              onClick={() => setEditMode(false)}
              disabled={updating}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-lg">
        <div className="h-24 flex items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="flex-shrink-0 w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {(selectedUser.name || selectedUser.email).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-slate-900">{selectedUser.name || 'Unnamed User'}</h1>
              <p className="text-sm text-slate-600 truncate">{selectedUser.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                  {selectedUser.role || 'VIEWER'}
                </span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedUser.status === 'ACTIVE'
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {selectedUser.status || 'ACTIVE'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs (mobile secondary nav) */}
        <div className="sm:hidden border-t border-slate-200 flex overflow-x-auto">
          {(['overview', 'details', 'activity', 'settings'] as const).map((id) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                activeTab === id ? 'border-blue-600 text-blue-600 bg-blue-50' : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex">
          {/* Sidebar (desktop) */}
          <nav className="w-64 bg-white border-r border-gray-200 overflow-y-auto hidden sm:block">
            <div className="p-4 space-y-2">
              {([
                { id: 'overview', label: 'Overview' },
                { id: 'details', label: 'Details' },
                { id: 'activity', label: 'Activity' },
                { id: 'settings', label: 'Settings' },
              ] as const).map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Main */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-5xl mx-auto px-6 md:px-8 py-8">
              {activeTab === 'overview' && <OverviewTab user={selectedUser} />}
              {activeTab === 'details' && <DetailsTab user={selectedUser} isEditing={editMode} />}
              {activeTab === 'activity' && <ActivityTab userId={selectedUser.id} />}
              {activeTab === 'settings' && <SettingsTab user={selectedUser} />}
            </div>
          </div>
        </div>
      </div>

      {/* Permission Modal */}
      {permissionModalOpen && selectedUser && (
        <UnifiedPermissionModal
          mode="user"
          targetId={selectedUser.id}
          targetName={selectedUser.name || 'User'}
          targetEmail={selectedUser.email}
          currentRole={selectedUser.role}
          currentPermissions={(selectedUser.permissions || []) as Permission[]}
          onClose={() => setPermissionModalOpen(false)}
          onSave={async (changes) => {
            try {
              const res = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changes)
              })
              if (!res.ok) throw new Error('Failed to update permissions')
              setPermissionModalOpen(false)
              toast.success('Permissions updated successfully')
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Failed to update permissions')
              throw error
            }
          }}
        />
      )}
    </div>
  )
}
