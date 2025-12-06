/**
 * Rule of thirds grid overlay for camera composition
 */

import { View, StyleSheet } from 'react-native'

interface GridOverlayProps {
  visible?: boolean
}

export function GridOverlay({ visible = true }: GridOverlayProps) {
  if (!visible) return null

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Vertical lines */}
      <View style={[styles.line, styles.verticalLine, { left: '33.33%' }]} />
      <View style={[styles.line, styles.verticalLine, { left: '66.66%' }]} />
      
      {/* Horizontal lines */}
      <View style={[styles.line, styles.horizontalLine, { top: '33.33%' }]} />
      <View style={[styles.line, styles.horizontalLine, { top: '66.66%' }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
  },
  line: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  verticalLine: {
    width: 1,
    height: '100%',
  },
  horizontalLine: {
    width: '100%',
    height: 1,
  },
})

