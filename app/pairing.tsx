/**
 * Pairing - Connect with your partner
 * Enhanced UX with profile setup and connection management
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
  Alert,
  useWindowDimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  FadeInDown,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { pairingApi, profileApi } from '../src/services/api'
import { Icon } from '../src/components/ui/Icon'
import { ZenLoader } from '../src/components/ui/ZenLoader'
import { sessionLogger } from '../src/services/sessionLogger'

// API timeout helper
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timed out')), ms)
    ),
  ])
}

const CODE_LENGTH = 4

// Avatar options
const AVATAR_OPTIONS = ['👤', '😊', '🙂', '😎', '🤓', '🥰', '🦊', '🐱', '🐶', '🦁', '🐼', '🐨']

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
 * Profile Setup Component
 */
function ProfileSetup({ 
  onComplete,
  colors,
}: { 
  onComplete: (name: string, avatar: string) => void
  colors: any
}) {
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState('👤')
  const { width } = useWindowDimensions()
  const isSmall = width < 360

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.profileSetup}>
      <Text style={[styles.setupTitle, { color: colors.text }]}>
        👋 Welcome!
      </Text>
      <Text style={[styles.setupSubtitle, { color: colors.textMuted }]}>
        Set up your profile so your partner knows who you are
      </Text>

      {/* Avatar selector */}
      <View style={styles.avatarSection}>
        <Text style={[styles.labelText, { color: colors.textMuted }]}>Choose your avatar</Text>
        <View style={styles.avatarGrid}>
          {AVATAR_OPTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.avatarOption,
                { 
                  backgroundColor: avatar === emoji ? colors.primary : colors.surface,
                  borderColor: avatar === emoji ? colors.primary : colors.border,
                }
              ]}
              onPress={() => {
                setAvatar(emoji)
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              }}
            >
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Name input */}
      <View style={styles.nameSection}>
        <Text style={[styles.labelText, { color: colors.textMuted }]}>Your display name</Text>
        <TextInput
          style={[
            styles.nameInput,
            { 
              backgroundColor: colors.surface,
              borderColor: name.length > 0 ? colors.primary : colors.border,
              color: colors.text,
              fontSize: isSmall ? 16 : 18,
            }
          ]}
          value={name}
          onChangeText={setName}
          placeholder="Enter your name..."
          placeholderTextColor={colors.textMuted}
          maxLength={20}
          autoCapitalize="words"
        />
      </View>

      {/* Continue button */}
      <Pressable
        style={[
          styles.continueBtn,
          { 
            backgroundColor: name.trim().length > 0 ? colors.primary : colors.textMuted,
            opacity: name.trim().length > 0 ? 1 : 0.5,
          }
        ]}
        onPress={() => {
          if (name.trim().length > 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onComplete(name.trim(), avatar)
          }
        }}
        disabled={name.trim().length === 0}
      >
        <Text style={[styles.continueBtnText, { color: colors.primaryText }]}>
          Continue
        </Text>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Connected Status Component - Clean, simple connected state with celebration
 */
