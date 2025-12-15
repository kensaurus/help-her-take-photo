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

// Encouragement toast
function EncouragementToast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.toast}
    >
      <Text style={styles.toastText}>{message}</Text>
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
        if (!isOnline) {
          Alert.alert(
            'Director Disconnected',
            `${partnerNameRef.current || 'Your director'} has disconnected.`,
            [{ text: 'OK', onPress: () => disconnectAndUnpair('partner_presence_offline') }]
          )
        }
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
  // IMPORTANT: Don't auto-start WebRTC on mount. If pairing state is stale or partner isn't online yet,
  // auto-starting WebRTC frequently results in an Android "blank screen" (getUserMedia hangs / RTCView black).
  // We only start sharing once Presence confirms partner is online (or user explicitly retries).
  const [isSharing, setIsSharing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [localStream, setLocalStream] = useState<any>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [showEncouragement, setShowEncouragement] = useState(false)
  const [encouragement, setEncouragement] = useState('')
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [isLoadingPermission, setIsLoadingPermission] = useState(true)
  const [webrtcState, setWebrtcState] = useState<string>('idle')
  const [partnerOnline, setPartnerOnline] = useState<boolean | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [streamReady, setStreamReady] = useState(false) // Track if stream has active video
  
  const encouragements = t.camera.encouragements

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
    
    // Initialize WebRTC and handle errors properly
    // ANDROID FIX: Add timeout to prevent indefinite hang on camera init
    const INIT_TIMEOUT_MS = 15000 // 15 second timeout
    let initTimedOut = false

    const initWebRTC = async () => {
      sessionLogger.info('photographer_calling_webrtc_init', {
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
          void webrtcService.destroy().catch(() => {})
        }
      }, INIT_TIMEOUT_MS)
      
      try {
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

        // NOW that the channel exists, attach command listener (direction/capture/etc.)
        webrtcService.onCommand((command, data) => {
          if (!isMounted) return
          sessionLogger.info('command_received', { command, data })
          setLastCommand(command)
          handleRemoteCommand(command, data)
          setTimeout(() => setLastCommand(null), 2000)
        })
        sessionLogger.info('photographer_command_listener_attached')
        
        // Get local stream for preview AFTER init completes
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
        void webrtcService.destroy()
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
      void webrtcService.destroy()
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId, permission?.granted, isSharing])

  // Handle commands from director
  const handleRemoteCommand = (command: string, data?: Record<string, unknown>) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    
    switch (command) {
      case 'capture':
        handleCapture()
        break
      case 'flip':
        setFacing(f => f === 'back' ? 'front' : 'back')
        break
      case 'direction':
        setShowEncouragement(true)
        setEncouragement(`👆 ${data?.direction || 'Adjust'}`)
        setTimeout(() => setShowEncouragement(false), 2000)
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
          <Text style={styles.backButtonText}>← Back</Text>
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
      {/* Back button - consistent navigation */}
      <Pressable 
        style={styles.backButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.back()
        }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Text style={styles.backButtonTextCamera}>← Back</Text>
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
            onCameraReady={() => {
              setCameraReady(true)
              setCameraError(null)
              sessionLogger.logCamera('ready', {
                facing,
                isPaired,
                isSharing,
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
        
        {/* Status bar */}
        <Pressable 
          style={styles.statusBar}
          onLongPress={handleDisconnect}
          accessibilityLabel="Connection status. Long press to disconnect"
        >
          <View style={[
            styles.statusDot, 
            isConnected ? styles.statusDotLive : 
            isPaired ? styles.statusDotOn : styles.statusDotOff
          ]} />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusText}>
              {isConnected ? '🔴 LIVE' : isPaired ? (isSharing ? 'Connecting...' : 'Paired') : t.camera.notConnected}
            </Text>
            {isPaired && pairedDeviceId && (
              <Text style={styles.partnerText}>👁️ Director watching</Text>
            )}
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
      </View>

      {/* Controls - Simplified for focus */}
      <View style={styles.controls}>
        {/* Connection status indicator */}
        {isPaired && (
          <View style={styles.connectionIndicator}>
            <View style={[styles.liveIndicator, isConnected && styles.liveIndicatorActive]}>
              <Text style={styles.liveIndicatorText}>
                {isConnected ? '🔴 LIVE' : '⏳ Connecting...'}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.captureRow}>
          <CaptureButton onPress={handleCapture} isSharing={isSharing} />
        </View>

        {/* Minimal quick actions - only essential controls */}
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
            icon="🔄"
            label="Flip"
            onPress={toggleCameraFacing}
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
                  await webrtcService.destroy()
                } finally {
                  router.replace('/viewer')
                }
              })()
            }}
            accessibilityLabel="Switch to Director mode"
          >
            <Text style={styles.switchRoleIcon}>👁️</Text>
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
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingEmoji: {
    fontSize: 64,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  backButtonTop: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 6,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 16,
    zIndex: 100,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  backButtonTextCamera: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    width: 100,
    height: 100,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  permissionDesc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
  settingsLink: {
    paddingVertical: 12,
  },
  settingsLinkText: {
    fontSize: 15,
    fontWeight: '500',
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  initializingContainer: {
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initializingEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  initializingText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  errorHint: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
  },
  settingsButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  settingsButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOn: {
    backgroundColor: '#22C55E',
  },
  statusDotOff: {
    backgroundColor: '#DC2626',
  },
  statusDotLive: {
    backgroundColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  statusTextContainer: {
    flexDirection: 'column',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  partnerText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  photoCount: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  photoCountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  commandOverlay: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  commandText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  controls: {
    backgroundColor: '#000',
    paddingBottom: 32,
  },
  connectionIndicator: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  liveIndicator: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  liveIndicatorActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.3)',
  },
  liveIndicatorText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  captureRow: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    paddingTop: 8,
  },
  quickAction: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  quickActionText: {
    fontSize: 28,
    color: '#fff',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionActive: {
    color: '#22C55E',
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  // Small pill buttons (used by ActionButton component)
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.25)',
    borderColor: 'rgba(34, 197, 94, 0.55)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  actionBtnTextActive: {
    color: '#22C55E',
  },
  connectPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  connectPromptIcon: {
    fontSize: 20,
  },
  connectPromptText: {
    fontSize: 16,
    color: '#22C55E',
    fontWeight: '600',
  },
  switchRolePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  switchRoleIcon: {
    fontSize: 18,
  },
  switchRoleText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
  },
})
