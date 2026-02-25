import { useRunsStore } from '@/stores/runs.store'
import { useToast } from '@/hooks/useToast'
import { Button } from '@/components/ui/Button'
import { Pause, Play, XCircle } from 'lucide-react'

interface RunControlsProps {
  runId: string
}

export default function RunControls({ runId }: RunControlsProps) {
  const { currentRun, pauseRun, resumeRun, cancelRun } = useRunsStore()
  const { success, error: showError } = useToast()

  const status = currentRun?.status

  const handlePause = async () => {
    try {
      await pauseRun(runId)
      success('Run paused')
    } catch {
      showError('Failed to pause run')
    }
  }

  const handleResume = async () => {
    try {
      await resumeRun(runId)
      success('Run resumed')
    } catch {
      showError('Failed to resume run')
    }
  }

  const handleCancel = async () => {
    try {
      await cancelRun(runId)
      success('Run cancelled')
    } catch {
      showError('Failed to cancel run')
    }
  }

  if (!status || status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED') {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'RUNNING' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePause}
          icon={<Pause className="h-4 w-4" />}
        >
          Pause
        </Button>
      )}

      {status === 'PAUSED' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleResume}
          icon={<Play className="h-4 w-4" />}
        >
          Resume
        </Button>
      )}

      <Button
        variant="danger"
        size="sm"
        onClick={handleCancel}
        icon={<XCircle className="h-4 w-4" />}
      >
        Cancel
      </Button>
    </div>
  )
}
