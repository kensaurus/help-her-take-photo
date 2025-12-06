/**
 * AnimatedButton - Polished press animation with haptic & sound feedback
 * Micro-interactions: scale, opacity, color shift
 */

import { ReactNode } from 'react'
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
  Easing,
  withSequence,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../stores/themeStore'
import { Icon } from './Icon'

interface AnimatedButtonProps {
  label?: string
  children?: ReactNode
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  loading?: boolean
  icon?: 'camera' | 'eye' | 'image' | 'check' | 'close' | 'send' | 'share' | 'refresh' | 'plus'
  iconPosition?: 'left' | 'right'
  style?: ViewStyle
  textStyle?: TextStyle
  haptic?: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'none'
  fullWidth?: boolean
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function AnimatedButton({
  label,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  haptic = 'light',
  fullWidth = false,
}: AnimatedButtonProps) {
  const { colors } = useThemeStore()
  const pressed = useSharedValue(0)
  const scale = useSharedValue(1)

  const handlePressIn = () => {
    if (disabled || loading) return
    
    pressed.value = withTiming(1, { duration: 80, easing: Easing.out(Easing.ease) })
    scale.value = withSpring(0.97, { 
      damping: 15, 
      stiffness: 400,
    })
    
    // Haptic feedback
    if (haptic !== 'none') {
      switch (haptic) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          break
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
          break
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
          break
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          break
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
    }
  }

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 150 })
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: colors.primary,
          bgPressed: colors.textSecondary,
          text: colors.primaryText,
          border: colors.primary,
        }
      case 'secondary':
        return {
          bg: colors.surface,
          bgPressed: colors.surfaceAlt,
          text: colors.text,
          border: colors.border,
        }
      case 'ghost':
        return {
          bg: 'transparent',
          bgPressed: colors.surfaceAlt,
          text: colors.text,
          border: 'transparent',
        }
      case 'outline':
        return {
          bg: 'transparent',
          bgPressed: colors.surfaceAlt,
          text: colors.text,
          border: colors.border,
        }
      case 'danger':
        return {
          bg: colors.error,
          bgPressed: `${colors.error}CC`,
          text: '#FFFFFF',
          border: colors.error,
        }
      default:
        return {
          bg: colors.primary,
          bgPressed: colors.textSecondary,
          text: colors.primaryText,
          border: colors.primary,
        }
    }
  }

  const variantColors = getVariantColors()

  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = interpolateColor(
      pressed.value,
      [0, 1],
      [variantColors.bg, variantColors.bgPressed]
    )

    return {
      transform: [{ scale: scale.value }],
      backgroundColor: variant === 'ghost' || variant === 'outline' 
        ? interpolateColor(pressed.value, [0, 1], ['transparent', colors.surfaceAlt])
        : bgColor,
      opacity: interpolate(pressed.value, [0, 1], [1, 0.95]),
    }
  })

  const sizeStyles: Record<string, { paddingVertical: number; paddingHorizontal: number; minHeight: number }> = {
    sm: { paddingVertical: 10, paddingHorizontal: 14, minHeight: 40 },
    md: { paddingVertical: 14, paddingHorizontal: 20, minHeight: 48 },
    lg: { paddingVertical: 18, paddingHorizontal: 28, minHeight: 56 },
    xl: { paddingVertical: 22, paddingHorizontal: 36, minHeight: 64 },
  }

  const textSizes: Record<string, number> = {
    sm: 13,
    md: 15,
    lg: 17,
    xl: 18,
  }

  const iconSizes: Record<string, number> = {
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
  }

  const variantBorderStyle: ViewStyle = 
    variant === 'outline' || variant === 'secondary'
      ? { borderWidth: 1, borderColor: variantColors.border }
      : {}

  const renderContent = () => {
    if (loading) {
      return (
        <Icon 
          name="loading" 
          size={iconSizes[size]} 
          color={variantColors.text} 
          animated 
        />
      )
    }

    if (children) {
      return children
    }

    const iconElement = icon && (
      <Icon 
        name={icon} 
        size={iconSizes[size]} 
        color={variantColors.text} 
      />
    )

    const labelElement = label && (
      <Text
        style={[
          styles.text,
          { 
            fontSize: textSizes[size],
            color: variantColors.text,
          },
          disabled && styles.disabledText,
          textStyle,
        ]}
      >
        {label}
      </Text>
    )

    if (icon && label) {
      return (
        <View style={[styles.contentRow, iconPosition === 'right' && styles.contentRowReverse]}>
          {iconElement}
          <View style={{ width: 8 }} />
          {labelElement}
        </View>
      )
    }

    return iconElement || labelElement
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        sizeStyles[size],
        variantBorderStyle,
        disabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
        animatedStyle,
      ]}
    >
      {renderContent()}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  fullWidth: {
    width: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentRowReverse: {
    flexDirection: 'row-reverse',
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
})
