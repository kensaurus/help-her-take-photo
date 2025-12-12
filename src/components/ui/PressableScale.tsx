/**
 * PressableScale - Reusable pressable with scale animation and haptic feedback
 * Follows Material Design and iOS HIG touch feedback patterns
 * 
 * Features:
 * - Spring physics for natural feel (damping: 15, stiffness: 400)
 * - Haptic feedback with different intensities
 * - Reduced motion accessibility support
 * - Keep animations under 300ms per Material guidelines
 */

import { ReactNode } from 'react'
import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { buttonHaptic } from '../../utils/haptics'
import { useSettingsStore } from '../../stores/settingsStore'

interface PressableScaleProps extends Omit<PressableProps, 'style'> {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  scaleValue?: number
  hapticType?: 'light' | 'medium' | 'heavy' | 'none'
  accessibilityLabel: string
  accessibilityHint?: string
  accessibilityRole?: 'button' | 'link' | 'tab' | 'menuitem' | 'checkbox' | 'radio'
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function PressableScale({
  children,
  style,
  scaleValue = 0.97,
  hapticType = 'light',
  onPressIn,
  onPressOut,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  disabled,
  ...props
}: PressableScaleProps) {
  const { settings } = useSettingsStore()
  const reduceMotion = settings.reduceMotion
  
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  const handlePressIn = (e: any) => {
    // Respect reduced motion preference
    if (reduceMotion) {
      opacity.value = withTiming(0.7, { duration: 50 })
    } else {
      // Spring animation for natural feel (under 300ms)
      scale.value = withSpring(scaleValue, { 
        damping: 15, 
        stiffness: 400,
        mass: 0.8,
      })
      opacity.value = withTiming(0.9, { duration: 50 })
    }
    
    // Use centralized haptics with accessibility support
    if (hapticType !== 'none') {
      buttonHaptic(hapticType)
    }
    
    onPressIn?.(e)
  }

  const handlePressOut = (e: any) => {
    if (reduceMotion) {
      opacity.value = withTiming(1, { duration: 100 })
    } else {
      scale.value = withSpring(1, { 
        damping: 15, 
        stiffness: 300,
        mass: 0.8,
      })
      opacity.value = withTiming(1, { duration: 100 })
    }
    onPressOut?.(e)
  }

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled ?? undefined }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  )
}

/**
 * Higher opacity scale effect for subtle interactions
 */
export function PressableOpacity({
  children,
  style,
  onPressIn,
  onPressOut,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  disabled,
  ...props
}: PressableScaleProps) {
  const opacity = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const handlePressIn = (e: any) => {
    opacity.value = withTiming(0.6, { duration: 80 })
    buttonHaptic('light')
    onPressIn?.(e)
  }

  const handlePressOut = (e: any) => {
    opacity.value = withTiming(1, { duration: 150 })
    onPressOut?.(e)
  }

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ disabled: disabled ?? undefined }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  )
}

