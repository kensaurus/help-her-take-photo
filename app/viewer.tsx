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
import { profileApi } from '../src/services/api'

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
import { pairingApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { webrtcService, webrtcAvailable } from '../src/services/webrtc'

const QUICK_CONNECT_KEY = 'quick_connect_mode'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Compact direction chip button
function DirectionChip({ 
  label, 
  icon,
  onPress 
}: { 
  label: string
  icon: string
  onPress: () => void 
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable 
      onPress={() => {
        scale.value = withSequence(
          withSpring(0.9, { damping: 15 }),
          withSpring(1, { damping: 15 })
        )
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
    >
      <Animated.View style={[styles.directionChip, animatedStyle]}>
        <Text style={styles.directionChipIcon}>{icon}</Text>
        <Text style={styles.directionChipLabel}>{label}</Text>
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
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing, partnerDisplayName, partnerAvatar, setPartnerInfo } = usePairingStore()
  const { t } = useLanguageStore()
  
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
      sessionLogger.info('viewer_screen_opened', { role: 'director', pairedDeviceId })
    }
    return () => {
      sessionLogger.info('viewer_screen_closed')
    }
  }, [myDeviceId, sessionId, pairedDeviceId])

  // Fetch partner profile if not available
  useEffect(() => {
    if (isPaired && pairedDeviceId && !partnerDisplayName) {
      profileApi.get(pairedDeviceId).then(({ profile }) => {
        if (profile) {
          setPartnerInfo(profile.display_name, profile.avatar_emoji)
          sessionLogger.info('partner_profile_loaded', { 
            partnerName: profile.display_name,
            partnerDeviceId: pairedDeviceId 
          })
        }
      }).catch((err) => {
        sessionLogger.warn('partner_profile_fetch_failed', { error: err?.message })
      })
    }
  }, [isPaired, pairedDeviceId, partnerDisplayName, setPartnerInfo])

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

      sessionLogger.info('starting_webrtc_as_director', {
        myDeviceId,
        pairedDeviceId,
        sessionId,
      })
      setIsConnected(true)
      
      webrtcService.init(
        myDeviceId,
        pairedDeviceId,
        sessionId,
        'director',
        {
          onRemoteStream: (stream) => {
            // Detailed logging for debugging blank screen issues
            const videoTracks = stream?.getVideoTracks?.() ?? []
            const audioTracks = stream?.getAudioTracks?.() ?? []
            
            sessionLogger.info('director_remote_stream_received', {
              trackCount: stream?.getTracks?.()?.length ?? 0,
              videoTrackCount: videoTracks.length,
              audioTrackCount: audioTracks.length,
              streamId: stream?.id?.substring(0, 8),
              streamActive: stream?.active,
              // Log first video track details if present
              videoTrackEnabled: videoTracks[0]?.enabled,
              videoTrackMuted: videoTracks[0]?.muted,
              videoTrackReadyState: videoTracks[0]?.readyState,
            })
            
            // Validate stream has video tracks before setting
            if (videoTracks.length === 0) {
              sessionLogger.warn('director_no_video_tracks_in_stream', {
                message: 'Remote stream has no video tracks - will show blank screen',
              })
            }
            
            setRemoteStream(stream)
            setIsReceiving(true)
          },
          onConnectionStateChange: (state) => {
            sessionLogger.info('director_webrtc_state', { 
              connectionState: state,
              role: 'director',
            })
            setConnectionState(state)
            if (state === 'failed' || state === 'disconnected') {
              setIsReceiving(false)
              setRemoteStream(null)
            }
          },
          onError: (error) => {
            sessionLogger.error('director_webrtc_error', error, {
              role: 'director',
              myDeviceId,
              pairedDeviceId,
            })
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
            const videoTracks = stream?.getVideoTracks?.() ?? []
            sessionLogger.info('director_remote_stream_received_refresh', {
              trackCount: stream?.getTracks?.()?.length ?? 0,
              videoTrackCount: videoTracks.length,
              streamId: stream?.id?.substring(0, 8),
              videoTrackEnabled: videoTracks[0]?.enabled,
            })
            setRemoteStream(stream)
            setIsReceiving(true)
          },
          onConnectionStateChange: (state) => {
            sessionLogger.info('director_webrtc_state_refresh', { 
              connectionState: state,
              role: 'director',
            })
            setConnectionState(state)
          },
          onError: (error) => {
            sessionLogger.error('director_webrtc_error_refresh', error, {
              role: 'director',
            })
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
      {/* Simple back navigation */}
      <View style={styles.headerNav}>
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
          {isPaired && (
            <View style={styles.partnerCard}>
              <Text style={styles.partnerEmoji}>{partnerAvatar || '📸'}</Text>
              <View style={styles.partnerInfo}>
                <Text style={styles.partnerLabel}>
                  Connected to {partnerDisplayName || 'Photographer'}
                </Text>
                <Text style={styles.partnerStatus}>
                  {isReceiving ? '🟢 Streaming' : connectionState}
                </Text>
              </View>
            </View>
          )}
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
                    {/* 
                      RTCView key prop forces re-render when stream changes
                      This fixes blank screen issues where RTCView doesn't update
                    */}
                    <RTCView
                      key={remoteStream?.id || 'remote-stream'}
                      streamURL={remoteStream.toURL()}
                      style={StyleSheet.absoluteFill}
                      objectFit="cover"
                      mirror={false}
                      zOrder={0}
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

        {/* Direction controls - Compact chip-style */}
        {isConnected && (
          <Animated.View entering={FadeIn} style={styles.controlsSection}>
            <Text style={styles.sectionLabel}>Quick Commands</Text>
            
            {/* Direction chips - horizontal scroll */}
            <View style={styles.directionChipsRow}>
              <DirectionChip 
                label="Left" 
                icon="←"
                onPress={() => sendDirection('left')} 
              />
              <DirectionChip 
                label="Right" 
                icon="→"
                onPress={() => sendDirection('right')} 
              />
              <DirectionChip 
                label="Up" 
                icon="↑"
                onPress={() => sendDirection('up')} 
              />
              <DirectionChip 
                label="Down" 
                icon="↓"
                onPress={() => sendDirection('down')} 
              />
            </View>

            {/* Zoom chips */}
            <View style={styles.directionChipsRow}>
              <DirectionChip 
                label="Closer" 
                icon="🔍"
                onPress={() => sendDirection('closer')} 
              />
              <DirectionChip 
                label="Back" 
                icon="🔎"
                onPress={() => sendDirection('back')} 
              />
            </View>

            {/* Take photo - prominent floating button */}
            <TakePhotoButton onPress={handleTakePhoto} />
          </Animated.View>
        )}

        {/* Switch role button - prominent action */}
        {isPaired && (
          <View style={styles.switchRoleSection}>
            <Pressable 
              style={styles.switchRoleBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                webrtcService.destroy()
                router.replace('/camera')
              }}
              accessibilityLabel="Switch to Photographer mode"
              accessibilityHint="Change your role to take photos"
              accessibilityRole="button"
            >
              <Text style={styles.switchRoleIcon}>📸</Text>
              <Text style={styles.switchRoleText}>Switch to Photographer</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
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
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 12,
  },
  partnerEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  partnerStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
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
  directionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  directionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  directionChipIcon: {
    fontSize: 16,
    color: '#1a1a1a',
  },
  directionChipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  takePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 50,
    gap: 12,
    marginTop: 8,
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  takePhotoBtnIcon: {
    fontSize: 22,
  },
  takePhotoBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  switchRoleSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  switchRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  switchRoleIcon: {
    fontSize: 20,
  },
  switchRoleText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
})
