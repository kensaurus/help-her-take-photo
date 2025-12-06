/**
 * Icon - Minimal, clean icons using simple shapes
 * No emojis, just elegant geometry
 */

import { View, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import { useThemeStore } from '../../stores/themeStore'

type IconName = 
  | 'camera'
  | 'eye'
  | 'image'
  | 'user'
  | 'settings'
  | 'check'
  | 'close'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'sun'
  | 'moon'
  | 'link'
  | 'unlink'
  | 'send'
  | 'star'
  | 'heart'
  | 'flash'
  | 'grid'
  | 'share'
  | 'trash'
  | 'refresh'
  | 'plus'
  | 'minus'
  | 'dot'
  | 'loading'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  animated?: boolean
}

export function Icon({ name, size = 20, color, animated = false }: IconProps) {
  const { colors } = useThemeStore()
  const iconColor = color || colors.text
  const rotation = useSharedValue(0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (animated && name === 'loading') {
      rotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
        false
      )
    }
    if (animated) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        true
      )
    }
  }, [animated, name, rotation, pulse])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: animated ? pulse.value : 1 },
    ],
  }))

  const renderIcon = () => {
    const baseStyle = { width: size, height: size }
    const stroke = size * 0.1
    const half = size / 2
    const quarter = size / 4

    switch (name) {
      case 'camera':
        return (
          <View style={baseStyle}>
            {/* Camera body */}
            <View style={[styles.absolute, {
              top: quarter,
              left: stroke,
              right: stroke,
              bottom: stroke,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: stroke * 2,
            }]} />
            {/* Lens */}
            <View style={[styles.absolute, {
              top: half - quarter / 2,
              left: half - quarter / 2,
              width: quarter,
              height: quarter,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: quarter,
            }]} />
            {/* Flash bump */}
            <View style={[styles.absolute, {
              top: quarter - stroke,
              left: quarter,
              width: quarter,
              height: stroke * 2,
              backgroundColor: iconColor,
              borderRadius: stroke,
            }]} />
          </View>
        )

      case 'eye':
        return (
          <View style={baseStyle}>
            {/* Eye outline */}
            <View style={[styles.absolute, {
              top: quarter,
              left: 0,
              right: 0,
              height: half,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: half,
            }]} />
            {/* Pupil */}
            <View style={[styles.absolute, {
              top: half - quarter / 2,
              left: half - quarter / 2,
              width: quarter,
              height: quarter,
              backgroundColor: iconColor,
              borderRadius: quarter,
            }]} />
          </View>
        )

      case 'image':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: stroke,
              left: stroke,
              right: stroke,
              bottom: stroke,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: stroke,
            }]} />
            {/* Mountain */}
            <View style={[styles.absolute, {
              bottom: quarter,
              left: quarter,
              width: 0,
              height: 0,
              borderLeftWidth: quarter,
              borderRightWidth: quarter,
              borderBottomWidth: quarter,
              borderLeftColor: 'transparent',
              borderRightColor: 'transparent',
              borderBottomColor: iconColor,
            }]} />
            {/* Sun */}
            <View style={[styles.absolute, {
              top: quarter,
              right: quarter,
              width: stroke * 2,
              height: stroke * 2,
              backgroundColor: iconColor,
              borderRadius: stroke,
            }]} />
          </View>
        )

      case 'user':
        return (
          <View style={baseStyle}>
            {/* Head */}
            <View style={[styles.absolute, {
              top: stroke,
              left: half - quarter / 2,
              width: quarter,
              height: quarter,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: quarter,
            }]} />
            {/* Body */}
            <View style={[styles.absolute, {
              bottom: stroke,
              left: quarter,
              right: quarter,
              height: quarter + stroke,
              borderWidth: stroke,
              borderColor: iconColor,
              borderTopLeftRadius: quarter,
              borderTopRightRadius: quarter,
              borderBottomWidth: 0,
            }]} />
          </View>
        )

      case 'settings':
        return (
          <View style={baseStyle}>
            {/* Outer gear */}
            <View style={[styles.absolute, {
              top: stroke,
              left: stroke,
              right: stroke,
              bottom: stroke,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: size,
            }]} />
            {/* Inner circle */}
            <View style={[styles.absolute, {
              top: quarter,
              left: quarter,
              right: quarter,
              bottom: quarter,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: size,
            }]} />
          </View>
        )

      case 'check':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: half,
              left: quarter / 2,
              width: quarter,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '45deg' }],
            }]} />
            <View style={[styles.absolute, {
              top: half - stroke,
              left: quarter,
              width: half,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '-45deg' }],
            }]} />
          </View>
        )

      case 'close':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: half - stroke / 2,
              left: quarter / 2,
              right: quarter / 2,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '45deg' }],
            }]} />
            <View style={[styles.absolute, {
              top: half - stroke / 2,
              left: quarter / 2,
              right: quarter / 2,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '-45deg' }],
            }]} />
          </View>
        )

      case 'arrow-right':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: half - stroke / 2,
              left: stroke,
              right: quarter,
              height: stroke,
              backgroundColor: iconColor,
            }]} />
            <View style={[styles.absolute, {
              top: quarter,
              right: stroke,
              width: quarter,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '45deg' }],
            }]} />
            <View style={[styles.absolute, {
              bottom: quarter,
              right: stroke,
              width: quarter,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '-45deg' }],
            }]} />
          </View>
        )

      case 'chevron-right':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: quarter - stroke,
              left: half - quarter / 2,
              width: quarter,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '45deg' }],
              transformOrigin: 'right',
            }]} />
            <View style={[styles.absolute, {
              bottom: quarter - stroke,
              left: half - quarter / 2,
              width: quarter,
              height: stroke,
              backgroundColor: iconColor,
              transform: [{ rotate: '-45deg' }],
              transformOrigin: 'right',
            }]} />
          </View>
        )

      case 'sun':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: quarter,
              left: quarter,
              right: quarter,
              bottom: quarter,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: size,
            }]} />
            {/* Rays */}
            <View style={[styles.absolute, { top: stroke / 2, left: half - stroke / 2, width: stroke, height: quarter / 2, backgroundColor: iconColor }]} />
            <View style={[styles.absolute, { bottom: stroke / 2, left: half - stroke / 2, width: stroke, height: quarter / 2, backgroundColor: iconColor }]} />
            <View style={[styles.absolute, { top: half - stroke / 2, left: stroke / 2, width: quarter / 2, height: stroke, backgroundColor: iconColor }]} />
            <View style={[styles.absolute, { top: half - stroke / 2, right: stroke / 2, width: quarter / 2, height: stroke, backgroundColor: iconColor }]} />
          </View>
        )

      case 'moon':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: stroke,
              left: quarter,
              width: half,
              height: size - stroke * 2,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: half,
              borderRightColor: 'transparent',
            }]} />
          </View>
        )

      case 'dot':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: half - quarter / 2,
              left: half - quarter / 2,
              width: quarter,
              height: quarter,
              backgroundColor: iconColor,
              borderRadius: quarter,
            }]} />
          </View>
        )

      case 'plus':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, { top: half - stroke / 2, left: quarter, right: quarter, height: stroke, backgroundColor: iconColor }]} />
            <View style={[styles.absolute, { left: half - stroke / 2, top: quarter, bottom: quarter, width: stroke, backgroundColor: iconColor }]} />
          </View>
        )

      case 'loading':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: stroke,
              left: stroke,
              right: stroke,
              bottom: stroke,
              borderWidth: stroke,
              borderColor: `${iconColor}33`,
              borderRadius: size,
            }]} />
            <View style={[styles.absolute, {
              top: stroke,
              left: stroke,
              right: stroke,
              bottom: stroke,
              borderWidth: stroke,
              borderColor: 'transparent',
              borderTopColor: iconColor,
              borderRadius: size,
            }]} />
          </View>
        )

      case 'send':
        return (
          <View style={baseStyle}>
            {/* Paper plane */}
            <View style={[styles.absolute, {
              top: quarter,
              left: stroke,
              width: 0,
              height: 0,
              borderTopWidth: quarter,
              borderRightWidth: size - stroke * 2,
              borderBottomWidth: quarter,
              borderTopColor: 'transparent',
              borderRightColor: iconColor,
              borderBottomColor: 'transparent',
            }]} />
          </View>
        )

      case 'refresh':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: quarter / 2,
              left: quarter / 2,
              right: quarter / 2,
              bottom: quarter / 2,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: size,
              borderRightColor: 'transparent',
              borderBottomColor: 'transparent',
            }]} />
            {/* Arrow head */}
            <View style={[styles.absolute, {
              top: quarter / 2 - stroke,
              right: quarter,
              width: 0,
              height: 0,
              borderLeftWidth: stroke * 2,
              borderTopWidth: stroke * 2,
              borderBottomWidth: stroke * 2,
              borderLeftColor: iconColor,
              borderTopColor: 'transparent',
              borderBottomColor: 'transparent',
            }]} />
          </View>
        )

      case 'share':
        return (
          <View style={baseStyle}>
            {/* Circle nodes */}
            <View style={[styles.absolute, { top: quarter / 2, right: quarter / 2, width: stroke * 2, height: stroke * 2, backgroundColor: iconColor, borderRadius: stroke }]} />
            <View style={[styles.absolute, { top: half - stroke, left: quarter / 2, width: stroke * 2, height: stroke * 2, backgroundColor: iconColor, borderRadius: stroke }]} />
            <View style={[styles.absolute, { bottom: quarter / 2, right: quarter / 2, width: stroke * 2, height: stroke * 2, backgroundColor: iconColor, borderRadius: stroke }]} />
            {/* Lines */}
            <View style={[styles.absolute, { top: quarter, left: quarter, width: half, height: stroke, backgroundColor: iconColor, transform: [{ rotate: '-30deg' }] }]} />
            <View style={[styles.absolute, { bottom: quarter, left: quarter, width: half, height: stroke, backgroundColor: iconColor, transform: [{ rotate: '30deg' }] }]} />
          </View>
        )

      case 'trash':
        return (
          <View style={baseStyle}>
            {/* Lid */}
            <View style={[styles.absolute, { top: stroke, left: quarter / 2, right: quarter / 2, height: stroke, backgroundColor: iconColor }]} />
            {/* Handle */}
            <View style={[styles.absolute, { top: 0, left: half - quarter / 2, width: quarter, height: stroke * 2, borderTopLeftRadius: stroke, borderTopRightRadius: stroke, borderWidth: stroke, borderColor: iconColor, borderBottomWidth: 0 }]} />
            {/* Body */}
            <View style={[styles.absolute, { top: stroke * 3, left: quarter, right: quarter, bottom: stroke, borderWidth: stroke, borderColor: iconColor, borderTopWidth: 0, borderBottomLeftRadius: stroke, borderBottomRightRadius: stroke }]} />
          </View>
        )

      case 'star':
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: stroke,
              left: half - stroke / 2,
              width: stroke,
              height: quarter,
              backgroundColor: iconColor,
            }]} />
            <View style={[styles.absolute, {
              top: quarter,
              left: stroke,
              right: stroke,
              height: stroke,
              backgroundColor: iconColor,
            }]} />
            <View style={[styles.absolute, {
              bottom: stroke,
              left: quarter,
              width: stroke,
              height: quarter,
              backgroundColor: iconColor,
              transform: [{ rotate: '30deg' }],
            }]} />
            <View style={[styles.absolute, {
              bottom: stroke,
              right: quarter,
              width: stroke,
              height: quarter,
              backgroundColor: iconColor,
              transform: [{ rotate: '-30deg' }],
            }]} />
          </View>
        )

      default:
        // Default circle
        return (
          <View style={baseStyle}>
            <View style={[styles.absolute, {
              top: quarter,
              left: quarter,
              right: quarter,
              bottom: quarter,
              borderWidth: stroke,
              borderColor: iconColor,
              borderRadius: size,
            }]} />
          </View>
        )
    }
  }

  return (
    <Animated.View style={animatedStyle}>
      {renderIcon()}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
})

