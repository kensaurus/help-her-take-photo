/**
 * Display for received camera preview frames
 */

import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { Image } from 'expo-image'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'
import type { StreamFrame } from '../types'
import { streamingService } from '../services/streaming'

interface PreviewDisplayProps {
  frame: StreamFrame | null
  showStats?: boolean
  frameRate?: number
  latency?: number | null
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

export function PreviewDisplay({
  frame,
  showStats = false,
  frameRate = 0,
  latency,
}: PreviewDisplayProps) {
  if (!frame) {
    return (
      <View style={styles.container}>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Waiting for preview...</Text>
          <Text style={styles.placeholderSubtext}>
            Make sure your partner's camera is active
          </Text>
        </View>
      </View>
    )
  }

  const decoded = streamingService.decodeFrame(frame)
  const frameLatency = decoded.latency

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: decoded.uri }}
        style={styles.image}
        contentFit="contain"
        transition={50}
      />
      
      {showStats && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          style={styles.statsContainer}
        >
          <Text style={styles.statsText}>{frameRate} FPS</Text>
          <Text style={styles.statsText}>
            {latency !== null && latency !== undefined ? `${latency}ms` : '--'}
          </Text>
          <Text style={styles.statsText}>
            {decoded.width}x{decoded.height}
          </Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  placeholder: {
    alignItems: 'center',
    gap: 8,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholderSubtext: {
    color: '#9ca3af',
    fontSize: 14,
  },
  statsContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 8,
    gap: 4,
  },
  statsText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
})

