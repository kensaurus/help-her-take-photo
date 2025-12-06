/**
 * Capture button with animation and loading state
 */

import { Pressable, StyleSheet, View, ActivityIndicator } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface CaptureButtonProps {
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  size?: number
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export function CaptureButton({
  onPress,
  disabled = false,
  loading = false,
  size = 80,
}: CaptureButtonProps) {
  const scale = useSharedValue(1)
  const innerScale = useSharedValue(1)

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.95)
    innerScale.value = withTiming(0.85, { duration: 100 })
  }

  const handlePressOut = () => {
    scale.value = withSpring(1)
    innerScale.value = withSpring(1)
  }

  const innerSize = size * 0.75

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.outer,
        outerStyle,
        { width: size, height: size, borderRadius: size / 2 },
        disabled && styles.disabled,
      ]}
      accessibilityLabel="Take photo"
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <Animated.View
          style={[
            styles.inner,
            innerStyle,
            { width: innerSize, height: innerSize, borderRadius: innerSize / 2 },
          ]}
        />
      )}
    </AnimatedPressable>
  )
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    backgroundColor: '#fff',
  },
  disabled: {
    opacity: 0.5,
  },
})

