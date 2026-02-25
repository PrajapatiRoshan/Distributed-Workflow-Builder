import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import type { StepLog } from '@/types'

interface LogViewerProps {
  logs: StepLog[]
  className?: string
}

const levelColors: Record<string, string> = {
  info: 'text-blue-600',
  warn: 'text-amber-600',
  error: 'text-red-600',
  debug: 'text-slate-500',
}

const levelBg: Record<string, string> = {
  info: 'bg-blue-50',
  warn: 'bg-amber-50',
  error: 'bg-red-50',
  debug: 'bg-slate-50',
}

export default function LogViewer({ logs, className }: LogViewerProps) {
  if (logs.length === 0) {
    return (
      <div className={cn('bg-slate-900 rounded-lg p-4', className)}>
        <p className="text-slate-400 text-sm text-center py-8">No logs yet</p>
      </div>
    )
  }

  return (
    <div className={cn('bg-slate-900 rounded-lg p-4 overflow-auto', className)}>
      <div className="space-y-1 font-mono text-sm">
        {logs.map((log, index) => (
          <div
            key={index}
            className={cn(
              'flex gap-3 px-2 py-1 rounded',
              levelBg[log.level]
            )}
          >
            <span className="text-slate-400 flex-shrink-0">
              {formatDate(log.ts, { timeStyle: 'medium' })}
            </span>
            <span
              className={cn(
                'uppercase text-xs font-semibold w-12 flex-shrink-0',
                levelColors[log.level]
              )}
            >
              {log.level}
            </span>
            <span className="text-slate-800 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
