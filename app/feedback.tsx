/**
 * Feedback - Submit feature requests and bug reports
 */

import { useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../src/stores/themeStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { feedbackApi } from '../src/services/api'

type FeedbackType = 'feature' | 'bug' | 'other'

function TypeButton({ 
  label, 
  type, 
  selected, 
  onPress 
}: { 
  label: string
  type: FeedbackType
  selected: boolean
  onPress: () => void 
}) {
  const { colors } = useThemeStore()
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
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
    >
      <Animated.View style={[
        styles.typeButton,
        { 
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        animatedStyle
      ]}>
        <Text style={[
          styles.typeButtonText,
          { color: selected ? colors.primaryText : colors.text }
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

function RatingButton({ 
  value, 
  selected, 
  onPress 
}: { 
  value: number
  selected: boolean
  onPress: () => void 
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, { damping: 15 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
    >
      <Animated.View style={[
        styles.ratingButton,
        { 
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        animatedStyle
      ]}>
        <Text style={[
          styles.ratingText,
          { color: selected ? colors.primaryText : colors.text }
        ]}>
          {value}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export default function FeedbackScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { t } = useLanguageStore()
  const { myDeviceId } = usePairingStore()
  
  const [type, setType] = useState<FeedbackType>('feature')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [rating, setRating] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (message.length < 10) {
      Alert.alert('Error', 'Please enter at least 10 characters')
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      return
    }

    setSubmitting(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const result = await feedbackApi.submit({
      deviceId: myDeviceId || undefined,
      type,
      message,
      email: email || undefined,
      rating: rating || undefined,
    })

    setSubmitting(false)

    if (result.success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert(
        'Thank you!',
        'Your feedback has been submitted. We appreciate your input!',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Error', result.error || 'Failed to submit feedback')
    }
  }

  const scale = useSharedValue(1)
  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView 
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Send Feedback
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Help us improve the app
            </Text>
          </Animated.View>

          {/* Type Selection */}
          <Animated.View entering={FadeInUp.delay(50).duration(300)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>TYPE</Text>
            <View style={styles.typeRow}>
              <TypeButton 
                label="Feature Request" 
                type="feature"
                selected={type === 'feature'} 
                onPress={() => setType('feature')} 
              />
              <TypeButton 
                label="Bug Report" 
                type="bug"
                selected={type === 'bug'} 
                onPress={() => setType('bug')} 
              />
              <TypeButton 
                label="Other" 
                type="other"
                selected={type === 'other'} 
                onPress={() => setType('other')} 
              />
            </View>
          </Animated.View>

          {/* Message */}
          <Animated.View entering={FadeInUp.delay(100).duration(300)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>MESSAGE *</Text>
            <TextInput
              style={[
                styles.messageInput,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  color: colors.text,
                }
              ]}
              placeholder={
                type === 'feature' 
                  ? "Describe the feature you'd like to see..."
                  : type === 'bug'
                  ? "Describe the bug and how to reproduce it..."
                  : "What's on your mind?"
              }
              placeholderTextColor={colors.textMuted}
              value={message}
              onChangeText={setMessage}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>
              {message.length}/500
            </Text>
          </Animated.View>

          {/* Email (optional) */}
          <Animated.View entering={FadeInUp.delay(150).duration(300)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              EMAIL (optional)
            </Text>
            <TextInput
              style={[
                styles.emailInput,
                { 
                  backgroundColor: colors.surface, 
                  borderColor: colors.border,
                  color: colors.text,
                }
              ]}
              placeholder="your@email.com"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={[styles.helpText, { color: colors.textMuted }]}>
              We'll only use this to follow up on your feedback
            </Text>
          </Animated.View>

          {/* Rating */}
          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              RATE YOUR EXPERIENCE (optional)
            </Text>
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <RatingButton
                  key={value}
                  value={value}
                  selected={rating === value}
                  onPress={() => setRating(value)}
                />
              ))}
            </View>
          </Animated.View>

          {/* Submit */}
          <Animated.View entering={FadeInUp.delay(250).duration(300)} style={styles.submitSection}>
            <Pressable
              style={[
                styles.submitButton,
                { 
                  backgroundColor: message.length >= 10 ? colors.primary : colors.textMuted,
                  opacity: submitting ? 0.7 : 1,
                }
              ]}
              onPress={handleSubmit}
              onPressIn={() => {
                if (message.length >= 10) {
                  scale.value = withSpring(0.98, { damping: 15 })
                }
              }}
              onPressOut={() => {
                scale.value = withSpring(1, { damping: 15 })
              }}
              disabled={submitting}
            >
              <Animated.View style={buttonStyle}>
                <Text style={[styles.submitButtonText, { color: colors.primaryText }]}>
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </Text>
              </Animated.View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  header: {
    paddingHorizontal: 20,
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
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  messageInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    minHeight: 140,
    lineHeight: 22,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 6,
  },
  emailInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
  },
  helpText: {
    fontSize: 12,
    marginTop: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 10,
  },
  ratingButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingText: {
    fontSize: 18,
    fontWeight: '600',
  },
  submitSection: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})

