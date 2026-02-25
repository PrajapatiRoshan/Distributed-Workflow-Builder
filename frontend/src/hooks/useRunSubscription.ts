import { useEffect, useCallback } from 'react'
import { getSocket, connectSocket } from '@/lib/socket'
import { useRunsStore } from '@/stores/runs.store'
import type { WsRunEvent, StepLog, StepStatus, RunStatus } from '@/types'

export function useRunSubscription(runId: string | null) {
  const { updateStepStatus, updateRunStatus, appendLog, clearLiveState } = useRunsStore()

  const handleEvent = useCallback(
    (rawMessage: string) => {
      try {
        const event = JSON.parse(rawMessage) as WsRunEvent & { log?: StepLog; eventType?: string }

        if (event.type === 'RUN_UPDATE') {
          updateRunStatus(event.status as RunStatus)
        } else if (event.type === 'STEP_UPDATE') {
          if (event.eventType === 'STEP_LOG' && event.log) {
            appendLog(event.log)
          }
          if (event.stepId) {
            updateStepStatus(event.stepId, event.status as StepStatus, event.output)
          }
        }
      } catch (e) {
        console.error('Failed to parse WebSocket event:', e)
      }
    },
    [updateStepStatus, updateRunStatus, appendLog]
  )

  useEffect(() => {
    if (!runId) return

    connectSocket()
    const socket = getSocket()

    // Subscribe to run updates
    socket.emit('subscribe:run', runId)
    socket.on('event', handleEvent)

    return () => {
      socket.emit('unsubscribe:run', runId)
      socket.off('event', handleEvent)
      clearLiveState()
    }
  }, [runId, handleEvent, clearLiveState])
}
