/**
 * LoadingOverlay - Full-screen loading indicator with smooth animations
 * Provides visual feedback during async operations
 */

import { StyleSheet, View, Text } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import { useThemeStore } from '../../stores/themeStore'
import { useSettingsStore } from '../../stores/settingsStore'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  transparent?: boolean
}

export function LoadingOverlay({
  visible,
  message = 'Loading...',
  transparent = false,
}: LoadingOverlayProps) {
  const { colors } = useThemeStore()
  const { settings } = useSettingsStore()
  const reduceMotion = settings.reduceMotion

  const opacity = useSharedValue(0)
  const dot1Scale = useSharedValue(1)
  const dot2Scale = useSharedValue(1)
  const dot3Scale = useSharedValue(1)

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 })
      
      if (!reduceMotion) {
        // Staggered bouncing dots animation
        const bounceConfig = {
          duration: 400,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        }
        
        dot1Scale.value = withRepeat(
          withSequence(
            withTiming(1.3, bounceConfig),
            withTiming(1, bounceConfig)
          ),
          -1,
          false
        )
        
        dot2Scale.value = withDelay(
          133,
          withRepeat(
            withSequence(
              withTiming(1.3, bounceConfig),
              withTiming(1, bounceConfig)
            ),
            -1,
            false
          )
        )
        
        dot3Scale.value = withDelay(
          266,
          withRepeat(
            withSequence(
              withTiming(1.3, bounceConfig),
              withTiming(1, bounceConfig)
            ),
            -1,
            false
          )
        )
      }
    } else {
      opacity.value = withTiming(0, { duration: 150 })
      dot1Scale.value = 1
      dot2Scale.value = 1
      dot3Scale.value = 1
    }
  }, [visible, reduceMotion])

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }],
  }))

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }],
  }))

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }],
  }))

  if (!visible && opacity.value === 0) {
    return null
  }

  return (
    <Animated.View
      style={[
        styles.container,
        containerStyle,
        {
          backgroundColor: transparent
            ? 'rgba(0,0,0,0.5)'
            : colors.background,
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View
        style={[
          styles.content,
          { backgroundColor: colors.surface },
        ]}
      >
        <View style={styles.dotsContainer}>
          <Animated.View
            style={[
              styles.dot,
              dot1Style,
              { backgroundColor: colors.primary },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              dot2Style,
              { backgroundColor: colors.primary },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              dot3Style,
              { backgroundColor: colors.primary },
            ]}
          />
        </View>
        
        {message && (
          <Text style={[styles.message, { color: colors.text }]}>
            {message}
          </Text>
        )}
      </View>
    </Animated.View>
  )
}

/**
 * Inline loading spinner for buttons/small areas
 */
export function LoadingSpinner({
  size = 24,
  color,
}: {
  size?: number
  color?: string
}) {
  const { colors } = useThemeStore()
  const { settings } = useSettingsStore()
  const reduceMotion = settings.reduceMotion
  
  const rotation = useSharedValue(0)

  useEffect(() => {
    if (!reduceMotion) {
      rotation.value = withRepeat(
        withTiming(360, {
          duration: 1000,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    }
  }, [reduceMotion])

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }))

  return (
    <Animated.View
      style={[
        styles.spinner,
        spinnerStyle,
        {
          width: size,
          height: size,
          borderWidth: size * 0.12,
          borderRadius: size / 2,
          borderColor: `${color || colors.primary}30`,
          borderTopColor: color || colors.primary,
        },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  message: {
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  spinner: {
    borderStyle: 'solid',
  },
})

