/**
 * Connection Manager - Centralized connection lifecycle management
 * 
 * Handles:
 * - Network state monitoring
 * - App lifecycle (foreground/background)
 * - Session validation and recovery
 * - WebRTC + Presence coordination
 * - Automatic reconnection on failures
 */

import { AppState, AppStateStatus, Platform } from 'react-native'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { sessionLogger } from './sessionLogger'
import { webrtcService, webrtcAvailable } from './webrtc'
import { pairingApi, connectionHistoryApi } from './api'
import { usePairingStore } from '../stores/pairingStore'

// Connection states
export type ConnectionManagerState = 
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'error'

// Event types
export type ConnectionEvent = 
  | { type: 'network_changed'; isConnected: boolean; connectionType: string | null }
  | { type: 'app_state_changed'; state: AppStateStatus }
  | { type: 'session_validated'; isValid: boolean }
  | { type: 'session_expired' }
  | { type: 'partner_online'; isOnline: boolean }
  | { type: 'webrtc_state_changed'; state: string }
  | { type: 'reconnect_attempt'; attempt: number; maxAttempts: number }
  | { type: 'reconnect_success' }
  | { type: 'reconnect_failed'; reason: string }
  | { type: 'fatal_error'; error: string; recoverable: boolean }

type EventListener = (event: ConnectionEvent) => void

/**
 * Retry configuration
 */
interface RetryConfig {
  maxAttempts: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  const { maxAttempts, baseDelayMs, maxDelayMs, backoffMultiplier } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config,
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on non-recoverable errors
      if (isNonRecoverableError(lastError)) {
        throw lastError
      }

