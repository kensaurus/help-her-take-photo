/**
 * Enhanced Capture Button
 * 
 * A beautiful, physics-based capture button with:
 * - Satisfying press animation with spring physics
 * - Ring pulse effect on capture
 * - Flash feedback animation
 * - Smooth loading state
 * - Haptic feedback
 */

import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'

interface CaptureButtonProps {
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  size?: number
  isSharing?: boolean
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

// Spring configurations for natural feel
const SPRING_CONFIG = {
  damping: 12,
  stiffness: 400,
  mass: 0.8,
}

const BOUNCE_CONFIG = {
  damping: 6,
  stiffness: 200,
  mass: 1,
}

export function CaptureButton({
  onPress,
  disabled = false,
  loading = false,
  size = 80,
  isSharing = false,
}: CaptureButtonProps) {
  // Animation values
  const scale = useSharedValue(1)
  const innerScale = useSharedValue(1)
  const ringScale = useSharedValue(1)
  const ringOpacity = useSharedValue(0)
  const flashOpacity = useSharedValue(0)
  const pressed = useSharedValue(0)

  // Outer button animation
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.95]),
  }))

  // Inner circle animation
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  // Expanding ring animation (captures)
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }))

  // Flash overlay animation
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }))

  // Trigger haptic feedback
  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  }

  const handlePressIn = () => {
    pressed.value = withTiming(1, { duration: 50 })
    scale.value = withSpring(0.92, SPRING_CONFIG)
    innerScale.value = withTiming(0.8, { duration: 80 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handlePressOut = () => {
    pressed.value = withSpring(0, SPRING_CONFIG)
    scale.value = withSpring(1, SPRING_CONFIG)
    innerScale.value = withSpring(1, BOUNCE_CONFIG)
  }

  const handlePress = () => {
    // Heavy haptic on actual capture
    runOnJS(triggerHaptic)()
    
    // Flash effect
    flashOpacity.value = withSequence(
      withTiming(0.6, { duration: 50 }),
      withTiming(0, { duration: 150 })
    )

    // Ring pulse effect
    ringScale.value = 1
    ringOpacity.value = 0.8
    ringScale.value = withTiming(1.8, { duration: 400 })
    ringOpacity.value = withDelay(100, withTiming(0, { duration: 300 }))

    // Bounce effect on inner circle
    innerScale.value = withSequence(
      withTiming(0.7, { duration: 50 }),
      withSpring(1.05, BOUNCE_CONFIG),
      withSpring(1, SPRING_CONFIG)
    )

    // Call the actual onPress handler
    onPress()
  }

  const innerSize = size * 0.72
  const ringSize = size * 1.2

  return (
    <View style={styles.container}>
      {/* Expanding ring effect */}
      <Animated.View
        style={[
          styles.ring,
          ringStyle,
          { 
            width: ringSize, 
            height: ringSize, 
            borderRadius: ringSize / 2,
            left: -(ringSize - size) / 2,
            top: -(ringSize - size) / 2,
          },
        ]}
        pointerEvents="none"
      />

      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.outer,
          outerStyle,
          { width: size, height: size, borderRadius: size / 2 },
          disabled && styles.disabled,
          isSharing && styles.sharing,
        ]}
        accessibilityLabel="Take photo"
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || loading }}
      >
        {/* Flash overlay */}
        <Animated.View 
          style={[styles.flash, flashStyle]} 
          pointerEvents="none"
        />

        {loading ? (
          <ActivityIndicator size="large" color="#fff" />
        ) : (
          <Animated.View
            style={[
              styles.inner,
              innerStyle,
              { 
                width: innerSize, 
                height: innerSize, 
                borderRadius: innerSize / 2,
              },
              isSharing && styles.innerSharing,
            ]}
          />
        )}
      </AnimatedPressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  outer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    // Subtle shadow for depth
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  inner: {
    backgroundColor: '#fff',
    // Inner shadow for 3D effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  disabled: {
    opacity: 0.4,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  sharing: {
    borderColor: '#DC2626',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
  },
  innerSharing: {
    backgroundColor: '#DC2626',
  },
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#fff',
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    borderRadius: 999,
  },
})
