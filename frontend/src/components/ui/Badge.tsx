import { cn } from '@/lib/utils'
import type { RunStatus, StepStatus } from '@/types'

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'status'
  size?: 'sm' | 'md'
  status?: RunStatus | StepStatus
  children: React.ReactNode
  className?: string
}

const statusStyles: Record<string, string> = {
  PENDING: 'bg-slate-100 text-slate-600 border-slate-300',
  RUNNING: 'bg-blue-100 text-blue-700 border-blue-400',
  COMPLETED: 'bg-green-100 text-green-700 border-green-400',
  FAILED: 'bg-red-100 text-red-700 border-red-400',
  PAUSED: 'bg-amber-100 text-amber-700 border-amber-400',
  CANCELLED: 'bg-slate-100 text-slate-600 border-slate-300',
  SKIPPED: 'bg-yellow-100 text-yellow-700 border-yellow-400',
  RETRYING: 'bg-orange-100 text-orange-700 border-orange-400',
}

export function Badge({
  variant = 'default',
  size = 'sm',
  status,
  className,
  children,
}: BadgeProps) {
  const variants = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-100 text-green-700',
    warning: 'bg-amber-100 text-amber-700',
    error: 'bg-red-100 text-red-700',
    info: 'bg-blue-100 text-blue-700',
    status: '',
  }

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  }

  const statusStyle = status && variant === 'status' ? statusStyles[status] || '' : ''

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        sizes[size],
        variant === 'status' ? statusStyle : variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
