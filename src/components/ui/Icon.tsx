/**
 * Icon - Minimal, clean icons using Svg-like approach
 * Using View shapes for reliable cross-platform rendering
 */

import { View, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
  | 'chevron-left'
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
  | 'download'

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
    // overflow: 'visible' prevents clipping of rotated/transformed elements
    const baseStyle = { width: size, height: size, overflow: 'visible' as const }
    const stroke = Math.max(size * 0.12, 1.5)
    const half = size / 2
    const quarter = size / 4

    switch (name) {
      case 'camera':
        return (
          <View style={baseStyle}>
            {/* Camera body */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter + stroke,
                  left: stroke,
                  right: stroke,
                  bottom: stroke,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: stroke * 1.5,
                },
              ]}
            />
            {/* Lens */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - quarter * 0.4,
                  left: half - quarter * 0.4,
                  width: quarter * 0.8,
                  height: quarter * 0.8,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
            {/* Viewfinder bump */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter - stroke / 2,
                  left: quarter,
                  width: quarter * 0.8,
                  height: stroke * 2,
                  backgroundColor: iconColor,
                  borderRadius: stroke,
                },
              ]}
            />
          </View>
        )

      case 'eye':
        return (
          <View style={baseStyle}>
            {/* Eye shape - almond outline */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: stroke,
                  right: stroke,
                  height: half,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: half,
                },
              ]}
            />
            {/* Pupil (filled circle) */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - quarter * 0.4,
                  left: half - quarter * 0.4,
                  width: quarter * 0.8,
                  height: quarter * 0.8,
                  backgroundColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
          </View>
        )

      case 'image':
        return (
          <View style={baseStyle}>
            {/* Frame */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  left: stroke,
                  right: stroke,
                  bottom: stroke,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: stroke * 1.5,
                },
              ]}
            />
            {/* Mountain shape */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: quarter,
                  left: quarter,
                  width: 0,
                  height: 0,
                  borderLeftWidth: quarter * 0.8,
                  borderRightWidth: quarter * 0.8,
                  borderBottomWidth: quarter * 0.7,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderBottomColor: iconColor,
                },
              ]}
            />
            {/* Sun dot */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter + stroke,
                  right: quarter,
                  width: stroke * 2.5,
                  height: stroke * 2.5,
                  backgroundColor: iconColor,
                  borderRadius: stroke * 2,
                },
              ]}
            />
          </View>
        )

      case 'user':
        return (
          <View style={baseStyle}>
            {/* Head circle */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: half - quarter * 0.6,
                  width: quarter * 1.2,
                  height: quarter * 1.2,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
            {/* Body/shoulders arc */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: stroke * 2,
                  left: quarter * 0.8,
                  right: quarter * 0.8,
                  height: quarter * 1.2,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderTopLeftRadius: size,
                  borderTopRightRadius: size,
                  borderBottomWidth: 0,
                },
              ]}
            />
          </View>
        )

      case 'settings':
        return (
          <View style={baseStyle}>
            {/* Outer gear circle */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  bottom: stroke * 2,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: size,
                },
              ]}
            />
            {/* Inner circle */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter + stroke,
                  left: quarter + stroke,
                  right: quarter + stroke,
                  bottom: quarter + stroke,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: size,
                },
              ]}
            />
          </View>
        )

      case 'check':
        return (
          <View style={baseStyle}>
            {/* Short leg */}
            <View
              style={[
                styles.absolute,
                {
                  top: half + stroke,
                  left: quarter * 0.6,
                  width: quarter * 0.9,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
            {/* Long leg */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke * 2,
                  left: quarter * 1.3,
                  width: half,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'close':
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: quarter * 0.6,
                  right: quarter * 0.6,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: quarter * 0.6,
                  right: quarter * 0.6,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'arrow-right':
        return (
          <View style={baseStyle}>
            {/* Horizontal line */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  height: stroke,
                  backgroundColor: iconColor,
                },
              ]}
            />
            {/* Arrow head top */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  right: stroke * 2,
                  width: quarter * 0.8,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
            {/* Arrow head bottom */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: quarter,
                  right: stroke * 2,
                  width: quarter * 0.8,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'chevron-right':
        // Simple V-shape pointing right - centered within bounds
        const chevronLen = size * 0.32
        const chevronThick = stroke
        // Center the chevron properly so rotation doesn't clip
        const chevronOffset = size * 0.35
        return (
          <View style={baseStyle}>
            {/* Top line of chevron */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - chevronLen * 0.6,
                  left: chevronOffset,
                  width: chevronLen,
                  height: chevronThick,
                  backgroundColor: iconColor,
                  borderRadius: chevronThick / 2,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
            {/* Bottom line of chevron */}
            <View
              style={[
                styles.absolute,
                {
                  top: half + chevronLen * 0.6 - chevronThick,
                  left: chevronOffset,
                  width: chevronLen,
                  height: chevronThick,
                  backgroundColor: iconColor,
                  borderRadius: chevronThick / 2,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'chevron-left':
        const chevronLLen = size * 0.35
        const chevronLThick = stroke
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: half - chevronLLen * 0.7,
                  right: half - chevronLLen * 0.3,
                  width: chevronLLen,
                  height: chevronLThick,
                  backgroundColor: iconColor,
                  borderRadius: chevronLThick / 2,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: half + chevronLLen * 0.7 - chevronLThick,
                  right: half - chevronLLen * 0.3,
                  width: chevronLLen,
                  height: chevronLThick,
                  backgroundColor: iconColor,
                  borderRadius: chevronLThick / 2,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'chevron-down':
        const chevronDLen = size * 0.35
        const chevronDThick = stroke
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: half - chevronDLen * 0.3,
                  left: half - chevronDLen * 0.7,
                  width: chevronDLen,
                  height: chevronDThick,
                  backgroundColor: iconColor,
                  borderRadius: chevronDThick / 2,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: half - chevronDLen * 0.3,
                  right: half - chevronDLen * 0.7,
                  width: chevronDLen,
                  height: chevronDThick,
                  backgroundColor: iconColor,
                  borderRadius: chevronDThick / 2,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'sun':
        return (
          <View style={baseStyle}>
            {/* Center circle */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter + stroke,
                  left: quarter + stroke,
                  right: quarter + stroke,
                  bottom: quarter + stroke,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: size,
                },
              ]}
            />
            {/* Rays */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  left: half - stroke / 2,
                  width: stroke,
                  height: quarter * 0.6,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  bottom: stroke,
                  left: half - stroke / 2,
                  width: stroke,
                  height: quarter * 0.6,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: stroke,
                  width: quarter * 0.6,
                  height: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  right: stroke,
                  width: quarter * 0.6,
                  height: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
          </View>
        )

      case 'moon':
        return (
          <View style={baseStyle}>
            {/* Crescent moon using arc */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: quarter,
                  width: half,
                  height: size - stroke * 4,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: half,
                  borderRightColor: 'transparent',
                },
              ]}
            />
          </View>
        )

      case 'dot':
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: half - quarter * 0.4,
                  left: half - quarter * 0.4,
                  width: quarter * 0.8,
                  height: quarter * 0.8,
                  backgroundColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
          </View>
        )

      case 'plus':
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: quarter,
                  right: quarter,
                  height: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  left: half - stroke / 2,
                  top: quarter,
                  bottom: quarter,
                  width: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
          </View>
        )

      case 'minus':
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: quarter,
                  right: quarter,
                  height: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
          </View>
        )

      case 'loading':
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  bottom: stroke * 2,
                  borderWidth: stroke,
                  borderColor: `${iconColor}30`,
                  borderRadius: size,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  bottom: stroke * 2,
                  borderWidth: stroke,
                  borderColor: 'transparent',
                  borderTopColor: iconColor,
                  borderRadius: size,
                },
              ]}
            />
          </View>
        )

      case 'download':
        return (
          <View style={baseStyle}>
            {/* Arrow line */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: half - stroke / 2,
                  width: stroke,
                  height: half,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
            {/* Arrow head left */}
            <View
              style={[
                styles.absolute,
                {
                  top: half + stroke,
                  left: quarter + stroke,
                  width: stroke,
                  height: quarter * 0.8,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
            {/* Arrow head right */}
            <View
              style={[
                styles.absolute,
                {
                  top: half + stroke,
                  right: quarter + stroke,
                  width: stroke,
                  height: quarter * 0.8,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
            {/* Bottom bar */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: quarter,
                  left: quarter,
                  right: quarter,
                  height: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
          </View>
        )

      case 'send':
        return (
          <View style={baseStyle}>
            {/* Paper plane triangle */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: stroke * 2,
                  width: 0,
                  height: 0,
                  borderTopWidth: quarter,
                  borderRightWidth: size - stroke * 4,
                  borderBottomWidth: quarter,
                  borderTopColor: 'transparent',
                  borderRightColor: iconColor,
                  borderBottomColor: 'transparent',
                },
              ]}
            />
          </View>
        )

      case 'refresh':
        return (
          <View style={baseStyle}>
            {/* Circular arrow */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  bottom: stroke * 2,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: size,
                  borderRightColor: 'transparent',
                  borderBottomColor: 'transparent',
                },
              ]}
            />
            {/* Arrow head */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  right: quarter - stroke,
                  width: 0,
                  height: 0,
                  borderLeftWidth: stroke * 2.5,
                  borderTopWidth: stroke * 2.5,
                  borderBottomWidth: stroke * 2.5,
                  borderLeftColor: iconColor,
                  borderTopColor: 'transparent',
                  borderBottomColor: 'transparent',
                },
              ]}
            />
          </View>
        )

      case 'share':
        return (
          <View style={baseStyle}>
            {/* Center node */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke * 1.2,
                  left: stroke * 2,
                  width: stroke * 2.4,
                  height: stroke * 2.4,
                  backgroundColor: iconColor,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            {/* Top right node */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter - stroke,
                  right: stroke * 2,
                  width: stroke * 2.4,
                  height: stroke * 2.4,
                  backgroundColor: iconColor,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            {/* Bottom right node */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: quarter - stroke,
                  right: stroke * 2,
                  width: stroke * 2.4,
                  height: stroke * 2.4,
                  backgroundColor: iconColor,
                  borderRadius: stroke * 2,
                },
              ]}
            />
            {/* Top connecting line */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter + stroke,
                  left: stroke * 4,
                  width: half * 0.8,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '-30deg' }],
                },
              ]}
            />
            {/* Bottom connecting line */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: quarter + stroke,
                  left: stroke * 4,
                  width: half * 0.8,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '30deg' }],
                },
              ]}
            />
          </View>
        )

      case 'trash':
        return (
          <View style={baseStyle}>
            {/* Lid */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: quarter * 0.6,
                  right: quarter * 0.6,
                  height: stroke,
                  backgroundColor: iconColor,
                  borderRadius: stroke / 2,
                },
              ]}
            />
            {/* Handle */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  left: half - quarter * 0.5,
                  width: quarter,
                  height: stroke * 1.5,
                  borderTopLeftRadius: stroke,
                  borderTopRightRadius: stroke,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderBottomWidth: 0,
                },
              ]}
            />
            {/* Body */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 4,
                  left: quarter,
                  right: quarter,
                  bottom: stroke * 2,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderTopWidth: 0,
                  borderBottomLeftRadius: stroke * 1.5,
                  borderBottomRightRadius: stroke * 1.5,
                },
              ]}
            />
          </View>
        )

      case 'star':
        // Simplified star using filled circle for better visibility
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: stroke * 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  bottom: stroke * 2,
                  backgroundColor: iconColor,
                  borderRadius: size,
                },
              ]}
            />
          </View>
        )

      case 'heart':
        // Simplified heart using two circles and a triangle
        const heartSize = size * 0.3
        return (
          <View style={baseStyle}>
            {/* Left circle */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: quarter * 0.5,
                  width: heartSize,
                  height: heartSize,
                  backgroundColor: iconColor,
                  borderRadius: heartSize / 2,
                },
              ]}
            />
            {/* Right circle */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  right: quarter * 0.5,
                  width: heartSize,
                  height: heartSize,
                  backgroundColor: iconColor,
                  borderRadius: heartSize / 2,
                },
              ]}
            />
            {/* Bottom triangle */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke,
                  left: quarter * 0.7,
                  width: 0,
                  height: 0,
                  borderLeftWidth: half - quarter * 0.4,
                  borderRightWidth: half - quarter * 0.4,
                  borderTopWidth: half - stroke,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: iconColor,
                },
              ]}
            />
          </View>
        )

      case 'flash':
        return (
          <View style={baseStyle}>
            {/* Lightning bolt */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  left: half - stroke * 2,
                  width: 0,
                  height: 0,
                  borderLeftWidth: stroke * 3,
                  borderRightWidth: stroke,
                  borderBottomWidth: half - stroke,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderBottomColor: iconColor,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  bottom: stroke,
                  left: half - stroke,
                  width: 0,
                  height: 0,
                  borderLeftWidth: stroke,
                  borderRightWidth: stroke * 3,
                  borderTopWidth: half - stroke,
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: iconColor,
                },
              ]}
            />
          </View>
        )

      case 'grid':
        return (
          <View style={baseStyle}>
            {/* Vertical lines */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  bottom: stroke,
                  left: size * 0.33 - stroke / 2,
                  width: stroke,
                  backgroundColor: iconColor,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  bottom: stroke,
                  left: size * 0.66 - stroke / 2,
                  width: stroke,
                  backgroundColor: iconColor,
                },
              ]}
            />
            {/* Horizontal lines */}
            <View
              style={[
                styles.absolute,
                {
                  left: stroke,
                  right: stroke,
                  top: size * 0.33 - stroke / 2,
                  height: stroke,
                  backgroundColor: iconColor,
                },
              ]}
            />
            <View
              style={[
                styles.absolute,
                {
                  left: stroke,
                  right: stroke,
                  top: size * 0.66 - stroke / 2,
                  height: stroke,
                  backgroundColor: iconColor,
                },
              ]}
            />
          </View>
        )

      case 'link':
        return (
          <View style={baseStyle}>
            {/* Left chain link */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: stroke,
                  width: half * 0.7,
                  height: half,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
            {/* Right chain link */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  right: stroke,
                  width: half * 0.7,
                  height: half,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
          </View>
        )

      case 'unlink':
        return (
          <View style={baseStyle}>
            {/* Left chain link */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: stroke,
                  width: half * 0.5,
                  height: half,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
            {/* Right chain link */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  right: stroke,
                  width: half * 0.5,
                  height: half,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: quarter,
                },
              ]}
            />
            {/* Break line */}
            <View
              style={[
                styles.absolute,
                {
                  top: stroke,
                  bottom: stroke,
                  left: half - stroke / 2,
                  width: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
          </View>
        )

      case 'arrow-left':
        return (
          <View style={baseStyle}>
            {/* Horizontal line */}
            <View
              style={[
                styles.absolute,
                {
                  top: half - stroke / 2,
                  left: stroke * 2,
                  right: stroke * 2,
                  height: stroke,
                  backgroundColor: iconColor,
                },
              ]}
            />
            {/* Arrow head top */}
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: stroke * 2,
                  width: quarter * 0.8,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '-45deg' }],
                },
              ]}
            />
            {/* Arrow head bottom */}
            <View
              style={[
                styles.absolute,
                {
                  bottom: quarter,
                  left: stroke * 2,
                  width: quarter * 0.8,
                  height: stroke,
                  backgroundColor: iconColor,
                  transform: [{ rotate: '45deg' }],
                },
              ]}
            />
          </View>
        )

      default:
        // Default placeholder circle
        return (
          <View style={baseStyle}>
            <View
              style={[
                styles.absolute,
                {
                  top: quarter,
                  left: quarter,
                  right: quarter,
                  bottom: quarter,
                  borderWidth: stroke,
                  borderColor: iconColor,
                  borderRadius: size,
                },
              ]}
            />
          </View>
        )
    }
  }

  return <Animated.View style={animatedStyle}>{renderIcon()}</Animated.View>
}

const styles = StyleSheet.create({
  absolute: {
    position: 'absolute',
  },
})
