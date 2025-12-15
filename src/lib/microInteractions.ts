/**
 * Micro-interactions Configuration
 * 
 * Centralized spring physics, timing configs, and haptic patterns
 * for consistent, delightful interactions across the app.
 * 
 * Zen Philosophy:
 * - Slower, deliberate animations create calm
 * - Gentle springs feel natural, not jarring
 * - Breathing rhythms connect to mindfulness
 * - Less bounce = more tranquility
 */

import * as Haptics from 'expo-haptics'
import { 
  withSpring, 
  withTiming, 
  withSequence,
  withDelay,
  withRepeat,
  Easing,
  WithSpringConfig,
  WithTimingConfig,
} from 'react-native-reanimated'

// ============================================
// SPRING CONFIGURATIONS
// ============================================

/**
 * Spring configs for different interaction types
 * Zen-enhanced: gentler, more deliberate motion
 */
export const SpringConfigs = {
  // Quick, snappy response for buttons
  button: {
    damping: 18,      // Slightly more damped for calm
    stiffness: 350,   // Slightly softer
    mass: 0.9,
  } as WithSpringConfig,

  // Bouncy for celebratory moments (subtle)
  bouncy: {
    damping: 12,      // More controlled bounce
    stiffness: 150,
    mass: 1,
  } as WithSpringConfig,

  // Gentle for subtle transitions
  gentle: {
    damping: 22,
    stiffness: 180,
    mass: 1,
  } as WithSpringConfig,

  // Stiff for precision interactions
  stiff: {
    damping: 28,
    stiffness: 450,
    mass: 0.6,
  } as WithSpringConfig,

  // Wobbly for playful elements (less wobbly for zen)
  wobbly: {
    damping: 10,
    stiffness: 100,
    mass: 1,
  } as WithSpringConfig,

  // === ZEN ADDITIONS ===
  
  // Zen - ultra smooth, peaceful motion
  zen: {
    damping: 30,
    stiffness: 100,
    mass: 1.2,
  } as WithSpringConfig,

  // Breathing - slow, natural rhythm (like inhale/exhale)
  breathing: {
    damping: 40,
    stiffness: 50,
    mass: 1.5,
  } as WithSpringConfig,

  // Float - weightless, dreamy motion
  float: {
    damping: 35,
    stiffness: 80,
    mass: 1.3,
  } as WithSpringConfig,

  // Settle - comes to rest gently, like a leaf landing
  settle: {
    damping: 25,
    stiffness: 120,
    mass: 1.1,
  } as WithSpringConfig,
}

// ============================================
// TIMING CONFIGURATIONS
// ============================================

export const TimingConfigs = {
  // Fast micro-interactions
  instant: {
    duration: 100,    // Slightly slower for zen
    easing: Easing.out(Easing.ease),
  } as WithTimingConfig,

  // Quick feedback
  quick: {
    duration: 180,    // More deliberate
    easing: Easing.out(Easing.ease),
  } as WithTimingConfig,

  // Standard transitions
  standard: {
    duration: 280,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,

  // Smooth, comfortable
  smooth: {
    duration: 400,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,

  // Slow, dramatic
  slow: {
    duration: 600,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,

  // === ZEN ADDITIONS ===

  // Zen - ultra slow, peaceful
  zen: {
    duration: 800,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1), // Smooth ease
  } as WithTimingConfig,

  // Breathe in - slow expansion
  breatheIn: {
    duration: 2000,
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  } as WithTimingConfig,

  // Breathe out - slow contraction
  breatheOut: {
    duration: 3000,
    easing: Easing.bezier(0.4, 0, 0.6, 1),
  } as WithTimingConfig,

  // Fade - gentle appearance/disappearance
  fade: {
    duration: 500,
    easing: Easing.bezier(0.4, 0, 0.2, 1),
  } as WithTimingConfig,

  // Drift - slow ambient motion
  drift: {
    duration: 4000,
    easing: Easing.inOut(Easing.ease),
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

/**
 * Zen staggered delays - slower, more contemplative
 */
export const zenStaggerDelay = (index: number, baseDelay = 100) => index * baseDelay

// ============================================
// ZEN ANIMATION HELPERS
// ============================================

/**
 * Breathing animation - continuous, calming pulse
 * Like the rhythm of breath: expand slowly, contract slowly
 */
export const createBreathingAnimation = (
  sharedValue: { value: number },
  minScale = 0.98,
  maxScale = 1.02
) => {
  'worklet'
  sharedValue.value = withRepeat(
    withSequence(
      withTiming(maxScale, TimingConfigs.breatheIn),
      withTiming(minScale, TimingConfigs.breatheOut)
    ),
    -1, // Infinite
    true // Reverse
  )
}

/**
 * Gentle fade in - peaceful appearance
 */
export const createZenFadeIn = (sharedValue: { value: number }) => {
  'worklet'
  sharedValue.value = withTiming(1, TimingConfigs.zen)
}

/**
 * Float animation - gentle up/down drift
 */
export const createFloatAnimation = (
  sharedValue: { value: number },
  amplitude = 4
) => {
  'worklet'
  sharedValue.value = withRepeat(
    withSequence(
      withTiming(amplitude, TimingConfigs.drift),
      withTiming(-amplitude, TimingConfigs.drift)
    ),
    -1,
    true
  )
}

/**
 * Settle animation - comes to rest like a leaf
 */
export const createSettleAnimation = (sharedValue: { value: number }) => {
  'worklet'
  sharedValue.value = withSpring(1, SpringConfigs.settle)
}

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

  // === ZEN PRESETS ===
  
  // Zen button - calm, deliberate press
  zenButton: {
    scale: ScaleValues.pressedSubtle,
    spring: SpringConfigs.zen,
    haptic: HapticPatterns.soft,
  },
  
  // Mindful card - gentle selection
  mindfulCard: {
    scale: 0.99,
    spring: SpringConfigs.float,
    haptic: HapticPatterns.selection,
  },
  
  // Breathing element - ambient life
  breathing: {
    scale: 1,
    spring: SpringConfigs.breathing,
    haptic: null, // No haptic - silent calm
  },
}

// ============================================
// ZEN CONSTANTS
// ============================================

/**
 * Zen timing constants for consistent calm
 */
export const ZenTiming = {
  breathCycle: 5000,      // Full breath cycle (in + out)
  contemplation: 800,     // Pause for thought
  transition: 600,        // Screen transitions
  fadeIn: 500,           // Gentle appearance
  fadeOut: 400,          // Gentle disappearance
  stagger: 100,          // Between list items
}

/**
 * Zen scale values - subtle, not dramatic
 */
export const ZenScales = {
  breatheMin: 0.98,
  breatheMax: 1.02,
  pressedSubtle: 0.98,
  hoverSubtle: 1.01,
  float: 4, // pixels of float
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
  // Zen exports
  zenStaggerDelay,
  createBreathingAnimation,
  createZenFadeIn,
  createFloatAnimation,
  createSettleAnimation,
  ZenTiming,
  ZenScales,
}
