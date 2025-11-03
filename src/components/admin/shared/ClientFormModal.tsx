'use client'

import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useEntityForm, type EntityFormConfig, type FieldValidation } from '@/app/admin/users/hooks'

interface ClientFormData {
  name: string
  email: string
  phone?: string
  company?: string
  tier: 'INDIVIDUAL' | 'SMB' | 'ENTERPRISE'
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  address?: string
  city?: string
  country?: string
  notes?: string
}

interface ClientFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (clientId: string) => void
  mode?: 'create' | 'edit'
  initialData?: Partial<Record<string, any>> & { id?: string }
  title?: string
  description?: string
}

export const ClientFormModal = React.forwardRef<HTMLDivElement, ClientFormModalProps>(
  function ClientFormModal({
    isOpen,
    onClose,
    onSuccess,
    mode = 'create',
    initialData,
    title,
    description,
  }, ref) {
    const defaultTitle = mode === 'create' ? 'Create New Client' : 'Edit Client'
    const defaultDescription = mode === 'create'
      ? 'Add a new client to your system'
      : 'Update client information'

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    const validation: FieldValidation = {
      name: { validate: (v) => !!v?.trim(), message: 'Client name is required' },
      email: [
        { validate: (v) => !!v?.trim(), message: 'Email is required' },
        { validate: (v) => emailRegex.test(v), message: 'Invalid email format' },
      ],
    }

    const formConfig: EntityFormConfig = {
      endpoint: (mode, id) =>
        mode === 'create' ? '/api/admin/entities/clients' : `/api/admin/entities/clients/${id}`,
      method: (mode) => (mode === 'create' ? 'POST' : 'PATCH'),
      successMessage: (mode) =>
        mode === 'create' ? 'Client created successfully' : 'Client updated successfully',
      onSuccess: (id) => {
        onSuccess?.(id)
        onClose()
      },
    }

    const form = useEntityForm<ClientFormData>({
      initialData: {
        name: initialData?.name || '',
        email: initialData?.email || '',
        phone: initialData?.phone || '',
        company: initialData?.company || '',
        tier: initialData?.tier || 'INDIVIDUAL',
        status: initialData?.status || 'ACTIVE',
        address: initialData?.address || '',
        city: initialData?.city || '',
        country: initialData?.country || '',
        notes: initialData?.notes || '',
      },
      validation,
      config: formConfig,
      entityId: initialData?.id,
      mode: mode,
    })

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      form.submit()
    }

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent ref={ref} className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg sm:text-xl">{title || defaultTitle}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">{description || defaultDescription}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {form.error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{form.error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="Client name"
                value={form.formData.name}
                onChange={(e) => form.handleChange('name', e.target.value)}
                disabled={form.isSubmitting}
              />
              {form.fieldErrors.name && <p className="text-sm text-red-600">{form.fieldErrors.name}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="client@example.com"
                value={form.formData.email}
                onChange={(e) => form.handleChange('email', e.target.value)}
                disabled={form.isSubmitting}
              />
              {form.fieldErrors.email && <p className="text-sm text-red-600">{form.fieldErrors.email}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs sm:text-sm">Phone</Label>
                <Input
                  id="phone"
                  placeholder="Phone number"
                  value={form.formData.phone || ''}
                  onChange={(e) => form.handleChange('phone', e.target.value)}
                  disabled={form.isSubmitting}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company" className="text-xs sm:text-sm">Company</Label>
                <Input
                  id="company"
                  placeholder="Company name"
                  value={form.formData.company || ''}
                  onChange={(e) => form.handleChange('company', e.target.value)}
                  disabled={form.isSubmitting}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tier" className="text-xs sm:text-sm">Tier</Label>
                <Select value={form.formData.tier} onValueChange={(value) => form.handleChange('tier', value)}>
                  <SelectTrigger id="tier" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="SMB">SMB</SelectItem>
                    <SelectItem value="ENTERPRISE">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status" className="text-xs sm:text-sm">Status</Label>
                <Select value={form.formData.status} onValueChange={(value) => form.handleChange('status', value)}>
                  <SelectTrigger id="status" className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="Street address"
                value={form.formData.address || ''}
                onChange={(e) => form.handleChange('address', e.target.value)}
                disabled={form.isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="City"
                  value={form.formData.city || ''}
                  onChange={(e) => form.handleChange('city', e.target.value)}
                  disabled={form.isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  placeholder="Country"
                  value={form.formData.country || ''}
                  onChange={(e) => form.handleChange('country', e.target.value)}
                  disabled={form.isSubmitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Additional notes"
                value={form.formData.notes || ''}
                onChange={(e) => form.handleChange('notes', e.target.value)}
                disabled={form.isSubmitting}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={form.isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={form.isSubmitting}
              >
                {form.isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {mode === 'create' ? 'Creating...' : 'Updating...'}
                  </>
                ) : (
                  mode === 'create' ? 'Create Client' : 'Update Client'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    )
  }
)

ClientFormModal.displayName = 'ClientFormModal'
