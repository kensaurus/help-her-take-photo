/**
 * Camera - The photographer's view (with encouragement!)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Alert,
  Share,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeOut,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { usePairingStore } from '../src/stores/pairingStore'
import { useSettingsStore } from '../src/stores/settingsStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

// Grid overlay component
function GridOverlay() {
  return (
    <View style={styles.gridOverlay} pointerEvents="none">
      <View style={[styles.gridLine, styles.gridLineH, { top: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineH, { top: '66%' }]} />
      <View style={[styles.gridLine, styles.gridLineV, { left: '33%' }]} />
      <View style={[styles.gridLine, styles.gridLineV, { left: '66%' }]} />
    </View>
  )
}

// Encouragement toast
function EncouragementToast({ message, visible }: { message: string; visible: boolean }) {
  if (!visible) return null
  
  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(200)}
      style={styles.toast}
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  )
}

// Capture button with animation
function CaptureButton({ onPress, isSharing }: { onPress: () => void; isSharing: boolean }) {
  const scale = useSharedValue(1)
  const innerScale = useSharedValue(1)
  
  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.9, { damping: 15 }),
      withSpring(1, { damping: 15 })
    )
    innerScale.value = withSequence(
      withTiming(0.6, { duration: 100 }),
      withTiming(1, { duration: 200 })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onPress()
  }
  
  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: innerScale.value }],
  }))

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.captureOuter, outerStyle]}>
        <Animated.View style={[
          styles.captureInner,
          isSharing && styles.captureInnerSharing,
          innerStyle
        ]} />
      </Animated.View>
    </Pressable>
  )
}

// Action button
function ActionButton({ 
  label, 
  onPress, 
  active = false 
}: { 
  label: string
  onPress: () => void
  active?: boolean
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={() => {
        scale.value = withSpring(0.95)
        setTimeout(() => { scale.value = withSpring(1) }, 100)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
    >
      <Animated.View style={[styles.actionBtn, active && styles.actionBtnActive, animatedStyle]}>
        <Text style={[styles.actionBtnText, active && styles.actionBtnTextActive]}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

export default function CameraScreen() {
  const router = useRouter()
  const { isPaired } = usePairingStore()
  const { settings, updateSettings } = useSettingsStore()
  const { t } = useLanguageStore()
  const { incrementPhotos, stats } = useStatsStore()
  
  const [isSharing, setIsSharing] = useState(false)
  const [photoCount, setPhotoCount] = useState(0)
  const [showEncouragement, setShowEncouragement] = useState(false)
  const [encouragement, setEncouragement] = useState('')
  
  const encouragements = t.camera.encouragements

  // Camera permission (would be real in actual app)
  useEffect(() => {
    // Request camera permissions
  }, [])

  // Show random encouragement after taking photo
  const showRandomEncouragement = useCallback(() => {
    const msg = encouragements[Math.floor(Math.random() * encouragements.length)]
    setEncouragement(msg)
    setShowEncouragement(true)
    setTimeout(() => setShowEncouragement(false), 2500)
  }, [encouragements])

  const handleCapture = async () => {
    setPhotoCount(prev => prev + 1)
    incrementPhotos()
    showRandomEncouragement()
    
    // Simulate saving
    if (settings.autoSave) {
      try {
        // In real app: save photo to library
      } catch {}
    }
  }

  const toggleSharing = () => {
    setIsSharing(!isSharing)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `📸 ${t.appName} - I've avoided ${stats.scoldingsSaved} scoldings so far! ${t.tagline}`,
      })
    } catch {}
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Camera preview placeholder */}
      <View style={styles.cameraPreview}>
        <View style={styles.mockCamera}>
          <Text style={styles.mockCameraText}>📷</Text>
          <Text style={styles.mockCameraLabel}>Camera Preview</Text>
          <Text style={styles.mockCameraHint}>(Vision Camera loads on device)</Text>
        </View>
        
        {settings.showGrid && <GridOverlay />}
        
        {/* Status bar */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, isPaired ? styles.statusDotOn : styles.statusDotOff]} />
          <Text style={styles.statusText}>
            {isPaired ? (isSharing ? 'LIVE' : 'Connected') : t.camera.notConnected}
          </Text>
        </View>
        
        {/* Photo count */}
        <View style={styles.photoCount}>
          <Text style={styles.photoCountText}>{photoCount} {t.camera.captured}</Text>
        </View>
        
        {/* Encouragement toast */}
        <EncouragementToast message={encouragement} visible={showEncouragement} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Top row - share/stop and settings */}
        <View style={styles.topControls}>
          <ActionButton
            label={isSharing ? t.camera.stop : t.camera.share}
            onPress={toggleSharing}
            active={isSharing}
          />
          
          <ActionButton
            label={t.camera.options}
            onPress={() => router.push('/settings')}
          />
        </View>

        {/* Capture button */}
        <View style={styles.captureRow}>
          <CaptureButton onPress={handleCapture} isSharing={isSharing} />
        </View>

        {/* Bottom row - quick actions */}
        <View style={styles.bottomControls}>
          <Pressable 
            style={styles.quickAction}
            onPress={() => updateSettings({ showGrid: !settings.showGrid })}
          >
            <Text style={styles.quickActionText}>⊞</Text>
            <Text style={styles.quickActionLabel}>Grid</Text>
          </Pressable>
          
          <Pressable 
            style={styles.quickAction}
            onPress={() => router.push('/gallery')}
          >
            <Text style={styles.quickActionText}>◫</Text>
            <Text style={styles.quickActionLabel}>Gallery</Text>
          </Pressable>
          
          <Pressable 
            style={styles.quickAction}
            onPress={handleShare}
          >
            <Text style={styles.quickActionText}>↗</Text>
            <Text style={styles.quickActionLabel}>Share</Text>
          </Pressable>
        </View>

        {/* Not connected prompt */}
        {!isPaired && (
          <Pressable 
            style={styles.connectPrompt}
            onPress={() => router.push('/pairing')}
          >
            <Text style={styles.connectPromptText}>{t.camera.connectPrompt}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPreview: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    position: 'relative',
  },
  mockCamera: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockCameraText: {
    fontSize: 64,
    marginBottom: 16,
  },
  mockCameraLabel: {
    fontSize: 18,
    color: '#666',
    fontWeight: '500',
  },
  mockCameraHint: {
    fontSize: 13,
    color: '#444',
    marginTop: 8,
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  gridLineH: {
    left: 0,
    right: 0,
    height: 1,
  },
  gridLineV: {
    top: 0,
    bottom: 0,
    width: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOn: {
    backgroundColor: '#22C55E',
  },
  statusDotOff: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  photoCount: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  photoCountText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  toast: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  controls: {
    backgroundColor: '#000',
    paddingBottom: 32,
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 100,
    alignItems: 'center',
  },
  actionBtnActive: {
    backgroundColor: '#DC2626',
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  actionBtnTextActive: {
    color: '#fff',
  },
  captureRow: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
    backgroundColor: '#fff',
  },
  captureInnerSharing: {
    backgroundColor: '#DC2626',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 40,
    paddingTop: 8,
  },
  quickAction: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  quickActionText: {
    fontSize: 24,
    color: '#fff',
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
  },
  connectPrompt: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  connectPromptText: {
    fontSize: 14,
    color: '#888',
  },
})
