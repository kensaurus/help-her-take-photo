/**
 * Session Logger - Supabase-based logging for debugging
 * 
 * Best Practices:
 * 1. Log all session events with timestamps
 * 2. Include device_id for filtering
 * 3. Use log levels (debug, info, warn, error)
 * 4. Capture stack traces for errors
 * 5. Rate-limit to prevent spam
 * 6. Include performance metrics
 * 7. Track camera lifecycle events
 */

import { Platform } from 'react-native'
import * as Application from 'expo-application'
import { supabase } from './supabase'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Camera-specific error types based on MDN getUserMedia errors
export type CameraErrorType = 
  | 'NotAllowedError'      // Permission denied
  | 'NotFoundError'        // No camera found
  | 'NotReadableError'     // Camera occupied by another app
  | 'OverconstrainedError' // Constraints couldn't be met
  | 'AbortError'           // Hardware problem
  | 'SecurityError'        // User media disabled
  | 'TypeError'            // Invalid constraints
  | 'TimeoutError'         // Custom: init timed out
  | 'StreamError'          // Custom: stream validation failed
  | 'UnknownError'         // Fallback

// Human-readable error messages
export const CAMERA_ERROR_MESSAGES: Record<CameraErrorType, string> = {
  NotAllowedError: 'Camera permission denied. Please enable camera access in Settings.',
  NotFoundError: 'No camera found on this device.',
  NotReadableError: 'Camera is being used by another app. Please close other camera apps and try again.',
  OverconstrainedError: 'Camera does not support the requested settings. Using default settings.',
  AbortError: 'Camera hardware error occurred. Please restart the app.',
  SecurityError: 'Camera access is disabled for security reasons.',
  TypeError: 'Invalid camera configuration. Please restart the app.',
  TimeoutError: 'Camera connection timed out. Please check your connection and try again.',
  StreamError: 'Camera stream failed to start. Please try again.',
  UnknownError: 'An unexpected camera error occurred. Please try again.',
}

interface LogEntry {
  device_id: string
  session_id?: string
  level: LogLevel
  event: string
  data?: Record<string, unknown>
  timestamp: string
  platform?: string
  app_version?: string
  duration_ms?: number
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
    // Defensive: avoid stacking multiple intervals when init() is called
    // from multiple screens (RootLayout, Home, Camera, Viewer, etc.).
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }

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
   * Log WebRTC event with detailed context
   */
  logWebRTC(event: string, data?: Record<string, unknown>) {
    this.info(`webrtc_${event}`, {
      ...data,
      _webrtc: true,
    })
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
   * Log camera lifecycle event with detailed tracking
   */
  logCamera(
    event: 'init_start' | 'init_success' | 'init_failed' | 'ready' | 'error' | 'cleanup' | 'stream_start' | 'stream_ready' | 'stream_failed' | 'capture_start' | 'capture_success' | 'capture_failed' | 'permission_request' | 'permission_granted' | 'permission_denied',
    data?: Record<string, unknown>
  ) {
    const level = event.includes('failed') || event.includes('error') || event.includes('denied') ? 'error' : 'info'
    this.log(level, `camera_${event}`, {
      ...data,
      _camera: true,
      _timestamp: Date.now(),
    })
  }

  /**
   * Log camera error with human-readable message
   */
  logCameraError(
    errorType: CameraErrorType,
    originalError?: Error | unknown,
    context?: Record<string, unknown>
  ) {
    const errorData: Record<string, unknown> = {
      errorType,
      userMessage: CAMERA_ERROR_MESSAGES[errorType],
      ...context,
      _camera: true,
    }

    if (originalError instanceof Error) {
      errorData.originalName = originalError.name
      errorData.originalMessage = originalError.message
      errorData.originalStack = originalError.stack?.substring(0, 500)
    } else if (originalError) {
      errorData.originalError = String(originalError)
    }

    this.error(`camera_error_${errorType.toLowerCase()}`, originalError as Error, errorData)
  }

  /**
   * Parse getUserMedia error to CameraErrorType
   */
  static parseMediaError(error: Error | unknown): CameraErrorType {
    if (!(error instanceof Error)) return 'UnknownError'
    
    const errorName = error.name
    
    switch (errorName) {
      case 'NotAllowedError':
      case 'PermissionDeniedError': // Legacy name
        return 'NotAllowedError'
      case 'NotFoundError':
      case 'DevicesNotFoundError': // Legacy name
        return 'NotFoundError'
      case 'NotReadableError':
      case 'TrackStartError': // Legacy name
        return 'NotReadableError'
      case 'OverconstrainedError':
      case 'ConstraintNotSatisfiedError': // Legacy name
        return 'OverconstrainedError'
      case 'AbortError':
        return 'AbortError'
      case 'SecurityError':
        return 'SecurityError'
      case 'TypeError':
        return 'TypeError'
      default:
        return 'UnknownError'
    }
  }

  /**
   * Get human-readable error message for camera error
   */
  static getCameraErrorMessage(errorType: CameraErrorType): string {
    return CAMERA_ERROR_MESSAGES[errorType]
  }

  /**
   * Log performance metric
   */
  logPerformance(
    operation: string,
    durationMs: number,
    success: boolean,
    metadata?: Record<string, unknown>
  ) {
    const level = success ? 'info' : 'warn'
    this.log(level, `perf_${operation}`, {
      durationMs,
      success,
      ...metadata,
      _performance: true,
    })
  }

  /**
   * Start a timing operation (returns stop function)
   */
  startTiming(operation: string): () => void {
    const startTime = Date.now()
    return () => {
      const durationMs = Date.now() - startTime
      this.logPerformance(operation, durationMs, true, { startTime, endTime: Date.now() })
    }
  }

  /**
   * Log device information for debugging
   */
  logDeviceInfo(info: {
    manufacturer?: string
    model?: string
    osVersion?: string
    appVersion?: string
    screenWidth?: number
    screenHeight?: number
    memoryUsage?: number
  }) {
    this.info('device_info', {
      ...info,
      platform: Platform.OS,
      platformVersion: Platform.Version,
      _device: true,
    })
  }

  /**
   * Create a scoped logger for a specific component/feature
   */
  createScope(scope: string) {
    return {
      debug: (event: string, data?: Record<string, unknown>) => 
        this.debug(`${scope}_${event}`, { ...data, _scope: scope }),
      info: (event: string, data?: Record<string, unknown>) => 
        this.info(`${scope}_${event}`, { ...data, _scope: scope }),
      warn: (event: string, data?: Record<string, unknown>) => 
        this.warn(`${scope}_${event}`, { ...data, _scope: scope }),
      error: (event: string, error?: Error | unknown, data?: Record<string, unknown>) => 
        this.error(`${scope}_${event}`, error, { ...data, _scope: scope }),
    }
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
      platform: `${Platform.OS} ${Platform.Version}`,
      app_version: Application.nativeApplicationVersion ?? '1.0.0',
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
      const { error } = await supabase.from('app_logs').insert(entries)
      if (error) {
        console.error('[SessionLogger] Insert error:', error.message, error.details, error.hint)
        // Re-add to buffer on failure (with limit)
        if (this.buffer.length < this.BUFFER_SIZE * 2) {
          this.buffer = [...entries, ...this.buffer]
        }
      }
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

