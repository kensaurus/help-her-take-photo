/**
 * AnimatedPressable - A delightful, physics-based pressable component
 * 
 * Features:
 * - Smooth scale + opacity animations on press
 * - Configurable spring physics
 * - Haptic feedback
 * - Accessibility support
 */

import React, { useCallback } from 'react'
import { 
  Pressable, 
  PressableProps, 
  ViewStyle, 
  StyleProp,
  AccessibilityRole,
} from 'react-native'
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import { 
  SpringConfigs, 
  TimingConfigs, 
  ScaleValues, 
  HapticPatterns,
  InteractionPresets,
} from '../../lib/microInteractions'

type InteractionType = keyof typeof InteractionPresets

interface AnimatedPressableProps extends Omit<PressableProps, 'style'> {
  /** Child elements */
  children: React.ReactNode
  /** Style for the animated container */
  style?: StyleProp<ViewStyle>
  /** Preset interaction type */
  interaction?: InteractionType
  /** Custom pressed scale (overrides preset) */
  pressedScale?: number
  /** Whether to include haptic feedback */
  haptic?: boolean
  /** Custom haptic pattern */
  hapticPattern?: keyof typeof HapticPatterns
  /** Disable the animation (useful for loading states) */
  animationDisabled?: boolean
  /** Accessibility role */
  accessibilityRole?: AccessibilityRole
}

const AnimatedPressableView = Animated.createAnimatedComponent(Pressable)

export function AnimatedPressable({
  children,
  style,
  interaction = 'button',
  pressedScale,
  haptic = true,
  hapticPattern,
  animationDisabled = false,
  disabled,
  onPress,
  onPressIn,
  onPressOut,
  ...pressableProps
}: AnimatedPressableProps) {
  const pressed = useSharedValue(0) // 0 = not pressed, 1 = pressed
  
  const preset = InteractionPresets[interaction]
  const scale = pressedScale ?? preset.scale
  
  const animatedStyle = useAnimatedStyle(() => {
    if (animationDisabled) return {}
    
    return {
      transform: [
        { 
          scale: interpolate(
            pressed.value, 
            [0, 1], 
            [1, scale],
            Extrapolation.CLAMP
          ) 
        }
      ],
      opacity: interpolate(
        pressed.value,
        [0, 1],
        [1, 0.9],
        Extrapolation.CLAMP
      ),
    }
  })

  const handlePressIn = useCallback((e: any) => {
    if (!animationDisabled && !disabled) {
      pressed.value = withTiming(1, TimingConfigs.instant)
    }
    onPressIn?.(e)
  }, [animationDisabled, disabled, onPressIn])

  const handlePressOut = useCallback((e: any) => {
    if (!animationDisabled && !disabled) {
      pressed.value = withSpring(0, preset.spring)
    }
    onPressOut?.(e)
  }, [animationDisabled, disabled, preset.spring, onPressOut])

  const handlePress = useCallback((e: any) => {
    if (haptic && !disabled) {
      const hapticFn = hapticPattern 
        ? HapticPatterns[hapticPattern] 
        : preset.haptic
      hapticFn()
    }
    onPress?.(e)
  }, [haptic, hapticPattern, disabled, preset.haptic, onPress])

  return (
    <AnimatedPressableView
      style={[animatedStyle, style]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      {...pressableProps}
    >
      {children}
    </AnimatedPressableView>
  )
}

/**
 * Pre-configured variants for common use cases
 */

export function ButtonPressable(props: Omit<AnimatedPressableProps, 'interaction'>) {
  return <AnimatedPressable interaction="button" {...props} />
}

export function CardPressable(props: Omit<AnimatedPressableProps, 'interaction'>) {
  return <AnimatedPressable interaction="card" {...props} />
}

export function PrimaryButtonPressable(props: Omit<AnimatedPressableProps, 'interaction'>) {
  return <AnimatedPressable interaction="primaryButton" {...props} />
}

export function DestructivePressable(props: Omit<AnimatedPressableProps, 'interaction'>) {
  return <AnimatedPressable interaction="destructive" {...props} />
}

export default AnimatedPressable
