import { cn } from '@/lib/utils'
import type { RunStep } from '@/types'

interface RunProgressProps {
  steps: RunStep[]
}

export default function RunProgress({ steps }: RunProgressProps) {
  const total = steps.length
  const completed = steps.filter((s) => s.status === 'COMPLETED').length
  const failed = steps.filter((s) => s.status === 'FAILED').length
  const running = steps.filter((s) => s.status === 'RUNNING').length
  const skipped = steps.filter((s) => s.status === 'SKIPPED').length

  const progress = total > 0 ? Math.round(((completed + failed + skipped) / total) * 100) : 0

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-900">Progress</span>
        <span className="text-sm text-slate-500">{progress}%</span>
      </div>

      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-500',
            failed > 0 ? 'bg-red-500' : 'bg-green-500'
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <div>
          <p className="text-lg font-semibold text-green-600">{completed}</p>
          <p className="text-xs text-slate-500">Completed</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-blue-600">{running}</p>
          <p className="text-xs text-slate-500">Running</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-red-600">{failed}</p>
          <p className="text-xs text-slate-500">Failed</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-400">{total - completed - failed - running - skipped}</p>
          <p className="text-xs text-slate-500">Pending</p>
        </div>
      </div>
    </div>
  )
}
