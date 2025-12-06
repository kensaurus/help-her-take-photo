/**
 * Logging Service - Crash reporting and analytics
 * Uses Sentry for error tracking and performance monitoring
 */

import * as Sentry from '@sentry/react-native'
import { Platform } from 'react-native'
import { getBuildInfo } from '../config/build'

// Environment detection
const isDev = __DEV__

/**
 * Initialize Sentry
 * Call this in app/_layout.tsx before rendering
 */
export function initSentry(dsn?: string) {
  if (!dsn && !isDev) {
    console.warn('Sentry DSN not provided - crash reporting disabled')
    return
  }

  Sentry.init({
    dsn: dsn || '', // Empty string disables in dev
    enabled: !isDev,
    enableInExpoDevelopment: false,
    debug: isDev,
    
    // Performance Monitoring
    tracesSampleRate: isDev ? 1.0 : 0.2,
    
    // Release info
    release: getBuildInfo().fullVersion,
    dist: getBuildInfo().buildNumber,
    environment: isDev ? 'development' : 'production',

    // Integration options
    integrations: [
      Sentry.reactNativeTracingIntegration(),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive data
      if (event.extra) {
        delete event.extra.password
        delete event.extra.token
        delete event.extra.apiKey
      }
      return event
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Filter out noisy console logs
      if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
        return null
      }
      return breadcrumb
    },
  })
}

/**
 * Set user context for error tracking
 */
export function setUser(userId: string, extra?: Record<string, string>) {
  Sentry.setUser({
    id: userId,
    ...extra,
  })
}

/**
 * Clear user context on logout
 */
export function clearUser() {
  Sentry.setUser(null)
}

/**
 * Log levels
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logger utility
 */
export const logger = {
  /**
   * Debug log (dev only)
   */
  debug(message: string, data?: Record<string, unknown>) {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, data || '')
    }
    Sentry.addBreadcrumb({
      message,
      category: 'debug',
      level: 'debug',
      data,
    })
  },

  /**
   * Info log
   */
  info(message: string, data?: Record<string, unknown>) {
    if (isDev) {
      console.info(`[INFO] ${message}`, data || '')
    }
    Sentry.addBreadcrumb({
      message,
      category: 'info',
      level: 'info',
      data,
    })
  },

  /**
   * Warning log
   */
  warn(message: string, data?: Record<string, unknown>) {
    console.warn(`[WARN] ${message}`, data || '')
    Sentry.addBreadcrumb({
      message,
      category: 'warning',
      level: 'warning',
      data,
    })
  },

  /**
   * Error log - also captures in Sentry
   */
  error(message: string, error?: Error | unknown, data?: Record<string, unknown>) {
    console.error(`[ERROR] ${message}`, error, data || '')
    
    if (error instanceof Error) {
      Sentry.captureException(error, {
        extra: { message, ...data },
      })
    } else {
      Sentry.captureMessage(message, {
        level: 'error',
        extra: { error, ...data },
      })
    }
  },

  /**
   * Track a user action
   */
  trackAction(action: string, data?: Record<string, unknown>) {
    Sentry.addBreadcrumb({
      message: action,
      category: 'user-action',
      level: 'info',
      data,
    })
    
    if (isDev) {
      console.log(`[ACTION] ${action}`, data || '')
    }
  },

  /**
   * Track navigation
   */
  trackNavigation(screen: string, params?: Record<string, unknown>) {
    Sentry.addBreadcrumb({
      message: `Navigate to ${screen}`,
      category: 'navigation',
      level: 'info',
      data: params,
    })
  },

  /**
   * Track network request
   */
  trackRequest(method: string, url: string, status?: number) {
    Sentry.addBreadcrumb({
      message: `${method} ${url}`,
      category: 'http',
      level: status && status >= 400 ? 'error' : 'info',
      data: { status },
    })
  },
}

/**
 * Performance monitoring
 */
export const performance = {
  /**
   * Start a transaction for performance monitoring
   */
  startTransaction(name: string, op: string = 'task') {
    return Sentry.startInactiveSpan({
      name,
      op,
    })
  },

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
      
      Sentry.addBreadcrumb({
        message: `${name} completed`,
        category: 'performance',
        level: 'info',
        data: { duration: `${duration}ms` },
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.error(`${name} failed after ${duration}ms`, error)
      throw error
    }
  },
}

/**
 * Error boundary wrapper
 */
export const ErrorBoundary = Sentry.wrap

/**
 * Capture feedback from user
 */
export function captureFeedback(
  message: string, 
  email?: string, 
  name?: string
) {
  Sentry.captureFeedback({
    message,
    email,
    name,
  })
}

