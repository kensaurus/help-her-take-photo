/**
 * Camera - The photographer's view (with encouragement!)
 * Full accessibility support and permission handling
 * Uses WebRTC for streaming when paired, expo-camera otherwise
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Alert,
  Linking,
  useWindowDimensions,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeOut,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePairingStore } from '../src/stores/pairingStore'
import { useSettingsStore } from '../src/stores/settingsStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { useStatsStore } from '../src/stores/statsStore'
import { Icon } from '../src/components/ui/Icon'
import { CaptureButton } from '../src/components/CaptureButton'
import { ConnectionDebugPanel } from '../src/components/ui/ConnectionDebugPanel'
import { pairingApi, connectionHistoryApi } from '../src/services/api'
import { sessionLogger, CAMERA_ERROR_MESSAGES, type CameraErrorType } from '../src/services/sessionLogger'
import { webrtcService, webrtcAvailable } from '../src/services/webrtc'
import { livekitService, isLiveKitAvailable } from '../src/services/livekit'
import { useRealtimeCommands, Direction } from '../src/services/realtimeCommands'
import { cloudApi } from '../src/services/cloudApi'

// LiveKit temporarily disabled - native packages conflict
// Use WebRTC until LiveKit build issues are resolved
const USE_LIVEKIT = false

// Helper to get user-friendly error message
function getCameraErrorMessage(error: Error | unknown): string {
  if (!(error instanceof Error)) return CAMERA_ERROR_MESSAGES.UnknownError
  
  const errorName = error.name as CameraErrorType
  return CAMERA_ERROR_MESSAGES[errorName] || error.message || CAMERA_ERROR_MESSAGES.UnknownError
}

// Dynamically import RTCView
let RTCView: any = null
try {
  const webrtc = require('react-native-webrtc')
  RTCView = webrtc.RTCView
} catch {
  // WebRTC not available
}

const QUICK_CONNECT_KEY = 'quick_connect_mode'

// Grid overlay component
function GridOverlay() {
  return (
    <View style={styles.gridOverlay} pointerEvents="none">
      <View style={[styles.gridLine, styles.gridLineH, { top: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineH, { top: '66%' }]} />
      <View style={[styles.gridLine, styles.gridLineV, { left: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineV, { left: '66%' }]} />
    </View>
  )
}

// Quick action button with animated press feedback
function QuickActionButton({ 
  icon, 
  label, 
  active = false,
  onPress 
}: { 
  icon: string
  label: string
  active?: boolean
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  const handlePressIn = () => {
    scale.value = withSpring(0.85, { damping: 15, stiffness: 400 })
  }
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 })
  }

  return (
    <Pressable
      style={styles.quickAction}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
        onPress()
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={label}
    >
      <Animated.View style={animatedStyle}>
        <Text style={[styles.quickActionText, active && styles.quickActionActive]}>{icon}</Text>
        <Text style={styles.quickActionLabel}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

// Encouragement toast - minimal
function EncouragementToast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  
  return (
    <Animated.View 
      entering={FadeIn.duration(150)} 
      exiting={FadeOut.duration(150)}
      style={styles.toast}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  )
}

// Direction overlay - large, prominent arrows for camera positioning
function DirectionOverlay({ direction, visible }: { direction: string | null; visible: boolean }) {
  if (!visible || !direction) return null
  
  const directionConfig: Record<string, { icon: string; label: string; color: string }> = {
    up: { icon: '⬆', label: 'TILT UP', color: '#4ECDC4' },
    down: { icon: '⬇', label: 'TILT DOWN', color: '#FF6B6B' },
    left: { icon: '⬅', label: 'PAN LEFT', color: '#FFE66D' },
    right: { icon: '➡', label: 'PAN RIGHT', color: '#FFE66D' },
    closer: { icon: '⊕', label: 'MOVE CLOSER', color: '#95E1D3' },
    back: { icon: '⊖', label: 'STEP BACK', color: '#F38181' },
  }
  
  const config = directionConfig[direction] || { icon: '📍', label: 'ADJUST', color: '#FFF' }
  
  return (
    <Animated.View 
      entering={FadeIn.duration(100).springify()} 
      exiting={FadeOut.duration(200)}
      style={styles.directionOverlay}
    >
      <View style={[styles.directionBox, { borderColor: config.color }]}>
        <Text style={[styles.directionIcon, { color: config.color }]}>{config.icon}</Text>
        <Text style={[styles.directionLabel, { color: config.color }]}>{config.label}</Text>
      </View>
    </Animated.View>
  )
}

// Toast notification for role switch request from partner
function SwitchRoleToast({ visible, partnerName }: { visible: boolean; partnerName: string }) {
  if (!visible) return null
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.switchToast}
    >
      <Text style={styles.switchToastText}>
        {partnerName} wants to be Photographer
      </Text>
      <Text style={styles.switchToastSubtext}>Switching you to Director...</Text>
    </Animated.View>
  )
}


// Action button
function ActionButton({ 
  label, 
  onPress, 
  active = false,
  accessibilityHint,
}: { 
  label: string
  onPress: () => void
  active?: boolean
  accessibilityHint?: string
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={() => {
        scale.value = withSpring(0.95)
        setTimeout(() => { scale.value = withSpring(1) }, 100)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.actionBtn, active && styles.actionBtnActive, animatedStyle]}>
        <Text style={[styles.actionBtnText, active && styles.actionBtnTextActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

/**
 * Permission denied view with action button
 */
