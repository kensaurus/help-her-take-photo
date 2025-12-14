/**
 * Pairing - Connect with your partner
 * 4-digit code for easier entry
 * Responsive design for all screen sizes
 */

import { useState, useEffect, useRef, useCallback } from 'react'
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
  useWindowDimensions,
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
import { sessionLogger } from '../src/services/sessionLogger'
import AsyncStorage from '@react-native-async-storage/async-storage'

// API timeout helper
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)
    ),
  ])
}

const CODE_LENGTH = 4

// Quick connect mode - auto-disconnect after session
const QUICK_CONNECT_KEY = 'quick_connect_mode'

/**
 * Generate device ID if needed
 */
function generateDeviceId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Animated action button with press feedback
 */
function ActionButton({ 
  label, 
  subtitle, 
  onPress,
  active = false,
  index = 0,
  loading = false,
  accessibilityHint,
}: { 
  label: string
  subtitle: string
  onPress: () => void
  active?: boolean
  index?: number
  loading?: boolean
  accessibilityHint?: string
}) {
  const { colors } = useThemeStore()
  const { width } = useWindowDimensions()
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

  // Responsive font sizes
  const isSmallScreen = width < 360
  const labelSize = isSmallScreen ? 15 : 17
  const subtitleSize = isSmallScreen ? 12 : 14
  
  return (
    <Animated.View entering={FadeInUp.delay(index * 80).duration(300)}>
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.actionButtonPressable}
        disabled={loading}
        accessibilityLabel={`${label}. ${subtitle}`}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
        accessibilityState={{ disabled: loading }}
      >
        <Animated.View style={[
          styles.actionButton, 
          { 
            backgroundColor: active ? colors.primary : colors.surface,
            borderColor: active ? colors.primary : colors.border,
            opacity: loading ? 0.7 : 1,
          },
          animatedStyle
        ]}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Text 
                style={[
                  styles.actionButtonLabel, 
                  { 
                    color: active ? colors.primaryText : colors.text,
                    fontSize: labelSize,
                  }
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {label}
              </Text>
              <Text 
                style={[
                  styles.actionButtonSubtitle, 
                  { 
                    color: active ? `${colors.primaryText}99` : colors.textMuted,
                    fontSize: subtitleSize,
                  }
                ]}
                numberOfLines={2}
                adjustsFontSizeToFit
              >
                {subtitle}
              </Text>
            </>
          )}
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Code display with staggered animation - 4 digits
 * Responsive sizing based on screen width
 */
function CodeDisplay({ code }: { code: string }) {
  const { colors } = useThemeStore()
  const { width } = useWindowDimensions()
  const displayCode = code.split('')
  
  // Responsive sizing - use percentage of screen width
  const maxCharWidth = Math.min(64, (width - 80) / CODE_LENGTH - 12)
  const charWidth = Math.max(48, maxCharWidth)
  const charHeight = charWidth * 1.25
  const fontSize = charWidth * 0.55
  
  return (
    <View style={[styles.codeDisplay, { gap: Math.min(12, (width - 80 - charWidth * CODE_LENGTH) / (CODE_LENGTH - 1)) }]}>
      {displayCode.map((char, i) => (
        <Animated.View 
          key={i} 
          entering={FadeInUp.delay(i * 60).duration(300).springify()} 
          style={[
            styles.codeChar, 
            { 
              backgroundColor: colors.primary,
              width: charWidth,
              height: charHeight,
            }
          ]}
        >
          <Text 
            style={[
              styles.codeCharText, 
              { 
                color: colors.primaryText,
                fontSize,
              }
            ]}
          >
            {char}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}

/**
 * Code input with cursor effect - 4 digits
 * Responsive sizing based on screen width
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
  const { width } = useWindowDimensions()
  const inputRef = useRef<TextInput>(null)
  const chars = value.padEnd(CODE_LENGTH, ' ').split('')
  const cursorOpacity = useSharedValue(1)

  // Responsive sizing
  const maxCharWidth = Math.min(64, (width - 80) / CODE_LENGTH - 12)
  const charWidth = Math.max(48, maxCharWidth)
  const charHeight = charWidth * 1.25
  const fontSize = charWidth * 0.55

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
      accessibilityLabel={`Enter ${CODE_LENGTH}-digit pairing code. ${value.length} of ${CODE_LENGTH} digits entered`}
      accessibilityHint="Tap to enter pairing code"
    >
      <View 
        style={[styles.codeDisplay, { gap: Math.min(12, (width - 80 - charWidth * CODE_LENGTH) / (CODE_LENGTH - 1)) }]}
        accessibilityElementsHidden
      >
        {chars.map((char, i) => (
          <Animated.View 
            key={i}
            entering={FadeInUp.delay(i * 40).duration(300)}
            style={[
              styles.codeInputChar,
              { 
                backgroundColor: colors.surface,
                borderColor: i < value.length ? colors.primary : colors.border,
                width: charWidth,
                height: charHeight,
              },
              i < value.length && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Text 
              style={[
                styles.codeInputCharText, 
                { 
                  color: colors.text,
                  fontSize,
                }
              ]}
            >
              {char.trim() || ''}
            </Text>
            {i === value.length && (
              <Animated.View 
                style={[
                  styles.cursor, 
                  { 
                    backgroundColor: colors.primary,
                    width: charWidth * 0.4,
                  },
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
        accessibilityLabel="Pairing code input"
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
  const { width } = useWindowDimensions()
  const scale = useSharedValue(1)
  
  const isSmallScreen = width < 360
  const buttonWidth = Math.min(200, width - 80)
  
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
          minWidth: buttonWidth,
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
      accessibilityLabel={label}
      accessibilityHint="Connect with your partner"
      accessibilityRole="button"
      accessibilityState={{ disabled: loading || disabled }}
    >
      <Animated.View style={animatedStyle}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primaryText} />
        ) : (
          <Text 
            style={[
              styles.submitButtonText, 
              { 
                color: colors.primaryText,
                fontSize: isSmallScreen ? 14 : 16,
              }
            ]}
          >
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
  const { width } = useWindowDimensions()
  const { 
    myDeviceId, 
    setMyDeviceId,
    setPairedDeviceId,
    setSessionId,
    setRole: setPairingRole 
  } = usePairingStore()
  const { myRole: role } = useConnectionStore()
  const { t } = useLanguageStore()
  const { incrementSessions } = useStatsStore()
  
  const [mode, setMode] = useState<'select' | 'showCode' | 'enterCode'>('select')
  const [code, setCode] = useState('')
  const [inputCode, setInputCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [expiresIn, setExpiresIn] = useState(300)
  const [refreshing, setRefreshing] = useState(false)
  const [deviceReady, setDeviceReady] = useState(false)
  const [quickConnect, setQuickConnect] = useState(false)

  // Responsive sizing
  const isSmallScreen = width < 360
  const padding = isSmallScreen ? 16 : 20
  const titleSize = isSmallScreen ? 24 : 28

  // Ensure device ID exists
  useEffect(() => {
    const initDeviceId = async () => {
      if (!myDeviceId) {
        const newId = generateDeviceId()
        await setMyDeviceId(newId)
      }
      setDeviceReady(true)
    }
    initDeviceId()
  }, [myDeviceId, setMyDeviceId])

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

  // Get current device ID (either stored or newly generated)
  const getDeviceId = useCallback(async (): Promise<string> => {
    if (myDeviceId) return myDeviceId
    const newId = generateDeviceId()
    await setMyDeviceId(newId)
    return newId
  }, [myDeviceId, setMyDeviceId])

  // Generate pairing code with timeout
  const generateCode = async () => {
    const deviceId = await getDeviceId()
    
    setLoading(true)
    setError('')
    
    try {
      sessionLogger.info('creating_pairing_code', { deviceId })
      // 10 second timeout to prevent hanging
      const result = await withTimeout(pairingApi.createPairing(deviceId), 10000)
      sessionLogger.info('pairing_code_created', { code: result.code, error: result.error })
      
      if (result.code) {
        setCode(result.code)
        setMode('showCode')
        setExpiresIn(300)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } else {
        setError(result.error || 'Failed to generate code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Server unavailable. Please try again.'
      sessionLogger.error('pairing_error', err, { errorMessage })
      setError(errorMessage)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  // Join with code with timeout
  const joinWithCode = async () => {
    if (inputCode.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits`)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }
    
    const deviceId = await getDeviceId()
    
    setLoading(true)
    setError('')
    Keyboard.dismiss()
    
    try {
      sessionLogger.info('joining_pairing', { code: inputCode, deviceId })
      // 10 second timeout to prevent hanging
      const result = await withTimeout(pairingApi.joinPairing(deviceId, inputCode), 10000)
      sessionLogger.info('join_result', { partnerId: result.partnerId, error: result.error })
      
      if (result.partnerId) {
        // Save quick connect mode for auto-disconnect
        await AsyncStorage.setItem(QUICK_CONNECT_KEY, quickConnect ? 'true' : 'false')
        // Await state persistence before navigation to prevent race condition
        await setPairedDeviceId(result.partnerId)
        if (result.sessionId) {
          await setSessionId(result.sessionId)
        }
        await setPairingRole(role || 'camera')
        incrementSessions()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.replace(role === 'viewer' ? '/viewer' : '/camera')
      } else {
        setError(result.error || 'Invalid or expired code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Server unavailable. Check your connection.'
      sessionLogger.error('join_error', err, { errorMessage })
      setError(errorMessage)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  // Check for partner joining
  useEffect(() => {
    if (mode !== 'showCode' || !code || !myDeviceId) return
    
    const interval = setInterval(async () => {
      try {
        const result = await pairingApi.getPartner(myDeviceId, code)
        if (result.partnerId) {
          clearInterval(interval)
          // Save quick connect mode for auto-disconnect
          await AsyncStorage.setItem(QUICK_CONNECT_KEY, quickConnect ? 'true' : 'false')
          // Await state persistence before navigation to prevent race condition
          await setPairedDeviceId(result.partnerId)
          if (result.sessionId) {
            await setSessionId(result.sessionId)
          }
          await setPairingRole(role || 'camera')
          incrementSessions()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.replace(role === 'viewer' ? '/viewer' : '/camera')
        }
      } catch {}
    }, 2000)

    return () => clearInterval(interval)
  }, [mode, code, myDeviceId, role, setPairedDeviceId, setSessionId, setPairingRole, incrementSessions, router, quickConnect])

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

  // Show loading while device ID initializes
  if (!deviceReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: padding }]}
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
          <Text 
            style={[styles.title, { color: colors.text, fontSize: titleSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {t.pairing.title}
          </Text>
          <Text 
            style={[styles.subtitle, { color: colors.textMuted, fontSize: isSmallScreen ? 13 : 15 }]}
            numberOfLines={2}
          >
            {role === 'viewer' 
              ? "Connect to guide the photographer"
              : "Connect to get real-time guidance"}
          </Text>
        </Animated.View>

        {mode === 'select' && (
          <View style={styles.modeSelect}>
            {/* Quick Connect Toggle */}
            <Animated.View 
              entering={FadeInUp.duration(300)}
              style={[styles.quickConnectCard, { 
                backgroundColor: quickConnect ? `${colors.primary}15` : colors.surface,
                borderColor: quickConnect ? colors.primary : colors.border,
              }]}
            >
              <Pressable
                style={styles.quickConnectPressable}
                onPress={() => {
                  setQuickConnect(!quickConnect)
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: quickConnect }}
                accessibilityLabel="Quick Connect mode"
                accessibilityHint="When enabled, connection will automatically end when you exit the camera or viewer"
              >
                <View style={styles.quickConnectContent}>
                  <View style={[styles.quickConnectIcon, { backgroundColor: quickConnect ? colors.primary : colors.surfaceAlt }]}>
                    <Icon name="flash" size={18} color={quickConnect ? colors.primaryText : colors.textMuted} />
                  </View>
                  <View style={styles.quickConnectText}>
                    <Text style={[styles.quickConnectTitle, { color: colors.text }]}>
                      Quick Connect
                    </Text>
                    <Text style={[styles.quickConnectDesc, { color: colors.textMuted }]}>
                      {quickConnect ? "Auto-disconnect after session" : "One-time use for helping a friend"}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.quickConnectToggle,
                  { backgroundColor: quickConnect ? colors.primary : colors.surfaceAlt }
                ]}>
                  <Animated.View 
                    style={[
                      styles.quickConnectToggleKnob,
                      { 
                        backgroundColor: colors.background,
                        transform: [{ translateX: quickConnect ? 18 : 0 }],
                      }
                    ]}
                  />
                </View>
              </Pressable>
            </Animated.View>
            
            <ActionButton
              label={t.pairing.showCode}
              subtitle={quickConnect ? "One-time code for quick session" : "Generate a code for your partner"}
              onPress={generateCode}
              index={0}
              loading={loading}
              accessibilityHint="Creates a code that your partner can enter on their device"
            />
            
            <View style={styles.orDivider} accessibilityElementsHidden>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted, fontSize: isSmallScreen ? 12 : 13 }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>
            
            <ActionButton
              label={t.pairing.enterCode}
              subtitle="Enter partner's 4-digit code"
              onPress={() => setMode('enterCode')}
              index={1}
              accessibilityHint="Opens keyboard to enter your partner's code"
            />

            {/* Error message */}
            {error && (
              <Animated.View 
                entering={FadeIn.duration(200)}
                style={[styles.errorContainer, { backgroundColor: colors.error + '20' }]}
              >
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              </Animated.View>
            )}

            {/* How it works */}
            <Animated.View 
              entering={FadeInUp.delay(160).duration(300)}
              style={[styles.howItWorks, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.howTitle, { color: colors.text, fontSize: isSmallScreen ? 13 : 14 }]}>
                {t.pairing.howItWorks}
              </Text>
              {[t.pairing.step1, t.pairing.step2, t.pairing.step3].map((step, i) => (
                <View key={i} style={styles.step}>
                  <Text style={[styles.stepNum, { color: colors.textMuted, fontSize: isSmallScreen ? 13 : 14 }]}>
                    {i + 1}.
                  </Text>
                  <Text 
                    style={[styles.stepText, { color: colors.textSecondary, fontSize: isSmallScreen ? 13 : 14 }]}
                    numberOfLines={2}
                  >
                    {step}
                  </Text>
                </View>
              ))}
            </Animated.View>
          </View>
        )}

        {mode === 'showCode' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <Text style={[styles.codeLabel, { color: colors.textMuted, fontSize: isSmallScreen ? 12 : 14 }]}>
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
              <Text 
                style={[styles.waitingText, { color: colors.textMuted, fontSize: isSmallScreen ? 12 : 14 }]}
                numberOfLines={2}
              >
                {waitingMessages[waitingMsgIndex]}
              </Text>
            </Animated.View>
            
            <View style={styles.expiry}>
              <Text style={[styles.expiryLabel, { color: colors.textMuted }]}>
                Expires in
              </Text>
              <Text style={[styles.expiryTime, { color: colors.text, fontSize: isSmallScreen ? 20 : 24 }]}>
                {formatTime(expiresIn)}
              </Text>
            </View>
            
            <Pressable 
              style={[styles.backButton, { borderColor: colors.border }]} 
              onPress={goBack}
              accessibilityLabel="Cancel"
              accessibilityHint="Go back to pairing options"
              accessibilityRole="button"
            >
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {mode === 'enterCode' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <Text style={[styles.enterPrompt, { color: colors.text, fontSize: isSmallScreen ? 18 : 20 }]}>
              Enter 4-digit code
            </Text>
            <Text style={[styles.enterHint, { color: colors.textMuted, fontSize: isSmallScreen ? 13 : 14 }]}>
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
              accessibilityLabel="Cancel"
              accessibilityHint="Go back to pairing options"
              accessibilityRole="button"
            >
              <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </Pressable>
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
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    lineHeight: 22,
  },
  modeSelect: {
    flex: 1,
  },
  quickConnectCard: {
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    overflow: 'hidden',
  },
  quickConnectPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  quickConnectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  quickConnectIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  quickConnectText: {
    flex: 1,
  },
  quickConnectTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  quickConnectDesc: {
    fontSize: 12,
  },
  quickConnectToggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    padding: 2,
  },
  quickConnectToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  actionButtonPressable: {
    marginBottom: 10,
  },
  actionButton: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 80,
    justifyContent: 'center',
  },
  actionButtonLabel: {
    fontWeight: '600',
    marginBottom: 4,
  },
  actionButtonSubtitle: {
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
    fontWeight: '500',
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  howItWorks: {
    marginTop: 24,
    padding: 16,
    borderWidth: 1,
    borderRadius: 8,
  },
  howTitle: {
    fontWeight: '600',
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  stepNum: {
    width: 20,
    fontWeight: '500',
  },
  stepText: {
    flex: 1,
    lineHeight: 20,
  },
  codeSection: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 24,
  },
  codeLabel: {
    fontWeight: '500',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeDisplay: {
    flexDirection: 'row',
    marginBottom: 32,
    justifyContent: 'center',
  },
  codeChar: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCharText: {
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  waitingText: {
    flex: 1,
    textAlign: 'center',
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
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  enterPrompt: {
    fontWeight: '600',
    marginBottom: 4,
  },
  enterHint: {
    marginBottom: 24,
  },
  codeInputContainer: {
    marginBottom: 24,
  },
  codeInputChar: {
    borderWidth: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  codeInputCharText: {
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cursor: {
    position: 'absolute',
    bottom: 14,
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
    paddingHorizontal: 32,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  submitButtonText: {
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
})
