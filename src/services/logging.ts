/**
 * Logging Service - Simple production-ready logging
 * Can be extended with crash reporting services in the future
 */

import { Platform } from 'react-native'
import { getBuildInfo } from '../config/build'

// Environment detection
const isDev = __DEV__

// Log levels
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

// Log entry structure
type LogEntry = {
  level: LogLevel
  message: string
  timestamp: Date
  data?: Record<string, unknown>
}

// Simple in-memory log buffer for debugging
const LOG_BUFFER_SIZE = 100
const logBuffer: LogEntry[] = []

function addToBuffer(entry: LogEntry) {
  logBuffer.push(entry)
  if (logBuffer.length > LOG_BUFFER_SIZE) {
    logBuffer.shift()
  }
}

/**
 * Logger utility - simple console-based logging
 */
export const logger = {
  /**
   * Debug log (dev only)
   */
  debug(message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'debug', message, timestamp: new Date(), data }
    addToBuffer(entry)
    
    if (isDev) {
      console.log(`[DEBUG] ${message}`, data || '')
    }
  },

  /**
   * Info log
   */
  info(message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'info', message, timestamp: new Date(), data }
    addToBuffer(entry)
    
    if (isDev) {
      console.info(`[INFO] ${message}`, data || '')
    }
  },

  /**
   * Warning log
   */
  warn(message: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'warn', message, timestamp: new Date(), data }
    addToBuffer(entry)
    
    console.warn(`[WARN] ${message}`, data || '')
  },

  /**
   * Error log
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'error', message, timestamp: new Date(), data }
    addToBuffer(entry)
    
    console.error(`[ERROR] ${message}`, error, data || '')
  },

  /**
   * Track a user action
   */
  trackAction(action: string, data?: Record<string, unknown>) {
    const entry: LogEntry = { level: 'info', message: action, timestamp: new Date(), data }
    addToBuffer(entry)
    
    if (isDev) {
      console.log(`[ACTION] ${action}`, data || '')
    }
  },

  /**
   * Track navigation
   */
  trackNavigation(screen: string, params?: Record<string, unknown>) {
    const entry: LogEntry = { 
      level: 'info', 
      message: `Navigate to ${screen}`, 
      timestamp: new Date(),
      data: params,
    }
    addToBuffer(entry)
    
    if (isDev) {
      console.log(`[NAV] ${screen}`, params || '')
    }
  },

  /**
   * Track network request
   */
  trackRequest(method: string, url: string, status?: number) {
    const entry: LogEntry = { 
      level: status && status >= 400 ? 'error' : 'info', 
      message: `${method} ${url}`, 
      timestamp: new Date(),
      data: { status },
    }
    addToBuffer(entry)
    
    if (isDev) {
      console.log(`[HTTP] ${method} ${url} - ${status || 'pending'}`)
    }
  },

  /**
   * Get recent logs (useful for debugging)
   */
  getRecentLogs: () => [...logBuffer],

  /**
   * Clear log buffer
   */
  clearLogs: () => {
    logBuffer.length = 0
  },
}

/**
 * Set user context for logging
 */
export function setUser(userId: string, extra?: Record<string, string>) {
  if (isDev) {
    console.log(`[USER] Set user ID: ${userId}`, extra)
  }
}

/**
 * Clear user context
 */
export function clearUser() {
  if (isDev) {
    console.log('[USER] Cleared user')
  }
}

/**
 * Performance monitoring utilities
 */
export const performance = {
  /**
   * Measure async operation duration
   */
  async measure<T>(
    name: string, 
    operation: () => Promise<T>
  ): Promise<T> {
    const start = Date.now()
    try {
      const result = await operation()
      const duration = Date.now() - start
      
      if (isDev) {
        console.log(`[PERF] ${name} completed in ${duration}ms`)
      }
      
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`${name} failed after ${duration}ms`, error)
      throw error
    }
  },
}