function ConnectedStatus({ 
  partnerName,
  partnerAvatar,
  myName,
  myAvatar,
  onGoBack,
  colors,
}: { 
  partnerName: string | null
  partnerAvatar: string
  myName: string | null
  myAvatar: string
  onGoBack: () => void
  colors: any
}) {
  const router = useRouter()
  const celebrationScale = useSharedValue(0)
  const buttonScale = useSharedValue(1)
  
  // Play celebration animation on mount
  useEffect(() => {
    celebrationScale.value = withSequence(
      withTiming(1.15, { duration: 200 }),
      withSpring(1, { damping: 8, stiffness: 200 })
    )
    // Haptic celebration
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }, [])
  
  const celebrationStyle = useAnimatedStyle(() => ({
    transform: [{ scale: celebrationScale.value }],
  }))
  
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }))
  
  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
  }
  
  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 12, stiffness: 300 })
  }
  
  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.connectedContainer}>
      {/* Success banner with celebration */}
      <Animated.View style={[styles.successBanner, { backgroundColor: '#22C55E15' }, celebrationStyle]}>
        <Text style={styles.successIcon}>✓</Text>
        <Text style={[styles.successText, { color: '#22C55E' }]}>
          Paired Successfully
        </Text>
      </Animated.View>

      <View style={[styles.connectedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Connection visualization */}
        <View style={styles.connectionVisual}>
          {/* My device */}
          <Animated.View 
            entering={FadeInUp.delay(100).duration(300)}
            style={styles.deviceInfo}
          >
            <Text style={styles.deviceAvatar}>{myAvatar}</Text>
            <Text style={[styles.deviceName, { color: colors.text }]}>
              {myName || 'You'}
            </Text>
          </Animated.View>

          {/* Connection line */}
          <View style={styles.connectionLine}>
            <View style={[styles.connectionDot, { backgroundColor: '#22C55E' }]} />
            <Animated.View 
              entering={FadeIn.delay(200).duration(400)}
              style={[styles.connectionDash, { backgroundColor: '#22C55E' }]} 
            />
            <View style={[styles.connectionDot, { backgroundColor: '#22C55E' }]} />
          </View>

          {/* Partner device */}
          <Animated.View 
            entering={FadeInUp.delay(150).duration(300)}
            style={styles.deviceInfo}
          >
            <Text style={styles.deviceAvatar}>{partnerAvatar}</Text>
            <Text style={[styles.deviceName, { color: colors.text }]}>
              {partnerName || 'Partner'}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* Primary action - Go choose role with press feedback */}
      <Animated.View entering={FadeInUp.delay(250).duration(350)}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onGoBack()
          }}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
        >
          <Animated.View style={[styles.primaryBtn, { backgroundColor: colors.primary }, buttonStyle]}>
            <Text style={[styles.primaryBtnText, { color: colors.primaryText }]}>
              Choose Your Role →
            </Text>
          </Animated.View>
        </Pressable>
      </Animated.View>

      {/* Subtle hint */}
      <Animated.Text 
        entering={FadeIn.delay(350).duration(300)}
        style={[styles.hintText, { color: colors.textMuted }]}
      >
        One person takes photos, one gives directions
      </Animated.Text>
    </Animated.View>
  )
}

/**
 * Code Display Component
 */
function CodeDisplay({ code, colors }: { code: string; colors: any }) {
  const { width } = useWindowDimensions()
  const displayCode = code.split('')
  const charWidth = Math.min(64, (width - 80) / CODE_LENGTH - 12)
  
  return (
    <View style={styles.codeDisplay}>
      {displayCode.map((char, i) => (
        <Animated.View 
          key={i} 
          entering={FadeInUp.delay(i * 60).duration(300).springify()} 
          style={[styles.codeChar, { backgroundColor: colors.primary, width: charWidth, height: charWidth * 1.25 }]}
        >
          <Text style={[styles.codeCharText, { color: colors.primaryText, fontSize: charWidth * 0.55 }]}>
            {char}
          </Text>
        </Animated.View>
      ))}
    </View>
  )
}

/**
 * Code Input Component
 */
