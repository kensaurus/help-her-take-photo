/**
 * CutesBadge - Soft informational badge
 * 
 * Design Philosophy:
 * - Soft pill shape with wavy/organic feel
 * - No harsh shadows (informational, not action)
 * - Muted pastel colors
 * - Distinguished from clickable buttons
 */

import { View, Text, StyleSheet, Pressable } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../stores/themeStore'
import { Icon } from './Icon'

type BadgeVariant = 'info' | 'success' | 'warning' | 'accent' | 'muted'
type BadgeSize = 'small' | 'medium'

interface CutesBadgeProps {
  label: string
  variant?: BadgeVariant
  size?: BadgeSize
  icon?: 'star' | 'heart' | 'check' | 'dot'
  onPress?: () => void
  showDot?: boolean
  dotColor?: string
  animated?: boolean
}

export function CutesBadge({
  label,
  variant = 'info',
  size = 'medium',
  icon,
  onPress,
  showDot,
  dotColor,
  animated = false,
}: CutesBadgeProps) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)

  const getBadgeColors = () => {
    switch (variant) {
      case 'success':
        return {
          bg: `${colors.success}20`,
          text: colors.success,
          border: `${colors.success}30`,
        }
      case 'warning':
        return {
          bg: colors.pastelPeach,
          text: colors.text,
          border: `${colors.pastelPeach}`,
        }
      case 'accent':
        return {
          bg: colors.badgeBg,
          text: colors.accent,
          border: `${colors.accent}30`,
        }
      case 'muted':
        return {
          bg: colors.surfaceAlt,
          text: colors.textMuted,
          border: colors.borderLight,
        }
      default: // info
        return {
          bg: colors.badgeBg,
          text: colors.text,
          border: colors.borderLight,
        }
    }
  }

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 4,
          paddingHorizontal: 10,
          fontSize: 11,
          iconSize: 10,
        }
      default:
        return {
          paddingVertical: 8,
          paddingHorizontal: 14,
          fontSize: 12,
          iconSize: 12,
        }
    }
  }

  const badgeColors = getBadgeColors()
  const sizeStyles = getSizeStyles()

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const handlePressOut = () => {
    if (onPress) {
      scale.value = withSpring(1, { damping: 15 })
    }
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const BadgeContent = (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: badgeColors.bg,
          borderColor: badgeColors.border,
          paddingVertical: sizeStyles.paddingVertical,
          paddingHorizontal: sizeStyles.paddingHorizontal,
        },
        animatedStyle,
      ]}
    >
      {/* Decorative wavy top edge - subtle organic feel */}
      <View style={[styles.wavyDecor, { backgroundColor: badgeColors.bg }]} />
      
      {showDot && (
        <View
          style={[
            styles.dot,
            { backgroundColor: dotColor || badgeColors.text },
          ]}
        />
      )}
      
      {icon && (
        <View style={styles.iconContainer}>
          <Icon name={icon} size={sizeStyles.iconSize} color={badgeColors.text} />
        </View>
      )}
      
      <Text
        style={[
          styles.label,
          {
            color: badgeColors.text,
            fontSize: sizeStyles.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </Animated.View>
  )

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={label}
        accessibilityRole="button"
      >
        {BadgeContent}
      </Pressable>
    )
  }

  return BadgeContent
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    // Soft organic pill shape - distinct from angular buttons
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    position: 'relative',
    overflow: 'hidden',
  },
  wavyDecor: {
    position: 'absolute',
    top: -2,
    left: '20%',
    right: '20%',
    height: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    opacity: 0.5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  iconContainer: {
    marginRight: 2,
  },
  label: {
    fontWeight: '500',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
})
