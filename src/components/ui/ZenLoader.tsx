/**
 * ZenLoader - Mindful loading states
 * 
 * Calming, breathing animations that turn waiting into a moment of peace.
 * Uses slow, natural rhythms instead of spinning indicators.
 */

import { useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated'
import { useThemeStore } from '../../stores/themeStore'
import { TimingConfigs, ZenTiming } from '../../lib/microInteractions'

interface ZenLoaderProps {
  message?: string
  variant?: 'dots' | 'breathe' | 'wave' | 'minimal'
  size?: 'small' | 'medium' | 'large'
}

/**
 * Breathing circle - expands and contracts like breath
 */
function BreathingCircle({ size = 60, delay = 0 }: { size?: number; delay?: number }) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0.3)
  
  useEffect(() => {
    // Breathing animation
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.9, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    )
    
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View 
      style={[
        styles.breathingCircle, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: colors.zen,
        },
        animatedStyle
      ]} 
    />
  )
}

/**
 * Zen dots - three dots that pulse gently in sequence
 */
function ZenDots({ size = 8 }: { size?: number }) {
  const { colors } = useThemeStore()
  
  return (
    <View style={styles.dotsContainer}>
      {[0, 1, 2].map((i) => (
        <ZenDot key={i} index={i} size={size} color={colors.zen} />
      ))}
    </View>
  )
}

function ZenDot({ index, size, color }: { index: number; size: number; color: string }) {
  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0.3)
  
  useEffect(() => {
    const delay = index * 400
    
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 800, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    )
    
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.8, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(0.3, { duration: 800, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      )
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View 
      style={[
        styles.dot,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle
      ]} 
    />
  )
}

/**
 * Wave animation - gentle ripple effect
 */
function WaveLoader({ size = 80 }: { size?: number }) {
  const { colors } = useThemeStore()
  
  return (
    <View style={[styles.waveContainer, { width: size, height: size }]}>
      {[0, 1, 2].map((i) => (
        <WaveRing key={i} index={i} size={size} color={colors.zen} />
      ))}
    </View>
  )
}

function WaveRing({ index, size, color }: { index: number; size: number; color: string }) {
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0.6)
  
  useEffect(() => {
    const delay = index * 800
    
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) })
        ),
        -1,
        false
      )
    )
    
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: 2400, easing: Easing.out(Easing.quad) })
        ),
        -1,
        false
      )
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View 
      style={[
        styles.waveRing,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          borderColor: color,
        },
        animatedStyle
      ]} 
    />
  )
}

/**
 * Minimal loader - single breathing dot
 */
function MinimalLoader({ size = 12 }: { size?: number }) {
  const { colors } = useThemeStore()
  const opacity = useSharedValue(0.3)
  
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    )
  }, [])
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))
  
  return (
    <Animated.View 
      style={[
        styles.minimalDot,
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: colors.zen,
        },
        animatedStyle
      ]} 
    />
  )
}

export function ZenLoader({ 
  message, 
  variant = 'breathe',
  size = 'medium',
}: ZenLoaderProps) {
  const { colors } = useThemeStore()
  
  const sizeMap = {
    small: { loader: 40, dots: 6, text: 12 },
    medium: { loader: 60, dots: 8, text: 14 },
    large: { loader: 80, dots: 10, text: 16 },
  }
  
  const dimensions = sizeMap[size]
  
  const renderLoader = () => {
    switch (variant) {
      case 'dots':
        return <ZenDots size={dimensions.dots} />
      case 'wave':
        return <WaveLoader size={dimensions.loader} />
      case 'minimal':
        return <MinimalLoader size={dimensions.dots * 1.5} />
      case 'breathe':
      default:
        return <BreathingCircle size={dimensions.loader} />
    }
  }
  
  return (
    <Animated.View 
      entering={FadeIn.duration(ZenTiming.fadeIn)}
      style={styles.container}
    >
      {renderLoader()}
      {message && (
        <Text 
          style={[
            styles.message, 
            { color: colors.textMuted, fontSize: dimensions.text }
          ]}
        >
          {message}
        </Text>
      )}
    </Animated.View>
  )
}

/**
 * Full screen zen loading overlay
 */
export function ZenLoadingOverlay({ message = 'One moment...' }: { message?: string }) {
  const { colors } = useThemeStore()
  
  return (
    <Animated.View 
      entering={FadeIn.duration(ZenTiming.fadeIn)}
      style={[styles.overlay, { backgroundColor: colors.background }]}
    >
      <ZenLoader variant="breathe" size="large" message={message} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breathingCircle: {
    // Base styles, animated
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    // Base styles, animated
  },
  waveContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  minimalDot: {
    // Base styles, animated
  },
  message: {
    fontWeight: '400',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
})

export default ZenLoader
