/**
 * AnimatedButton - Beautiful press animation with haptic feedback
 */

import { ReactNode } from 'react'
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../../stores/themeStore'

interface AnimatedButtonProps {
  label?: string
  children?: ReactNode
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  disabled?: boolean
  style?: ViewStyle
  textStyle?: TextStyle
  haptic?: 'light' | 'medium' | 'heavy' | 'none'
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function AnimatedButton({
  label,
  children,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  style,
  textStyle,
  haptic = 'light',
}: AnimatedButtonProps) {
  const { colors } = useThemeStore()
  const pressed = useSharedValue(0)
  const scale = useSharedValue(1)

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 100 })
    scale.value = withSpring(0.97, { 
      damping: 15, 
      stiffness: 400,
    })
    
    if (haptic !== 'none') {
      const feedback = haptic === 'heavy' 
        ? Haptics.ImpactFeedbackStyle.Heavy
        : haptic === 'medium'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light
      Haptics.impactAsync(feedback)
    }
  }

  const handlePressOut = () => {
    pressed.value = withTiming(0, { duration: 200 })
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  const animatedStyle = useAnimatedStyle(() => {
    const bgColor = variant === 'primary'
      ? interpolateColor(
          pressed.value,
          [0, 1],
          [colors.primary, colors.textSecondary]
        )
      : variant === 'secondary'
      ? interpolateColor(
          pressed.value,
          [0, 1],
          [colors.surface, colors.surfaceAlt]
        )
      : 'transparent'

    return {
      transform: [{ scale: scale.value }],
      backgroundColor: variant === 'ghost' || variant === 'outline' ? 'transparent' : bgColor,
      opacity: interpolate(pressed.value, [0, 1], [1, 0.9]),
    }
  })

  const sizeStyles = {
    sm: { paddingVertical: 10, paddingHorizontal: 16 },
    md: { paddingVertical: 16, paddingHorizontal: 24 },
    lg: { paddingVertical: 20, paddingHorizontal: 32 },
    xl: { paddingVertical: 24, paddingHorizontal: 40 },
  }

  const textSizes = {
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
  }

  const variantStyles: ViewStyle = {
    primary: {},
    secondary: { borderWidth: 1, borderColor: colors.border },
    ghost: {},
    outline: { borderWidth: 1, borderColor: colors.border },
  }[variant]

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles,
        disabled && styles.disabled,
        style,
        animatedStyle,
      ]}
    >
      {children || (
        <Text
          style={[
            styles.text,
            { 
              fontSize: textSizes[size],
              color: variant === 'primary' ? colors.primaryText : colors.text,
            },
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {label}
        </Text>
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    minHeight: 48,
  },
  text: {
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.7,
  },
})

