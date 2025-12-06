/**
 * Camera view with controls and preview streaming
 */

import { useCallback, useEffect } from 'react'
import { View, StyleSheet, Pressable, Text } from 'react-native'
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera'
import { useCamera } from '../hooks/useCamera'
import { useSettingsStore } from '../stores/settingsStore'
import { GridOverlay } from './GridOverlay'
import { CaptureButton } from './CaptureButton'
import { ConnectionStatus } from './ConnectionStatus'
import type { ConnectionStatus as ConnectionStatusType } from '../types'

interface CameraViewProps {
  onCapture: () => Promise<void>
  onFrameCapture?: (base64: string, width: number, height: number) => void
  connectionStatus: ConnectionStatusType
  latency?: number | null
}

export function CameraView({
  onCapture,
  onFrameCapture,
  connectionStatus,
  latency,
}: CameraViewProps) {
  const {
    cameraRef,
    device,
    format,
    hasPermission,
    isTakingPhoto,
    flashEnabled,
    toggleFlash,
    toggleCamera,
    focusAtPoint,
  } = useCamera()

  const { showGridOverlay } = useSettingsStore()

  const handlePress = useCallback((event: { nativeEvent: { locationX: number; locationY: number } }) => {
    const { locationX, locationY } = event.nativeEvent
    focusAtPoint(locationX, locationY)
  }, [focusAtPoint])

  if (!hasPermission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <Text style={styles.permissionSubtext}>
          Please enable camera access in your device settings
        </Text>
      </View>
    )
  }

  if (!device) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>No camera device found</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.cameraContainer} onPress={handlePress}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={true}
          photo={true}
          enableZoomGesture
        />
        <GridOverlay visible={showGridOverlay} />
      </Pressable>

      {/* Top controls */}
      <View style={styles.topControls}>
        <ConnectionStatus status={connectionStatus} latency={latency} />
      </View>

      {/* Side controls */}
      <View style={styles.sideControls}>
        <Pressable
          style={[styles.iconButton, flashEnabled && styles.iconButtonActive]}
          onPress={toggleFlash}
          accessibilityLabel={flashEnabled ? 'Turn off flash' : 'Turn on flash'}
        >
          <Text style={styles.iconText}>{flashEnabled ? '⚡' : '⚡'}</Text>
        </Pressable>
        
        <Pressable
          style={styles.iconButton}
          onPress={toggleCamera}
          accessibilityLabel="Switch camera"
        >
          <Text style={styles.iconText}>🔄</Text>
        </Pressable>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        <CaptureButton
          onPress={onCapture}
          loading={isTakingPhoto}
          disabled={!device}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  permissionSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  topControls: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  sideControls: {
    position: 'absolute',
    right: 16,
    top: '30%',
    gap: 16,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconButtonActive: {
    backgroundColor: 'rgba(251, 191, 36, 0.8)',
  },
  iconText: {
    fontSize: 20,
  },
})

