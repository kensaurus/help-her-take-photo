/**
 * ArtisticButton - Cutesy asymmetric button design
 * 
 * Design Philosophy:
 * - Chamfered corners (not generic rounded)
 * - Subtle glow effect for clickability indication
 * - Playful pastel gradients
 * - Clear hover/press states with bounce
 */

import { View, Text, StyleSheet, Pressable, ViewStyle, TextStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../stores/themeStore'
import { Icon } from './Icon'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent'
type ButtonSize = 'small' | 'medium' | 'large'

interface ArtisticButtonProps {
  label: string
  onPress: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: 'camera' | 'eye' | 'image' | 'link' | 'chevron-right' | 'send' | 'check'
  iconPosition?: 'left' | 'right'
  disabled?: boolean
  fullWidth?: boolean
  accessibilityHint?: string
}

export function ArtisticButton({
  label,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  iconPosition = 'right',
  disabled = false,
  fullWidth = false,
  accessibilityHint,
}: ArtisticButtonProps) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  const glow = useSharedValue(0)

  const getButtonColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary,
          text: colors.primaryText,
          border: colors.primary,
          glowColor: colors.buttonGlow,
        }
      case 'secondary':
        return {
          bg: colors.surface,
          text: colors.text,
          border: colors.border,
          glowColor: colors.buttonGlow,
        }
      case 'accent':
        return {
          bg: colors.accent,
          text: colors.accentText,
          border: colors.accent,
          glowColor: `${colors.accent}40`,
        }
      case 'ghost':
        return {
          bg: 'transparent',
          text: colors.text,
          border: colors.border,
          glowColor: colors.buttonGlow,
        }
      default:
        return {
          bg: colors.primary,
          text: colors.primaryText,
          border: colors.primary,
          glowColor: colors.buttonGlow,
        }
    }
  }

  const getSizeStyles = (): { button: ViewStyle; text: TextStyle; icon: number } => {
    switch (size) {
      case 'small':
        return {
          button: { paddingVertical: 10, paddingHorizontal: 16 },
          text: { fontSize: 13 },
          icon: 14,
        }
      case 'large':
        return {
          button: { paddingVertical: 18, paddingHorizontal: 28 },
          text: { fontSize: 17 },
          icon: 20,
        }
      default:
        return {
          button: { paddingVertical: 14, paddingHorizontal: 22 },
          text: { fontSize: 15 },
          icon: 16,
        }
    }
  }

  const buttonColors = getButtonColors()
  const sizeStyles = getSizeStyles()

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 })
    glow.value = withTiming(1, { duration: 100 })
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
  }

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 })
    glow.value = withTiming(0, { duration: 200 })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.6]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.95, 1.02]) }],
  }))

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={fullWidth ? styles.fullWidth : undefined}
    >
      {/* Glow layer */}
      <Animated.View
        style={[
          styles.glowLayer,
          { backgroundColor: buttonColors.glowColor },
          glowStyle,
        ]}
      />
      
      <Animated.View
        style={[
          styles.button,
          sizeStyles.button,
          {
            backgroundColor: buttonColors.bg,
            borderColor: buttonColors.border,
            opacity: disabled ? 0.5 : 1,
          },
          animatedStyle,
        ]}
      >
        {icon && iconPosition === 'left' && (
          <View style={styles.iconLeft}>
            <Icon name={icon} size={sizeStyles.icon} color={buttonColors.text} />
          </View>
        )}
        
        <Text style={[styles.label, sizeStyles.text, { color: buttonColors.text }]}>
          {label}
        </Text>
        
        {icon && iconPosition === 'right' && (
          <View style={styles.iconRight}>
            <Icon name={icon} size={sizeStyles.icon} color={buttonColors.text} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
  glowLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 6, // Subtle chamfer - less rounded
    // Artistic asymmetric shape hint
    borderTopLeftRadius: 12,
    borderBottomRightRadius: 12,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    // Artistic asymmetric corners - NOT generic rounded
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    minHeight: 48, // Accessibility
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
})
