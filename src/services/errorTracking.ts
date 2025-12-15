/**
 * Error Tracking Service
 * 
 * Centralized error tracking with Sentry integration.
 * Falls back to console logging when Sentry is not available.
 * 
 * Setup:
 * 1. npm install @sentry/react-native
 * 2. Add EXPO_PUBLIC_SENTRY_DSN to your .env
 * 3. Call initErrorTracking() in _layout.tsx
 */

import { logger } from './logging'

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

interface ErrorContext {
  [key: string]: unknown
}

interface UserContext {
  id: string
  deviceId?: string
  email?: string
}

// ─────────────────────────────────────────────────────────────────────────────────
// Sentry Module (optional import)
// ─────────────────────────────────────────────────────────────────────────────────

// Sentry is initialized in _layout.tsx with Sentry.init() and Sentry.wrap()
// This module provides helper functions to interact with Sentry
let Sentry: typeof import('@sentry/react-native') | null = null
let isSentryInitialized = false

/**
 * Initialize error tracking helpers
 * Sentry.init() is called in _layout.tsx, this just loads the module
 */
export async function initErrorTracking(): Promise<boolean> {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN

  if (!dsn) {
    logger.info('Sentry DSN not configured, using fallback error tracking')
    return false
  }

  try {
    // Import Sentry module (already initialized in _layout.tsx)
    Sentry = await import('@sentry/react-native')
    isSentryInitialized = true
    logger.info('Sentry helpers loaded')
    return true
  } catch (error) {
    logger.warn('Failed to load Sentry module', { error })
    return false
  }
}

/**
 * Check if email should be included in error reports
 */
function shouldIncludeEmail(): boolean {
  // Could check user settings for privacy preferences
  return false
}

// ─────────────────────────────────────────────────────────────────────────────────
// Error Tracking API
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Capture an exception
 */
export function captureException(error: Error | unknown, context?: ErrorContext): void {
  const errorObj = error instanceof Error ? error : new Error(String(error))

  if (isSentryInitialized && Sentry) {
    Sentry.captureException(errorObj, {
      extra: context,
    })
  }

  // Always log to console/logger
  logger.error('Exception captured', errorObj, context)
}

/**
 * Capture a message
 */
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
  if (isSentryInitialized && Sentry) {
    Sentry.captureMessage(message, {
      level: level === 'warning' ? 'warning' : level === 'error' ? 'error' : 'info',
      extra: context,
    })
  }

  // Always log
  switch (level) {
    case 'error':
      logger.error(message, undefined, context)
      break
    case 'warning':
      logger.warn(message, context)
      break
    default:
      logger.info(message, context)
  }
}

/**
 * Set user context for error reports
 */
export function setUser(user: UserContext | null): void {
  if (isSentryInitialized && Sentry) {
    if (user) {
      Sentry.setUser({
        id: user.id,
        // Only include email if privacy settings allow
        ...(shouldIncludeEmail() && user.email ? { email: user.email } : {}),
      })
    } else {
      Sentry.setUser(null)
    }
  }

  if (user) {
    logger.info('User context set', { userId: user.id.substring(0, 8) })
  }
}

/**
 * Add a breadcrumb for debugging
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info'
): void {
  if (isSentryInitialized && Sentry) {
    Sentry.addBreadcrumb({
      category,
      message,
      data,
      level,
      timestamp: Date.now() / 1000,
    })
  }
}

/**
 * Set extra context data
 */
export function setContext(name: string, context: Record<string, unknown>): void {
  if (isSentryInitialized && Sentry) {
    Sentry.setContext(name, context)
  }
}

/**
 * Set a tag for filtering
 */
export function setTag(key: string, value: string): void {
  if (isSentryInitialized && Sentry) {
    Sentry.setTag(key, value)
  }
}

/**
 * Start a performance transaction
 */
export function startTransaction(name: string, op: string): { finish: () => void } {
  if (isSentryInitialized && Sentry) {
    const transaction = Sentry.startTransaction({ name, op })
    return {
      finish: () => transaction.finish(),
    }
  }

  // Fallback: just measure time
  const start = Date.now()
  return {
    finish: () => {
      const duration = Date.now() - start
      logger.info(`Transaction: ${name}`, { op, durationMs: duration })
    },
  }
}

/**
 * Wrap a function with error boundary
 */
export function wrapWithErrorBoundary<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: ErrorContext
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args)
      
      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureException(error, { ...context, args })
          throw error
        })
      }
      
      return result
    } catch (error) {
      captureException(error, { ...context, args })
      throw error
    }
  }) as T
}

// ─────────────────────────────────────────────────────────────────────────────────
// React Native Specific
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Wrap navigation container for performance monitoring
 */
export function getNavigationIntegration() {
  if (isSentryInitialized && Sentry) {
    return new Sentry.ReactNavigationInstrumentation()
  }
  return null
}

/**
 * Create error boundary HOC
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactElement
) {
  if (isSentryInitialized && Sentry) {
    return Sentry.withErrorBoundary(Component, { fallback })
  }
  return Component
}

// ─────────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────────

export const errorTracking = {
  init: initErrorTracking,
  captureException,
  captureMessage,
  setUser,
  addBreadcrumb,
  setContext,
  setTag,
  startTransaction,
  wrapWithErrorBoundary,
  getNavigationIntegration,
  withErrorBoundary,
}

export default errorTracking
