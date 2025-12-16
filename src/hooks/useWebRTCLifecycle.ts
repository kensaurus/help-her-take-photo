/**
 * useWebRTCLifecycle - Manages WebRTC connection lifecycle with app state
 * 
 * Handles edge cases:
 * - Phone lock/unlock
 * - App minimize/restore
 * - Network changes
 * - Session expiry
 * 
 * Best practices based on:
 * - react-native-webrtc guidelines
 * - WebRTC mobile reconnection patterns
 * - Battery optimization (pause video when backgrounded)
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { connectionManager, type ConnectionEvent } from '../services/connectionManager'
import { webrtcService, webrtcAvailable, type WebRTCRole } from '../services/webrtc'
import { sessionLogger } from '../services/sessionLogger'
import { usePairingStore } from '../stores/pairingStore'

export interface WebRTCLifecycleState {
  isConnecting: boolean
  isReconnecting: boolean
  reconnectAttempt: number
  lastDisconnectReason: string | null
  wasBackgrounded: boolean
}

export interface WebRTCLifecycleCallbacks {
  onRemoteStream?: (stream: MediaStream) => void
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void
  onError?: (error: Error) => void
  onReconnecting?: () => void
  onReconnected?: () => void
  onSessionExpired?: () => void
}

interface UseWebRTCLifecycleOptions {
  role: WebRTCRole
  callbacks: WebRTCLifecycleCallbacks
  /** Auto-reconnect on foreground (default: true) */
  autoReconnect?: boolean
  /** Pause video tracks when backgrounded (default: true for camera) */
  pauseVideoOnBackground?: boolean
}

/**
 * Hook to manage WebRTC lifecycle with proper background/foreground handling
 */
