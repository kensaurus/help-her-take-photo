/**
 * ZenEmptyState - Calming empty state displays
 * 
 * Transform empty moments into peaceful pauses.
 * Uses gentle animations and mindful messaging.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
  FadeInUp,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../stores/themeStore'
import { ZenTiming, SpringConfigs } from '../../lib/microInteractions'

interface ZenEmptyStateProps {
  icon?: 'camera' | 'gallery' | 'connection' | 'peace' | 'search'
  title: string
  description?: string
  action?: {
    label: string
    onPress: () => void
  }
}

/**
 * Floating icon with gentle bob animation
 */
function FloatingIcon({ icon, color }: { icon: string; color: string }) {
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(0.7)
  
  useEffect(() => {
    // Gentle floating motion
    translateY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(6, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    )
    
    // Subtle breathing opacity
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.9, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View style={[styles.iconContainer, animatedStyle]}>
      <Text style={[styles.icon, { color }]}>{icon}</Text>
    </Animated.View>
  )
}

/**
 * Decorative zen circles (background)
 */
function ZenCircles({ color }: { color: string }) {
  return (
    <View style={styles.circlesContainer}>
      <ZenCircle size={120} delay={0} color={color} />
      <ZenCircle size={80} delay={500} color={color} />
      <ZenCircle size={160} delay={1000} color={color} />
    </View>
  )
}

function ZenCircle({ size, delay, color }: { size: number; delay: number; color: string }) {
  const scale = useSharedValue(0.8)
  const opacity = useSharedValue(0)
  
  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    )
    
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.08, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.03, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View 
      style={[
        styles.zenCircle,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle
      ]} 
    />
  )
}

const iconMap = {
  camera: '📷',
  gallery: '🖼️',
  connection: '🔗',
  peace: '🕊️',
  search: '🔍',
}

export function ZenEmptyState({ 
  icon = 'peace',
  title, 
  description,
  action,
}: ZenEmptyStateProps) {
  const { colors } = useThemeStore()
  
  const handleAction = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    action?.onPress()
  }
  
  return (
    <Animated.View 
      entering={FadeIn.duration(ZenTiming.fadeIn)}
      style={styles.container}
    >
      {/* Background circles */}
      <ZenCircles color={colors.zen} />
      
      {/* Floating icon */}
      <Animated.View entering={FadeInUp.delay(200).duration(600)}>
        <FloatingIcon icon={iconMap[icon]} color={colors.textMuted} />
      </Animated.View>
      
      {/* Title */}
      <Animated.Text 
        entering={FadeInUp.delay(350).duration(500)}
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Animated.Text>
      
      {/* Description */}
      {description && (
        <Animated.Text 
          entering={FadeInUp.delay(450).duration(500)}
          style={[styles.description, { color: colors.textSecondary }]}
        >
          {description}
        </Animated.Text>
      )}
      
      {/* Action button */}
      {action && (
        <Animated.View entering={FadeInUp.delay(550).duration(500)}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.zenMuted }]}
            onPress={handleAction}
            accessibilityLabel={action.label}
            accessibilityRole="button"
          >
            <Text style={[styles.actionText, { color: colors.text }]}>
              {action.label}
            </Text>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  )
}

/**
 * Mindful message - for quiet moments
 */
export function ZenMoment({ message }: { message?: string }) {
  const { colors } = useThemeStore()
  
  const messages = [
    'Breathe in... breathe out...',
    'A moment of calm',
    'Ready when you are',
    'Take your time',
    'Everything in its place',
  ]
  
  const displayMessage = message || messages[Math.floor(Math.random() * messages.length)]
  
  const opacity = useSharedValue(0.5)
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View 
      entering={FadeIn.duration(800)}
      style={styles.momentContainer}
    >
      <Animated.Text style={[styles.momentText, { color: colors.textMuted }, animatedStyle]}>
        {displayMessage}
      </Animated.Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  circlesContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zenCircle: {
    position: 'absolute',
  },
  iconContainer: {
    marginBottom: 8,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  actionButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    minHeight: 48,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  momentContainer: {
    padding: 20,
    alignItems: 'center',
  },
  momentText: {
    fontSize: 14,
    fontWeight: '400',
    fontStyle: 'italic',
    letterSpacing: 0.5,
  },
})

export default ZenEmptyState
