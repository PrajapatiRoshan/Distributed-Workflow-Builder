import { useNavigate } from 'react-router-dom'
import { useBuilderStore } from '@/stores/builder.store'
import { useWorkflowsStore } from '@/stores/workflows.store'
import { useToast } from '@/hooks/useToast'
import { runsApi } from '@/api/runs.api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Save, CheckCircle, Play, Upload, ArrowLeft } from 'lucide-react'

export default function BuilderToolbar() {
  const navigate = useNavigate()
  const { success, error: showError } = useToast()

  const {
    workflowId,
    workflowName,
    isDirty,
    isSaving,
    isValidating,
    validationResult,
    setWorkflowName,
    saveWorkflow,
    validateWorkflow,
  } = useBuilderStore()

  const { publishWorkflow } = useWorkflowsStore()

  const handleSave = async () => {
    try {
      await saveWorkflow()
      success('Workflow saved')
    } catch {
      showError('Failed to save workflow')
    }
  }

  const handleValidate = async () => {
    const result = await validateWorkflow()
    if (result.valid) {
      success('Workflow is valid')
    } else {
      showError(`Validation failed: ${result.errors[0]?.message || 'Unknown error'}`)
    }
  }

  const handlePublish = async () => {
    if (!workflowId) {
      showError('Please save the workflow first')
      return
    }

    // Validate first
    const result = await validateWorkflow()
    if (!result.valid) {
      showError('Please fix validation errors before publishing')
      return
    }

    try {
      await publishWorkflow(workflowId)
      success('Workflow published')
    } catch {
      showError('Failed to publish workflow')
    }
  }

  const handleRun = async () => {
    if (!workflowId) {
      showError('Please save the workflow first')
      return
    }

    try {
      const { data } = await runsApi.start({ workflowId })
      if (data.data?.runId) {
        success('Workflow started')
        navigate(`/runs/${data.data.runId}`)
      }
    } catch {
      showError('Failed to start workflow')
    }
  }

  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/workflows')}
            icon={<ArrowLeft className="h-4 w-4" />}
          >
            Back
          </Button>

          <div className="h-6 w-px bg-slate-200" />

          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="w-64 h-8 text-sm font-medium"
            placeholder="Workflow name..."
          />

          {isDirty && (
            <Badge variant="warning" size="sm">
              Unsaved changes
            </Badge>
          )}

          {validationResult && (
            <Badge variant={validationResult.valid ? 'success' : 'error'} size="sm">
              {validationResult.valid ? 'Valid' : 'Invalid'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleValidate}
            loading={isValidating}
            icon={<CheckCircle className="h-4 w-4" />}
          >
            Validate
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            disabled={!isDirty}
            icon={<Save className="h-4 w-4" />}
          >
            Save
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePublish}
            disabled={!workflowId}
            icon={<Upload className="h-4 w-4" />}
          >
            Publish
          </Button>

          <Button
            size="sm"
            onClick={handleRun}
            disabled={!workflowId}
            icon={<Play className="h-4 w-4" />}
          >
            Run
          </Button>
        </div>
      </div>
    </div>
  )
}
