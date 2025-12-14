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
import { pairingApi, connectionHistoryApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { webrtcService, webrtcAvailable } from '../src/services/webrtc'

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
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing, partnerDisplayName, partnerAvatar } = usePairingStore()
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useLanguageStore()
  const { incrementPhotos } = useStatsStore()
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
  
  const cameraRef = useRef<CameraView>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [isSharing, setIsSharing] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [localStream, setLocalStream] = useState<any>(null)
  const [photoCount, setPhotoCount] = useState(0)
  const [showEncouragement, setShowEncouragement] = useState(false)
  const [encouragement, setEncouragement] = useState('')
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  const [isLoadingPermission, setIsLoadingPermission] = useState(true)
  const [webrtcInitialized, setWebrtcInitialized] = useState(false)
  
  const encouragements = t.camera.encouragements

  // Initialize logging
  useEffect(() => {
    if (myDeviceId) {
      sessionLogger.init(myDeviceId, sessionId ?? undefined)
      sessionLogger.info('camera_screen_opened', { 
        role: 'photographer',
        isPaired,
        pairedDeviceId,
        webrtcAvailable,
      })
    }
    return () => {
      sessionLogger.info('camera_screen_closed')
      sessionLogger.flush()
    }
  }, [myDeviceId, sessionId, isPaired, pairedDeviceId])

  // Handle permission loading state
  useEffect(() => {
    if (permission !== null) {
      setIsLoadingPermission(false)
    }
  }, [permission])

  // Initialize WebRTC when paired AND permission is granted
  // IMPORTANT: Only init WebRTC, don't use expo-camera when streaming
  // Uses mounted ref to prevent state updates after unmount
  useEffect(() => {
    // Don't init if already initialized or not ready
    if (webrtcInitialized) return
    if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) return
    if (!permission?.granted) return
    
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
    let partnerStatusSubscription: { unsubscribe: () => void } | null = null

    sessionLogger.info('starting_webrtc_as_photographer', {
      myDeviceId,
      pairedDeviceId,
      sessionId,
    })
    
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
    
    // Presence-based partner disconnect detection (works even on abrupt disconnects)
    partnerStatusSubscription = connectionHistoryApi.subscribeToSessionPresence({
      sessionId,
      myDeviceId,
      partnerDeviceId: pairedDeviceId,
      onPartnerOnlineChange: (isOnline) => {
        sessionLogger.info('partner_presence_changed', { partnerDeviceId: pairedDeviceId, isOnline })
        if (!isOnline && isMounted) {
          Alert.alert(
            'Director Disconnected',
            `${partnerDisplayName || 'Your director'} has disconnected.`,
            [{ text: 'OK', onPress: () => disconnectAndUnpair('partner_presence_offline') }]
          )
        }
      },
      onError: (message) => sessionLogger.warn('presence_error', { message }),
    })
    
    // Initialize WebRTC and handle errors properly
    const initWebRTC = async () => {
      try {
        sessionLogger.info('photographer_calling_webrtc_init')
        
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
              setIsConnected(state === 'connected')
              
              // If connection failed or disconnected, notify user
              if (state === 'failed' || state === 'disconnected') {
                sessionLogger.warn('photographer_connection_lost', { state })
                disconnectAndUnpair(`webrtc_${state}`)
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
              disconnectAndUnpair('webrtc_error', { message: error?.message })
            },
          }
        )
        
        // Check if still mounted after async init
        if (!isMounted) {
          sessionLogger.warn('photographer_unmounted_after_init', {
            message: 'Component unmounted during WebRTC init'
          })
          return
        }
        
        sessionLogger.info('photographer_webrtc_init_returned')
        
        // Get local stream for preview AFTER init completes
        const stream = webrtcService.getLocalStream()
        if (stream && isMounted) {
          setLocalStream(stream)
          sessionLogger.info('photographer_local_stream_ready', {
            trackCount: stream.getTracks().length,
            videoTracks: stream.getVideoTracks().length,
            streamId: stream.id?.substring(0, 8),
          })
        } else if (!stream) {
          sessionLogger.warn('photographer_no_local_stream', {
            message: 'WebRTC init completed but no local stream available',
            isMounted,
          })
        }
      } catch (error) {
        if (!isMounted) return
        sessionLogger.error('photographer_webrtc_init_failed', error, {
          errorMessage: (error as Error)?.message,
        })
        setIsConnected(false)
        setIsSharing(false)
      }
    }
    
    // Set state before async call
    setWebrtcInitialized(true)
    setIsSharing(true)
    
    // Call async function
    initWebRTC()

    // Listen for commands from director
    webrtcService.onCommand((command, data) => {
      if (!isMounted) return
      sessionLogger.info('command_received', { command, data })
      setLastCommand(command)
      handleRemoteCommand(command, data)
      setTimeout(() => setLastCommand(null), 2000)
    })

    return () => {
      isMounted = false
      sessionLogger.info('webrtc_cleanup', { 
        reason: 'component_unmount',
        hadLocalStream: !!localStream,
      })
      webrtcService.destroy()
      setIsConnected(false)
      setIsSharing(false)
      setLocalStream(null)
      setWebrtcInitialized(false)
      // Unsubscribe from partner status
      if (partnerStatusSubscription) {
        void partnerStatusSubscription.unsubscribe()
      }
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId, permission?.granted, webrtcInitialized, partnerDisplayName, partnerAvatar])

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

  const showRandomEncouragement = useCallback(() => {
    const msg = encouragements[Math.floor(Math.random() * encouragements.length)]
    setEncouragement(msg)
    setShowEncouragement(true)
    setTimeout(() => setShowEncouragement(false), 2500)
  }, [encouragements])

  const handleCapture = async () => {
    // For now, just increment counter and show encouragement
    // Photo capture from WebRTC stream requires additional implementation
    setPhotoCount(prev => prev + 1)
    incrementPhotos()
    showRandomEncouragement()
    sessionLogger.info('capture_triggered')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
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
  // If paired + WebRTC available + has local stream → show RTCView
  // Otherwise → show expo-camera CameraView
  const useWebRTCPreview = isPaired && webrtcAvailable && localStream && RTCView

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
          // WebRTC local stream preview (when paired)
          // Key prop forces re-render when stream changes - fixes blank screen
          <RTCView
            key={localStream?.id || 'local-stream'}
            streamURL={localStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={facing === 'front'}
            zOrder={0}
          />
        ) : (
          // expo-camera preview (when not paired)
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            onCameraReady={() => sessionLogger.info('camera_ready')}
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
              {isConnected ? '🔴 LIVE' : isPaired ? (isSharing ? 'Connecting...' : 'Connected') : t.camera.notConnected}
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
              webrtcService.destroy()
              router.replace('/viewer')
            }}
            accessibilityLabel="Switch to Director mode"
          >
            <Text style={styles.switchRoleIcon}>👁️</Text>
            <Text style={styles.switchRoleText}>Switch to Director</Text>
          </Pressable>
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
