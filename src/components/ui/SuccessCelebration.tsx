/**
 * SuccessCelebration - Animated success feedback component
 * Based on Google Material Design celebration patterns
 * 
 * Shows a satisfying checkmark animation with optional confetti
 * for major accomplishments (photo taken, pairing successful, etc.)
 */

import { useEffect } from 'react'
import { StyleSheet, View, Dimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated'
import { celebrateSuccess } from '../../utils/haptics'
import { useSettingsStore } from '../../stores/settingsStore'

interface SuccessCelebrationProps {
  visible: boolean
  onComplete?: () => void
  size?: 'small' | 'medium' | 'large'
  color?: string
  showConfetti?: boolean
}

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SIZES = {
  small: { container: 48, checkmark: 24, stroke: 3 },
  medium: { container: 72, checkmark: 36, stroke: 4 },
  large: { container: 96, checkmark: 48, stroke: 5 },
}

export function SuccessCelebration({
  visible,
  onComplete,
  size = 'medium',
  color = '#10B981', // Emerald green
  showConfetti = false,
}: SuccessCelebrationProps) {
  const { settings } = useSettingsStore()
  const reduceMotion = settings.reduceMotion
  
  const scale = useSharedValue(0)
  const checkScale = useSharedValue(0)
  const opacity = useSharedValue(0)
  const rotation = useSharedValue(0)
  
  const dimensions = SIZES[size]

  useEffect(() => {
    if (visible) {
      // Trigger haptic feedback
      celebrateSuccess()
      
      if (reduceMotion) {
        // Instant appearance for reduced motion
        scale.value = 1
        checkScale.value = 1
        opacity.value = 1
        
        if (onComplete) {
          setTimeout(onComplete, 500)
        }
      } else {
        // Full animation sequence
        // Step 1: Circle scales in with bounce
        opacity.value = withTiming(1, { duration: 100 })
        scale.value = withSpring(1, {
          damping: 12,
          stiffness: 200,
          mass: 0.8,
        })
        
        // Step 2: Slight rotation for playfulness
        rotation.value = withSequence(
          withTiming(-5, { duration: 100 }),
          withSpring(0, { damping: 8 })
        )
        
        // Step 3: Checkmark draws in
        checkScale.value = withDelay(
          200,
          withSpring(1, {
            damping: 10,
            stiffness: 150,
          })
        )
        
        // Callback after animation
        if (onComplete) {
          setTimeout(onComplete, 800)
        }
      }
    } else {
      // Reset
      scale.value = withTiming(0, { duration: 150 })
      checkScale.value = 0
      opacity.value = withTiming(0, { duration: 150 })
      rotation.value = 0
    }
  }, [visible, reduceMotion])

  const containerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
    opacity: opacity.value,
  }))

  const checkmarkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkScale.value,
  }))

  if (!visible && scale.value === 0) {
    return null
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.container,
          containerStyle,
          {
            width: dimensions.container,
            height: dimensions.container,
            borderRadius: dimensions.container / 2,
            backgroundColor: color,
          },
        ]}
      >
        <Animated.View style={checkmarkStyle}>
          <View style={styles.checkmarkContainer}>
            {/* Checkmark drawn with Views */}
            <View
              style={[
                styles.checkmarkShort,
                {
                  width: dimensions.checkmark * 0.35,
                  height: dimensions.stroke,
                  backgroundColor: '#fff',
                  borderRadius: dimensions.stroke / 2,
                },
              ]}
            />
            <View
              style={[
                styles.checkmarkLong,
                {
                  width: dimensions.checkmark * 0.7,
                  height: dimensions.stroke,
                  backgroundColor: '#fff',
                  borderRadius: dimensions.stroke / 2,
                },
              ]}
            />
          </View>
        </Animated.View>
      </Animated.View>
      
      {/* Optional confetti particles */}
      {showConfetti && visible && !reduceMotion && (
        <ConfettiParticles color={color} />
      )}
    </View>
  )
}

/**
 * Simple confetti particles for extra celebration
 */
function ConfettiParticles({ color }: { color: string }) {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    angle: (i * 45) * (Math.PI / 180),
    delay: i * 30,
  }))

  return (
    <>
      {particles.map((particle) => (
        <ConfettiParticle
          key={particle.id}
          angle={particle.angle}
          delay={particle.delay}
          color={color}
        />
      ))}
    </>
  )
}

function ConfettiParticle({
  angle,
  delay,
  color,
}: {
  angle: number
  delay: number
  color: string
}) {
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(0.5)

  useEffect(() => {
    const distance = 60
    const targetX = Math.cos(angle) * distance
    const targetY = Math.sin(angle) * distance

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 100 }),
      withDelay(300, withTiming(0, { duration: 200 }))
    ))
    
    translateX.value = withDelay(delay, withSpring(targetX, {
      damping: 8,
      stiffness: 100,
    }))
    
    translateY.value = withDelay(delay, withSpring(targetY, {
      damping: 8,
      stiffness: 100,
    }))
    
    scale.value = withDelay(delay, withSequence(
      withSpring(1, { damping: 10 }),
      withDelay(200, withTiming(0, { duration: 200 }))
    ))
  }, [])

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        { backgroundColor: color },
      ]}
    />
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  checkmarkContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkShort: {
    position: 'absolute',
    transform: [{ rotate: '45deg' }],
    left: '22%',
    top: '48%',
  },
  checkmarkLong: {
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
    left: '35%',
    top: '40%',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
})