function PermissionDenied({ 
  onRequestPermission,
  colors,
}: { 
  onRequestPermission: () => void
  colors: any 
}) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Animated.View 
        entering={FadeIn.duration(400)}
        style={styles.permissionContainer}
      >
        <View style={[styles.permissionIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name="camera" size={48} color={colors.textMuted} />
        </View>
        
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Camera Access Required
        </Text>
        
        <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
          We need camera access to take photos. Your photos are never uploaded without your permission.
        </Text>
        
        <Pressable
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={onRequestPermission}
          accessibilityLabel="Grant camera permission"
          accessibilityRole="button"
        >
          <Text style={[styles.permissionButtonText, { color: colors.primaryText }]}>
            Enable Camera
          </Text>
        </Pressable>
        
        <Pressable
          style={styles.settingsLink}
          onPress={() => Linking.openSettings()}
          accessibilityLabel="Open device settings"
          accessibilityHint="Opens system settings to manage app permissions"
        >
          <Text style={[styles.settingsLinkText, { color: colors.accent }]}>
            Open Settings
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  )
}

export default function CameraScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing, partnerDisplayName, partnerAvatar, setPartnerPresence } = usePairingStore()
  const partnerNameRef = useRef(partnerDisplayName)
  const partnerAvatarRef = useRef(partnerAvatar)

  // Update refs when store values change
  useEffect(() => {
    partnerNameRef.current = partnerDisplayName
    partnerAvatarRef.current = partnerAvatar
  }, [partnerDisplayName, partnerAvatar])

  const { settings, updateSettings } = useSettingsStore()
  const { t } = useLanguageStore()
  const { incrementPhotos, incrementScoldingsSaved } = useStatsStore()
  const autoDisconnectingRef = useRef(false)

  const disconnectAndUnpair = useCallback(async (reason: string, extra?: Record<string, unknown>) => {
    if (autoDisconnectingRef.current) return
    autoDisconnectingRef.current = true

    sessionLogger.warn('auto_disconnect_start', {
      reason,
      role: 'camera',
      sessionId: sessionId?.substring(0, 8),
      pairedDeviceId: pairedDeviceId?.substring(0, 8),
      ...extra,
    })

    try {
      webrtcService.destroy()

      if (myDeviceId) {
        await connectionHistoryApi.disconnectAll(myDeviceId)
        await connectionHistoryApi.updateOnlineStatus(myDeviceId, false)
        await pairingApi.unpair(myDeviceId)
      }
    } catch (e) {
      sessionLogger.error('auto_disconnect_failed', e, { reason })
    } finally {
      await clearPairing()
      router.replace('/')
    }
  }, [clearPairing, myDeviceId, pairedDeviceId, router, sessionId])

  // Presence should be tracked as soon as the device is paired (NOT gated by camera permissions),
  // otherwise the director will see partner_presence_offline and auto-disconnect.
  useEffect(() => {
    if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) return

    sessionLogger.info('presence_join_requested', {
      role: 'camera',
      sessionId: sessionId.substring(0, 8),
      partnerDeviceId: pairedDeviceId.substring(0, 8),
    })

    const presenceSub = connectionHistoryApi.subscribeToSessionPresence({
      sessionId,
      myDeviceId,
      partnerDeviceId: pairedDeviceId,
      onPartnerOnlineChange: (isOnline) => {
        sessionLogger.info('partner_presence_changed', { partnerDeviceId: pairedDeviceId, isOnline })
        setPartnerPresence(isOnline)
        setPartnerOnline(isOnline)
        // NOTE: We do NOT auto-disconnect when partner goes offline.
        // Session should persist so they can reconnect when they return.
        // User can manually disconnect if needed.
      },
      onError: (message) => {
        sessionLogger.warn('presence_error', { message })
      },
    })

    return () => {
      void presenceSub.unsubscribe()
    }
  }, [disconnectAndUnpair, isPaired, myDeviceId, pairedDeviceId, sessionId])
  
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off')
  const [showSwitchToast, setShowSwitchToast] = useState(false)
  // IMPORTANT: Don't auto-start WebRTC on mount. If pairing state is stale or partner isn't online yet,
  // auto-starting WebRTC frequently results in an Android "blank screen" (getUserMedia hangs / RTCView black).
  // We only start sharing once Presence confirms partner is online (or user explicitly retries).
  const [isSharing, setIsSharing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [localStream, setLocalStream] = useState<any>(null)
  const [usingLiveKit, setUsingLiveKit] = useState(USE_LIVEKIT && isLiveKitAvailable)
  const [photoCount, setPhotoCount] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [showEncouragement, setShowEncouragement] = useState(false)
  const [encouragement, setEncouragement] = useState('')
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [currentDirection, setCurrentDirection] = useState<string | null>(null)
  const [showDirection, setShowDirection] = useState(false)
  const [isLoadingPermission, setIsLoadingPermission] = useState(true)
  const [webrtcState, setWebrtcState] = useState<string>('idle')
  const [partnerOnline, setPartnerOnline] = useState<boolean | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [streamReady, setStreamReady] = useState(false) // Track if stream has active video
  const [isReconnecting, setIsReconnecting] = useState(false) // Track background/foreground reconnection
  
  // Track app state for background/foreground handling
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const wasConnectedRef = useRef(false) // Track if we had a connection before backgrounding
  
  const encouragements = t.camera.encouragements

  // Use Supabase Realtime as fallback/enhancement for WebRTC commands
  // This provides instant direction commands even if WebRTC data channel has issues
  const handleRealtimeCommand = useCallback((command: { direction: Direction }) => {
    sessionLogger.info('realtime_direction_received', { direction: command.direction })
    setCurrentDirection(command.direction)
    setShowDirection(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    setTimeout(() => setShowDirection(false), 2500)
  }, [])

  const { isConnected: realtimeConnected } = useRealtimeCommands(
    isPaired ? sessionId ?? undefined : undefined,
    'camera',
    handleRealtimeCommand
  )

  // IMPORTANT: This hook must be defined BEFORE any conditional returns
  // to comply with React's rules of hooks
  const showRandomEncouragement = useCallback(() => {
    const msg = encouragements[Math.floor(Math.random() * encouragements.length)]
    setEncouragement(msg)
    setShowEncouragement(true)
    setTimeout(() => setShowEncouragement(false), 2500)
  }, [encouragements])

  // Initialize logging with detailed device info
  useEffect(() => {
    if (myDeviceId) {
      sessionLogger.init(myDeviceId, sessionId ?? undefined)
      sessionLogger.logCamera('init_start', { 
        role: 'photographer',
        isPaired,
        pairedDeviceId: pairedDeviceId?.substring(0, 8),
        webrtcAvailable,
        screenMounted: true,
      })
      
      // Log device info for debugging
      sessionLogger.logDeviceInfo({
        osVersion: `${Platform.OS} ${Platform.Version}`,
      })
    }
    return () => {
      sessionLogger.logCamera('cleanup', { 
        role: 'photographer',
        reason: 'screen_unmount',
      })
      sessionLogger.flush()
    }
  }, [myDeviceId, sessionId, isPaired, pairedDeviceId])

  // Handle permission loading state
  useEffect(() => {
    if (permission !== null) {
      setIsLoadingPermission(false)
    }
  }, [permission])

  // Handle app state changes (background/foreground) for WebRTC lifecycle
  // Best practices:
  // - Pause video tracks when backgrounded (saves battery)
  // - Resume and potentially reconnect when returning to foreground
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const prevState = appStateRef.current
      appStateRef.current = nextState
      
      sessionLogger.info('camera_app_state_change', {
        from: prevState,
        to: nextState,
        isConnected,
        isSharing,
        wasConnected: wasConnectedRef.current,
      })
      
      // App going to background - pause video to save battery
      if (nextState === 'background' && prevState === 'active') {
        // Mark that we had an active connection
        if (isConnected) {
          wasConnectedRef.current = true
        }
        
        // Pause local video tracks (saves battery, keeps connection alive)
        const localStream = webrtcService.getLocalStream()
        if (localStream) {
          const videoTracks = localStream.getVideoTracks?.() ?? []
          videoTracks.forEach((track: { enabled: boolean }) => {
            track.enabled = false
          })
          sessionLogger.info('camera_video_paused_background', { trackCount: videoTracks.length })
        }
      }
      
      // App coming to foreground - resume and potentially reconnect
      if (nextState === 'active' && prevState !== 'active') {
        // Resume local video tracks first (quick operation)
        const localStream = webrtcService.getLocalStream()
        if (localStream) {
          const videoTracks = localStream.getVideoTracks?.() ?? []
          videoTracks.forEach((track: { enabled: boolean }) => {
            track.enabled = true
          })
          sessionLogger.info('camera_video_resumed_foreground', { trackCount: videoTracks.length })
        }
        
        // If we were connected before and now aren't, trigger reconnect
        if (wasConnectedRef.current && !isConnected && isPaired && isSharing) {
          sessionLogger.info('camera_foreground_reconnect_needed', {
            wasConnected: wasConnectedRef.current,
            isConnected,
          })
          
          setIsReconnecting(true)
          
          // Small delay to let system stabilize, then reinit WebRTC
          setTimeout(async () => {
            if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) {
              setIsReconnecting(false)
              return
            }
            
            try {
              // Destroy and reinit to get fresh connection
              await webrtcService.destroy()
              await new Promise(resolve => setTimeout(resolve, 500))
              
              await webrtcService.init(
                myDeviceId,
                pairedDeviceId,
                sessionId,
                'camera',
                {
                  onConnectionStateChange: (state) => {
                    setWebrtcState(state)
                    setIsConnected(state === 'connected')
                    if (state === 'connected') {
                      setIsReconnecting(false)
                      wasConnectedRef.current = true
                      sessionLogger.info('camera_reconnect_success')
                    }
                  },
                  onError: (error) => {
                    sessionLogger.error('camera_reconnect_error', error)
                    setIsReconnecting(false)
                  },
                }
              )
            } catch (error) {
              sessionLogger.error('camera_foreground_reconnect_failed', error as Error)
              setIsReconnecting(false)
            }
          }, 1500)
        }
      }
    }
    
    const subscription = AppState.addEventListener('change', handleAppStateChange)
    
    return () => {
      subscription.remove()
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId, isConnected, isSharing])

  // Auto-start sharing only when we know the partner is online.
  useEffect(() => {
    if (!isPaired) return
    if (!webrtcAvailable) return
    if (!permission?.granted) return
    if (cameraError) return
    if (partnerOnline !== true) return
    if (isSharing) return
    setIsSharing(true)
  }, [cameraError, isPaired, isSharing, partnerOnline, permission?.granted])

  // Initialize WebRTC when paired AND permission is granted AND sharing is requested.
  // IMPORTANT:
  // - Don't include "webrtcInitialized" as a dependency (it caused init/cleanup loops).
  // - Only attach command listeners AFTER init() so the channel exists.
  // - ANDROID FIX: Add delay before init to allow previous role's cleanup to complete.
  useEffect(() => {
    if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) return
    if (!permission?.granted) return
    if (!isSharing) return
    
    // Check if WebRTC is available
    if (!webrtcAvailable) {
      sessionLogger.warn('webrtc_not_available_camera', { 
        isPaired, 
        hasPermission: permission?.granted 
      })
      return
    }

    // Track if component is still mounted
    let isMounted = true
    let initDelayId: ReturnType<typeof setTimeout> | null = null

    sessionLogger.info('starting_webrtc_as_photographer', {
      myDeviceId,
      pairedDeviceId,
      sessionId,
    })
    
    // Flush immediately so we can see this log even if native code crashes
    sessionLogger.flush()
    
    // Record connection in history
    connectionHistoryApi.recordConnection({
      deviceId: myDeviceId,
      partnerDeviceId: pairedDeviceId,
      partnerDisplayName: partnerDisplayName || undefined,
      partnerAvatar: partnerAvatar || '👤',
      sessionId,
      role: 'camera',
      initiatedBy: 'self',
    }).then(({ connection }) => {
      if (connection) {
        sessionLogger.info('connection_recorded', { connectionId: connection.id })
      }
    }).catch(() => {
      // Silent fail for history
    })
    
    // Initialize video streaming (LiveKit or WebRTC)
    // ANDROID FIX: Add timeout to prevent indefinite hang on camera init
    const INIT_TIMEOUT_MS = 15000 // 15 second timeout
    let initTimedOut = false
    const canUseLiveKit = USE_LIVEKIT && isLiveKitAvailable
    const streamingMethod = canUseLiveKit ? 'livekit' : 'webrtc'
    setUsingLiveKit(canUseLiveKit)

    const initWebRTC = async () => {
      sessionLogger.info('photographer_calling_video_init', {
        method: streamingMethod,
        myDeviceId: myDeviceId?.substring(0, 8),
        pairedDeviceId: pairedDeviceId?.substring(0, 8),
        isMounted,
      })
      
      // Flush logs immediately so we can see init started even if app crashes
      sessionLogger.flush()

      // Set up timeout - IMPORTANT: Also handles case where native code crashes
      const timeoutId = setTimeout(() => {
        initTimedOut = true
        sessionLogger.logCamera('init_failed', {
          reason: 'timeout',
          timeoutMs: INIT_TIMEOUT_MS,
          role: 'photographer',
          note: 'WebRTC init did not complete in time - may indicate native crash',
        })
        sessionLogger.flush()
        if (isMounted) {
          setCameraError(CAMERA_ERROR_MESSAGES.TimeoutError)
          setIsSharing(false)
          // Attempt cleanup in case init is stuck
          if (canUseLiveKit) {
            void livekitService.destroy().catch(() => {})
          } else {
            void webrtcService.destroy().catch(() => {})
          }
        }
      }, INIT_TIMEOUT_MS)
      
      try {
        // Command handler for both LiveKit and WebRTC
        const handleCommand = (command: string, data?: Record<string, unknown>) => {
          if (!isMounted) return
          sessionLogger.info('command_received', { command, data })
          
          // Handle role switch command - auto-navigate to director mode
          if (command === 'switch_role' && data?.newRole === 'director') {
            sessionLogger.info('switch_role_received', { newRole: 'director' })
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            setShowSwitchToast(true)
            setTimeout(async () => {
              if (canUseLiveKit) {
                await livekitService.destroy()
              } else {
                await webrtcService.destroy()
              }
              router.replace('/viewer')
            }, 1500)
            return
          }
          
          setLastCommand(command)
          handleRemoteCommand(command, data)
          setTimeout(() => setLastCommand(null), 2000)
        }

        if (canUseLiveKit) {
          // Use LiveKit (more reliable)
          await livekitService.init(
            myDeviceId,
            pairedDeviceId,
            sessionId,
            'camera',
            {
              onConnectionStateChange: (state) => {
                if (!isMounted) return
                sessionLogger.info('photographer_livekit_state', { connectionState: state })
                setWebrtcState(state)
                setIsConnected(state === 'connected')
                if (state === 'disconnected') {
                  sessionLogger.warn('photographer_connection_lost', { state })
                }
              },
              onError: (error) => {
                if (!isMounted) return
                sessionLogger.error('photographer_livekit_error', error)
                setIsConnected(false)
              },
            }
          )
          livekitService.onCommand(handleCommand)
        } else {
          // Fall back to WebRTC
          await webrtcService.init(
            myDeviceId,
            pairedDeviceId,
            sessionId,
            'camera',
            {
              onConnectionStateChange: (state) => {
                if (!isMounted) {
                  sessionLogger.info('photographer_state_after_unmount', { state })
                  return
                }
                sessionLogger.info('photographer_webrtc_state', { 
                  connectionState: state,
                  role: 'camera',
                })
                setWebrtcState(state)
                setIsConnected(state === 'connected')
                
                // Track connection state for background/foreground reconnection
                if (state === 'connected') {
                  wasConnectedRef.current = true
                }
                
                // If connection failed or disconnected, notify user
                if (state === 'failed' || state === 'disconnected') {
                  sessionLogger.warn('photographer_connection_lost', { state })
                  // Do NOT unpair on transient WebRTC failures; Presence handles real disconnects.
                }
              },
              onError: (error) => {
                if (!isMounted) return
                sessionLogger.error('photographer_webrtc_error', error, {
                  role: 'camera',
                  myDeviceId,
                  pairedDeviceId,
                })
                setIsConnected(false)
                // Do NOT unpair on transient WebRTC errors; Presence handles real disconnects.
              },
            }
          )
        } // End of else block (WebRTC fallback)
        
        // Clear timeout on successful init
        clearTimeout(timeoutId)

        // Check if timed out during init
        if (initTimedOut) {
          sessionLogger.warn('photographer_init_completed_after_timeout', {
            message: 'Init completed but timeout already fired',
          })
          return
        }

        sessionLogger.info('photographer_webrtc_init_returned', { isMounted })
        
        // Check if still mounted after async init
        if (!isMounted) {
          sessionLogger.warn('photographer_unmounted_after_init', {
            message: 'Component unmounted during WebRTC init'
          })
          return
        }

        // Command listener already attached in handler above for LiveKit
        if (!canUseLiveKit) {
          webrtcService.onCommand(handleCommand)
        }
        sessionLogger.info('photographer_command_listener_attached', { method: streamingMethod })
        
        // For LiveKit, camera is managed by the service
        // For WebRTC, get local stream for preview AFTER init completes
        if (canUseLiveKit) {
          // LiveKit manages the camera internally
          setStreamReady(true)
          setCameraError(null)
          sessionLogger.info('livekit_camera_ready', {
            role: 'photographer',
          })
        } else {
          // WebRTC - get local stream for preview
          const stream = webrtcService.getLocalStream()
          if (stream && isMounted) {
            // Validate stream has active video tracks before rendering
            const videoTracks = stream.getVideoTracks()
            const hasActiveVideo = videoTracks.length > 0 && videoTracks.some(
              (track: { readyState: string; enabled: boolean }) => track.readyState === 'live' && track.enabled
            )
            
            if (hasActiveVideo) {
              setLocalStream(stream)
              setStreamReady(true)
              setCameraError(null)
              sessionLogger.logCamera('stream_ready', {
                trackCount: stream.getTracks().length,
                videoTracks: videoTracks.length,
                streamId: stream.id?.substring(0, 8),
                hasActiveVideo,
                role: 'photographer',
                trackDetails: videoTracks.map((t: { readyState: string; enabled: boolean; id?: string; label?: string }) => ({
                  readyState: t.readyState,
                  enabled: t.enabled,
                  id: t.id?.substring(0, 8),
                  label: t.label,
                })),
              })
            } else {
              sessionLogger.logCamera('stream_failed', {
                reason: 'no_active_video_tracks',
                trackCount: stream.getTracks().length,
                videoTracksCount: videoTracks.length,
                trackStates: videoTracks.map((t: { readyState: string; enabled: boolean; id?: string }) => ({
                  readyState: t.readyState,
                  enabled: t.enabled,
                  id: t.id?.substring(0, 8),
                })),
                role: 'photographer',
              })
              setCameraError(CAMERA_ERROR_MESSAGES.StreamError)
              setIsSharing(false)
              void webrtcService.destroy()
            }
          } else if (!stream) {
            sessionLogger.logCamera('stream_failed', {
              reason: 'no_stream_returned',
              isMounted,
              role: 'photographer',
            })
            setCameraError(CAMERA_ERROR_MESSAGES.StreamError)
            setIsSharing(false)
            void webrtcService.destroy()
          }
        }
      } catch (error) {
        // Clear timeout on error
        clearTimeout(timeoutId)

        // Get user-friendly error message
        const userMessage = getCameraErrorMessage(error)

        // Log detailed error for debugging
        sessionLogger.logCamera('init_failed', {
          errorName: (error as Error)?.name,
          errorMessage: (error as Error)?.message,
          errorStack: (error as Error)?.stack?.substring(0, 500),
          userMessage,
          isMounted,
          initTimedOut,
          role: 'photographer',
        })
        
        if (!isMounted || initTimedOut) return
        setIsConnected(false)
        setIsSharing(false)
        setCameraError(userMessage)
        if (canUseLiveKit) {
          void livekitService.destroy()
        } else {
          void webrtcService.destroy()
        }
      }
    }
    
    // ANDROID FIX: Small delay before starting init to ensure any previous
    // role's cleanup (especially from Director) has completed at the native level.
    // This prevents native crashes when RTCPeerConnection is created too quickly
    // after the previous one was destroyed.
    sessionLogger.info('photographer_init_delay_start', { delayMs: 300 })
    initDelayId = setTimeout(() => {
      if (!isMounted) {
        sessionLogger.info('photographer_init_cancelled_unmounted_during_delay')
        return
      }
      sessionLogger.info('photographer_init_delay_complete')
      initWebRTC()
    }, 300)

    return () => {
      isMounted = false
      if (initDelayId) {
        clearTimeout(initDelayId)
        initDelayId = null
      }
      sessionLogger.info('webrtc_cleanup', { 
        reason: 'component_unmount',
        hadLocalStream: !!localStream,
      })
      // Reset stream state on cleanup
      setStreamReady(false)
      // Best-effort cleanup; don't set state here (avoids effect loops).
      if (usingLiveKit) {
        void livekitService.destroy()
      } else {
        void webrtcService.destroy()
      }
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId, permission?.granted, isSharing, usingLiveKit])

  // Handle commands from director
  const handleRemoteCommand = (command: string, data?: Record<string, unknown>) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    
    switch (command) {
      case 'capture':
        handleCapture()
        break
      case 'flip':
        toggleCameraFacing()
        setShowEncouragement(true)
        setEncouragement('Camera flipped')
        setTimeout(() => setShowEncouragement(false), 1500)
        break
      case 'flash':
        toggleFlash()
        setShowEncouragement(true)
        setEncouragement(flashMode === 'off' ? 'Flash ON' : 'Flash OFF')
        setTimeout(() => setShowEncouragement(false), 1500)
        break
      case 'direction':
        // Show large prominent direction overlay
        const dir = data?.direction as string
        setCurrentDirection(dir)
        setShowDirection(true)
        // Auto-hide after 2.5 seconds
        setTimeout(() => setShowDirection(false), 2500)
        break
    }
  }

  // Quick Connect cleanup
  useEffect(() => {
    return () => {
      (async () => {
        try {
          const quickConnectMode = await AsyncStorage.getItem(QUICK_CONNECT_KEY)
          if (quickConnectMode === 'true' && myDeviceId) {
            await pairingApi.unpair(myDeviceId)
            clearPairing()
            await AsyncStorage.removeItem(QUICK_CONNECT_KEY)
            sessionLogger.info('quick_connect_auto_disconnected')
          }
        } catch (error) {
          sessionLogger.error('quick_connect_cleanup_error', error)
        }
      })()
    }
  }, [myDeviceId, clearPairing])

  const handleRequestPermission = async () => {
    const result = await requestPermission()
    if (!result.granted) {
      Alert.alert(
        'Permission Required',
        'Please enable camera access in your device settings to use this feature.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      )
    }
  }

  // Loading state
  if (isLoadingPermission || permission === null) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Pressable 
          style={styles.backButtonTop}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        
        <View style={styles.loadingContainer}>
          <Animated.Text entering={FadeIn.duration(300)} style={styles.loadingEmoji}>📷</Animated.Text>
          <Animated.Text 
            entering={FadeIn.delay(200).duration(300)}
            style={[styles.loadingText, { color: colors.textMuted }]}
          >
            {t.camera.loading || 'Preparing camera...'}
          </Animated.Text>
        </View>
      </SafeAreaView>
    )
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <PermissionDenied 
        onRequestPermission={handleRequestPermission}
        colors={colors}
      />
    )
  }

  const handleCapture = async () => {
    const captureStartTime = Date.now()
    
    sessionLogger.logCamera('capture_start', {
      isPaired,
      isConnected,
      hasCameraRef: !!cameraRef.current,
      hasLocalStream: !!localStream,
      webrtcPreview: useWebRTCPreview,
      cameraReady,
      facing,
      captureStartTime,
    })

    if (useWebRTCPreview) {
      // WebRTC is holding the camera. To capture a real photo, temporarily stop WebRTC,
      // take a photo via expo-camera, then resume WebRTC.
      sessionLogger.info('capture_webrtc_pause_start')
      try {
        void webrtcService.destroy()
      } catch {}
      setLocalStream(null)
      setStreamReady(false)
      setIsConnected(false)
      setIsSharing(false)

      // Give the native camera a moment to release + CameraView to mount
      await new Promise<void>((resolve) => setTimeout(resolve, 500))

      // Wait for camera to become ready (max 3s)
      const start = Date.now()
      while (!cameraReady && Date.now() - start < 3000) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => setTimeout(resolve, 100))
      }

      sessionLogger.info('capture_webrtc_pause_done', { cameraReady })
    }

    try {
      if (!cameraRef.current) {
        sessionLogger.logCamera('capture_failed', {
          reason: 'no_camera_ref',
          cameraReady,
          useWebRTCPreview,
        })
        Alert.alert('Camera not ready', 'Please wait a second and try again.')
        return
      }

      sessionLogger.logCamera('capture_start', { phase: 'taking_picture' })
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        exif: false,
        skipProcessing: false,
      })

      const captureEndTime = Date.now()
      sessionLogger.logCamera('capture_success', {
        uri: photo?.uri?.substring(0, 50),
        width: (photo as any)?.width,
        height: (photo as any)?.height,
        captureDurationMs: captureEndTime - captureStartTime,
      })

      // Save if enabled
      if (settings.autoSave && photo?.uri) {
        sessionLogger.info('capture_saving_to_library', { autoSave: true })
        const permission = await MediaLibrary.requestPermissionsAsync()
        if (permission.status === 'granted') {
          const asset = await MediaLibrary.createAssetAsync(photo.uri)
          sessionLogger.info('capture_saved_to_library', { 
            assetUri: asset?.uri?.substring(0, 50),
            success: true,
          })
        } else {
          sessionLogger.logCamera('permission_denied', { 
            type: 'media_library',
            action: 'save_photo',
          })
        }
      }

      // Update UI + stats ONLY on success
      setPhotoCount(prev => prev + 1)
      await incrementPhotos()
      await incrementScoldingsSaved(1)
      showRandomEncouragement()
      sessionLogger.logPerformance('photo_capture', captureEndTime - captureStartTime, true, {
        photoCount: photoCount + 1,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch (error) {
      sessionLogger.logCamera('capture_failed', {
        errorName: (error as Error)?.name,
        errorMessage: (error as Error)?.message,
        errorStack: (error as Error)?.stack?.substring(0, 300),
        cameraReady,
        hasCameraRef: !!cameraRef.current,
      })
      Alert.alert('Capture failed', getCameraErrorMessage(error))
    } finally {
      // Resume WebRTC after capture if we're paired
      if (isPaired && myDeviceId && pairedDeviceId && sessionId && permission?.granted && webrtcAvailable) {
        sessionLogger.info('capture_webrtc_resume_requested')
        // Trigger re-init by requesting sharing again.
        setIsSharing(true)
      }
    }
  }

  const toggleCameraFacing = () => {
    setFacing(f => f === 'back' ? 'front' : 'back')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const toggleFlash = () => {
    setFlashMode(f => f === 'off' ? 'on' : 'off')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect',
      'Clear current pairing and go back?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            sessionLogger.info('manual_disconnect')
            webrtcService.destroy()
            if (myDeviceId) {
              await pairingApi.unpair(myDeviceId)
            }
            clearPairing()
            router.replace('/')
          }
        },
      ]
    )
  }

  // Determine which camera view to show
  // If paired + WebRTC available + has local stream with active video → show RTCView
  // If paired but WebRTC is initializing (no stream yet) → show loading placeholder
  // Otherwise → show expo-camera CameraView
  // 
  // ANDROID FIX: Ensure stream is validated before rendering RTCView to avoid blank screen
  const useWebRTCPreview = isPaired && webrtcAvailable && localStream && RTCView && streamReady
  const webrtcIsInitializing = isPaired && webrtcAvailable && !localStream && isSharing && !cameraError

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Back button - minimal */}
      <Pressable 
        style={styles.backButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.back()
        }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Text style={styles.backButtonTextCamera}>‹</Text>
      </Pressable>

      {/* Camera preview */}
      <View style={styles.cameraPreview}>
        {useWebRTCPreview ? (
          // WebRTC local stream preview (when paired and stream ready)
          // Key prop forces re-render when stream changes - fixes blank screen
          // ANDROID FIX: 
          // - zOrder={1} brings RTCView to front (0 can render behind other views)
          // - Explicit width/height prevents 0-dimension crash on Android
          // - Added wrapper View with flex:1 to ensure proper layout
          <View style={styles.rtcViewWrapper}>
            <RTCView
              key={localStream?.id || 'local-stream'}
              streamURL={localStream.toURL()}
              style={styles.rtcView}
              objectFit="cover"
              mirror={facing === 'front'}
              zOrder={1}
            />
          </View>
        ) : webrtcIsInitializing ? (
          // WebRTC is initializing - show placeholder to avoid camera conflict
          // Do NOT render CameraView here or it will fight with getUserMedia()
          <View style={[StyleSheet.absoluteFill, styles.initializingContainer]}>
            <Text style={styles.initializingEmoji}>📷</Text>
            <Text style={styles.initializingText}>Connecting camera...</Text>
            {partnerOnline === false && (
              <Text style={styles.initializingText}>Partner is offline — showing local camera only</Text>
            )}
          </View>
        ) : cameraError ? (
          // Camera error state - show error message with retry option
          <View style={[StyleSheet.absoluteFill, styles.initializingContainer]}>
            <Text style={styles.initializingEmoji}>⚠️</Text>
            <Text style={styles.errorText}>{cameraError}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => {
                sessionLogger.logCamera('init_start', {
                  reason: 'user_retry',
                  previousError: cameraError,
                  isPaired,
                  webrtcAvailable,
                })
                setCameraError(null)
                setCameraReady(false)
                setStreamReady(false)
                if (isPaired && webrtcAvailable) {
                  setIsSharing(true)
                }
              }}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
            
            {/* Show additional help for specific errors */}
            {cameraError === CAMERA_ERROR_MESSAGES.NotReadableError && (
              <Text style={styles.errorHint}>
                💡 Tip: Close other camera apps and try again
              </Text>
            )}
            {cameraError === CAMERA_ERROR_MESSAGES.NotAllowedError && (
              <Pressable 
                style={styles.settingsButton}
                onPress={() => {
                  sessionLogger.info('user_opened_settings', { reason: 'permission_denied' })
                  Linking.openSettings()
                }}
              >
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </Pressable>
            )}
          </View>
        ) : (
          // expo-camera preview (when not paired OR after WebRTC gives up camera)
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flashMode}
            onCameraReady={() => {
              setCameraReady(true)
              setCameraError(null)
              sessionLogger.logCamera('ready', {
                facing,
                isPaired,
                isSharing,
                flashMode,
                source: 'expo-camera',
              })
            }}
            onMountError={(error) => {
              const userMessage = getCameraErrorMessage(error)
              sessionLogger.logCamera('error', {
                errorName: (error as any)?.name ?? 'CameraMountError',
                errorMessage: (error as any)?.message ?? String(error),
                userMessage,
                facing,
                source: 'expo-camera',
              })
              setCameraError(userMessage)
            }}
          />
        )}
        
        {settings.showGrid && <GridOverlay />}
        
        {/* Status bar with long-press hint */}
        <Pressable 
          style={styles.statusBar}
          onLongPress={handleDisconnect}
          accessibilityLabel={`Connection status: ${isConnected ? 'Live streaming' : isPaired ? 'Paired' : 'Not connected'}. Long press to disconnect`}
          accessibilityHint="Long press to disconnect from partner"
          accessibilityRole="button"
        >
          <View style={[
            styles.statusDot, 
            isConnected ? styles.statusDotLive : 
            isReconnecting ? styles.statusDotReconnecting :
            isPaired ? (partnerOnline === false ? styles.statusDotOff : styles.statusDotOn) : styles.statusDotOff
          ]} />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusText}>
              {isReconnecting ? '🔄 Reconnecting...' : isConnected ? '🔴 LIVE' : isPaired ? (partnerOnline === false ? '📴 Offline' : isSharing ? '⏳ Connecting...' : '✓ Paired') : t.camera.notConnected}
            </Text>
            {isPaired && pairedDeviceId && (
              <Text style={styles.partnerText}>
                {partnerOnline === false ? '⏳ Session saved' : '👁️ Director watching'}
              </Text>
            )}
            {/* Long-press hint indicator */}
            <Text style={styles.longPressHint}>Hold to disconnect</Text>
          </View>
        </Pressable>
        
        {/* Photo count */}
        <View style={styles.photoCount}>
          <Text style={styles.photoCountText}>{photoCount} {t.camera.captured}</Text>
        </View>

        {/* Command overlay */}
        {lastCommand && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.commandOverlay}>
            <Text style={styles.commandText}>📍 {lastCommand}</Text>
          </Animated.View>
        )}
        
        <EncouragementToast message={encouragement} visible={showEncouragement} />
        <DirectionOverlay direction={currentDirection} visible={showDirection} />
        <SwitchRoleToast visible={showSwitchToast} partnerName={partnerDisplayName || 'Partner'} />
      </View>

      {/* Controls - Simplified for focus */}
      <View style={styles.controls}>
        {/* Prominent streaming indicator */}
        {isPaired && (
          <Animated.View 
            entering={FadeIn.duration(200)}
            style={styles.connectionIndicator}
          >
            <View style={[styles.liveIndicator, isConnected && styles.liveIndicatorActive, isReconnecting && styles.liveIndicatorReconnecting]}>
              {isConnected && <View style={styles.recordingDot} />}
              {isReconnecting && <View style={[styles.recordingDot, { backgroundColor: '#ff9800' }]} />}
              <Text style={styles.liveIndicatorText}>
                {isReconnecting ? 'RECONNECTING...' : isConnected ? 'STREAMING TO PARTNER' : '⏳ Connecting...'}
              </Text>
            </View>
            {isConnected && (
              <Text style={styles.streamingHint}>
                📷 Camera is being shared
              </Text>
            )}
          </Animated.View>
        )}

        <View style={styles.captureRow}>
          <CaptureButton onPress={handleCapture} isSharing={isSharing} />
        </View>

        {/* Minimal quick actions - essential controls */}
        <View style={styles.bottomControls} accessibilityRole="toolbar">
          <QuickActionButton
            icon="⊞"
            label="Grid"
            active={settings.showGrid}
            onPress={() => {
              updateSettings({ showGrid: !settings.showGrid })
            }}
          />

          <QuickActionButton
            icon="⟲"
            label="Flip"
            onPress={toggleCameraFacing}
          />

          <QuickActionButton
            icon="⚡"
            label="Flash"
            active={flashMode === 'on'}
            onPress={toggleFlash}
          />
        </View>

        {/* Clear call-to-action when not paired */}
        {!isPaired && (
          <Pressable 
            style={styles.connectPrompt}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/pairing')
            }}
            accessibilityLabel={t.camera.connectPrompt}
          >
            <Text style={styles.connectPromptIcon}>🔗</Text>
            <Text style={styles.connectPromptText}>Connect with Partner</Text>
          </Pressable>
        )}

        {/* Switch role - more prominent when paired */}
        {isPaired && (
          <Pressable 
            style={styles.switchRolePrompt}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              ;(async () => {
                try {
                  // Notify partner to switch to photographer before we switch
                  await webrtcService.sendCommand('switch_role', { newRole: 'photographer' })
                  sessionLogger.info('switch_role_command_sent', { partnerNewRole: 'photographer' })
                  await webrtcService.destroy()
                } finally {
                  router.replace('/viewer')
                }
              })()
            }}
            accessibilityLabel="Switch to Director mode"
          >
            <Text style={styles.switchRoleIcon}>◉</Text>
            <Text style={styles.switchRoleText}>Switch to Director</Text>
          </Pressable>
        )}

        {/* Debug panel - tap to expand (only visible in __DEV__ mode) */}
        {__DEV__ && (
          <ConnectionDebugPanel
            role="photographer"
            sessionId={sessionId}
            myDeviceId={myDeviceId}
            partnerDeviceId={pairedDeviceId}
            partnerOnline={partnerOnline}
            webrtcState={webrtcState}
            isConnected={isConnected}
            isSharing={isSharing}
            hasLocalStream={!!localStream}
            cameraError={cameraError}
            streamReady={streamReady}
            cameraReady={cameraReady}
            facing={facing}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingEmoji: {
    fontSize: 32,
    opacity: 0.5,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
  backButtonTop: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 100,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 12,
    zIndex: 100,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonTextCamera: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.3,
  },
  permissionDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    color: 'rgba(255,255,255,0.5)',
  },
  permissionButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 24,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  permissionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  settingsLink: {
    paddingVertical: 12,
  },
  settingsLinkText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#111',
    position: 'relative',
  },
  initializingContainer: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initializingEmoji: {
    fontSize: 32,
    marginBottom: 16,
    opacity: 0.4,
  },
  initializingText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  errorText: {
    fontSize: 13,
    color: 'rgba(255,100,100,0.8)',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  retryButtonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  errorHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
  },
  settingsButton: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  settingsButtonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
  },
  // ANDROID FIX: Explicit dimensions for RTCView wrapper to prevent 0-dimension crash
  rtcViewWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
  },
  rtcView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridLineH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOn: {
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  statusDotOff: {
    backgroundColor: 'rgba(255,100,100,0.6)',
  },
  statusDotLive: {
    backgroundColor: '#e53935',
  },
  statusDotReconnecting: {
    backgroundColor: '#ff9800', // Orange for reconnecting
  },
  statusTextContainer: {
    flexDirection: 'column',
  },
  statusText: {
    fontSize: 12, // Accessibility: minimum 12sp
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  partnerText: {
    fontSize: 12, // Accessibility: minimum 12sp
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  longPressHint: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    fontStyle: 'italic',
  },
  photoCount: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  photoCountText: {
    fontSize: 12, // Accessibility: minimum 12sp
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  commandOverlay: {
    position: 'absolute',
    top: '40%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  commandText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  // Direction overlay - large prominent arrows
  directionOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  directionBox: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 32,
    paddingHorizontal: 48,
    borderRadius: 24,
    borderWidth: 3,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
  directionIcon: {
    fontSize: 80,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  directionLabel: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 4,
  },
  // Switch role toast
  switchToast: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(229, 57, 53, 0.95)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  switchToastText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  switchToastSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  controls: {
    backgroundColor: '#0a0a0a',
    paddingBottom: 32,
  },
  connectionIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  liveIndicatorActive: {
    backgroundColor: 'rgba(229, 57, 53, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.4)',
  },
  liveIndicatorReconnecting: {
    backgroundColor: 'rgba(255, 152, 0, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 152, 0, 0.4)',
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e53935',
  },
  streamingHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 6,
    textAlign: 'center',
  },
  liveIndicatorText: {
    fontSize: 12, // Accessibility: minimum 12sp
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  captureRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
    paddingTop: 8,
  },
  quickAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    minWidth: 48, // Accessibility: minimum touch target
    minHeight: 48, // Accessibility: minimum touch target
  },
  quickActionText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  quickActionLabel: {
    fontSize: 12, // Accessibility: minimum 12sp
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Small pill buttons (used by ActionButton component)
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  actionBtnTextActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  connectPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 24,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  connectPromptIcon: {
    fontSize: 14,
    opacity: 0.6,
  },
  connectPromptText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  switchRolePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  switchRoleIcon: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  switchRoleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
})
