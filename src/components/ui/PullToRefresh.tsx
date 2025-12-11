/**
 * PullToRefresh - Enhanced pull-to-refresh with animated feedback
 * 
 * Features:
 * - Smooth spring animation on pull
 * - Progress indicator that fills as you pull
 * - Haptic feedback at threshold
 * - Success animation on complete
 */

import { ReactNode, useCallback, useState } from 'react'
import {
  RefreshControl,
  RefreshControlProps,
  StyleSheet,
  View,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { useThemeStore } from '../../stores/themeStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { triggerHaptic } from '../../utils/haptics'

interface PullToRefreshProps extends Omit<RefreshControlProps, 'refreshing' | 'onRefresh'> {
  refreshing: boolean
  onRefresh: () => Promise<void> | void
  children?: ReactNode
}

/**
 * Custom RefreshControl with enhanced haptic feedback
 */
export function EnhancedRefreshControl({
  refreshing,
  onRefresh,
  ...props
}: Omit<PullToRefreshProps, 'children'>) {
  const { colors } = useThemeStore()
  const [triggered, setTriggered] = useState(false)

  const handleRefresh = useCallback(async () => {
    if (!triggered) {
      setTriggered(true)
      triggerHaptic('impact')
    }
    
    await onRefresh()
    setTriggered(false)
    triggerHaptic('success')
  }, [onRefresh, triggered])

  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handleRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
      {...props}
    />
  )
}

/**
 * Animated refresh indicator for custom implementations
 */
interface RefreshIndicatorProps {
  progress: number // 0 to 1
  isRefreshing: boolean
}

export function RefreshIndicator({
  progress,
  isRefreshing,
}: RefreshIndicatorProps) {
  const { colors } = useThemeStore()
  const { settings } = useSettingsStore()
  const reduceMotion = settings.reduceMotion
  
  const rotation = useSharedValue(0)
  const scale = useSharedValue(0)

  // Animate based on progress
  const indicatorStyle = useAnimatedStyle(() => {
    const clampedProgress = Math.min(Math.max(progress, 0), 1)
    
    return {
      opacity: clampedProgress,
      transform: [
        { scale: reduceMotion ? clampedProgress : withSpring(clampedProgress) },
        { rotate: `${rotation.value}deg` },
      ],
    }
  })

  // Spinning animation when refreshing
  if (isRefreshing && !reduceMotion) {
    rotation.value = withTiming(rotation.value + 360, {
      duration: 1000,
    }, () => {
      if (isRefreshing) {
        rotation.value = 0
      }
    })
  }

  const progressStroke = Math.min(progress, 1) * 360

  return (
    <Animated.View style={[styles.indicator, indicatorStyle]}>
      <View
        style={[
          styles.indicatorCircle,
          {
            borderColor: colors.primary,
            borderRightColor: `${colors.primary}30`,
            borderBottomColor: progress > 0.25 ? colors.primary : `${colors.primary}30`,
            borderLeftColor: progress > 0.5 ? colors.primary : `${colors.primary}30`,
            borderTopColor: progress > 0.75 ? colors.primary : `${colors.primary}30`,
          },
        ]}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  indicator: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicatorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2.5,
  },
})

export default EnhancedRefreshControl

