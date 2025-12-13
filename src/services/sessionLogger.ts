/**
 * Session Logger - Supabase-based logging for debugging
 * 
 * Best Practices:
 * 1. Log all session events with timestamps
 * 2. Include device_id for filtering
 * 3. Use log levels (debug, info, warn, error)
 * 4. Capture stack traces for errors
 * 5. Rate-limit to prevent spam
 */

import { supabase } from './supabase'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  device_id: string
  session_id?: string
  level: LogLevel
  event: string
  data?: Record<string, unknown>
  timestamp: string
  platform?: string
  app_version?: string
}

interface SessionEvent {
  event_type: string
  device_id: string
  session_id?: string
  peer_device_id?: string
  metadata?: Record<string, unknown>
}

class SessionLogger {
  private deviceId: string | null = null
  private sessionId: string | null = null
  private buffer: LogEntry[] = []
  private flushInterval: NodeJS.Timeout | null = null
  private readonly BUFFER_SIZE = 10
  private readonly FLUSH_INTERVAL_MS = 5000

  /**
   * Initialize logger with device ID
   */
  init(deviceId: string, sessionId?: string) {
    this.deviceId = deviceId
    this.sessionId = sessionId ?? null

    // Start periodic flush
    this.flushInterval = setInterval(() => {
      this.flush()
    }, this.FLUSH_INTERVAL_MS)

    this.info('logger_initialized', { sessionId })
  }

  /**
   * Set current session ID
   */
  setSession(sessionId: string) {
    this.sessionId = sessionId
    this.info('session_set', { sessionId })
  }

  /**
   * Log debug message (development only)
   */
  debug(event: string, data?: Record<string, unknown>) {
    if (__DEV__) {
      this.log('debug', event, data)
    }
  }

  /**
   * Log info message
   */
  info(event: string, data?: Record<string, unknown>) {
    this.log('info', event, data)
  }

  /**
   * Log warning
   */
  warn(event: string, data?: Record<string, unknown>) {
    this.log('warn', event, data)
  }

  /**
   * Log error with optional stack trace
   */
  error(event: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const errorData: Record<string, unknown> = { ...data }
    
    if (error instanceof Error) {
      errorData.error_message = error.message
      errorData.error_stack = error.stack
      errorData.error_name = error.name
    } else if (error) {
      errorData.error_raw = String(error)
    }

    this.log('error', event, errorData)
    
    // Flush immediately on error
    this.flush()
  }

  /**
   * Log session event (pairing, connection, disconnect)
   */
  async logSessionEvent(event: SessionEvent) {
    if (!this.deviceId) {
      console.warn('[SessionLogger] Not initialized')
      return
    }

    try {
      await supabase.from('session_events').insert({
        ...event,
        device_id: this.deviceId,
        session_id: this.sessionId ?? event.session_id,
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[SessionLogger] Failed to log session event:', err)
    }
  }

  /**
   * Log connection state change
   */
  async logConnectionState(
    state: 'connecting' | 'connected' | 'disconnected' | 'failed',
    peerDeviceId?: string,
    metadata?: Record<string, unknown>
  ) {
    await this.logSessionEvent({
      event_type: `connection_${state}`,
      device_id: this.deviceId!,
      peer_device_id: peerDeviceId,
      metadata: {
        state,
        ...metadata,
      },
    })

    this.info(`connection_${state}`, { peerDeviceId, ...metadata })
  }

  /**
   * Log WebRTC event
   */
  logWebRTC(event: string, data?: Record<string, unknown>) {
    this.info(`webrtc_${event}`, data)
  }

  /**
   * Log command sent/received
   */
  logCommand(
    direction: 'sent' | 'received',
    command: string,
    data?: Record<string, unknown>
  ) {
    this.info(`command_${direction}`, { command, ...data })
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, event: string, data?: Record<string, unknown>) {
    if (!this.deviceId) {
      console.warn('[SessionLogger] Not initialized, logging to console only')
      console[level](`[${event}]`, data)
      return
    }

    const entry: LogEntry = {
      device_id: this.deviceId,
      session_id: this.sessionId ?? undefined,
      level,
      event,
      data,
      timestamp: new Date().toISOString(),
      platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    }

    // Console output in dev
    if (__DEV__) {
      const prefix = `[${level.toUpperCase()}] ${event}`
      console[level](prefix, data ?? '')
    }

    // Buffer for batch insert
    this.buffer.push(entry)

    // Flush if buffer is full
    if (this.buffer.length >= this.BUFFER_SIZE) {
      this.flush()
    }
  }

  /**
   * Flush buffered logs to Supabase
   */
  async flush() {
    if (this.buffer.length === 0) return

    const entries = [...this.buffer]
    this.buffer = []

    try {
      await supabase.from('app_logs').insert(entries)
    } catch (err) {
      // Re-add to buffer on failure (with limit)
      if (this.buffer.length < this.BUFFER_SIZE * 2) {
        this.buffer = [...entries, ...this.buffer]
      }
      console.error('[SessionLogger] Failed to flush logs:', err)
    }
  }

  /**
   * Cleanup on app close
   */
  async destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
    await this.flush()
    this.deviceId = null
    this.sessionId = null
  }

  /**
   * Query logs for debugging (admin use)
   */
  async queryLogs(options: {
    deviceId?: string
    sessionId?: string
    level?: LogLevel
    startTime?: string
    endTime?: string
    limit?: number
  }) {
    let query = supabase
      .from('app_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(options.limit ?? 100)

    if (options.deviceId) {
      query = query.eq('device_id', options.deviceId)
    }
    if (options.sessionId) {
      query = query.eq('session_id', options.sessionId)
    }
    if (options.level) {
      query = query.eq('level', options.level)
    }
    if (options.startTime) {
      query = query.gte('timestamp', options.startTime)
    }
    if (options.endTime) {
      query = query.lte('timestamp', options.endTime)
    }

    const { data, error } = await query

    if (error) {
      console.error('[SessionLogger] Query failed:', error)
      return []
    }

    return data
  }
}

export const sessionLogger = new SessionLogger()

// Export type for event tracking
export type { SessionEvent, LogEntry }

