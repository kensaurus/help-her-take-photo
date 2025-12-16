/**
 * ArtisticCard - Cutesy asymmetric card design
 * 
 * Design Philosophy:
 * - Chamfered/angular corners (not generic rounded)
 * - Subtle blob decoration for playfulness
 * - Pastel accent colors
 * - Clear clickable vs non-clickable distinction
 */

import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../stores/themeStore'
import { Icon } from './Icon'

type CardVariant = 'default' | 'highlighted' | 'subtle'

interface ArtisticCardProps {
  title: string
  subtitle?: string
  icon?: 'camera' | 'eye' | 'image' | 'link' | 'user' | 'settings'
  onPress?: () => void
  variant?: CardVariant
  showArrow?: boolean
  accessibilityHint?: string
  children?: React.ReactNode
}

export function ArtisticCard({
  title,
  subtitle,
  icon,
  onPress,
  variant = 'default',
  showArrow = true,
  accessibilityHint,
  children,
}: ArtisticCardProps) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  const pressed = useSharedValue(0)
  const shimmer = useSharedValue(0)

  // Subtle shimmer animation on highlighted cards
  useEffect(() => {
    if (variant === 'highlighted') {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    }
  }, [variant, shimmer])

  const getCardColors = () => {
    switch (variant) {
      case 'highlighted':
        return {
          bg: colors.primary,
          text: colors.primaryText,
          subtitle: `${colors.primaryText}90`,
          border: colors.primary,
          iconBg: `${colors.primaryText}20`,
          iconColor: colors.primaryText,
          shimmerColor: `${colors.primaryText}10`,
        }
      case 'subtle':
        return {
          bg: colors.surfaceAlt,
          text: colors.text,
          subtitle: colors.textMuted,
          border: colors.borderLight,
          iconBg: colors.surface,
          iconColor: colors.textSecondary,
          shimmerColor: 'transparent',
        }
      default:
        return {
          bg: colors.surface,
          text: colors.text,
          subtitle: colors.textMuted,
          border: colors.border,
          iconBg: colors.surfaceAlt,
          iconColor: colors.text,
          shimmerColor: 'transparent',
        }
    }
  }

  const cardColors = getCardColors()

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.98, { damping: 20, stiffness: 300 })
      pressed.value = withTiming(1, { duration: 100 })
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 18, stiffness: 250 })
      pressed.value = withTiming(0, { duration: 200 })
    }
  }

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.95]),
  }))

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0, 0.15]),
  }))

  const CardContent = (
    <Animated.View style={[styles.card, { borderColor: cardColors.border, backgroundColor: cardColors.bg }, cardStyle]}>
      {/* Shimmer overlay for highlighted cards */}
      {variant === 'highlighted' && (
        <Animated.View
          style={[styles.shimmer, { backgroundColor: cardColors.shimmerColor }, shimmerStyle]}
        />
      )}
      
      {/* Decorative blob in corner - artistic touch */}
      <View style={[styles.decorBlob, { backgroundColor: cardColors.iconBg }]} />
      
      {/* Icon */}
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: cardColors.iconBg }]}>
          <Icon name={icon} size={26} color={cardColors.iconColor} />
        </View>
      )}
      
      {/* Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: cardColors.text }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: cardColors.subtitle }]}>
            {subtitle}
          </Text>
        )}
        {children}
      </View>
      
      {/* Arrow indicator for clickable cards */}
      {onPress && showArrow && (
        <View style={styles.arrowContainer}>
          <Icon
            name="chevron-right"
            size={16}
            color={cardColors.subtitle}
          />
        </View>
      )}
    </Animated.View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
        accessibilityLabel={`${title}${subtitle ? `. ${subtitle}` : ''}`}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
      >
        {CardContent}
      </Pressable>
    )
  }

  return CardContent
}

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    // Artistic asymmetric corners - NOT generic rounded
    borderTopLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    minHeight: 88,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  decorBlob: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 60,
    height: 60,
    // Organic blob shape
    borderRadius: 30,
    opacity: 0.3,
    transform: [{ rotate: '15deg' }],
  },
  iconContainer: {
    width: 52,
    height: 52,
    // Asymmetric icon container matching card style
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: '400',
    lineHeight: 19,
  },
  arrowContainer: {
    paddingLeft: 12,
    opacity: 0.6,
  },
})
