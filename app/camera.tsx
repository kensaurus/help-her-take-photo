/**
 * Camera - The photographer's view
 * Uses expo-camera for preview, Supabase Realtime for commands
 * NO WebRTC video streaming (causes conflicts)
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
import { usePairingStore } from '../src/stores/pairingStore'
import { useSettingsStore } from '../src/stores/settingsStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Icon } from '../src/components/ui/Icon'
import { pairingApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { supabase } from '../src/services/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

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
function CaptureButton({ onPress, isConnected }: { onPress: () => void; isConnected: boolean }) {
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
      accessibilityRole="button"
    >
      <Animated.View style={[styles.captureOuter, outerStyle]}>
        <Animated.View style={[
          styles.captureInner,
          isConnected && styles.captureInnerConnected,
          innerStyle
        ]} />
      </Animated.View>
    </Pressable>
  )
}

// Permission denied view
function PermissionDenied({ 
  onRequestPermission,
  colors,
  onBack,
}: { 
  onRequestPermission: () => void
  colors: any 
  onBack: () => void
}) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <Pressable style={styles.backButtonTop} onPress={onBack}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>
      
      <Animated.View entering={FadeIn.duration(400)} style={styles.permissionContainer}>
        <View style={[styles.permissionIcon, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name="camera" size={48} color={colors.textMuted} />
        </View>
        
        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          Camera Access Required
        </Text>
        
        <Text style={[styles.permissionDesc, { color: colors.textSecondary }]}>
          We need camera access to take photos. Your photos stay on your device.
        </Text>
        
        <Pressable
          style={[styles.permissionButton, { backgroundColor: colors.primary }]}
          onPress={onRequestPermission}
        >
          <Text style={[styles.permissionButtonText, { color: colors.primaryText }]}>
            Enable Camera
          </Text>
        </Pressable>
        
        <Pressable style={styles.settingsLink} onPress={() => Linking.openSettings()}>
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
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [facing, setFacing] = useState<CameraType>('back')
  const [isConnected, setIsConnected] = useState(false)
  const [photoCount, setPhotoCount] = useState(0)
  const [showEncouragement, setShowEncouragement] = useState(false)
  const [encouragement, setEncouragement] = useState('')
  const [lastCommand, setLastCommand] = useState<string | null>(null)
  
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

  // Subscribe to commands channel (no WebRTC, just signaling)
  useEffect(() => {
    if (!isPaired || !sessionId || !myDeviceId) return

    const channelName = `commands:${sessionId}`
    sessionLogger.info('subscribing_to_commands', { channelName })
    
    const channel = supabase.channel(channelName)
    
    channel
      .on('broadcast', { event: 'command' }, (payload) => {
        const { to, command, data } = payload.payload as {
          from: string
          to: string
          command: string
          data?: Record<string, unknown>
        }
        
        // Only process commands for this device
        if (to !== myDeviceId) return
        
        sessionLogger.info('command_received', { command, data })
        handleCommand(command, data)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const partnerOnline = Object.keys(state).some(key => 
          state[key].some((p: any) => p.deviceId === pairedDeviceId)
        )
        setIsConnected(partnerOnline)
        sessionLogger.info('presence_sync', { partnerOnline })
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Track presence
          await channel.track({ deviceId: myDeviceId, role: 'camera' })
          sessionLogger.info('channel_subscribed', { channelName })
        }
      })
    
    channelRef.current = channel
    
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [isPaired, sessionId, myDeviceId, pairedDeviceId])

  // Handle commands from director
  const handleCommand = (command: string, data?: Record<string, unknown>) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    setLastCommand(command)
    setTimeout(() => setLastCommand(null), 2000)
    
    switch (command) {
      case 'capture':
        handleCapture()
        break
      case 'flip':
        setFacing(f => f === 'back' ? 'front' : 'back')
        showMessage('📱 Camera flipped!')
        break
      case 'up':
        showMessage('⬆️ Move UP')
        break
      case 'down':
        showMessage('⬇️ Move DOWN')
        break
      case 'left':
        showMessage('⬅️ Move LEFT')
        break
      case 'right':
        showMessage('➡️ Move RIGHT')
        break
      case 'perfect':
        showMessage('✨ Perfect! Hold still!')
        break
    }
  }

  const showMessage = (msg: string) => {
    setEncouragement(msg)
    setShowEncouragement(true)
    setTimeout(() => setShowEncouragement(false), 2000)
  }

  const handleRequestPermission = async () => {
    const result = await requestPermission()
    if (!result.granted) {
      Alert.alert(
        'Permission Required',
        'Please enable camera access in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      )
    }
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  // Loading / Permission denied states
  if (!permission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <Pressable style={styles.backButtonTop} onPress={handleBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingEmoji}>📷</Text>
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            Checking permissions...
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <PermissionDenied 
        onRequestPermission={handleRequestPermission}
        colors={colors}
        onBack={handleBack}
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
    if (!cameraRef.current) return
    
    try {
      sessionLogger.info('capture_started')
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      })
      
      if (photo) {
        setPhotoCount(prev => prev + 1)
        incrementPhotos()
        showRandomEncouragement()
        sessionLogger.info('capture_success', { uri: photo.uri })
        
        // Save to library
        if (settings.autoSave) {
          try {
            await MediaLibrary.createAssetAsync(photo.uri)
            sessionLogger.info('photo_saved')
          } catch (saveError) {
            sessionLogger.error('photo_save_failed', saveError)
          }
        }

        // Notify director
        if (channelRef.current && pairedDeviceId) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'status',
            payload: { from: myDeviceId, to: pairedDeviceId, status: 'photo_taken', count: photoCount + 1 }
          })
        }
      }
    } catch (error) {
      sessionLogger.error('capture_failed', error)
      Alert.alert('Capture Failed', 'Could not take photo. Please try again.')
    }
  }

  const toggleCameraFacing = () => {
    setFacing(f => f === 'back' ? 'front' : 'back')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `📸 HelpHer - I've avoided ${stats.scoldingsSaved} scoldings so far!`,
      })
    } catch {}
  }

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect',
      'End this session and go back?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Disconnect', 
          style: 'destructive',
          onPress: async () => {
            sessionLogger.info('manual_disconnect')
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Close button */}
      <Pressable style={styles.closeButton} onPress={handleBack}>
        <Text style={styles.closeButtonText}>✕</Text>
      </Pressable>

      {/* Camera preview - expo-camera only, no WebRTC */}
      <View style={styles.cameraPreview}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          onCameraReady={() => sessionLogger.info('camera_ready')}
        />
        
        {settings.showGrid && <GridOverlay />}
        
        {/* Status bar */}
        <Pressable style={styles.statusBar} onLongPress={handleDisconnect}>
          <View style={[
            styles.statusDot, 
            isConnected ? styles.statusDotConnected : 
            isPaired ? styles.statusDotPaired : styles.statusDotOff
          ]} />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusText}>
              {isConnected ? '🟢 Director Online' : isPaired ? '🟡 Waiting for Director' : '⚪ Not Connected'}
            </Text>
            {isPaired && (
              <Text style={styles.partnerText}>
                Session: {sessionId?.slice(0, 8)}...
              </Text>
            )}
          </View>
        </Pressable>
        
        {/* Photo count */}
        <View style={styles.photoCount}>
          <Text style={styles.photoCountText}>📷 {photoCount}</Text>
        </View>

        {/* Command overlay */}
        {lastCommand && (
          <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.commandOverlay}>
            <Text style={styles.commandText}>📍 {lastCommand.toUpperCase()}</Text>
          </Animated.View>
        )}
        
        <EncouragementToast message={encouragement} visible={showEncouragement} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.captureRow}>
          <CaptureButton onPress={handleCapture} isConnected={isConnected} />
        </View>

        <View style={styles.bottomControls}>
          <Pressable 
            style={styles.quickAction}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              updateSettings({ showGrid: !settings.showGrid })
            }}
          >
            <Text style={styles.quickActionText}>⊞</Text>
            <Text style={styles.quickActionLabel}>{settings.showGrid ? 'Grid On' : 'Grid'}</Text>
          </Pressable>
          
          <Pressable style={styles.quickAction} onPress={toggleCameraFacing}>
            <Text style={styles.quickActionText}>🔄</Text>
            <Text style={styles.quickActionLabel}>Flip</Text>
          </Pressable>
          
          <Pressable 
            style={styles.quickAction}
            onPress={() => router.push('/gallery')}
          >
            <Text style={styles.quickActionText}>🖼️</Text>
            <Text style={styles.quickActionLabel}>Gallery</Text>
          </Pressable>

          <Pressable style={styles.quickAction} onPress={handleShare}>
            <Text style={styles.quickActionText}>↗️</Text>
            <Text style={styles.quickActionLabel}>Share</Text>
          </Pressable>
        </View>

        {!isPaired && (
          <Pressable 
            style={styles.connectPrompt}
            onPress={() => router.push('/pairing')}
          >
            <Text style={styles.connectPromptText}>🔗 Connect with partner to receive directions</Text>
          </Pressable>
        )}

        {isPaired && (
          <Pressable 
            style={styles.switchRolePrompt}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              router.replace('/viewer')
            }}
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
    backgroundColor: 'rgba(255,255,255,0.3)',
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotConnected: {
    backgroundColor: '#22C55E',
  },
  statusDotPaired: {
    backgroundColor: '#EAB308',
  },
  statusDotOff: {
    backgroundColor: '#6B7280',
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
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  photoCount: {
    position: 'absolute',
    top: 16,
    right: 60,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  photoCountText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  commandOverlay: {
    position: 'absolute',
    top: '40%',
    left: 20,
    right: 20,
    backgroundColor: 'rgba(34, 197, 94, 0.95)',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  commandText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  controls: {
    backgroundColor: '#000',
    paddingBottom: 32,
  },
  captureRow: {
    alignItems: 'center',
    paddingVertical: 24,
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
  captureInnerConnected: {
    backgroundColor: '#22C55E',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  quickAction: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  quickActionText: {
    fontSize: 26,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
  },
  connectPrompt: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  connectPromptText: {
    fontSize: 14,
    color: '#aaa',
  },
  switchRolePrompt: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  switchRoleText: {
    fontSize: 14,
    color: '#aaa',
    fontWeight: '600',
  },
})