      if (attempt < maxAttempts) {
        const delay = Math.min(
          baseDelayMs * Math.pow(backoffMultiplier, attempt - 1),
          maxDelayMs
        )
        
        sessionLogger.warn('retry_attempt', {
          attempt,
          maxAttempts,
          delayMs: delay,
          error: lastError.message,
        })
        
        onRetry?.(attempt, lastError)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Check if error is non-recoverable (shouldn't retry)
 */
function isNonRecoverableError(error: Error): boolean {
  const message = error.message.toLowerCase()
  return (
    message.includes('permission denied') ||
    message.includes('not found') ||
    message.includes('invalid') ||
    message.includes('expired') ||
    message.includes('unauthorized') ||
    message.includes('forbidden')
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Connection Manager Service
 */
class ConnectionManager {
  private state: ConnectionManagerState = 'idle'
  private listeners: Set<EventListener> = new Set()
  private appState: AppStateStatus = 'active'
  private isNetworkConnected = true
  private networkType: string | null = null
  
  // Subscriptions
  private appStateSubscription: { remove: () => void } | null = null
  private netInfoSubscription: (() => void) | null = null
  private presenceSubscription: { unsubscribe: () => Promise<void> } | null = null
  
  // Reconnection state
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private readonly MAX_RECONNECT_ATTEMPTS = 5
  
  // Session validation
  private lastValidationTime = 0
  private readonly VALIDATION_INTERVAL_MS = 60000 // 1 minute
  
  // Health check
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null
  private readonly HEALTH_CHECK_INTERVAL_MS = 30000 // 30 seconds

  /**
   * Initialize the connection manager
   * Should be called once on app startup
   */
  initialize() {
    sessionLogger.info('connection_manager_init')
    
    // Listen to app state changes
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange)
    
    // Listen to network state changes
    this.netInfoSubscription = NetInfo.addEventListener(this.handleNetInfoChange)
    
    // Initial network state
    NetInfo.fetch().then((state) => {
      this.isNetworkConnected = state.isConnected ?? true
      this.networkType = state.type
      sessionLogger.info('connection_manager_network_state', {
        isConnected: this.isNetworkConnected,
        type: this.networkType,
      })
    })
    
    // Start health check
    this.startHealthCheck()
  }

  /**
   * Cleanup all subscriptions
   */
  destroy() {
    sessionLogger.info('connection_manager_destroy')
    
    this.appStateSubscription?.remove()
    this.appStateSubscription = null
    
    this.netInfoSubscription?.()
    this.netInfoSubscription = null
    
    if (this.presenceSubscription) {
      void this.presenceSubscription.unsubscribe()
      this.presenceSubscription = null
    }
    
    this.stopHealthCheck()
    this.cancelReconnect()
    this.listeners.clear()
  }

  /**
   * Subscribe to connection events
   */
  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: ConnectionEvent) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        sessionLogger.error('connection_manager_listener_error', error)
      }
    })
  }

  /**
   * Get current state
   */
  getState(): ConnectionManagerState {
    return this.state
  }

  /**
   * Check if network is available
   */
  isOnline(): boolean {
    return this.isNetworkConnected
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange = (nextState: AppStateStatus) => {
    const previousState = this.appState
    this.appState = nextState
    
    sessionLogger.info('app_state_change', {
      from: previousState,
      to: nextState,
    })
    
    this.emit({ type: 'app_state_changed', state: nextState })
    
    if (nextState === 'active' && previousState !== 'active') {
      // App coming to foreground
      this.handleAppForeground()
    } else if (nextState === 'background' && previousState === 'active') {
      // App going to background
      this.handleAppBackground()
    }
  }

  /**
   * Handle network state changes
   */
  private handleNetInfoChange = (state: NetInfoState): void => {
    const wasConnected = this.isNetworkConnected
    this.isNetworkConnected = state.isConnected ?? false
    this.networkType = state.type
    
    sessionLogger.info('network_state_change', {
      wasConnected,
      isConnected: this.isNetworkConnected,
      type: this.networkType,
      isInternetReachable: state.isInternetReachable,
    })
    
    this.emit({
      type: 'network_changed',
      isConnected: this.isNetworkConnected,
      connectionType: this.networkType,
    })
    
    if (!wasConnected && this.isNetworkConnected) {
      // Network recovered
      this.handleNetworkRecovery()
    } else if (wasConnected && !this.isNetworkConnected) {
      // Network lost
      this.handleNetworkLoss()
    }
  }

  /**
   * Handle app coming to foreground
   */
  private async handleAppForeground() {
    sessionLogger.info('app_foreground_handler')
    
    const { isPaired, sessionId, myDeviceId, pairedDeviceId } = usePairingStore.getState()
    
    if (!isPaired || !sessionId) {
      return
    }
    
    // Validate session is still valid
    const isValid = await this.validateSession()
    
    if (!isValid) {
      sessionLogger.warn('session_invalid_on_foreground')
      this.emit({ type: 'session_expired' })
      return
    }
    
    // Attempt to reconnect WebRTC if needed
    if (webrtcAvailable && myDeviceId && pairedDeviceId) {
      this.scheduleReconnect(1000) // Small delay before reconnecting
    }
  }

  /**
   * Handle app going to background
   */
  private handleAppBackground() {
    sessionLogger.info('app_background_handler')
    
    // Cancel any pending reconnection attempts
    this.cancelReconnect()
    
    // Note: We don't destroy WebRTC here because:
    // 1. iOS allows short background execution
    // 2. User might quickly return to app
    // The OS will kill WebRTC if needed
  }

  /**
   * Handle network recovery
   */
  private handleNetworkRecovery() {
    sessionLogger.info('network_recovery_handler')
    
    const { isPaired, sessionId } = usePairingStore.getState()
    
    if (isPaired && sessionId) {
      // Attempt to reconnect
      this.scheduleReconnect(2000)
    }
  }

  /**
   * Handle network loss
   */
  private handleNetworkLoss() {
    sessionLogger.warn('network_loss_handler')
    
    // Cancel reconnection attempts
    this.cancelReconnect()
    
    // Update state
    this.state = 'disconnected'
  }

  /**
   * Validate if current session is still valid in database
   */
  async validateSession(): Promise<boolean> {
    const { myDeviceId, pairedDeviceId, sessionId, clearPairing } = usePairingStore.getState()
    
    if (!myDeviceId || !sessionId) {
      return false
    }
    
    // Rate limit validation
    const now = Date.now()
    if (now - this.lastValidationTime < this.VALIDATION_INTERVAL_MS) {
      return true // Assume valid if recently validated
    }
    this.lastValidationTime = now
    
    try {
      const { partnerId } = await withRetry(
        () => pairingApi.getCurrentPairing(myDeviceId),
        { maxAttempts: 2 }
      )
      
      const isValid = partnerId === pairedDeviceId
      
      sessionLogger.info('session_validation', {
        isValid,
        expectedPartner: pairedDeviceId?.substring(0, 8),
        actualPartner: partnerId?.substring(0, 8),
      })
      
      this.emit({ type: 'session_validated', isValid })
      
      if (!isValid && pairedDeviceId) {
        // Session is stale, clear it
        sessionLogger.warn('session_stale_clearing')
        await clearPairing()
      }
      
      return isValid
    } catch (error) {
      sessionLogger.error('session_validation_error', error)
      // On error, assume session is still valid to avoid false disconnects
      return true
    }
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(delayMs: number) {
    if (this.reconnectTimer) {
      return // Already scheduled
    }
    
    if (this.reconnectAttempt >= this.MAX_RECONNECT_ATTEMPTS) {
      sessionLogger.error('reconnect_max_attempts_reached', new Error('Max reconnect attempts'), {
        attempts: this.reconnectAttempt,
      })
      this.emit({
        type: 'reconnect_failed',
        reason: 'Max reconnection attempts reached',
      })
      return
    }
    
    this.reconnectAttempt++
    this.state = 'reconnecting'
    
    sessionLogger.info('reconnect_scheduled', {
      attempt: this.reconnectAttempt,
      maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
      delayMs,
    })
    
    this.emit({
      type: 'reconnect_attempt',
      attempt: this.reconnectAttempt,
      maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
    })
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.attemptReconnect()
    }, delayMs)
  }

  /**
   * Cancel pending reconnection
   */
  private cancelReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  /**
   * Attempt to reconnect WebRTC
   */
  private async attemptReconnect() {
    if (!this.isNetworkConnected) {
      sessionLogger.warn('reconnect_aborted_no_network')
      return
    }
    
    const { isPaired, myDeviceId, pairedDeviceId, sessionId } = usePairingStore.getState()
    
    if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) {
      sessionLogger.warn('reconnect_aborted_no_session')
      return
    }
    
    try {
      // Validate session first
      const isValid = await this.validateSession()
      if (!isValid) {
        this.emit({ type: 'session_expired' })
        return
      }
      
      // Reconnect is handled by the individual screens (camera/viewer)
      // Just emit success event
      this.reconnectAttempt = 0
      this.state = 'connected'
      this.emit({ type: 'reconnect_success' })
      
      sessionLogger.info('reconnect_success')
    } catch (error) {
      sessionLogger.error('reconnect_failed', error)
      
      // Schedule next attempt with exponential backoff
      const nextDelay = Math.min(
        1000 * Math.pow(2, this.reconnectAttempt),
        30000
      )
      this.scheduleReconnect(nextDelay)
    }
  }

  /**
   * Reset reconnection counter (call after successful connection)
   */
  resetReconnectCounter() {
    this.reconnectAttempt = 0
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck() {
    if (this.healthCheckTimer) return
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL_MS)
  }

  /**
   * Stop health check
   */
  private stopHealthCheck() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
      this.healthCheckTimer = null
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck() {
    if (this.appState !== 'active') return
    if (!this.isNetworkConnected) return
    
    const { isPaired, myDeviceId } = usePairingStore.getState()
    
    if (!isPaired || !myDeviceId) return
    
    try {
      // Update device heartbeat
      await connectionHistoryApi.updateOnlineStatus(myDeviceId, true)
    } catch (error) {
      sessionLogger.warn('health_check_error', { error: (error as Error)?.message })
    }
  }

  /**
   * Force full state reset (for recovery from fatal errors)
   */
  async forceReset(): Promise<void> {
    sessionLogger.warn('force_reset_initiated')
    
    try {
      // Destroy WebRTC
      await webrtcService.destroy()
      
      // Clear presence subscription
      if (this.presenceSubscription) {
        await this.presenceSubscription.unsubscribe()
        this.presenceSubscription = null
      }
      
      // Clear pairing state
      const { myDeviceId, clearPairing } = usePairingStore.getState()
      
      if (myDeviceId) {
        // Best effort to unpair on server
        try {
          await pairingApi.unpair(myDeviceId)
          await connectionHistoryApi.disconnectAll(myDeviceId)
          await connectionHistoryApi.updateOnlineStatus(myDeviceId, false)
        } catch {
          // Ignore errors during cleanup
        }
      }
      
      await clearPairing()
      
      // Reset internal state
      this.state = 'idle'
      this.reconnectAttempt = 0
      this.cancelReconnect()
      
      sessionLogger.info('force_reset_complete')
    } catch (error) {
      sessionLogger.error('force_reset_error', error)
      throw error
    }
  }

  /**
   * Report a fatal error that may require recovery
   */
  reportFatalError(error: Error | string, recoverable = true) {
    const errorMessage = typeof error === 'string' ? error : error.message
    
    sessionLogger.error('fatal_error_reported', error instanceof Error ? error : new Error(errorMessage), {
      recoverable,
    })
    
    this.emit({
      type: 'fatal_error',
      error: errorMessage,
      recoverable,
    })
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager()

// Export utility functions
export { sleep }
