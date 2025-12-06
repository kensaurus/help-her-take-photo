/**
 * Pairing - Connect with your partner
 * 4-digit code for easier entry
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
import { Icon } from '../src/components/ui/Icon'

const CODE_LENGTH = 4

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
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }
  
  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(300)}>
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
 * Code display with staggered animation - 4 digits
 */
function CodeDisplay({ code }: { code: string }) {
  const { colors } = useThemeStore()
  const displayCode = code.split('')
  
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
 * Code input with cursor effect - 4 digits
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
  const chars = value.padEnd(CODE_LENGTH, ' ').split('')
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
          const filtered = text.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH)
          onChange(filtered)
          if (filtered.length === CODE_LENGTH) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
        }}
        onSubmitEditing={onSubmit}
        maxLength={CODE_LENGTH}
        keyboardType="number-pad"
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
          scale.value = withSpring(0.98, { damping: 15 })
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
    if (inputCode.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits`)
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

  const waitingMessages = [
    "Waiting for partner to connect...",
    "Share this code with your partner",
    "They should enter this on their device",
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
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t.pairing.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {role === 'viewer' 
              ? "Connect to guide the photographer"
              : "Connect to get real-time guidance"}
          </Text>
        </Animated.View>

        {mode === 'select' && (
          <View style={styles.modeSelect}>
            <ActionButton
              label={t.pairing.showCode}
              subtitle="Generate a code for your partner"
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
              subtitle="Enter partner's 4-digit code"
              onPress={() => setMode('enterCode')}
              index={1}
            />

            {/* How it works */}
            <Animated.View 
              entering={FadeInUp.delay(160).duration(300)}
              style={[styles.howItWorks, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.howTitle, { color: colors.text }]}>
                {t.pairing.howItWorks}
              </Text>
              {[t.pairing.step1, t.pairing.step2, t.pairing.step3].map((step, i) => (
                <View key={i} style={styles.step}>
                  <Text style={[styles.stepNum, { color: colors.textMuted }]}>
                    {i + 1}.
                  </Text>
                  <Text style={[styles.stepText, { color: colors.textSecondary }]}>
                    {step}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </View>
        )}

        {mode === 'showCode' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>
              Your pairing code
            </Text>
            
            <Animated.View style={pulseStyle}>
              <CodeDisplay code={code} />
            </Animated.View>
            
            <Animated.View 
              entering={FadeInDown.delay(150).duration(300)}
              style={styles.waitingInfo}
            >
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                {waitingMessages[waitingMsgIndex]}
              </Text>
            </Animated.View>
            
            <View style={styles.expiry}>
              <Text style={[styles.expiryLabel, { color: colors.textMuted }]}>
                Expires in
              </Text>
              <Text style={[styles.expiryTime, { color: colors.text }]}>
                {formatTime(expiresIn)}
              </Text>
            </View>
            
            <Pressable 
              style={[styles.backButton, { borderColor: colors.border }]} 
              onPress={goBack}
            >
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {mode === 'enterCode' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <Text style={[styles.enterPrompt, { color: colors.text }]}>
              Enter 4-digit code
            </Text>
            <Text style={[styles.enterHint, { color: colors.textMuted }]}>
              Ask your partner for their code
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
              disabled={inputCode.length < CODE_LENGTH}
            />
            
            <Pressable 
              style={[styles.backButton, { borderColor: colors.border }]} 
              onPress={goBack}
            >
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
                Cancel
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
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
  },
  modeSelect: {
    flex: 1,
  },
  actionButtonPressable: {
    marginBottom: 10,
  },
  actionButton: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonLabel: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  actionButtonSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    paddingHorizontal: 16,
    fontSize: 13,
    fontWeight: '500',
  },
  howItWorks: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepNum: {
    width: 20,
    fontSize: 14,
    fontWeight: '500',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  codeSection: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 32,
  },
  codeLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeDisplay: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  codeChar: {
    width: 64,
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCharText: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  waitingText: {
    fontSize: 14,
  },
  expiry: {
    alignItems: 'center',
    marginBottom: 32,
  },
  expiryLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  expiryTime: {
    fontSize: 24,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  enterPrompt: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  enterHint: {
    fontSize: 14,
    marginBottom: 24,
  },
  codeInputContainer: {
    marginBottom: 24,
  },
  codeInputChar: {
    width: 64,
    height: 80,
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  codeInputCharText: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cursor: {
    position: 'absolute',
    bottom: 14,
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
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 16,
    textAlign: 'center',
  },
  submitButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 8,
    marginBottom: 16,
    minWidth: 200,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderRadius: 6,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
