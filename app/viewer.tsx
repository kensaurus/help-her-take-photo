/**
 * Viewer/Director - Guide the photographer with direction commands
 * Uses Supabase Realtime for commands (no WebRTC video)
 */

import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { useStatsStore } from '../src/stores/statsStore'
import { pairingApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { supabase } from '../src/services/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Direction button component
function DirectionButton({
  direction,
  emoji,
  onPress,
}: {
  direction: string
  emoji: string
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.85, { duration: 50 }),
      withSpring(1, { damping: 10 })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.directionBtn, animatedStyle]}>
        <Text style={styles.directionEmoji}>{emoji}</Text>
      </Animated.View>
    </Pressable>
  )
}

// Capture button
function CaptureButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1)
  const pulse = useSharedValue(1)
  
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * pulse.value }],
  }))
  
  const handlePress = () => {
    scale.value = withSequence(
      withTiming(0.9, { duration: 50 }),
      withSpring(1, { damping: 8 })
    )
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    onPress()
  }

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.captureBtn, animatedStyle]}>
        <Text style={styles.captureText}>📸</Text>
        <Text style={styles.captureBtnText}>Take Photo!</Text>
      </Animated.View>
    </Pressable>
  )
}

export default function ViewerScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, clearPairing } = usePairingStore()
  const { t } = useLanguageStore()
  const { incrementScoldings } = useStatsStore()
  
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastSent, setLastSent] = useState<string | null>(null)
  const [photosTaken, setPhotosTaken] = useState(0)

  // Initialize logging
  useEffect(() => {
    if (myDeviceId) {
      sessionLogger.init(myDeviceId, sessionId ?? undefined)
      sessionLogger.info('viewer_screen_opened')
    }
    return () => {
      sessionLogger.info('viewer_screen_closed')
      sessionLogger.flush()
    }
  }, [myDeviceId, sessionId])

  // Subscribe to commands channel
  useEffect(() => {
    if (!isPaired || !sessionId || !myDeviceId) {
      // Not paired, redirect to home
      if (!isPaired) {
        router.replace('/')
      }
      return
    }

    const channelName = `commands:${sessionId}`
    sessionLogger.info('subscribing_to_commands', { channelName })
    
    const channel = supabase.channel(channelName)
    
    channel
      .on('broadcast', { event: 'status' }, (payload) => {
        const { from, status, count } = payload.payload as {
          from: string
          to: string
          status: string
          count?: number
        }
        
        if (from === pairedDeviceId) {
          if (status === 'photo_taken' && count) {
            setPhotosTaken(count)
            incrementScoldings() // Count as scolding saved!
            sessionLogger.info('photo_taken_by_partner', { count })
          }
        }
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
          await channel.track({ deviceId: myDeviceId, role: 'director' })
          sessionLogger.info('channel_subscribed', { channelName })
        }
      })
    
    channelRef.current = channel
    
    return () => {
      channel.unsubscribe()
      channelRef.current = null
    }
  }, [isPaired, sessionId, myDeviceId, pairedDeviceId])

  const sendCommand = async (command: string, data?: Record<string, unknown>) => {
    if (!channelRef.current || !myDeviceId || !pairedDeviceId) return
    
    setLastSent(command)
    setTimeout(() => setLastSent(null), 1000)
    
    await channelRef.current.send({
      type: 'broadcast',
      event: 'command',
      payload: {
        from: myDeviceId,
        to: pairedDeviceId,
        command,
        data,
      }
    })
    
    sessionLogger.info('command_sent', { command, data })
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
          },
        },
      ]
    )
  }

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    router.back()
  }

  // Not paired - show connect prompt
  if (!isPaired) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.notPairedContainer}>
          <Text style={styles.notPairedEmoji}>🔗</Text>
          <Text style={[styles.notPairedTitle, { color: colors.text }]}>Not Connected</Text>
          <Text style={[styles.notPairedDesc, { color: colors.textMuted }]}>
            Connect with your partner first to start directing!
          </Text>
          <Pressable
            style={[styles.connectBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/pairing')}
          >
            <Text style={[styles.connectBtnText, { color: colors.primaryText }]}>
              Connect Now
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Text style={[styles.backBtnText, { color: colors.text }]}>← Back</Text>
        </Pressable>
        
        <Pressable onLongPress={handleDisconnect}>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: isConnected ? '#22C55E20' : '#EAB30820' }
          ]}>
            <View style={[
              styles.statusDot, 
              { backgroundColor: isConnected ? '#22C55E' : '#EAB308' }
            ]} />
            <Text style={[
              styles.statusBadgeText, 
              { color: isConnected ? '#22C55E' : '#EAB308' }
            ]}>
              {isConnected ? 'Photographer Online' : 'Waiting...'}
            </Text>
          </View>
        </Pressable>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.text }]}>👁️ Director Mode</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Send directions to help frame the perfect shot
          </Text>
        </Animated.View>

        {/* Stats */}
        {photosTaken > 0 && (
          <Animated.View 
            entering={FadeInUp.duration(300)} 
            style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.statsValue, { color: colors.text }]}>{photosTaken}</Text>
            <Text style={[styles.statsLabel, { color: colors.textMuted }]}>Photos Taken</Text>
          </Animated.View>
        )}

        {/* Direction Controls */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.controlsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            DIRECTION CONTROLS
          </Text>
          
          <View style={styles.directionsGrid}>
            {/* Up */}
            <View style={styles.directionRow}>
              <DirectionButton direction="up" emoji="⬆️" onPress={() => sendCommand('up')} />
            </View>
            
            {/* Left / Center / Right */}
            <View style={styles.directionRow}>
              <DirectionButton direction="left" emoji="⬅️" onPress={() => sendCommand('left')} />
              <DirectionButton direction="perfect" emoji="✨" onPress={() => sendCommand('perfect')} />
              <DirectionButton direction="right" emoji="➡️" onPress={() => sendCommand('right')} />
            </View>
            
            {/* Down */}
            <View style={styles.directionRow}>
              <DirectionButton direction="down" emoji="⬇️" onPress={() => sendCommand('down')} />
            </View>
          </View>
          
          {/* Last sent indicator */}
          {lastSent && (
            <Animated.View entering={FadeIn.duration(200)} style={styles.lastSentBadge}>
              <Text style={styles.lastSentText}>✓ Sent: {lastSent.toUpperCase()}</Text>
            </Animated.View>
          )}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.quickActions}>
          <Pressable 
            style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              sendCommand('flip')
            }}
          >
            <Text style={styles.quickActionEmoji}>🔄</Text>
            <Text style={[styles.quickActionText, { color: colors.text }]}>Flip Camera</Text>
          </Pressable>
        </Animated.View>

        {/* Capture Button */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.captureSection}>
          <CaptureButton onPress={() => sendCommand('capture')} />
        </Animated.View>

        {/* Switch Role */}
        <Pressable 
          style={styles.switchRoleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.replace('/camera')
          }}
        >
          <Text style={[styles.switchRoleText, { color: colors.textMuted }]}>
            📷 Switch to Photographer
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  titleSection: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsCard: {
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  statsValue: {
    fontSize: 40,
    fontWeight: '800',
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  controlsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  directionsGrid: {
    alignItems: 'center',
    gap: 8,
  },
  directionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  directionBtn: {
    width: 70,
    height: 70,
    borderRadius: 16,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionEmoji: {
    fontSize: 32,
  },
  lastSentBadge: {
    alignSelf: 'center',
    marginTop: 16,
    backgroundColor: '#22C55E20',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  lastSentText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '600',
  },
  quickActions: {
    marginBottom: 24,
  },
  quickActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  quickActionEmoji: {
    fontSize: 24,
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  captureSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  captureBtn: {
    backgroundColor: '#22C55E',
    paddingVertical: 20,
    paddingHorizontal: 48,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  captureText: {
    fontSize: 40,
    marginBottom: 4,
  },
  captureBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  switchRoleBtn: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  switchRoleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notPairedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  notPairedEmoji: {
    fontSize: 64,
    marginBottom: 20,
  },
  notPairedTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  notPairedDesc: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  connectBtn: {
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 12,
  },
  connectBtnText: {
    fontSize: 17,
    fontWeight: '600',
  },
})