export function useWebRTCLifecycle(options: UseWebRTCLifecycleOptions) {
  const { 
    role, 
    callbacks, 
    autoReconnect = true,
    pauseVideoOnBackground = role === 'camera',
  } = options

  const { myDeviceId, pairedDeviceId, sessionId, isPaired } = usePairingStore()
  
  // Refs for cleanup and state tracking
  const isMountedRef = useRef(true)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const wasConnectedRef = useRef(false)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const initPromiseRef = useRef<Promise<void> | null>(null)
  
  // State for UI feedback
  const [lifecycleState, setLifecycleState] = useState<WebRTCLifecycleState>({
    isConnecting: false,
    isReconnecting: false,
    reconnectAttempt: 0,
    lastDisconnectReason: null,
    wasBackgrounded: false,
  })

  /**
   * Initialize WebRTC connection
   */
  const initializeWebRTC = useCallback(async (isReconnect = false) => {
    if (!isMountedRef.current || !webrtcAvailable) return
    if (!myDeviceId || !pairedDeviceId || !sessionId || !isPaired) return

    // Prevent concurrent initializations
    if (initPromiseRef.current) {
      sessionLogger.info('webrtc_lifecycle_init_already_pending', { role })
      return initPromiseRef.current
    }

    setLifecycleState(prev => ({
      ...prev,
      isConnecting: !isReconnect,
      isReconnecting: isReconnect,
    }))

    sessionLogger.info('webrtc_lifecycle_init', { 
      role, 
      isReconnect,
      myDeviceId: myDeviceId.substring(0, 8),
      pairedDeviceId: pairedDeviceId.substring(0, 8),
    })

    if (isReconnect) {
      callbacks.onReconnecting?.()
    }

    const initPromise = webrtcService.init(
      myDeviceId,
      pairedDeviceId,
      sessionId,
      role,
      {
        onRemoteStream: (stream) => {
          if (!isMountedRef.current) return
          callbacks.onRemoteStream?.(stream)
        },
        onConnectionStateChange: (state) => {
          if (!isMountedRef.current) return
          
          if (state === 'connected') {
            wasConnectedRef.current = true
            setLifecycleState(prev => ({
              ...prev,
              isConnecting: false,
              isReconnecting: false,
              reconnectAttempt: 0,
              lastDisconnectReason: null,
            }))
            
            if (isReconnect) {
              callbacks.onReconnected?.()
            }
          } else if (state === 'disconnected' || state === 'failed') {
            setLifecycleState(prev => ({
              ...prev,
              lastDisconnectReason: state,
            }))
          }
          
          callbacks.onConnectionStateChange?.(state)
        },
        onError: (error) => {
          if (!isMountedRef.current) return
          
          setLifecycleState(prev => ({
            ...prev,
            isConnecting: false,
            isReconnecting: false,
          }))
          
          callbacks.onError?.(error)
        },
      }
    ).finally(() => {
      initPromiseRef.current = null
    })

    initPromiseRef.current = initPromise
    return initPromise
  }, [myDeviceId, pairedDeviceId, sessionId, isPaired, role, callbacks])

  /**
   * Pause video tracks (called when app goes to background)
   */
  const pauseVideoTracks = useCallback(() => {
    if (role !== 'camera') return
    
    const localStream = webrtcService.getLocalStream()
    if (localStream) {
      const videoTracks = localStream.getVideoTracks?.() ?? []
      videoTracks.forEach((track: { enabled: boolean; id?: string }) => {
        track.enabled = false
      })
      sessionLogger.info('webrtc_lifecycle_video_paused', { 
        trackCount: videoTracks.length 
      })
    }
  }, [role])

  /**
   * Resume video tracks (called when app returns to foreground)
   */
  const resumeVideoTracks = useCallback(() => {
    if (role !== 'camera') return
    
    const localStream = webrtcService.getLocalStream()
    if (localStream) {
      const videoTracks = localStream.getVideoTracks?.() ?? []
      videoTracks.forEach((track: { enabled: boolean; id?: string }) => {
        track.enabled = true
      })
      sessionLogger.info('webrtc_lifecycle_video_resumed', { 
        trackCount: videoTracks.length 
      })
    }
  }, [role])

  /**
   * Handle app state changes
   */
  const handleAppStateChange = useCallback((nextState: AppStateStatus) => {
    const prevState = appStateRef.current
    appStateRef.current = nextState

    sessionLogger.info('webrtc_lifecycle_app_state', {
      role,
      from: prevState,
      to: nextState,
      wasConnected: wasConnectedRef.current,
    })

    // App going to background
    if (nextState === 'background' && prevState === 'active') {
      setLifecycleState(prev => ({ ...prev, wasBackgrounded: true }))
      
      if (pauseVideoOnBackground) {
        pauseVideoTracks()
      }
    }
    
    // App coming to foreground
    if (nextState === 'active' && prevState !== 'active') {
      // Resume video first (quick operation)
      if (pauseVideoOnBackground) {
        resumeVideoTracks()
      }
      
      // If we were previously connected, try to reconnect
      if (autoReconnect && wasConnectedRef.current && lifecycleState.wasBackgrounded) {
        sessionLogger.info('webrtc_lifecycle_foreground_reconnect', { role })
        
        // Small delay to let the system stabilize
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return
          
          setLifecycleState(prev => ({
            ...prev,
            wasBackgrounded: false,
            reconnectAttempt: prev.reconnectAttempt + 1,
          }))
          
          // Reinitialize WebRTC to handle potential stale connections
          initializeWebRTC(true)
        }, 1000)
      }
    }
  }, [role, autoReconnect, pauseVideoOnBackground, pauseVideoTracks, resumeVideoTracks, initializeWebRTC, lifecycleState.wasBackgrounded])

  /**
   * Handle connection manager events
   */
  const handleConnectionEvent = useCallback((event: ConnectionEvent) => {
    if (!isMountedRef.current) return

    switch (event.type) {
      case 'session_expired':
        sessionLogger.warn('webrtc_lifecycle_session_expired', { role })
        callbacks.onSessionExpired?.()
        break
        
      case 'network_changed':
        if (event.isConnected && wasConnectedRef.current && autoReconnect) {
          sessionLogger.info('webrtc_lifecycle_network_recovered', { role })
          // Network recovered, attempt reconnect after small delay
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current)
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (!isMountedRef.current) return
            initializeWebRTC(true)
          }, 2000)
        }
        break
        
      case 'reconnect_success':
        sessionLogger.info('webrtc_lifecycle_reconnect_success_event', { role })
        // Connection manager says reconnect succeeded, but we still need to verify WebRTC
        break
    }
  }, [role, autoReconnect, callbacks, initializeWebRTC])

  /**
   * Manual reconnect (for user-triggered retry)
   */
  const reconnect = useCallback(async () => {
    sessionLogger.info('webrtc_lifecycle_manual_reconnect', { role })
    
    // Destroy existing connection first
    await webrtcService.destroy()
    
    // Small delay for cleanup
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Reinitialize
    return initializeWebRTC(true)
  }, [role, initializeWebRTC])

  /**
   * Force disconnect (for cleanup)
   */
  const disconnect = useCallback(async () => {
    sessionLogger.info('webrtc_lifecycle_disconnect', { role })
    
    wasConnectedRef.current = false
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    await webrtcService.destroy()
    
    setLifecycleState({
      isConnecting: false,
      isReconnecting: false,
      reconnectAttempt: 0,
      lastDisconnectReason: 'manual_disconnect',
      wasBackgrounded: false,
    })
  }, [role])

  // Setup effect
  useEffect(() => {
    isMountedRef.current = true
    
    // Subscribe to AppState changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange)
    
    // Subscribe to connection manager events
    const unsubscribeConnectionManager = connectionManager.subscribe(handleConnectionEvent)
    
    // Initial WebRTC setup (handled by parent component calling initializeWebRTC)
    
    return () => {
      isMountedRef.current = false
      
      appStateSubscription.remove()
      unsubscribeConnectionManager()
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [handleAppStateChange, handleConnectionEvent])

  return {
    lifecycleState,
    initializeWebRTC,
    reconnect,
    disconnect,
    pauseVideoTracks,
    resumeVideoTracks,
  }
}
