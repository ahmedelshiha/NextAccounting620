'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

interface ConfigureStepProps {
  operationType: string
  config: Record<string, any>
  onConfigChange: (config: Record<string, any>) => void
  onNext: () => void
}

export const ConfigureStep: React.FC<ConfigureStepProps> = ({
  operationType,
  config,
  onConfigChange,
  onNext
}) => {
  const handleNext = () => {
    if (!config.fromValue && operationType !== 'SEND_EMAIL') {
      return
    }
    onNext()
  }

  const renderOperationConfig = () => {
    switch (operationType) {
      case 'ROLE_CHANGE':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">From Role</label>
              <Select
                value={config.fromRole || 'PLACEHOLDER'}
                onValueChange={(role) =>
                  onConfigChange({ ...config, fromRole: role })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">To Role</label>
              <Select
                value={config.toRole || 'PLACEHOLDER'}
                onValueChange={(role) =>
                  onConfigChange({ ...config, toRole: role })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="STAFF">Staff</SelectItem>
                  <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                  <SelectItem value="CLIENT">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-3 bg-amber-50 rounded border border-amber-200">
              <p className="text-xs text-amber-700">
                <strong>Warning:</strong> Changing roles may affect user permissions and access levels
              </p>
            </div>
          </div>
        )

      case 'STATUS_UPDATE':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">New Status</label>
              <Select
                value={config.toStatus || 'PLACEHOLDER'}
                onValueChange={(status) =>
                  onConfigChange({ ...config, toStatus: status })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Reason (optional)</label>
              <Textarea
                placeholder="Enter reason for status change..."
                value={config.reason || ''}
                onChange={(e) =>
                  onConfigChange({ ...config, reason: e.target.value })
                }
              />
            </div>
          </div>
        )

      case 'PERMISSION_GRANT':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Permissions to Grant</label>
              <div className="space-y-2">
                {[
                  'BOOKING_VIEW',
                  'BOOKING_CREATE',
                  'BOOKING_EDIT',
                  'USER_VIEW',
                  'USER_EDIT',
                  'REPORTING_VIEW',
                  'SETTINGS_EDIT'
                ].map(perm => (
                  <label
                    key={perm}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <Checkbox
                      checked={
                        config.permissions?.includes(perm) || false
                      }
                      onCheckedChange={(checked) => {
                        const perms = config.permissions || []
                        if (checked) {
                          if (!perms.includes(perm)) {
                            onConfigChange({
                              ...config,
                              permissions: [...perms, perm]
                            })
                          }
                        } else {
                          onConfigChange({
                            ...config,
                            permissions: perms.filter((p: string) => p !== perm)
                          })
                        }
                      }}
                    />
                    <span className="text-sm">{perm.replace(/_/g, ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            {config.permissions && config.permissions.length > 0 && (
              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <p className="text-xs font-medium text-blue-900 mb-2">Selected permissions:</p>
                <div className="flex flex-wrap gap-2">
                  {config.permissions.map((perm: string) => (
                    <Badge key={perm} variant="secondary">
                      {perm.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )

      case 'SEND_EMAIL':
        return (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email Template</label>
              <Select
                value={config.emailTemplate || 'PLACEHOLDER'}
                onValueChange={(template) =>
                  onConfigChange({ ...config, emailTemplate: template })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WELCOME">Welcome to System</SelectItem>
                  <SelectItem value="PASSWORD_RESET">
                    Password Reset
                  </SelectItem>
                  <SelectItem value="ROLE_CHANGE">Role Changed</SelectItem>
                  <SelectItem value="CUSTOM">Custom Message</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.emailTemplate === 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Custom Message
                </label>
                <Textarea
                  placeholder="Enter custom email message..."
                  value={config.customMessage || ''}
                  onChange={(e) =>
                    onConfigChange({ ...config, customMessage: e.target.value })
                  }
                  className="min-h-24"
                />
              </div>
            )}

            <div>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={config.sendImmediately !== false}
                  onCheckedChange={(checked) =>
                    onConfigChange({
                      ...config,
                      sendImmediately: checked
                    })
                  }
                />
                <span className="text-sm">Send immediately</span>
              </label>
            </div>
          </div>
        )

      default:
        return (
          <div className="text-center py-8 text-gray-500">
            <p>Select an operation type first</p>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Configure Operation</h3>
        <p className="text-gray-600 mb-4">
          Set the specific parameters for this bulk operation
        </p>
      </div>

      {/* Configuration form */}
      <div className="space-y-4 bg-gray-50 p-6 rounded-lg border">
        {renderOperationConfig()}
      </div>

      {/* Additional options */}
      <div className="space-y-3 bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={config.notifyUsers !== false}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, notifyUsers: checked })
              }
            />
            <span className="text-sm font-medium">Notify users of changes</span>
          </label>
        </div>

        <div>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={config.requireApproval || false}
              onCheckedChange={(checked) =>
                onConfigChange({ ...config, requireApproval: checked })
              }
            />
            <span className="text-sm font-medium">Require approval before executing</span>
          </label>
        </div>
      </div>

      {/* Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleNext}
          className="bg-blue-600 hover:bg-blue-700"
        >
          Next: Review & Preview
        </Button>
      </div>
    </div>
  )
}
