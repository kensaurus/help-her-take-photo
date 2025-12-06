/**
 * Pairing - Connect with your partner (the boss)
 * Minimal design with micro-interactions
 */

import { useState, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Keyboard,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  FadeInDown,
  FadeOut,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useConnectionStore } from '../src/stores/connectionStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { pairingApi } from '../src/services/api'

/**
 * Animated action button with press feedback
 */
function ActionButton({ 
  label, 
  subtitle, 
  onPress,
  active = false,
  index = 0,
}: { 
  label: string
  subtitle: string
  onPress: () => void
  active?: boolean
  index?: number
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }
  
  return (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(400).springify()}>
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.actionButtonPressable}
      >
        <Animated.View style={[
          styles.actionButton, 
          { 
            backgroundColor: active ? colors.primary : colors.surface,
            borderColor: active ? colors.primary : colors.border,
          },
          animatedStyle
        ]}>
          <Text style={[
            styles.actionButtonLabel, 
            { color: active ? colors.primaryText : colors.text }
          ]}>
            {label}
          </Text>
          <Text style={[
            styles.actionButtonSubtitle, 
            { color: active ? `${colors.primaryText}99` : colors.textMuted }
          ]}>
            {subtitle}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Code display with staggered animation
 */
function CodeDisplay({ code }: { code: string }) {
  const { colors } = useThemeStore()
  const displayCode = code.toUpperCase().split('')
  
  return (
    <View style={styles.codeDisplay}>
      {displayCode.map((char, i) => (
        <Animated.View 
          key={i} 
          entering={FadeInUp.delay(i * 60).duration(300).springify()} 
          style={[styles.codeChar, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.codeCharText, { color: colors.primaryText }]}>
            {char}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}

/**
 * Code input with cursor effect
 */
function CodeInput({ 
  value, 
  onChange, 
  onSubmit,
}: { 
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  const { colors } = useThemeStore()
  const inputRef = useRef<TextInput>(null)
  const chars = value.toUpperCase().padEnd(6, ' ').split('')
  const cursorOpacity = useSharedValue(1)

  useEffect(() => {
    cursorOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1
    )
  }, [cursorOpacity])

  const cursorStyle = useAnimatedStyle(() => ({
    opacity: cursorOpacity.value,
  }))
  
  return (
    <Pressable 
      style={styles.codeInputContainer} 
      onPress={() => inputRef.current?.focus()}
    >
      <View style={styles.codeDisplay}>
        {chars.map((char, i) => (
          <Animated.View 
            key={i}
            entering={FadeInUp.delay(i * 40).duration(300)}
            style={[
              styles.codeInputChar,
              { 
                backgroundColor: colors.surface,
                borderColor: i < value.length ? colors.primary : colors.border,
              },
              i < value.length && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Text style={[styles.codeInputCharText, { color: colors.text }]}>
              {char.trim() || ''}
            </Text>
            {i === value.length && (
              <Animated.View 
                style={[
                  styles.cursor, 
                  { backgroundColor: colors.primary },
                  cursorStyle
                ]} 
              />
            )}
          </Animated.View>
        ))}
      </View>
      
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => {
          const filtered = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6)
          onChange(filtered)
          if (filtered.length === 6) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
        }}
        onSubmitEditing={onSubmit}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
        autoFocus
      />
    </Pressable>
  )
}

/**
 * Submit button with loading state
 */
function SubmitButton({ 
  label, 
  onPress, 
  loading, 
  disabled 
}: { 
  label: string
  onPress: () => void
  loading: boolean
  disabled: boolean
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable 
      style={[
        styles.submitButton,
        { 
          backgroundColor: disabled ? colors.textMuted : colors.primary,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled) {
          scale.value = withSpring(0.97, { damping: 15 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        }
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
      disabled={loading || disabled}
    >
      <Animated.View style={animatedStyle}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primaryText} />
        ) : (
          <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>
            {label}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  )
}

export default function PairingScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { 
    myDeviceId, 
    setMyDeviceId, 
    setPairedDeviceId, 
    setRole: setPairingRole 
  } = usePairingStore()
  const { role } = useConnectionStore()
  const { t } = useLanguageStore()
  const { incrementSessions } = useStatsStore()
  
  const [mode, setMode] = useState<'select' | 'showCode' | 'enterCode'>('select')
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiresIn, setExpiresIn] = useState(300)
  const [refreshing, setRefreshing] = useState(false)

  // Pulse animation for waiting state
  const pulse = useSharedValue(1)
  
  useEffect(() => {
    if (mode === 'showCode') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1
      )
    }
  }, [mode, pulse])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }))

  // Generate pairing code
  const generateCode = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await pairingApi.createPairing(myDeviceId!)
      if (result.code) {
        setCode(result.code)
        setMode('showCode')
        setExpiresIn(300)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        setError(result.error || 'Failed to generate code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch {
      setError('Server unavailable. Please try again.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
    setLoading(false)
  }

  // Join with code
  const joinWithCode = async () => {
    if (inputCode.length !== 6) {
      setError('Enter all 6 characters')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    
    setLoading(true)
    setError('')
    Keyboard.dismiss()
    
    try {
      const result = await pairingApi.joinPairing(myDeviceId!, inputCode)
      if (result.partnerId) {
        setPairedDeviceId(result.partnerId)
        setPairingRole(role || 'camera')
        incrementSessions()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.replace(role === 'viewer' ? '/viewer' : '/camera')
      } else {
        setError(result.error || 'Invalid or expired code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch {
      setError('Server unavailable. Check your connection.')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    }
    setLoading(false)
  }

  // Check for partner joining
  useEffect(() => {
    if (mode !== 'showCode' || !code) return
    
    const interval = setInterval(async () => {
      try {
        const result = await pairingApi.getPartner(myDeviceId!, code)
        if (result.partnerId) {
          clearInterval(interval)
          setPairedDeviceId(result.partnerId)
          setPairingRole(role || 'camera')
          incrementSessions()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.replace(role === 'viewer' ? '/viewer' : '/camera')
        }
      } catch {}
    }, 2000)

    return () => clearInterval(interval)
  }, [mode, code, myDeviceId, role, setPairedDeviceId, setPairingRole, incrementSessions, router])

  // Countdown
  useEffect(() => {
    if (mode !== 'showCode') return
    
    const interval = setInterval(() => {
      setExpiresIn(prev => {
        if (prev <= 1) {
          setMode('select')
          setCode('')
          return 300
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [mode])

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    if (mode === 'showCode') {
      await generateCode()
    }
    setRefreshing(false)
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Fun messages
  const waitingMessages = [
    "Waiting for the boss to scan... 👀",
    "She's probably fixing her hair first",
    "Any moment now... (he says hopefully)",
    "Connection pending...",
  ]
  const [waitingMsgIndex, setWaitingMsgIndex] = useState(0)
  
  useEffect(() => {
    if (mode !== 'showCode') return
    const interval = setInterval(() => {
      setWaitingMsgIndex(i => (i + 1) % waitingMessages.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [mode, waitingMessages.length])

  const goBack = () => {
    setMode('select')
    setCode('')
    setInputCode('')
    setError('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.textMuted}
          />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t.pairing.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {role === 'viewer' 
              ? "Connect to supervise his photography skills"
              : "Connect so she can guide you (finally)"}
          </Text>
        </Animated.View>

        {mode === 'select' && (
          <View style={styles.modeSelect}>
            <ActionButton
              label={t.pairing.showCode}
              subtitle={t.pairing.showCodeDesc}
              onPress={generateCode}
              index={0}
            />
            
            <View style={styles.orDivider}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>
            
            <ActionButton
              label={t.pairing.enterCode}
              subtitle={t.pairing.enterCodeDesc}
              onPress={() => setMode('enterCode')}
              index={1}
            />

            {/* How it works */}
            <Animated.View 
              entering={FadeInUp.delay(200).duration(400)}
              style={[styles.howItWorks, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.howTitle, { color: colors.text }]}>
                {t.pairing.howItWorks}
              </Text>
              {[t.pairing.step1, t.pairing.step2, t.pairing.step3].map((step, i) => (
                <View key={i} style={styles.step}>
                  <View style={[styles.stepNum, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.stepNumText, { color: colors.textSecondary }]}>
                      {i + 1}
                    </Text>
                  </View>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                    {step}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </View>
        )}

        {mode === 'showCode' && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.codeSection}>
            <Animated.View style={pulseStyle}>
              <CodeDisplay code={code} />
            </Animated.View>
            
            <Animated.View 
              entering={FadeInDown.delay(200).duration(400)}
              style={styles.waitingInfo}
            >
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                {waitingMessages[waitingMsgIndex]}
              </Text>
            </Animated.View>
            
            <View style={styles.expiry}>
              <Text style={[styles.expiryLabel, { color: colors.textMuted }]}>
                {t.pairing.expires}
              </Text>
              <Text style={[styles.expiryTime, { color: colors.text }]}>
                {formatTime(expiresIn)}
              </Text>
            </View>
            
            <Pressable 
              style={styles.backLink} 
              onPress={goBack}
              hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
            >
              <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>
                ← {t.common.back}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {mode === 'enterCode' && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.codeSection}>
            <Text style={[styles.enterPrompt, { color: colors.text }]}>
              Enter the code from her screen
            </Text>
            <Text style={[styles.enterHint, { color: colors.textMuted }]}>
              (Don't mess this up too)
            </Text>
            
            <CodeInput
              value={inputCode}
              onChange={setInputCode}
              onSubmit={joinWithCode}
            />
            
            {error && (
              <Animated.Text 
                entering={FadeIn.duration(200)}
                style={[styles.errorText, { color: colors.error }]}
              >
                {error}
              </Animated.Text>
            )}
            
            <SubmitButton
              label={t.pairing.connect}
              onPress={joinWithCode}
              loading={loading}
              disabled={inputCode.length < 6}
            />
            
            <Pressable 
              style={styles.backLink} 
              onPress={goBack}
              hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
            >
              <Text style={[styles.backLinkText, { color: colors.textSecondary }]}>
                ← {t.common.back}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {loading && mode === 'select' && (
          <Animated.View 
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={[styles.loadingOverlay, { backgroundColor: colors.overlay }]}
          >
            <ActivityIndicator size="large" color={colors.text} />
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  modeSelect: {
    flex: 1,
  },
  actionButtonPressable: {
    marginBottom: 12,
  },
  actionButton: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionButtonLabel: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  actionButtonSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '500',
  },
  howItWorks: {
    marginTop: 32,
    padding: 24,
    borderWidth: 1,
    borderRadius: 16,
  },
  howTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumText: {
    fontSize: 14,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  codeSection: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  codeDisplay: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 40,
  },
  codeChar: {
    width: 52,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCharText: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  waitingText: {
    fontSize: 15,
  },
  expiry: {
    alignItems: 'center',
    marginBottom: 40,
  },
  expiryLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  expiryTime: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 2,
  },
  enterPrompt: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 6,
  },
  enterHint: {
    fontSize: 15,
    marginBottom: 32,
  },
  codeInputContainer: {
    marginBottom: 32,
  },
  codeInputChar: {
    width: 52,
    height: 72,
    borderWidth: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  codeInputCharText: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  cursor: {
    position: 'absolute',
    bottom: 16,
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 20,
    textAlign: 'center',
  },
  submitButton: {
    paddingVertical: 20,
    paddingHorizontal: 56,
    borderRadius: 12,
    marginBottom: 24,
    minWidth: 220,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
  },
  backLink: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  backLinkText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
