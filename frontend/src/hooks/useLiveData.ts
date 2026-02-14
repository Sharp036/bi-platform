import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

export type LiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface LiveEvent {
  type: string
  data: Record<string, unknown>
}

interface UseLiveDataOptions {
  /** Whether live mode is enabled */
  enabled: boolean
  /** Report ID to subscribe to */
  reportId: number | null
  /** Callback when report data is updated */
  onReportUpdate?: (data: Record<string, unknown>) => void
  /** Callback when a specific widget is updated */
  onWidgetUpdate?: (data: { widgetId: number; data: unknown }) => void
  /** Callback for any event */
  onEvent?: (event: LiveEvent) => void
  /** Reconnect delay in ms (default 3000) */
  reconnectDelay?: number
}

/**
 * Hook for subscribing to live SSE updates for a report.
 *
 * Uses fetch() + ReadableStream to consume SSE with Authorization header
 * (native EventSource doesn't support custom headers).
 *
 * Usage:
 *   const { status, lastUpdate, disconnect } = useLiveData({
 *     enabled: true,
 *     reportId: 5,
 *     onReportUpdate: (data) => { refetch() },
 *   })
 */
export function useLiveData(options: UseLiveDataOptions) {
  const { enabled, reportId, onReportUpdate, onWidgetUpdate, onEvent, reconnectDelay = 3000 } = options
  const [status, setStatus] = useState<LiveStatus>('disconnected')
  const [lastUpdate, setLastUpdate] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retriesRef = useRef(0)
  const callbacksRef = useRef({ onReportUpdate, onWidgetUpdate, onEvent })

  // Keep callbacks fresh
  callbacksRef.current = { onReportUpdate, onWidgetUpdate, onEvent }

  const getToken = useCallback(() => {
    return localStorage.getItem('accessToken')
  }, [])

  const connect = useCallback(async () => {
    if (!reportId || !enabled) return

    // Cleanup previous connection
    abortRef.current?.abort()
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    const token = getToken()
    if (!token) { setStatus('error'); return }

    const controller = new AbortController()
    abortRef.current = controller

    setStatus('connecting')

    try {
      const baseUrl = import.meta.env.VITE_API_URL || ''
      const url = `${baseUrl}/live/subscribe?reportId=${reportId}`

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported')
      }

      setStatus('connected')
      retriesRef.current = 0

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete line

        let currentEventType = 'message'
        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEventType = line.slice(6).trim()
          } else if (line.startsWith('data:')) {
            const raw = line.slice(5).trim()
            if (!raw) continue

            try {
              const data = JSON.parse(raw)
              handleEvent(currentEventType, data)
            } catch {
              // Non-JSON data, ignore
            }
            currentEventType = 'message'
          }
          // Skip comments and empty lines
        }
      }

      // Stream ended normally
      setStatus('disconnected')
      scheduleReconnect()

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') {
        setStatus('disconnected')
        return
      }
      console.warn('SSE error:', err)
      setStatus('error')
      scheduleReconnect()
    }
  }, [reportId, enabled, getToken])

  const handleEvent = useCallback((type: string, data: Record<string, unknown>) => {
    if (type === 'heartbeat') return // ignore heartbeats

    setLastUpdate(Date.now())

    if (type === 'connected') return // initial connection event

    if (type === 'report-update' || type === 'manual-refresh') {
      callbacksRef.current.onReportUpdate?.(data)
    }

    if (type === 'widget-update') {
      callbacksRef.current.onWidgetUpdate?.(data as { widgetId: number; data: unknown })
    }

    callbacksRef.current.onEvent?.({ type, data })
  }, [])

  const scheduleReconnect = useCallback(() => {
    retriesRef.current++
    const delay = Math.min(reconnectDelay * Math.pow(1.5, retriesRef.current - 1), 30000)
    reconnectTimerRef.current = setTimeout(() => {
      connect()
    }, delay)
  }, [reconnectDelay, connect])

  const disconnect = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    setStatus('disconnected')
  }, [])

  // Auto-connect when enabled + reportId
  useEffect(() => {
    if (enabled && reportId) {
      connect()
    } else {
      disconnect()
    }
    return () => disconnect()
  }, [enabled, reportId])

  return { status, lastUpdate, disconnect, reconnect: connect }
}
