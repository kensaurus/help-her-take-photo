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
  Share,
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
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Icon } from '../src/components/ui/Icon'
import { pairingApi } from '../src/services/api'
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

// Capture button with animation
function CaptureButton({ onPress, isSharing }: { onPress: () => void; isSharing: boolean }) {
  const scale = useSharedValue(1)
  const innerScale = useSharedValue(1)
  
  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.9, { damping: 15 }),
      withSpring(1, { damping: 15 })
    )
    innerScale.value = withSequence(
      withTiming(0.6, { duration: 100 }),
      withTiming(1, { duration: 200 })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }
  
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  return (
    <Pressable 
      onPress={handlePress}
      accessibilityLabel="Take photo"
      accessibilityHint="Captures a photo"
      accessibilityRole="button"
    >
      <Animated.View style={[styles.captureOuter, outerStyle]}>
        <Animated.View style={[
          styles.captureInner,
          isSharing && styles.captureInnerSharing,
          innerStyle
        ]} />
      </Animated.View>
    </Pressable>
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
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing } = usePairingStore()
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useLanguageStore()
  const { incrementPhotos, stats } = useStatsStore()
  
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
      sessionLogger.info('camera_screen_opened')
    }
    return () => {
      sessionLogger.info('camera_screen_closed')
      sessionLogger.flush()
    }
  }, [myDeviceId, sessionId])

  // Handle permission loading state
  useEffect(() => {
    if (permission !== null) {
      setIsLoadingPermission(false)
    }
  }, [permission])

  // Initialize WebRTC when paired AND permission is granted
  // IMPORTANT: Only init WebRTC, don't use expo-camera when streaming
  useEffect(() => {
    // Don't init if already initialized or not ready
    if (webrtcInitialized) return
    if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) return
    if (!permission?.granted) return
    
    // Check if WebRTC is available
    if (!webrtcAvailable) {
      sessionLogger.warn('webrtc_not_available_camera')
      return
    }

    sessionLogger.info('starting_webrtc_connection')
    setWebrtcInitialized(true)
    setIsSharing(true)
    
    webrtcService.init(
      myDeviceId,
      pairedDeviceId,
      sessionId,
      'camera',
      {
        onConnectionStateChange: (state) => {
          sessionLogger.info('webrtc_state', { state })
          setIsConnected(state === 'connected')
        },
        onError: (error) => {
          sessionLogger.error('webrtc_error', error)
          setIsConnected(false)
        },
      }
    ).then(() => {
      // Get local stream for preview
      const stream = webrtcService.getLocalStream()
      if (stream) {
        setLocalStream(stream)
        sessionLogger.info('local_stream_ready')
      }
    })

    // Listen for commands from director
    webrtcService.onCommand((command, data) => {
      sessionLogger.info('command_received', { command, data })
      setLastCommand(command)
      handleRemoteCommand(command, data)
      setTimeout(() => setLastCommand(null), 2000)
    })

    return () => {
      sessionLogger.info('webrtc_cleanup')
      webrtcService.destroy()
      setIsConnected(false)
      setIsSharing(false)
      setLocalStream(null)
      setWebrtcInitialized(false)
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId, permission?.granted, webrtcInitialized])

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

  const toggleSharing = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (!isPaired) {
      router.push('/pairing')
    }
  }

  const toggleCameraFacing = () => {
    setFacing(f => f === 'back' ? 'front' : 'back')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `📸 ${t.appName} - I've avoided ${stats.scoldingsSaved} scoldings so far! ${t.tagline}`,
      })
    } catch {}
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
      {/* Close button */}
      <Pressable 
        style={styles.closeButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.back()
        }}
        accessibilityLabel="Go back"
        accessibilityRole="button"
      >
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {/* Camera preview */}
      <View style={styles.cameraPreview}>
        {useWebRTCPreview ? (
          // WebRTC local stream preview (when paired)
          <RTCView
            streamURL={localStream.toURL()}
            style={StyleSheet.absoluteFill}
            objectFit="cover"
            mirror={facing === 'front'}
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

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.topControls}>
          <ActionButton
            label={isPaired ? (isConnected ? '🔴 Live' : 'Connecting') : t.camera.share}
            onPress={toggleSharing}
            active={isSharing}
            accessibilityHint={isPaired ? 'Connection status' : 'Connect with partner'}
          />
          
          <ActionButton
            label={t.camera.options}
            onPress={() => router.push('/settings')}
            accessibilityHint="Open camera settings"
          />
        </View>

        <View style={styles.captureRow}>
          <CaptureButton onPress={handleCapture} isSharing={isSharing} />
        </View>

        <View style={styles.bottomControls} accessibilityRole="toolbar">
          <Pressable 
            style={styles.quickAction}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              updateSettings({ showGrid: !settings.showGrid })
            }}
            accessibilityLabel={`Grid overlay ${settings.showGrid ? 'on' : 'off'}`}
          >
            <Text style={styles.quickActionText}>⊞</Text>
            <Text style={styles.quickActionLabel}>Grid</Text>
          </Pressable>
          
          <Pressable 
            style={styles.quickAction}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/gallery')
            }}
            accessibilityLabel="Gallery"
          >
            <Text style={styles.quickActionText}>◫</Text>
            <Text style={styles.quickActionLabel}>Gallery</Text>
          </Pressable>
          
          <Pressable 
            style={styles.quickAction}
            onPress={toggleCameraFacing}
            accessibilityLabel="Flip camera"
          >
            <Text style={styles.quickActionText}>🔄</Text>
            <Text style={styles.quickActionLabel}>Flip</Text>
          </Pressable>

          <Pressable 
            style={styles.quickAction}
            onPress={handleShare}
            accessibilityLabel="Share"
          >
            <Text style={styles.quickActionText}>↗</Text>
            <Text style={styles.quickActionLabel}>Share</Text>
          </Pressable>
        </View>

        {!isPaired && (
          <Pressable 
            style={styles.connectPrompt}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/pairing')
            }}
            accessibilityLabel={t.camera.connectPrompt}
          >
            <Text style={styles.connectPromptText}>{t.camera.connectPrompt}</Text>
          </Pressable>
        )}

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
            <Text style={styles.switchRoleText}>👁️ Switch to Director</Text>
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
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 100,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
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
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 100,
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#DC2626',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnTextActive: {
    color: '#fff',
  },
  captureRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: '#fff',
  },
  captureInnerSharing: {
    backgroundColor: '#DC2626',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingTop: 8,
  },
  quickAction: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  quickActionText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  connectPrompt: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  connectPromptText: {
    fontSize: 14,
    color: '#888',
  },
  switchRolePrompt: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  switchRoleText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '500',
  },
})
