export const API_URL = import.meta.env.VITE_API_URL || '/api'
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3005'

export const APP_NAME = 'Workflow Builder'

export const PLUGIN_TYPES = [
  { value: 'TEXT_TRANSFORM', label: 'Text Transform', icon: 'type' },
  { value: 'API_PROXY', label: 'API Proxy', icon: 'globe' },
  { value: 'DATA_AGGREGATOR', label: 'Data Aggregator', icon: 'layers' },
  { value: 'DELAY', label: 'Delay', icon: 'clock' },
  { value: 'CUSTOM', label: 'Custom', icon: 'code' },
] as const

export const RUN_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  PAUSED: 'Paused',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

export const STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  SKIPPED: 'Skipped',
  RETRYING: 'Retrying',
}

export const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 60000,
}
