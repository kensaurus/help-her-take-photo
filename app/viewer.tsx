/**
 * Viewer / Director Mode - Minimal Zen UI
 * Clean, professional interface with subtle controls
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Dimensions,
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
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { profileApi, connectionHistoryApi } from '../src/services/api'

// Dynamically import video components
let RTCView: any = null
let LiveKitVideoView: any = null
try {
  const webrtc = require('react-native-webrtc')
  RTCView = webrtc.RTCView
} catch {
  // WebRTC not available (Expo Go)
}
try {
  const livekit = require('@livekit/react-native')
  LiveKitVideoView = livekit.VideoView
} catch {
  // LiveKit not available
}
import { useLanguageStore } from '../src/stores/languageStore'
import { pairingApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { webrtcService, webrtcAvailable } from '../src/services/webrtc'
import { livekitService, isLiveKitAvailable } from '../src/services/livekit'

// LiveKit temporarily disabled - native packages conflict
// Use WebRTC until LiveKit build issues are resolved
const USE_LIVEKIT = false

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// Minimal direction button with accessibility
function DirectionButton({ 
  icon,
  onPress,
  style,
  label,
}: { 
  icon: string
  onPress: () => void 
  style?: any
  label?: string
}) {
  const opacity = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const getDirectionLabel = () => {
    if (label) return label
    switch (icon) {
      case '↑': return 'Move up'
      case '↓': return 'Move down'
      case '←': return 'Move left'
      case '→': return 'Move right'
      default: return 'Direction'
    }
  }

  return (
    <Pressable 
      onPress={() => {
        opacity.value = withTiming(0.5, { duration: 50 })
        setTimeout(() => {
          opacity.value = withTiming(1, { duration: 150 })
        }, 50)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      style={[styles.dirBtn, style]}
      accessibilityLabel={getDirectionLabel()}
      accessibilityRole="button"
      accessibilityHint="Sends direction command to photographer"
    >
      <Animated.Text style={[styles.dirBtnText, animatedStyle]}>{icon}</Animated.Text>
    </Pressable>
  )
}

// Minimal capture button with accessibility
function CaptureButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable 
      onPress={() => {
        scale.value = withSpring(0.92, { damping: 15 })
        setTimeout(() => {
          scale.value = withSpring(1, { damping: 12 })
        }, 100)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        onPress()
      }}
      style={styles.captureBtn}
      accessibilityLabel="Take photo"
      accessibilityRole="button"
      accessibilityHint="Sends capture command to photographer"
    >
      <Animated.View style={[styles.captureBtnInner, animatedStyle]}>
        <View style={styles.captureBtnRing} />
      </Animated.View>
    </Pressable>
  )
}

// Sent indicator - minimal
function SentIndicator({ message }: { message: string }) {
  return (
    <Animated.View 
      entering={FadeIn.duration(150)} 
      exiting={FadeOut.duration(150)}
      style={styles.sentIndicator}
    >
      <Text style={styles.sentText}>{message}</Text>
    </Animated.View>
  )
}

// Toast notification for role switch request
function RoleSwitchToast({ visible, partnerName }: { visible: boolean; partnerName: string }) {
  if (!visible) return null
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.switchToast}
    >
      <Text style={styles.switchToastText}>
        {partnerName} wants to be Director
      </Text>
    </Animated.View>
  )
}

export default function ViewerScreen() {
  const router = useRouter()
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing, partnerDisplayName, partnerAvatar, setPartnerInfo, setPartnerPresence } = usePairingStore()
  const { t } = useLanguageStore()
  const partnerNameRef = useRef(partnerDisplayName)

  useEffect(() => {
    partnerNameRef.current = partnerDisplayName
  }, [partnerDisplayName])

  const handleDisconnect = async () => {
    Alert.alert(
      'End Session',
      'Disconnect and go back?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End', 
          style: 'destructive',
          onPress: async () => {
            sessionLogger.info('manual_disconnect')
            webrtcService.destroy()
            if (myDeviceId) {
              await pairingApi.unpair(myDeviceId)
              await connectionHistoryApi.disconnectAll(myDeviceId)
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
  const [remoteTrack, setRemoteTrack] = useState<any>(null) // LiveKit video track
  const [connectionState, setConnectionState] = useState<string>('disconnected')
  const [webrtcError, setWebrtcError] = useState<string | null>(null)
  const [lastCommand, setLastCommand] = useState('')
  const [showSent, setShowSent] = useState(false)
  const [partnerOnline, setPartnerOnline] = useState<boolean | null>(null)
  const [showSwitchToast, setShowSwitchToast] = useState(false)
  const [usingLiveKit, setUsingLiveKit] = useState(USE_LIVEKIT && isLiveKitAvailable)
  
  // Ref to track if we should poll for stream
  const streamCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (myDeviceId) {
      sessionLogger.init(myDeviceId, sessionId ?? undefined)
      sessionLogger.info('viewer_screen_opened', { role: 'director', pairedDeviceId })
    }
    return () => {
      sessionLogger.info('viewer_screen_closed')
    }
  }, [myDeviceId, sessionId, pairedDeviceId])

  useEffect(() => {
    if (isPaired && pairedDeviceId && !partnerDisplayName) {
      profileApi.get(pairedDeviceId).then(({ profile }) => {
        if (profile) {
          setPartnerInfo(profile.display_name, profile.avatar_emoji)
        }
      }).catch(() => {})
    }
  }, [isPaired, pairedDeviceId, partnerDisplayName, setPartnerInfo])

  // Periodic check for remote stream - workaround for callback not firing
  useEffect(() => {
    if (connectionState === 'connected' && !isReceiving) {
      sessionLogger.info('starting_stream_poll', { connectionState, isReceiving })
      
      streamCheckIntervalRef.current = setInterval(() => {
        const stream = webrtcService.getRemoteStream()
        if (stream) {
          const videoTracks = stream.getVideoTracks?.() ?? []
          sessionLogger.info('poll_found_remote_stream', {
            streamId: stream.id?.substring(0, 8),
            videoTracks: videoTracks.length,
            active: stream.active,
          })
          if (videoTracks.length > 0) {
            setRemoteStream(stream)
            setIsReceiving(true)
            // Clear interval once stream is found
            if (streamCheckIntervalRef.current) {
              clearInterval(streamCheckIntervalRef.current)
              streamCheckIntervalRef.current = null
            }
          }
        }
      }, 500)
      
      return () => {
        if (streamCheckIntervalRef.current) {
          clearInterval(streamCheckIntervalRef.current)
          streamCheckIntervalRef.current = null
        }
      }
    }
  }, [connectionState, isReceiving])

  useEffect(() => {
    if (isPaired && myDeviceId && pairedDeviceId && sessionId) {
      // Check if video streaming is available
      const canUseLiveKit = USE_LIVEKIT && isLiveKitAvailable
      const canUseWebRTC = webrtcAvailable
      
      if (!canUseLiveKit && !canUseWebRTC) {
        setWebrtcError('Video streaming requires a development build.')
        setIsConnected(true)
        return
      }

      const streamingMethod = canUseLiveKit ? 'livekit' : 'webrtc'
      setUsingLiveKit(canUseLiveKit)
      
      sessionLogger.info('starting_video_as_director', { 
        method: streamingMethod,
        myDeviceId, 
        pairedDeviceId, 
        sessionId 
      })
      sessionLogger.flush()
      setIsConnected(true)
      
      let isActive = true
      let initDelayId: ReturnType<typeof setTimeout> | null = null
      
      connectionHistoryApi.recordConnection({
        deviceId: myDeviceId,
        partnerDeviceId: pairedDeviceId,
        partnerDisplayName: partnerDisplayName || undefined,
        partnerAvatar: partnerAvatar || '•',
        sessionId,
        role: 'director',
        initiatedBy: 'self',
      }).catch(() => {})
      
      const presenceSub = connectionHistoryApi.subscribeToSessionPresence({
        sessionId,
        myDeviceId,
        partnerDeviceId: pairedDeviceId,
        onPartnerOnlineChange: (isOnline) => {
          sessionLogger.info('partner_presence_changed', { partnerDeviceId: pairedDeviceId, isOnline })
          setPartnerPresence(isOnline)
          setPartnerOnline(isOnline)
        },
        onError: (message) => {
          sessionLogger.warn('presence_error', { message })
        },
      })
      
      initDelayId = setTimeout(async () => {
        if (!isActive) return
        
        // Command handler for both LiveKit and WebRTC
        const handleCommand = (command: string, data?: Record<string, unknown>) => {
          if (!isActive) return
          if (command === 'switch_role' && data?.newRole === 'photographer') {
            sessionLogger.info('switch_role_received', { newRole: 'photographer' })
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
            setShowSwitchToast(true)
            setTimeout(async () => {
              if (canUseLiveKit) {
                await livekitService.destroy()
              } else {
                await webrtcService.destroy()
              }
              router.replace('/camera')
            }, 1500)
          }
        }
        
        if (canUseLiveKit) {
          // Use LiveKit (more reliable)
          try {
            await livekitService.init(
              myDeviceId,
              pairedDeviceId,
              sessionId,
              'director',
              {
                onRemoteTrack: (track, participant) => {
                  if (!isActive) return
                  sessionLogger.info('director_livekit_track_received', {
                    kind: track.kind,
                    participantId: participant?.identity?.substring(0, 8),
                  })
                  setRemoteTrack(track)
                  setIsReceiving(true)
                },
                onConnectionStateChange: (state) => {
                  if (!isActive) return
                  sessionLogger.info('director_livekit_state', { connectionState: state })
                  setConnectionState(state)
                  if (state === 'disconnected') {
                    setIsReceiving(false)
                  }
                },
                onError: (error) => {
                  if (!isActive) return
                  sessionLogger.error('director_livekit_error', error)
                  setWebrtcError(error.message)
                },
              }
            )
            livekitService.onCommand(handleCommand)
          } catch (error) {
            sessionLogger.error('livekit_init_failed', error as Error)
            setWebrtcError((error as Error).message)
          }
        } else {
          // Fall back to WebRTC
          webrtcService.init(
            myDeviceId,
            pairedDeviceId,
            sessionId,
            'director',
            {
              onRemoteStream: (stream) => {
                if (!isActive) return
                const videoTracks = stream?.getVideoTracks?.() ?? []
                sessionLogger.info('director_remote_stream_received', {
                  trackCount: stream?.getTracks?.()?.length ?? 0,
                  videoTrackCount: videoTracks.length,
                  streamId: stream?.id?.substring(0, 8),
                  streamActive: stream?.active,
                })
                setRemoteStream(stream)
                setIsReceiving(true)
              },
              onConnectionStateChange: (state) => {
                if (!isActive) return
                sessionLogger.info('director_webrtc_state', { connectionState: state, role: 'director' })
                setConnectionState(state)
                if (state === 'failed' || state === 'disconnected') {
                  setIsReceiving(false)
                }
              },
              onError: (error) => {
                if (!isActive) return
                sessionLogger.error('director_webrtc_error', error, { role: 'director' })
                if (!error.message?.includes('wrong state')) {
                  setWebrtcError(error.message)
                }
              },
            }
          ).then(() => {
            webrtcService.onCommand(handleCommand)
          })
        }
      }, 300)

      return () => {
        isActive = false
        if (initDelayId) clearTimeout(initDelayId)
        if (streamCheckIntervalRef.current) {
          clearInterval(streamCheckIntervalRef.current)
          streamCheckIntervalRef.current = null
        }
        if (usingLiveKit) {
          livekitService.destroy()
        } else {
          webrtcService.destroy()
        }
        setIsConnected(false)
        setIsReceiving(false)
        setRemoteStream(null)
        setRemoteTrack(null)
        void presenceSub.unsubscribe()
      }
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId, partnerDisplayName, partnerAvatar, setPartnerPresence, usingLiveKit])

  // Send command via active service (LiveKit or WebRTC)
  const sendCommand = async (command: string, data?: Record<string, unknown>) => {
    if (usingLiveKit) {
      await livekitService.sendCommand(command, data)
    } else {
      await webrtcService.sendCommand(command, data)
    }
  }

  const sendDirection = async (direction: keyof typeof t.viewer.directions) => {
    setLastCommand(t.viewer.directions[direction])
    setShowSent(true)
    setTimeout(() => setShowSent(false), 1200)
    await sendCommand('direction', { direction })
    sessionLogger.info('direction_sent', { direction })
  }

  const handleTakePhoto = async () => {
    setLastCommand('Capture')
    setShowSent(true)
    setTimeout(() => setShowSent(false), 1500)
    await sendCommand('capture')
    sessionLogger.info('capture_command_sent')
  }

  // Send flip camera command
  const handleFlipCamera = async () => {
    setLastCommand('Flip Camera')
    setShowSent(true)
    setTimeout(() => setShowSent(false), 1200)
    await sendCommand('flip')
    sessionLogger.info('flip_command_sent')
  }

  // Send flash toggle command
  const handleToggleFlash = async () => {
    setLastCommand('Toggle Flash')
    setShowSent(true)
    setTimeout(() => setShowSent(false), 1200)
    await sendCommand('flash')
    sessionLogger.info('flash_command_sent')
  }

  return (
    <View style={styles.container}>
      {/* Full screen video area */}
      <View style={styles.videoContainer}>
        {isConnected ? (
          <>
            {webrtcError ? (
              <View style={styles.waitingContainer}>
                <Text style={styles.waitingIcon}>!</Text>
                <Text style={styles.waitingText}>{webrtcError}</Text>
              </View>
            ) : isReceiving && usingLiveKit && remoteTrack && LiveKitVideoView ? (
              <View style={styles.videoWrapper}>
                <LiveKitVideoView
                  style={styles.video}
                  videoTrack={remoteTrack}
                  objectFit="cover"
                  mirror={false}
                />
              </View>
            ) : isReceiving && !usingLiveKit && remoteStream && RTCView ? (
              <View style={styles.videoWrapper}>
                <RTCView
                  key={remoteStream?.id || 'remote-stream'}
                  streamURL={remoteStream.toURL()}
                  style={styles.video}
                  objectFit="cover"
                  mirror={false}
                  zOrder={1}
                />
              </View>
            ) : (
              <View style={styles.waitingContainer}>
                <View style={styles.waitingRing}>
                  <View style={[styles.waitingDot, partnerOnline === false && styles.waitingDotOff]} />
                </View>
                <Text style={styles.waitingText}>
                  {partnerOnline === false 
                    ? 'Partner offline'
                    : connectionState === 'connected' 
                      ? 'Receiving stream...'
                      : 'Waiting for feed...'}
                </Text>
                <Text style={styles.waitingSubtext}>{connectionState}</Text>
              </View>
            )}
          </>
        ) : (
          <Pressable 
            style={styles.connectContainer}
            onPress={() => router.push('/pairing')}
          >
            <View style={styles.connectRing} />
            <Text style={styles.connectText}>Not Connected</Text>
            <Text style={styles.connectHint}>Tap to pair</Text>
          </Pressable>
        )}

        {/* Top bar - back and end buttons on sides */}
        <SafeAreaView style={styles.topBar} edges={['top']}>
          <Pressable 
            style={styles.topBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.back()
            }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Text style={styles.topBtnText}>‹</Text>
          </Pressable>
          
          {/* Spacer to push end button to right */}
          <View style={styles.topSpacer} />
          
          <Pressable 
            style={[styles.topBtn, styles.endBtn]}
            onPress={handleDisconnect}
            accessibilityLabel="End session"
            accessibilityRole="button"
          >
            <Text style={styles.endBtnText}>×</Text>
          </Pressable>
        </SafeAreaView>

        {/* Centered LIVE indicator - separate from top bar */}
        <View style={styles.liveIndicatorContainer}>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, isReceiving && styles.statusDotLive]} />
            <Text style={styles.statusText}>
              {isReceiving ? 'LIVE' : connectionState.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Partner indicator */}
        {isPaired && partnerDisplayName && (
          <View style={styles.partnerPill}>
            <Text style={styles.partnerText}>{partnerDisplayName}</Text>
          </View>
        )}

        {/* Sent indicator */}
        {showSent && <SentIndicator message={lastCommand} />}
        
        {/* Role switch toast */}
        <RoleSwitchToast visible={showSwitchToast} partnerName={partnerDisplayName || 'Partner'} />
      </View>

      {/* Controls - Minimal joypad layout */}
      <SafeAreaView style={styles.controlsContainer} edges={['bottom']}>
        <View style={styles.controls}>
          {/* Camera controls row */}
          <View style={styles.cameraControlsRow}>
            <Pressable 
              style={styles.cameraControlBtn}
              onPress={handleFlipCamera}
              accessibilityLabel="Flip camera"
              accessibilityRole="button"
            >
              <Text style={styles.cameraControlIcon}>⟲</Text>
              <Text style={styles.cameraControlLabel}>Flip</Text>
            </Pressable>
            
            <Pressable 
              style={styles.cameraControlBtn}
              onPress={handleToggleFlash}
              accessibilityLabel="Toggle flash"
              accessibilityRole="button"
            >
              <Text style={styles.cameraControlIcon}>⚡</Text>
              <Text style={styles.cameraControlLabel}>Flash</Text>
            </Pressable>
          </View>

          {/* Direction pad */}
          <View style={styles.dpad}>
            <DirectionButton icon="↑" onPress={() => sendDirection('up')} style={styles.dpadUp} />
            <View style={styles.dpadMiddle}>
              <DirectionButton icon="←" onPress={() => sendDirection('left')} />
              <CaptureButton onPress={handleTakePhoto} />
              <DirectionButton icon="→" onPress={() => sendDirection('right')} />
            </View>
            <DirectionButton icon="↓" onPress={() => sendDirection('down')} style={styles.dpadDown} />
          </View>
          
          {/* Zoom controls */}
          <View style={styles.zoomRow}>
            <Pressable 
              style={styles.zoomBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                sendDirection('closer')
              }}
              accessibilityLabel="Move closer"
              accessibilityRole="button"
            >
              <Text style={styles.zoomText}>+ Closer</Text>
            </Pressable>
            
            <Pressable 
              style={styles.zoomBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                sendDirection('back')
              }}
              accessibilityLabel="Move back"
              accessibilityRole="button"
            >
              <Text style={styles.zoomText}>− Back</Text>
            </Pressable>
          </View>

          {/* Switch role */}
          <Pressable 
            style={styles.switchBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              ;(async () => {
                await sendCommand('switch_role', { newRole: 'director' })
                sessionLogger.info('switch_role_command_sent', { partnerNewRole: 'director' })
                if (usingLiveKit) {
                  await livekitService.destroy()
                } else {
                  await webrtcService.destroy()
                }
                router.replace('/camera')
              })()
            }}
            accessibilityLabel="Switch to photographer mode"
            accessibilityRole="button"
          >
            <Text style={styles.switchBtnText}>Switch to Photographer</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  
  // Video area
  videoContainer: {
    flex: 1,
    backgroundColor: '#111',
    position: 'relative',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  waitingRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  waitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  waitingDotOff: {
    backgroundColor: 'rgba(255,100,100,0.6)',
  },
  waitingIcon: {
    fontSize: 32,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 12,
    fontWeight: '300',
  },
  waitingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  waitingSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  connectRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: 20,
  },
  connectText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  connectHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
  },

  // Top bar - just back and end buttons
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  topSpacer: {
    flex: 1,
  },
  topBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBtnText: {
    fontSize: 28,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  endBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  endBtnText: {
    fontSize: 24,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.6)',
  },

  // Centered LIVE indicator
  liveIndicatorContainer: {
    position: 'absolute',
    top: 56, // Below safe area
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  statusDotLive: {
    backgroundColor: '#e53935',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 1,
  },

  // Partner indicator
  partnerPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  partnerText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },

  // Sent indicator
  sentIndicator: {
    position: 'absolute',
    top: '45%',
    left: 24,
    right: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  sentText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },

  // Switch toast
  switchToast: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(229, 57, 53, 0.9)',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  switchToastText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },

  // Controls
  controlsContainer: {
    backgroundColor: '#0a0a0a',
  },
  controls: {
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },

  // Camera controls
  cameraControlsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  cameraControlBtn: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 64,
    minHeight: 48,
  },
  cameraControlIcon: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  cameraControlLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '500',
  },
  
  // D-pad
  dpad: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dpadUp: {
    marginBottom: 4,
  },
  dpadDown: {
    marginTop: 4,
  },
  dpadMiddle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dirBtn: {
    width: 52,
    height: 52,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  dirBtnText: {
    fontSize: 18,
    fontWeight: '300',
    color: 'rgba(255,255,255,0.7)',
  },
  
  // Capture button
  captureBtn: {
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  captureBtnInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  captureBtnRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },

  // Zoom buttons
  zoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  zoomBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 48,
    justifyContent: 'center',
  },
  zoomText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },

  // Switch role button
  switchBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 48,
    justifyContent: 'center',
  },
  switchBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
  },
})