function CodeInput({ value, onChange, onSubmit, colors }: { value: string; onChange: (v: string) => void; onSubmit: () => void; colors: any }) {
  const { width } = useWindowDimensions()
  const inputRef = useRef<TextInput>(null)
  const chars = value.padEnd(CODE_LENGTH, ' ').split('')
  const charWidth = Math.min(64, (width - 80) / CODE_LENGTH - 12)
  
  return (
    <Pressable style={styles.codeInputContainer} onPress={() => inputRef.current?.focus()}>
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
                width: charWidth,
                height: charWidth * 1.25,
              },
              i < value.length && { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <Text style={[styles.codeInputCharText, { color: colors.text, fontSize: charWidth * 0.55 }]}>
              {char.trim() || ''}
            </Text>
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

export default function PairingScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { width } = useWindowDimensions()
  const { 
    myDeviceId, 
    myDisplayName,
    myAvatar,
    pairedDeviceId,
    partnerDisplayName,
    partnerAvatar,
    sessionId,
    isPaired,
    hasSetupProfile,
    setMyDeviceId,
    setMyDisplayName,
    setMyAvatar,
    setPairedDeviceId,
    setSessionId,
    setPartnerInfo,
    setHasSetupProfile,
    clearPairing,
  } = usePairingStore()
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
  const [showProfileSetup, setShowProfileSetup] = useState(false)

  const isSmall = width < 360

  // Initialize device
  useEffect(() => {
    const init = async () => {
      if (!myDeviceId) {
        const newId = generateDeviceId()
        await setMyDeviceId(newId)
      }
      setDeviceReady(true)
      
      // Check if profile needs setup
      if (!hasSetupProfile && !myDisplayName) {
        setShowProfileSetup(true)
      }
    }
    init()
  }, [myDeviceId, setMyDeviceId, hasSetupProfile, myDisplayName])

  // Fetch partner profile when paired
  useEffect(() => {
    if (isPaired && pairedDeviceId && !partnerDisplayName) {
      profileApi.get(pairedDeviceId).then(({ profile }) => {
        if (profile) {
          setPartnerInfo(profile.display_name, profile.avatar_emoji)
        }
      })
    }
  }, [isPaired, pairedDeviceId, partnerDisplayName, setPartnerInfo])

  const getDeviceId = useCallback(async (): Promise<string> => {
    if (myDeviceId) return myDeviceId
    const newId = generateDeviceId()
    await setMyDeviceId(newId)
    return newId
  }, [myDeviceId, setMyDeviceId])

  // Handle profile setup completion
  const handleProfileSetup = async (name: string, avatar: string) => {
    await setMyDisplayName(name)
    await setMyAvatar(avatar)
    await setHasSetupProfile(true)
    setShowProfileSetup(false)
    
    // Save to Supabase
    const deviceId = await getDeviceId()
    await profileApi.upsert(deviceId, name, avatar)
  }

  // Generate pairing code
  const generateCode = async () => {
    const deviceId = await getDeviceId()
    setLoading(true)
    setError('')
    
    try {
      sessionLogger.info('creating_pairing_code', { deviceId })
      const result = await withTimeout(pairingApi.createPairing(deviceId), 10000)
      
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
      setError(err instanceof Error ? err.message : 'Server unavailable')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    } finally {
      setLoading(false)
    }
  }

  // Join with code
  const joinWithCode = async () => {
    if (inputCode.length !== CODE_LENGTH) {
      setError(`Enter all ${CODE_LENGTH} digits`)
      return
    }
    
    const deviceId = await getDeviceId()
    setLoading(true)
    setError('')
    Keyboard.dismiss()
    
    try {
      sessionLogger.info('joining_pairing', { code: inputCode, deviceId })
      const result = await withTimeout(pairingApi.joinPairing(deviceId, inputCode), 10000)
      
      if (result.partnerId) {
        await setPairedDeviceId(result.partnerId)
        if (result.sessionId) await setSessionId(result.sessionId)
        
        // Fetch partner profile
        const { profile } = await profileApi.get(result.partnerId)
        if (profile) {
          setPartnerInfo(profile.display_name, profile.avatar_emoji)
        }
        
        incrementSessions()
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        router.replace('/')
      } else {
        setError(result.error || 'Invalid or expired code')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Server unavailable')
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
          await setPairedDeviceId(result.partnerId)
          if (result.sessionId) await setSessionId(result.sessionId)
          
          // Fetch partner profile
          const { profile } = await profileApi.get(result.partnerId)
          if (profile) {
            setPartnerInfo(profile.display_name, profile.avatar_emoji)
          }
          
          incrementSessions()
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          router.replace('/')
        }
      } catch {}
    }, 2000)

    return () => clearInterval(interval)
  }, [mode, code, myDeviceId, setPairedDeviceId, setSessionId, setPartnerInfo, incrementSessions, router])

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

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect',
      'Are you sure you want to disconnect from your partner?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            if (myDeviceId) await pairingApi.unpair(myDeviceId)
            await clearPairing()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          },
        },
      ]
    )
  }

  const goBack = () => {
    setMode('select')
    setCode('')
    setInputCode('')
    setError('')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Loading state
  if (!deviceReady) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    )
  }

  // Profile setup
  if (showProfileSetup) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ProfileSetup onComplete={handleProfileSetup} colors={colors} />
        </ScrollView>
      </SafeAreaView>
    )
  }

  // Already connected - show clean connected state
  if (isPaired && sessionId && mode === 'select') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            {/* Intentionally no in-screen back button (avoids duplicate back buttons with Stack header). */}
          </View>
          
          <ConnectedStatus
            partnerName={partnerDisplayName}
            partnerAvatar={partnerAvatar}
            myName={myDisplayName}
            myAvatar={myAvatar}
            onGoBack={() => router.replace('/')}
            colors={colors}
          />
        </ScrollView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); if (mode === 'showCode') await generateCode(); setRefreshing(false) }} tintColor={colors.textMuted} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          {/* Intentionally no in-screen back button (avoids duplicate back buttons with Stack header). */}
          
          <Text style={[styles.title, { color: colors.text, fontSize: isSmall ? 24 : 28 }]}>
            {t.pairing.title}
          </Text>
          
          {/* My profile card */}
          {myDisplayName && (
            <View style={[styles.myProfileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.myProfileAvatar}>{myAvatar}</Text>
              <Text style={[styles.myProfileName, { color: colors.text }]}>{myDisplayName}</Text>
              <Pressable onPress={() => setShowProfileSetup(true)}>
                <Text style={[styles.editProfile, { color: colors.primary }]}>Edit</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>

        {mode === 'select' && (
          <View style={styles.modeSelect}>
            <Animated.View entering={FadeInUp.duration(300)}>
              <Pressable
                style={[styles.optionCard, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={generateCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={colors.primaryText} />
                ) : (
                  <>
                    <Text style={styles.optionEmoji}>📲</Text>
                    <Text style={[styles.optionTitle, { color: colors.primaryText }]}>{t.pairing.showCode}</Text>
                    <Text style={[styles.optionDesc, { color: `${colors.primaryText}99` }]}>Generate a code for your partner</Text>
                  </>
                )}
              </Pressable>
            </Animated.View>

            <View style={styles.orDivider}>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.orText, { color: colors.textMuted }]}>or</Text>
              <View style={[styles.orLine, { backgroundColor: colors.border }]} />
            </View>

            <Animated.View entering={FadeInUp.delay(80).duration(300)}>
              <Pressable
                style={[styles.optionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setMode('enterCode')}
              >
                <Text style={styles.optionEmoji}>🔢</Text>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{t.pairing.enterCode}</Text>
                <Text style={[styles.optionDesc, { color: colors.textMuted }]}>
                  Enter your partner’s 4-digit pairing code (not a username)
                </Text>
              </Pressable>
            </Animated.View>

            {error && (
              <Animated.View entering={FadeIn} style={[styles.errorBox, { backgroundColor: '#DC262620' }]}>
                <Text style={styles.errorText}>{error}</Text>
              </Animated.View>
            )}
          </View>
        )}

        {mode === 'showCode' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>
              Your pairing code (this is NOT your username)
            </Text>
            <CodeDisplay code={code} colors={colors} />
            
            <View style={styles.waitingInfo}>
              <ZenLoader variant="dots" size="small" />
              <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                Waiting for partner...
              </Text>
            </View>
            
            <View style={styles.expiry}>
              <Text style={[styles.expiryLabel, { color: colors.textMuted }]}>Expires in</Text>
              <Text style={[styles.expiryTime, { color: colors.text }]}>{formatTime(expiresIn)}</Text>
            </View>
            
            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={goBack}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </Animated.View>
        )}

        {mode === 'enterCode' && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.codeSection}>
            <Text style={[styles.enterTitle, { color: colors.text }]}>Enter 4-digit code</Text>
            <Text style={[styles.enterHint, { color: colors.textMuted }]}>
              Enter the 4-digit pairing code shown on your partner’s screen (not a username)
            </Text>
            
            <CodeInput value={inputCode} onChange={setInputCode} onSubmit={joinWithCode} colors={colors} />
            
            {error && <Text style={styles.errorText}>{error}</Text>}
            
            <Pressable
              style={[styles.submitBtn, { backgroundColor: inputCode.length === CODE_LENGTH ? colors.primary : colors.textMuted, opacity: inputCode.length === CODE_LENGTH ? 1 : 0.5 }]}
              onPress={joinWithCode}
              disabled={loading || inputCode.length < CODE_LENGTH}
            >
              {loading ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={[styles.submitBtnText, { color: colors.primaryText }]}>{t.pairing.connect}</Text>
              )}
            </Pressable>
            
            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={goBack}>
              <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

// Zen-inspired styles: generous whitespace, soft corners, calm typography
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 28 },  // Zen: more breathing room
  loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 16, paddingBottom: 28 },  // Zen: more space
  backBtn: { paddingVertical: 10, marginBottom: 16 },
  backBtnText: { fontSize: 16, fontWeight: '500' },  // Zen: lighter weight
  title: { fontWeight: '600', letterSpacing: -0.3, marginBottom: 16 },  // Zen: softer
  myProfileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, gap: 12 },  // Zen: softer corners
  myProfileAvatar: { fontSize: 26 },
  myProfileName: { flex: 1, fontSize: 15, fontWeight: '500' },
  editProfile: { fontSize: 14, fontWeight: '500' },
  
  // Profile Setup - Zen: spacious, calm
  profileSetup: { flex: 1, paddingTop: 48 },
  setupTitle: { fontSize: 26, fontWeight: '600', marginBottom: 12 },  // Zen: slightly smaller, lighter
  setupSubtitle: { fontSize: 15, lineHeight: 24, marginBottom: 40 },  // Zen: more line height
  labelText: { fontSize: 12, fontWeight: '500', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.8 },
  avatarSection: { marginBottom: 36 },  // Zen: more space
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },  // Zen: more gap
  avatarOption: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji: { fontSize: 28 },
  nameSection: { marginBottom: 40 },
  nameInput: { paddingVertical: 18, paddingHorizontal: 18, borderRadius: 14, borderWidth: 1.5, fontWeight: '500', fontSize: 16 },
  continueBtn: { paddingVertical: 20, borderRadius: 14, alignItems: 'center' },  // Zen: taller button
  continueBtnText: { fontSize: 16, fontWeight: '600' },

  // Connected Status - Zen: celebratory but calm
  connectedContainer: { flex: 1, paddingTop: 40, alignItems: 'center' },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 28, marginBottom: 40 },
  successIcon: { fontSize: 18 },
  successText: { fontSize: 15, fontWeight: '500' },
  connectedCard: { borderRadius: 20, borderWidth: 1, padding: 32, marginBottom: 32, width: '100%' },  // Zen: softer corners
  connectionVisual: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deviceInfo: { alignItems: 'center', gap: 10 },
  deviceAvatar: { fontSize: 44 },
  deviceName: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  connectionLine: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, paddingHorizontal: 20 },
  connectionDot: { width: 10, height: 10, borderRadius: 5 },
  connectionDash: { flex: 1, height: 2, borderRadius: 1 },  // Zen: thinner line
  primaryBtn: { paddingVertical: 20, paddingHorizontal: 52, borderRadius: 14, marginBottom: 20 },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  hintText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },

  // Mode Select - Zen: clear choices
  modeSelect: { flex: 1 },
  optionCard: { padding: 24, borderRadius: 16, borderWidth: 1, alignItems: 'center', marginBottom: 16 },  // Zen: more padding
  optionEmoji: { fontSize: 36, marginBottom: 12 },
  optionTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  optionDesc: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  orDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },  // Zen: more space
  orLine: { flex: 1, height: 1 },
  orText: { paddingHorizontal: 20, fontSize: 13, fontWeight: '400' },  // Zen: lighter
  errorBox: { padding: 14, borderRadius: 12, marginTop: 20 },
  errorText: { color: '#C17B7B', fontSize: 14, fontWeight: '500', textAlign: 'center' },  // Zen: muted error color

  // Code Section - Zen: focused, calm waiting
  codeSection: { flex: 1, alignItems: 'center', paddingTop: 32 },
  codeLabel: { fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 20 },
  codeDisplay: { flexDirection: 'row', gap: 14, marginBottom: 40 },
  codeChar: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  codeCharText: { fontWeight: '600', fontFamily: 'monospace' },
  codeInputContainer: { marginBottom: 28 },
  codeInputChar: { borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  codeInputCharText: { fontWeight: '600', fontFamily: 'monospace' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0 },
  waitingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 28 },
  waitingText: { fontSize: 14, fontWeight: '400' },
  expiry: { alignItems: 'center', marginBottom: 40 },
  expiryLabel: { fontSize: 12, marginBottom: 6 },
  expiryTime: { fontSize: 22, fontWeight: '500', fontFamily: 'monospace' },
  enterTitle: { fontSize: 20, fontWeight: '500', marginBottom: 6 },
  enterHint: { fontSize: 14, marginBottom: 28, lineHeight: 21 },
  submitBtn: { paddingVertical: 18, paddingHorizontal: 44, borderRadius: 14, marginBottom: 20, minWidth: 180, alignItems: 'center' },
  submitBtnText: { fontSize: 16, fontWeight: '600' },
  cancelBtn: { paddingVertical: 14, paddingHorizontal: 28, borderWidth: 1, borderRadius: 12, minHeight: 48 },
  cancelBtnText: { fontSize: 15, fontWeight: '400' },
})
