/**
 * Viewer / Director Mode - Where she takes control
 * Now with real WebRTC video streaming
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Dimensions,
  RefreshControl,
  ScrollView,
  Alert,
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
  withRepeat,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usePairingStore } from '../src/stores/pairingStore'

// Dynamically import RTCView to handle Expo Go gracefully
let RTCView: any = null
let MediaStream: any = null
try {
  const webrtc = require('react-native-webrtc')
  RTCView = webrtc.RTCView
  MediaStream = webrtc.MediaStream
} catch {
  // WebRTC not available (Expo Go)
}
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { pairingApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { webrtcService, webrtcAvailable } from '../src/services/webrtc'

const QUICK_CONNECT_KEY = 'quick_connect_mode'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Direction button with big touch target
function DirectionButton({ 
  label, 
  direction,
  onPress 
}: { 
  label: string
  direction: 'left' | 'right' | 'up' | 'down' | 'closer' | 'back'
  onPress: () => void 
}) {
  const scale = useSharedValue(1)
  const [pressed, setPressed] = useState(false)
  
  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.9, { damping: 15 }),
      withSpring(1, { damping: 15 })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setPressed(true)
    setTimeout(() => setPressed(false), 300)
    onPress()
  }
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const arrows: Record<string, string> = {
    left: '←',
    right: '→',
    up: '↑',
    down: '↓',
    closer: '⊕',
    back: '⊖',
  }

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[
        styles.directionBtn,
        pressed && styles.directionBtnPressed,
        animatedStyle
      ]}>
        <Text style={styles.directionArrow}>{arrows[direction]}</Text>
        <Text style={[styles.directionLabel, pressed && styles.directionLabelPressed]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

// Take photo button
function TakePhotoButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1)
  
  // Subtle pulse
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1
    )
  }, [scale])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable 
      onPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        onPress()
      }}
    >
      <Animated.View style={[styles.takePhotoBtn, animatedStyle]}>
        <Text style={styles.takePhotoBtnIcon}>📸</Text>
        <Text style={styles.takePhotoBtnText}>Perfect! Take it!</Text>
      </Animated.View>
    </Pressable>
  )
}

// Sent indicator
function SentIndicator({ message }: { message: string }) {
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.sentIndicator}
    >
      <Text style={styles.sentText}>✓ {message}</Text>
    </Animated.View>
  )
}

export default function ViewerScreen() {
  const router = useRouter()
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing } = usePairingStore()
  const { t } = useLanguageStore()
  const { stats } = useStatsStore()
  
  // Handle disconnect
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
  
  const [isConnected, setIsConnected] = useState(false)
  const [isReceiving, setIsReceiving] = useState(false)
  const [remoteStream, setRemoteStream] = useState<any>(null)
  const [connectionState, setConnectionState] = useState<string>('disconnected')
  const [webrtcError, setWebrtcError] = useState<string | null>(null)
  const [lastCommand, setLastCommand] = useState('')
  const [showSent, setShowSent] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Initialize logging
  useEffect(() => {
    if (myDeviceId) {
      sessionLogger.init(myDeviceId, sessionId ?? undefined)
      sessionLogger.info('viewer_screen_opened')
    }
    return () => {
      sessionLogger.info('viewer_screen_closed')
    }
  }, [myDeviceId, sessionId])

  // Initialize WebRTC when paired
  useEffect(() => {
    if (isPaired && myDeviceId && pairedDeviceId && sessionId) {
      // Check if WebRTC is available
      if (!webrtcAvailable) {
        sessionLogger.warn('webrtc_not_available_viewer')
        setWebrtcError('Video streaming requires a development build. Expo Go does not support WebRTC.')
        setIsConnected(true) // Mark as "connected" for UI purposes
        return
      }

      sessionLogger.info('starting_webrtc_as_director')
      setIsConnected(true)
      
      webrtcService.init(
        myDeviceId,
        pairedDeviceId,
        sessionId,
        'director',
        {
          onRemoteStream: (stream) => {
            sessionLogger.info('remote_stream_received')
            setRemoteStream(stream)
            setIsReceiving(true)
          },
          onConnectionStateChange: (state) => {
            sessionLogger.info('webrtc_state', { state })
            setConnectionState(state)
            if (state === 'failed' || state === 'disconnected') {
              setIsReceiving(false)
              setRemoteStream(null)
            }
          },
          onError: (error) => {
            sessionLogger.error('webrtc_error', error)
            setWebrtcError(error.message)
          },
        }
      )

      return () => {
        webrtcService.destroy()
        setIsConnected(false)
        setIsReceiving(false)
        setRemoteStream(null)
      }
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId])

  // Quick Connect: Auto-disconnect when leaving viewer
  useEffect(() => {
    return () => {
      // Cleanup function runs when component unmounts
      (async () => {
        try {
          const quickConnectMode = await AsyncStorage.getItem(QUICK_CONNECT_KEY)
          if (quickConnectMode === 'true' && myDeviceId) {
            // Auto-disconnect for quick connect mode
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

  const sendDirection = async (direction: keyof typeof t.viewer.directions) => {
    setLastCommand(t.viewer.directions[direction])
    setShowSent(true)
    setTimeout(() => setShowSent(false), 1500)
    
    // Send command via WebRTC
    await webrtcService.sendCommand('direction', { direction })
    sessionLogger.info('direction_sent', { direction })
  }

  const handleTakePhoto = async () => {
    setLastCommand(t.viewer.takePhoto)
    setShowSent(true)
    setTimeout(() => setShowSent(false), 2000)
    
    // Send capture command via WebRTC
    await webrtcService.sendCommand('capture')
    sessionLogger.info('capture_command_sent')
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    sessionLogger.info('viewer_refresh_triggered')
    
    // Reconnect WebRTC
    if (isPaired && myDeviceId && pairedDeviceId && sessionId) {
      await webrtcService.destroy()
      setIsReceiving(false)
      setRemoteStream(null)
      
      // Small delay before reconnecting
      await new Promise(r => setTimeout(r, 500))
      
      webrtcService.init(
        myDeviceId,
        pairedDeviceId,
        sessionId,
        'director',
        {
          onRemoteStream: (stream) => {
            sessionLogger.info('remote_stream_received')
            setRemoteStream(stream)
            setIsReceiving(true)
          },
          onConnectionStateChange: (state) => {
            sessionLogger.info('webrtc_state', { state })
            setConnectionState(state)
          },
          onError: (error) => {
            sessionLogger.error('webrtc_error', error)
          },
        }
      )
    }
    
    setRefreshing(false)
  }

  // Funny waiting messages
  const waitingMessages = [
    "Waiting for his camera feed... 📡",
    "He's probably holding it upside down",
    "Connection buffering... like his brain",
    "Any second now... (optimistic estimate)",
  ]
  const [waitingMsgIndex, setWaitingMsgIndex] = useState(0)
  
  useEffect(() => {
    if (!isReceiving) {
      const interval = setInterval(() => {
        setWaitingMsgIndex(i => (i + 1) % waitingMessages.length)
      }, 3000)
      return () => clearInterval(interval)
    }
  }, [isReceiving, waitingMessages.length])

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Close button */}
      <View style={styles.headerButtons}>
        <Pressable 
          style={styles.backButton}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.back()
          }}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        
        {isPaired && (
          <Pressable 
            style={styles.disconnectButton}
            onPress={handleDisconnect}
            accessibilityLabel="Disconnect"
            accessibilityRole="button"
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1a1a1a"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t.viewer.title}</Text>
          <Text style={styles.subtitle}>{t.viewer.subtitle}</Text>
        </View>

        {/* Preview area */}
        <View style={styles.previewSection}>
          <View style={styles.previewContainer}>
            {isConnected ? (
              <View style={styles.preview}>
                {webrtcError ? (
                  <View style={styles.waitingPreview}>
                    <Text style={styles.waitingEmoji}>📱</Text>
                    <Text style={styles.waitingText}>
                      {webrtcError}
                    </Text>
                    <Text style={styles.connectionStatus}>
                      Commands still work! Use the direction buttons below.
                    </Text>
                  </View>
                ) : isReceiving && remoteStream && RTCView ? (
                  <View style={styles.livePreview}>
                    <RTCView
                      streamURL={remoteStream.toURL()}
                      style={StyleSheet.absoluteFill}
                      objectFit="cover"
                      mirror={false}
                    />
                    <View style={styles.liveOverlay}>
                      <Text style={styles.liveLabel}>🔴 {t.viewer.livePreview}</Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.waitingPreview}>
                    <Text style={styles.waitingEmoji}>👀</Text>
                    <Text style={styles.waitingText}>
                      {waitingMessages[waitingMsgIndex]}
                    </Text>
                    <Text style={styles.connectionStatus}>
                      Status: {connectionState}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Pressable 
                style={styles.connectPreview}
                onPress={() => router.push('/pairing')}
              >
                <Text style={styles.connectEmoji}>🔗</Text>
                <Text style={styles.connectText}>{t.viewer.notConnected}</Text>
                <Text style={styles.connectHint}>{t.viewer.connectPrompt}</Text>
              </Pressable>
            )}
          </View>
          
          {/* Sent indicator */}
          {showSent && <SentIndicator message={lastCommand} />}
        </View>

        {/* Direction controls */}
        {isConnected && (
          <Animated.View entering={FadeIn} style={styles.controlsSection}>
            <Text style={styles.sectionLabel}>{t.viewer.giveDirections}</Text>
            
            {/* Directional pad */}
            <View style={styles.directionGrid}>
              <View style={styles.directionRow}>
                <View style={styles.directionSpacer} />
                <DirectionButton 
                  label={t.viewer.directions.up} 
                  direction="up"
                  onPress={() => sendDirection('up')} 
                />
                <View style={styles.directionSpacer} />
              </View>
              
              <View style={styles.directionRow}>
                <DirectionButton 
                  label={t.viewer.directions.left} 
                  direction="left"
                  onPress={() => sendDirection('left')} 
                />
                <View style={styles.directionCenter} />
                <DirectionButton 
                  label={t.viewer.directions.right} 
                  direction="right"
                  onPress={() => sendDirection('right')} 
                />
              </View>
              
              <View style={styles.directionRow}>
                <View style={styles.directionSpacer} />
                <DirectionButton 
                  label={t.viewer.directions.down} 
                  direction="down"
                  onPress={() => sendDirection('down')} 
                />
                <View style={styles.directionSpacer} />
              </View>
            </View>

            {/* Zoom controls */}
            <View style={styles.zoomRow}>
              <DirectionButton 
                label={t.viewer.directions.closer} 
                direction="closer"
                onPress={() => sendDirection('closer')} 
              />
              <DirectionButton 
                label={t.viewer.directions.back} 
                direction="back"
                onPress={() => sendDirection('back')} 
              />
            </View>

            {/* Take photo button */}
            <View style={styles.takePhotoSection}>
              <TakePhotoButton onPress={handleTakePhoto} />
            </View>
          </Animated.View>
        )}

        {/* Stats */}
        <View style={styles.statsSection}>
          <Text style={styles.statsText}>
            🛡️ {stats.scoldingsSaved} {t.profile.scoldingsSaved}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  disconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fee2e2',
    borderRadius: 6,
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
  },
  previewSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  previewContainer: {
    aspectRatio: 3 / 4,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  preview: {
    flex: 1,
  },
  livePreview: {
    flex: 1,
    position: 'relative',
  },
  liveOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
  },
  liveLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  connectionStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  waitingPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  waitingEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  waitingText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  connectPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  connectEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  connectText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  connectHint: {
    fontSize: 14,
    color: '#888',
  },
  sentIndicator: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    borderRadius: 4,
    alignItems: 'center',
  },
  sentText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  controlsSection: {
    paddingHorizontal: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  directionGrid: {
    alignItems: 'center',
    marginBottom: 16,
  },
  directionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionSpacer: {
    width: 80,
    height: 70,
  },
  directionCenter: {
    width: 20,
    height: 70,
  },
  directionBtn: {
    width: 80,
    height: 70,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  directionBtnPressed: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  directionArrow: {
    fontSize: 24,
    color: '#1a1a1a',
  },
  directionLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  directionLabelPressed: {
    color: '#fff',
  },
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  takePhotoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  takePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 4,
    gap: 12,
  },
  takePhotoBtnIcon: {
    fontSize: 24,
  },
  takePhotoBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statsSection: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  statsText: {
    fontSize: 14,
    color: '#888',
  },
})
