/**
 * Skeleton loader component for loading states
 * Provides shimmer animation for placeholder content
 */

import { useEffect } from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated'
import { useThemeStore } from '../../stores/themeStore'

interface SkeletonProps {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: object
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 4,
  style,
}: SkeletonProps) {
  const { colors, mode } = useThemeStore()
  const shimmer = useSharedValue(0)

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    )
  }, [shimmer])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }))

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: mode === 'dark' ? colors.surfaceAlt : colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  )
}

/**
 * Skeleton for photo grid items
 */
interface PhotoSkeletonProps {
  size: number
  count?: number
}

export function PhotoGridSkeleton({ size, count = 6 }: PhotoSkeletonProps) {
  const { colors, mode } = useThemeStore()
  const { width: screenWidth } = useWindowDimensions()
  const gap = 3
  const columns = 3
  const itemSize = (screenWidth - gap * (columns + 1)) / columns

  return (
    <View style={[styles.photoGrid, { padding: gap }]}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonItem key={index} size={itemSize} gap={gap} mode={mode} colors={colors} />
      ))}
    </View>
  )
}

function SkeletonItem({ 
  size, 
  gap, 
  mode, 
  colors 
}: { 
  size: number
  gap: number
  mode: string
  colors: any 
}) {
  const shimmer = useSharedValue(0)

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    )
  }, [shimmer])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }))

  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          margin: gap / 2,
          borderRadius: 6,
          backgroundColor: mode === 'dark' ? colors.surfaceAlt : colors.border,
        },
        animatedStyle,
      ]}
    />
  )
}

/**
 * Skeleton for list items
 */
export function ListItemSkeleton() {
  const { colors, mode } = useThemeStore()

  return (
    <View style={[styles.listItem, { backgroundColor: colors.surface }]}>
      <Skeleton width={44} height={44} borderRadius={8} />
      <View style={styles.listItemContent}>
        <Skeleton width="60%" height={16} />
        <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
  )
}

/**
 * Skeleton for card content
 */
export function CardSkeleton() {
  const { colors, mode } = useThemeStore()

  return (
    <View style={[styles.card, { 
      backgroundColor: colors.surface, 
      borderColor: colors.border 
    }]}>
      <View style={styles.cardHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={styles.cardHeaderText}>
          <Skeleton width={120} height={16} />
          <Skeleton width={80} height={12} style={{ marginTop: 6 }} />
        </View>
      </View>
      <Skeleton width="100%" height={100} borderRadius={8} style={{ marginTop: 16 }} />
    </View>
  )
}

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  listItemContent: {
    flex: 1,
  },
  card: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
})

