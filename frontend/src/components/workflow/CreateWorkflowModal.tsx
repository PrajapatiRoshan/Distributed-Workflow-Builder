import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface CreateWorkflowModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, description?: string) => Promise<void>
}

export default function CreateWorkflowModal({
  isOpen,
  onClose,
  onCreate,
}: CreateWorkflowModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Workflow name is required')
      return
    }

    setIsLoading(true)
    try {
      await onCreate(name.trim(), description.trim() || undefined)
      setName('')
      setDescription('')
      onClose()
    } catch {
      setError('Failed to create workflow')
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setError('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create Workflow" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My Workflow"
          error={error}
          autoFocus
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this workflow does..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isLoading}>
            Create
          </Button>
        </div>
      </form>
    </Modal>
  )
}
