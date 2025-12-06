/**
 * Pairing - Connect with your partner (the boss)
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
import { pairingApi } from '../src/services/api'

function BigActionButton({ 
  label, 
  subtitle, 
  onPress,
  active = false,
}: { 
  label: string
  subtitle: string
  onPress: () => void
  active?: boolean
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  return (
    <Pressable 
      onPress={onPress}
      onPressIn={() => { 
        scale.value = withSpring(0.97, { damping: 15 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }) }}
      style={styles.bigButtonPressable}
    >
      <Animated.View style={[
        styles.bigButton, 
        active && styles.bigButtonActive,
        animatedStyle
      ]}>
        <Text style={[styles.bigButtonLabel, active && styles.bigButtonLabelActive]}>
          {label}
        </Text>
        <Text style={[styles.bigButtonSubtitle, active && styles.bigButtonSubtitleActive]}>
          {subtitle}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

function CodeDisplay({ code }: { code: string }) {
  const displayCode = code.toUpperCase().split('')
  
  return (
    <View style={styles.codeDisplay}>
      {displayCode.map((char, i) => (
        <Animated.View 
          key={i} 
          entering={FadeIn.delay(i * 50)} 
          style={styles.codeChar}
        >
          <Text style={styles.codeCharText}>{char}</Text>
        </Animated.View>
      ))}
    </View>
  )
}

function CodeInput({ 
  value, 
  onChange, 
  onSubmit,
}: { 
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
}) {
  const inputRef = useRef<TextInput>(null)
  const chars = value.toUpperCase().padEnd(6, ' ').split('')
  
  return (
    <Pressable style={styles.codeInputContainer} onPress={() => inputRef.current?.focus()}>
      <View style={styles.codeDisplay}>
        {chars.map((char, i) => (
          <View 
            key={i} 
            style={[
              styles.codeInputChar,
              i < value.length && styles.codeInputCharFilled,
              i === value.length && styles.codeInputCharActive,
            ]}
          >
            <Text style={styles.codeInputCharText}>
              {char.trim() || ''}
            </Text>
          </View>
        ))}
      </View>
      
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={(text) => {
          const filtered = text.replace(/[^A-Za-z0-9]/g, '').slice(0, 6)
          onChange(filtered)
        }}
        onSubmitEditing={onSubmit}
        maxLength={6}
        autoCapitalize="characters"
        autoCorrect={false}
        keyboardType="default"
      />
    </Pressable>
  )
}

export default function PairingScreen() {
  const router = useRouter()
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
          withTiming(1.05, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
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
      }
    } catch {
      setError('Network error. Check your connection.')
    }
    setLoading(false)
  }

  // Join with code
  const joinWithCode = async () => {
    if (inputCode.length !== 6) {
      setError('Enter a 6-character code')
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
        setError(result.error || 'Invalid code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch {
      setError('Connection failed. Try again.')
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
    "Connection pending... like your relationship status",
  ]
  const [waitingMsgIndex, setWaitingMsgIndex] = useState(0)
  
  useEffect(() => {
    if (mode !== 'showCode') return
    const interval = setInterval(() => {
      setWaitingMsgIndex(i => (i + 1) % waitingMessages.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [mode, waitingMessages.length])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          <Text style={styles.title}>{t.pairing.title}</Text>
          <Text style={styles.subtitle}>
            {role === 'viewer' 
              ? "Connect to supervise his photography skills"
              : "Connect so she can guide you (finally)"}
          </Text>
        </View>

        {mode === 'select' && (
          <Animated.View entering={FadeIn} style={styles.modeSelect}>
            <BigActionButton
              label={t.pairing.showCode}
              subtitle={t.pairing.showCodeDesc}
              onPress={generateCode}
            />
            
            <View style={styles.orDivider}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            
            <BigActionButton
              label={t.pairing.enterCode}
              subtitle={t.pairing.enterCodeDesc}
              onPress={() => setMode('enterCode')}
            />

            {/* How it works */}
            <View style={styles.howItWorks}>
              <Text style={styles.howTitle}>{t.pairing.howItWorks}</Text>
              <View style={styles.step}>
                <Text style={styles.stepNum}>1</Text>
                <Text style={styles.stepText}>{t.pairing.step1}</Text>
              </View>
              <View style={styles.step}>
                <Text style={styles.stepNum}>2</Text>
                <Text style={styles.stepText}>{t.pairing.step2}</Text>
              </View>
              <View style={styles.step}>
                <Text style={styles.stepNum}>3</Text>
                <Text style={styles.stepText}>{t.pairing.step3}</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {mode === 'showCode' && (
          <Animated.View entering={FadeIn} style={styles.codeSection}>
            <Animated.View style={pulseStyle}>
              <CodeDisplay code={code} />
            </Animated.View>
            
            <View style={styles.waitingInfo}>
              <ActivityIndicator size="small" color="#1a1a1a" />
              <Text style={styles.waitingText}>
                {waitingMessages[waitingMsgIndex]}
              </Text>
            </View>
            
            <View style={styles.expiry}>
              <Text style={styles.expiryLabel}>{t.pairing.expires}</Text>
              <Text style={styles.expiryTime}>{formatTime(expiresIn)}</Text>
            </View>
            
            <Pressable 
              style={styles.backLink} 
              onPress={() => { setMode('select'); setCode('') }}
            >
              <Text style={styles.backLinkText}>← {t.common.back}</Text>
            </Pressable>
          </Animated.View>
        )}

        {mode === 'enterCode' && (
          <Animated.View entering={FadeIn} style={styles.codeSection}>
            <Text style={styles.enterPrompt}>
              Enter the code from her screen
            </Text>
            <Text style={styles.enterHint}>
              (Don't mess this up too)
            </Text>
            
            <CodeInput
              value={inputCode}
              onChange={setInputCode}
              onSubmit={joinWithCode}
            />
            
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
            
            <Pressable 
              style={[
                styles.submitButton,
                inputCode.length < 6 && styles.submitButtonDisabled,
                loading && styles.submitButtonLoading,
              ]}
              onPress={joinWithCode}
              disabled={loading || inputCode.length < 6}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t.pairing.connect}</Text>
              )}
            </Pressable>
            
            <Pressable 
              style={styles.backLink} 
              onPress={() => { setMode('select'); setInputCode(''); setError('') }}
            >
              <Text style={styles.backLinkText}>← {t.common.back}</Text>
            </Pressable>
          </Animated.View>
        )}

        {loading && mode === 'select' && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#1a1a1a" />
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
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  modeSelect: {
    flex: 1,
  },
  bigButtonPressable: {
    marginBottom: 8,
  },
  bigButton: {
    backgroundColor: '#fff',
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    alignItems: 'center',
  },
  bigButtonActive: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  bigButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  bigButtonLabelActive: {
    color: '#fff',
  },
  bigButtonSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  bigButtonSubtitleActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  orText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#888',
  },
  howItWorks: {
    marginTop: 32,
    padding: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginRight: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#666',
  },
  codeSection: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 20,
  },
  codeDisplay: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
  },
  codeChar: {
    width: 48,
    height: 64,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCharText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'monospace',
  },
  waitingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
  },
  waitingText: {
    fontSize: 14,
    color: '#666',
  },
  expiry: {
    alignItems: 'center',
    marginBottom: 32,
  },
  expiryLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  expiryTime: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  enterPrompt: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  enterHint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 24,
  },
  codeInputContainer: {
    marginBottom: 24,
  },
  codeInputChar: {
    width: 48,
    height: 64,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInputCharFilled: {
    borderColor: '#1a1a1a',
    backgroundColor: '#F5F5F5',
  },
  codeInputCharActive: {
    borderColor: '#1a1a1a',
  },
  codeInputCharText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    fontFamily: 'monospace',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 0,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#1a1a1a',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 4,
    marginBottom: 24,
    minWidth: 200,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#CCC',
  },
  submitButtonLoading: {
    backgroundColor: '#666',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  backLink: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  backLinkText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(250,250,250,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
})
