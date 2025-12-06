/**
 * Connection status indicator
 */

import { View, Text, StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated'
import { useEffect } from 'react'
import type { ConnectionStatus as ConnectionStatusType } from '../types'

interface ConnectionStatusProps {
  status: ConnectionStatusType
  latency?: number | null
  compact?: boolean
}

const STATUS_CONFIG: Record<ConnectionStatusType, { color: string; label: string }> = {
  disconnected: { color: '#6b7280', label: 'Disconnected' },
  discovering: { color: '#f59e0b', label: 'Discovering...' },
  connecting: { color: '#3b82f6', label: 'Connecting...' },
  connected: { color: '#10b981', label: 'Connected' },
  streaming: { color: '#8b5cf6', label: 'Streaming' },
  error: { color: '#ef4444', label: 'Error' },
}

export function ConnectionStatus({
  status,
  latency,
  compact = false,
}: ConnectionStatusProps) {
  const pulseOpacity = useSharedValue(1)
  const config = STATUS_CONFIG[status]

  useEffect(() => {
    if (status === 'discovering' || status === 'connecting') {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 600 }),
          withTiming(1, { duration: 600 })
        ),
        -1,
        false
      )
    } else {
      pulseOpacity.value = 1
    }
  }, [status, pulseOpacity])

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }))

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Animated.View
          style={[styles.dot, { backgroundColor: config.color }, dotStyle]}
        />
        {latency !== null && latency !== undefined && latency >= 0 && (
          <Text style={styles.latencyCompact}>{latency}ms</Text>
        )}
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.dot, { backgroundColor: config.color }, dotStyle]}
      />
      <Text style={[styles.label, { color: config.color }]}>{config.label}</Text>
      {latency !== null && latency !== undefined && latency >= 0 && (
        <Text style={styles.latency}>{latency}ms</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  latency: {
    fontSize: 12,
    color: '#9ca3af',
    marginLeft: 4,
  },
  latencyCompact: {
    fontSize: 10,
    color: '#9ca3af',
  },
})

