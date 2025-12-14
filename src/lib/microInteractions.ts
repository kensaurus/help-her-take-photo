/**
 * Micro-interactions Configuration
 * 
 * Centralized spring physics, timing configs, and haptic patterns
 * for consistent, delightful interactions across the app.
 */

import * as Haptics from 'expo-haptics'
import { 
  withSpring, 
  withTiming, 
  withSequence,
  withDelay,
  Easing,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated'

// ============================================
// SPRING CONFIGURATIONS
// ============================================

/**
 * Spring configs for different interaction types
 * Based on Material Design motion principles
 */
export const SpringConfigs = {
  // Quick, snappy response for buttons
  button: {
    damping: 15,
    stiffness: 400,
    mass: 0.8,
  } as WithSpringConfig,

  // Bouncy for celebratory moments
  bouncy: {
    damping: 8,
    stiffness: 180,
    mass: 1,
  } as WithSpringConfig,

  // Gentle for subtle transitions
  gentle: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  } as WithSpringConfig,

  // Stiff for precision interactions
  stiff: {
    damping: 25,
    stiffness: 500,
    mass: 0.5,
  } as WithSpringConfig,

  // Wobbly for playful elements
  wobbly: {
    damping: 6,
    stiffness: 120,
    mass: 1,
  } as WithSpringConfig,
}

// ============================================
// TIMING CONFIGURATIONS
// ============================================

export const TimingConfigs = {
  // Fast micro-interactions
  instant: {
    duration: 80,
    easing: Easing.out(Easing.ease),
  } as WithTimingConfig,

  // Quick feedback
  quick: {
    duration: 150,
    easing: Easing.out(Easing.ease),
  } as WithTimingConfig,

  // Standard transitions
  standard: {
    duration: 250,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,

  // Smooth, comfortable
  smooth: {
    duration: 350,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,

  // Slow, dramatic
  slow: {
    duration: 500,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,
}

// ============================================
// SCALE VALUES
// ============================================

export const ScaleValues = {
  // Button press
  pressed: 0.94,
  pressedSubtle: 0.97,
  
  // Hover/focus
  focused: 1.02,
  
  // Bounce effects
  bounceUp: 1.08,
  bounceDown: 0.92,
  
  // Large press (capture button)
  capturePressed: 0.88,
  
  // Card selection
  cardSelected: 1.03,
}

// ============================================
// HAPTIC PATTERNS
// ============================================

export const HapticPatterns = {
  // Light tap for buttons
  tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  
  // Medium impact for selections
  select: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  
  // Heavy impact for important actions
  heavy: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  
  // Soft for subtle interactions
  soft: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft),
  
  // Rigid for toggles
  rigid: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid),
  
  // Success notification
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  
  // Warning
  warning: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  
  // Error
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  
  // Selection change
  selection: () => Haptics.selectionAsync(),
}

// ============================================
// ANIMATION HELPERS
// ============================================

/**
 * Press animation sequence - scale down then spring back
 */
export const createPressAnimation = (
  sharedValue: { value: number },
  pressedScale = ScaleValues.pressed
) => ({
  onPressIn: () => {
    'worklet'
    sharedValue.value = withTiming(pressedScale, TimingConfigs.instant)
  },
  onPressOut: () => {
    'worklet'
    sharedValue.value = withSpring(1, SpringConfigs.button)
  },
})

/**
 * Bounce animation - for celebratory moments
 */
export const createBounceAnimation = (sharedValue: { value: number }) => {
  'worklet'
  sharedValue.value = withSequence(
    withTiming(ScaleValues.bounceUp, { duration: 100 }),
    withSpring(1, SpringConfigs.bouncy)
  )
}

/**
 * Pulse animation - for attention
 */
export const createPulseAnimation = (sharedValue: { value: number }) => {
  'worklet'
  sharedValue.value = withSequence(
    withTiming(1.05, { duration: 150 }),
    withSpring(1, SpringConfigs.gentle)
  )
}

/**
 * Staggered entrance delays
 */
export const staggerDelay = (index: number, baseDelay = 50) => index * baseDelay

// ============================================
// INTERACTION PRESETS
// ============================================

export const InteractionPresets = {
  // Standard button interaction
  button: {
    scale: ScaleValues.pressed,
    spring: SpringConfigs.button,
    haptic: HapticPatterns.tap,
  },
  
  // Primary CTA button
  primaryButton: {
    scale: ScaleValues.pressed,
    spring: SpringConfigs.bouncy,
    haptic: HapticPatterns.select,
  },
  
  // Capture button (camera)
  captureButton: {
    scale: ScaleValues.capturePressed,
    spring: SpringConfigs.stiff,
    haptic: HapticPatterns.heavy,
  },
  
  // Card selection
  card: {
    scale: ScaleValues.pressedSubtle,
    spring: SpringConfigs.gentle,
    haptic: HapticPatterns.soft,
  },
  
  // Toggle/switch
  toggle: {
    scale: 1,
    spring: SpringConfigs.stiff,
    haptic: HapticPatterns.rigid,
  },
  
  // Destructive action
  destructive: {
    scale: ScaleValues.pressed,
    spring: SpringConfigs.button,
    haptic: HapticPatterns.warning,
  },
  
  // Success action
  success: {
    scale: ScaleValues.bounceUp,
    spring: SpringConfigs.bouncy,
    haptic: HapticPatterns.success,
  },
}

export default {
  SpringConfigs,
  TimingConfigs,
  ScaleValues,
  HapticPatterns,
  InteractionPresets,
  createPressAnimation,
  createBounceAnimation,
  createPulseAnimation,
  staggerDelay,
}
