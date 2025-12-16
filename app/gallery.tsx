/**
 * Gallery - Enhanced with share, zoom, skeleton loaders, and theme support
 * Full accessibility support and responsive design
 * Now loads photos from Supabase captures table
 * 
 * UX Enhancements:
 * - Undo pattern for delete (instead of confirm dialogs)
 * - Infinite scroll with prefetching
 * - Better accessibility labels
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Modal, 
  Dimensions,
  Share,
  Alert,
  RefreshControl,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native'
import { FlashList, ListRenderItemInfo } from '@shopify/flash-list'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  withRepeat,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import * as ImagePicker from 'expo-image-picker'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { Icon } from '../src/components/ui/Icon'
import { ZenLoader } from '../src/components/ui/ZenLoader'
import { ZenEmptyState } from '../src/components/ui/ZenEmptyState'
import { capturesApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'
import { cloudApi, AIAnalysisResult } from '../src/services/cloudApi'
import { useRouter } from 'expo-router'

const COLUMN_COUNT = 3
const GAP = 3

interface Photo {
  id: string
  uri: string
  byMe: boolean
  timestamp: Date
  cloudUrl?: string
  hasAnalysis?: boolean
}

/**
 * Skeleton loader for photo grid items
 */
function PhotoSkeleton({ size }: { size: number }) {
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
        {
          width: size,
          height: size,
          margin: GAP / 2,
          borderRadius: 6,
          backgroundColor: mode === 'dark' ? colors.surfaceAlt : colors.border,
        },
        animatedStyle,
      ]}
    />
  )
}

/**
 * Skeleton grid for loading state
 */
function PhotoGridSkeleton({ count = 9 }: { count?: number }) {
  const { width } = useWindowDimensions()
  const photoSize = (width - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT

  return (
    <View style={[styles.grid, { flexDirection: 'row', flexWrap: 'wrap' }]}>
      {Array.from({ length: count }).map((_, index) => (
        <PhotoSkeleton key={index} size={photoSize} />
      ))}
    </View>
  )
}

function ActionButton({ 
  label,
  icon, 
  onPress, 
  danger = false,
  loading = false,
  disabled = false,
  accessibilityHint,
}: { 
  label: string
  icon: 'share' | 'image' | 'trash' | 'cloud' | 'sparkles' | 'star'
  onPress: () => void
  danger?: boolean
  loading?: boolean
  disabled?: boolean
  accessibilityHint?: string
}) {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      onPressIn={() => { 
        if (!disabled && !loading) {
          scale.value = withSpring(0.94, { damping: 15, stiffness: 400 })
          opacity.value = withTiming(0.8, { duration: 50 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }}
      onPressOut={() => { 
        scale.value = withSpring(1, { damping: 15 }) 
        opacity.value = withTiming(1, { duration: 100 })
      }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
    >
      <Animated.View style={[
        styles.actionButton, 
        danger && styles.actionButtonDanger, 
        (disabled || loading) && styles.actionButtonDisabled,
        animatedStyle
      ]}>
        {loading ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Icon 
            name={icon} 
            size={18} 
            color={danger ? '#FCA5A5' : '#FFFFFF'} 
          />
        )}
        <Text style={[styles.actionButtonText, danger && styles.actionButtonTextDanger]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

function PhotoViewer({ 
  photo, 
  onClose,
  onShare,
  onDelete,
  onDownload,
  onCloudUpload,
  onAnalyze,
  isUploading,
  isAnalyzing,
  analysisResult,
  t,
}: { 
  photo: Photo
  onClose: () => void
  onShare: () => void
  onDelete: () => void
  onDownload: () => void
  onCloudUpload: () => void
  onAnalyze: () => void
  isUploading: boolean
  isAnalyzing: boolean
  analysisResult: AIAnalysisResult | null
  t: typeof import('../src/i18n/translations').translations.en
}) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const scale = useSharedValue(1)
  const translateX = useSharedValue(0)
  const translateY = useSharedValue(0)
  const savedScale = useSharedValue(1)
  
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1)
        savedScale.value = 1
      } else if (scale.value > 4) {
        scale.value = withSpring(4)
        savedScale.value = 4
      } else {
        savedScale.value = scale.value
      }
    })

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (scale.value > 1) {
        translateX.value = e.translationX
        translateY.value = e.translationY
      } else if (e.translationY > 100) {
        runOnJS(onClose)()
      }
    })
    .onEnd(() => {
      translateX.value = withSpring(0)
      translateY.value = withSpring(0)
    })

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = withSpring(1)
        savedScale.value = 1
      } else {
        scale.value = withSpring(2.5)
        savedScale.value = 2.5
      }
    })

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture)

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }))

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.viewerContainer}>
        <View style={styles.viewerHeader}>
          <Pressable 
            style={styles.closeButton} 
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close photo viewer"
            accessibilityRole="button"
          >
            <Icon name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <GestureDetector gesture={composedGesture}>
          <Animated.View style={styles.imageContainer}>
            <Animated.Image
              source={{ uri: photo.uri }}
              style={[styles.fullImage, imageStyle]}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>

        <View style={styles.viewerFooter}>
          {/* AI Analysis Panel */}
          {showAnalysis && analysisResult && (
            <Animated.View 
              entering={FadeIn.duration(200)}
              style={styles.analysisPanel}
            >
              <View style={styles.analysisPanelHeader}>
                <Text style={styles.analysisPanelTitle}>✨ AI Analysis</Text>
                <Pressable onPress={() => setShowAnalysis(false)}>
                  <Icon name="close" size={18} color="#FFFFFF" />
                </Pressable>
              </View>
              
              {analysisResult.composition && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>📐 Composition</Text>
                  <Text style={styles.analysisScore}>
                    Score: {analysisResult.composition.score}/10
                  </Text>
                  {analysisResult.composition.suggestions.map((s, i) => (
                    <Text key={i} style={styles.analysisSuggestion}>• {s}</Text>
                  ))}
                </View>
              )}
              
              {analysisResult.lighting && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>💡 Lighting</Text>
                  <Text style={styles.analysisScore}>
                    {analysisResult.lighting.quality} quality
                  </Text>
                  {analysisResult.lighting.suggestions.map((s, i) => (
                    <Text key={i} style={styles.analysisSuggestion}>• {s}</Text>
                  ))}
                </View>
              )}
              
              {analysisResult.overall_suggestions && analysisResult.overall_suggestions.length > 0 && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>💬 Tips</Text>
                  {analysisResult.overall_suggestions.slice(0, 3).map((s, i) => (
                    <Text key={i} style={styles.analysisSuggestion}>• {s}</Text>
                  ))}
                </View>
              )}
            </Animated.View>
          )}

          <Text 
            style={styles.photoInfo}
            accessibilityLabel={`Photo taken ${photo.byMe ? 'by you' : 'by partner'} on ${photo.timestamp.toLocaleDateString()}`}
          >
            {photo.byMe ? t.gallery.byYou : t.gallery.byPartner} · {photo.timestamp.toLocaleDateString()}
            {photo.cloudUrl && ' · ☁️ Backed up'}
          </Text>
          
          {/* Primary Actions Row */}
          <View style={styles.viewerActions} accessibilityRole="toolbar">
            <ActionButton 
              label="Cloud" 
              icon="cloud" 
              onPress={onCloudUpload}
              loading={isUploading}
              disabled={!!photo.cloudUrl}
              accessibilityHint={photo.cloudUrl ? "Already backed up to cloud" : "Upload photo to cloud storage"}
            />
            <ActionButton 
              label="AI" 
              icon="sparkles" 
              onPress={analysisResult ? () => setShowAnalysis(!showAnalysis) : onAnalyze}
              loading={isAnalyzing}
              accessibilityHint="Analyze photo composition and lighting with AI"
            />
            <ActionButton 
              label={t.gallery.share} 
              icon="share" 
              onPress={onShare}
              accessibilityHint="Share this photo with others"
            />
          </View>

          {/* Secondary Actions Row */}
          <View style={[styles.viewerActions, { marginTop: 8 }]} accessibilityRole="toolbar">
            <ActionButton 
              label={t.gallery.download} 
              icon="image" 
              onPress={onDownload}
              accessibilityHint="Save this photo to your device gallery"
            />
            <ActionButton 
              label={t.gallery.delete} 
              icon="trash" 
              onPress={onDelete} 
              danger
              accessibilityHint="Delete this photo permanently"
            />
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}


/**
 * UndoToast - Shows undo option after destructive actions
 */
function UndoToast({ 
  message, 
  visible, 
  onUndo, 
  onDismiss,
  duration = 5000,
}: { 
  message: string
  visible: boolean
  onUndo: () => void
  onDismiss: () => void
  duration?: number
}) {
  const { colors } = useThemeStore()
  const progress = useSharedValue(1)
  const translateY = useSharedValue(100)
  
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 200 })
      progress.value = 1
      progress.value = withTiming(0, { duration })
      
      const timer = setTimeout(() => {
        onDismiss()
      }, duration)
      
      return () => clearTimeout(timer)
    } else {
      translateY.value = withTiming(100, { duration: 200 })
    }
  }, [visible, duration, onDismiss])
  
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }))
  
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))
  
  if (!visible) return null
  
  return (
    <Animated.View style={[styles.undoToast, { backgroundColor: colors.surface }, containerStyle]}>
      <View style={styles.undoContent}>
        <Text style={[styles.undoMessage, { color: colors.text }]}>{message}</Text>
        <Pressable 
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onUndo()
          }}
          style={[styles.undoButton, { backgroundColor: colors.primary }]}
          accessibilityLabel="Undo delete"
          accessibilityRole="button"
        >
          <Text style={[styles.undoButtonText, { color: colors.primaryText }]}>UNDO</Text>
        </Pressable>
      </View>
      <Animated.View style={[styles.undoProgress, { backgroundColor: colors.primary }, progressStyle]} />
    </Animated.View>
  )
}

export default function GalleryScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { t } = useLanguageStore()
  const { stats } = useStatsStore()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const [photos, setPhotos] = useState<Photo[]>([])
  const [isAdding, setIsAdding] = useState(false)
  const { myDeviceId, sessionId, pairedDeviceId } = usePairingStore()
  
  // Cloud upload and AI analysis state
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null)
  
  // Undo state for delete actions
  const [undoState, setUndoState] = useState<{
    visible: boolean
    deletedPhoto: Photo | null
    message: string
  }>({ visible: false, deletedPhoto: null, message: '' })
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  
  // Infinite scroll state
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  
  // Calculate responsive photo size
  const photoSize = (screenWidth - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT

  // Add photos from device gallery
  const handleAddFromGallery = async () => {
    try {
      setIsAdding(true)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          t.common.error, 
          'We need gallery access to import photos'
        )
        return
      }

      // Launch image picker (allow multiple selection)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.9,
        selectionLimit: 10,
      })

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return
      }

      sessionLogger.info('gallery_import_started', { count: result.assets.length })

      // Add each selected photo to the gallery
      const newPhotos: Photo[] = []
      for (const asset of result.assets) {
        // Create a capture record in Supabase
        if (myDeviceId) {
          const { capture, error } = await capturesApi.save({
            cameraDeviceId: myDeviceId,
            viewerDeviceId: pairedDeviceId || undefined,
            sessionId: sessionId || undefined,
            storagePath: asset.uri,
            capturedBy: 'camera',
            width: asset.width,
            height: asset.height,
          })

          if (capture && !error) {
            newPhotos.push({
              id: capture.id,
              uri: asset.uri,
              byMe: true,
              timestamp: new Date(),
            })
          }
        } else {
          // If not connected, just add locally
          newPhotos.push({
            id: `local-${Date.now()}-${Math.random()}`,
            uri: asset.uri,
            byMe: true,
            timestamp: new Date(),
          })
        }
      }

      setPhotos(prev => [...newPhotos, ...prev])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      sessionLogger.info('gallery_import_complete', { count: newPhotos.length })
      
      if (newPhotos.length > 0) {
        Alert.alert(
          t.common.success, 
          `Added ${newPhotos.length} photo${newPhotos.length > 1 ? 's' : ''} to gallery!`
        )
      }
    } catch (err) {
      sessionLogger.error('gallery_import_error', err)
      Alert.alert(t.common.error, 'Failed to import photos')
    } finally {
      setIsAdding(false)
    }
  }

  // Load photos from Supabase
  const loadPhotos = useCallback(async () => {
    if (!myDeviceId) {
      setIsLoading(false)
      return
    }

    try {
      sessionLogger.info('gallery_loading_photos', { deviceId: myDeviceId })
      const { captures, error } = await capturesApi.getByDevice(myDeviceId, { limit: 100 })
      
      if (error) {
        sessionLogger.error('gallery_load_failed', new Error(error))
        setIsLoading(false)
        return
      }

      // Transform captures to Photo format
      const loadedPhotos: Photo[] = captures.map(capture => ({
        id: capture.id,
        uri: capture.storage_path || capture.thumbnail_path || '',
        byMe: capture.captured_by === 'camera',
        timestamp: capture.created_at ? new Date(capture.created_at) : new Date(),
      }))

      setPhotos(loadedPhotos)
      sessionLogger.info('gallery_photos_loaded', { count: loadedPhotos.length })
    } catch (err) {
      sessionLogger.error('gallery_load_error', err)
    } finally {
      setIsLoading(false)
    }
  }, [myDeviceId])

  // Initial load
  useEffect(() => {
    loadPhotos()
  }, [loadPhotos])

  // Show all photos
  const filteredPhotos = photos

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await loadPhotos()
    setRefreshing(false)
  }

  const handleShare = async () => {
    if (!selectedPhoto) return
    try {
      await Share.share({
        message: `${t.appName} - ${t.tagline}`,
        url: selectedPhoto.uri,
      })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      // User cancelled
    }
  }

  const handleDownload = async () => {
    if (!selectedPhoto) return
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(selectedPhoto.uri)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        Alert.alert(t.common.success, 'Photo saved to gallery!')
      }
    } catch {
      Alert.alert(t.common.error, 'Failed to save photo')
    }
  }

  // Cloud upload handler
  const handleCloudUpload = async () => {
    if (!selectedPhoto || !myDeviceId || selectedPhoto.cloudUrl) return
    
    setIsUploading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    sessionLogger.info('cloud_upload_started', { photoId: selectedPhoto.id })
    
    try {
      // Convert URI to base64
      const base64 = await cloudApi.photo.uriToBase64(selectedPhoto.uri)
      
      if (!base64) {
        Alert.alert(t.common.error, 'Failed to read photo')
        return
      }
      
      // Upload to cloud
      const result = await cloudApi.photo.upload({
        captureId: selectedPhoto.id,
        deviceId: myDeviceId,
        imageBase64: base64,
        mimeType: 'image/jpeg',
      })
      
      if (result.success && result.publicUrl) {
        // Update photo with cloud URL
        setPhotos(prev => prev.map(p => 
          p.id === selectedPhoto.id 
            ? { ...p, cloudUrl: result.publicUrl } 
            : p
        ))
        setSelectedPhoto(prev => prev ? { ...prev, cloudUrl: result.publicUrl } : null)
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        sessionLogger.info('cloud_upload_success', { photoId: selectedPhoto.id })
        Alert.alert('☁️ Success', 'Photo backed up to cloud!')
      } else {
        sessionLogger.error('cloud_upload_failed', new Error(result.error || 'Unknown'))
        Alert.alert(t.common.error, result.error || 'Upload failed')
      }
    } catch (error) {
      sessionLogger.error('cloud_upload_error', error)
      Alert.alert(t.common.error, 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // AI analysis handler
  const handleAnalyze = async () => {
    if (!selectedPhoto || !myDeviceId) return
    
    setIsAnalyzing(true)
    setAnalysisResult(null)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    sessionLogger.info('ai_analysis_started', { photoId: selectedPhoto.id })
    
    try {
      // Check for existing analysis first
      const existing = await cloudApi.ai.getAnalysis(selectedPhoto.id)
      if (existing) {
        setAnalysisResult(existing)
        setIsAnalyzing(false)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        return
      }
      
      // Need cloud URL for AI analysis
      let imageUrl = selectedPhoto.cloudUrl
      
      if (!imageUrl) {
        // Upload to cloud first
        const base64 = await cloudApi.photo.uriToBase64(selectedPhoto.uri)
        if (base64) {
          const uploadResult = await cloudApi.photo.upload({
            captureId: selectedPhoto.id,
            deviceId: myDeviceId,
            imageBase64: base64,
            mimeType: 'image/jpeg',
          })
          
          if (uploadResult.success && uploadResult.publicUrl) {
            imageUrl = uploadResult.publicUrl
            // Update photo with cloud URL
            setPhotos(prev => prev.map(p => 
              p.id === selectedPhoto.id 
                ? { ...p, cloudUrl: uploadResult.publicUrl } 
                : p
            ))
            setSelectedPhoto(prev => prev ? { ...prev, cloudUrl: uploadResult.publicUrl } : null)
          }
        }
      }
      
      if (!imageUrl) {
        Alert.alert(t.common.error, 'Could not prepare photo for analysis')
        return
      }
      
      // Run AI analysis
      const result = await cloudApi.ai.analyze({
        captureId: selectedPhoto.id,
        imageUrl,
        deviceId: myDeviceId,
      })
      
      if (result.success) {
        setAnalysisResult(result)
        setPhotos(prev => prev.map(p => 
          p.id === selectedPhoto.id 
            ? { ...p, hasAnalysis: true } 
            : p
        ))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        sessionLogger.info('ai_analysis_complete', { photoId: selectedPhoto.id })
      } else {
        sessionLogger.error('ai_analysis_failed', new Error(result.error || 'Unknown'))
        Alert.alert(t.common.error, result.error || 'Analysis failed')
      }
    } catch (error) {
      sessionLogger.error('ai_analysis_error', error)
      Alert.alert(t.common.error, 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }
  
  // Reset analysis when selecting different photo
  useEffect(() => {
    if (selectedPhoto) {
      setAnalysisResult(null)
      // Check for existing analysis
      cloudApi.ai.getAnalysis(selectedPhoto.id).then(existing => {
        if (existing) setAnalysisResult(existing)
      })
    }
  }, [selectedPhoto?.id])

  // Undo pattern for delete - more user-friendly than confirm dialogs
  const handleDelete = () => {
    if (!selectedPhoto) return
    
    const photoToDelete = selectedPhoto
    
    // Optimistic removal from UI
    setPhotos(prev => prev.filter(p => p.id !== photoToDelete.id))
    setSelectedPhoto(null)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    
    // Show undo toast
    setUndoState({
      visible: true,
      deletedPhoto: photoToDelete,
      message: 'Photo deleted',
    })
    
    sessionLogger.info('photo_delete_initiated', { photoId: photoToDelete.id })
  }
  
  // Handle undo
  const handleUndo = useCallback(() => {
    if (undoState.deletedPhoto) {
      // Restore the photo to the list
      setPhotos(prev => [undoState.deletedPhoto!, ...prev])
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      sessionLogger.info('photo_delete_undone', { photoId: undoState.deletedPhoto.id })
    }
    setUndoState({ visible: false, deletedPhoto: null, message: '' })
  }, [undoState.deletedPhoto])
  
  // Handle dismiss (actually delete)
  const handleUndoDismiss = useCallback(async () => {
    if (undoState.deletedPhoto) {
      try {
        // Actually delete from Supabase
        const { success, error } = await capturesApi.delete(undoState.deletedPhoto.id)
        
        if (success) {
          sessionLogger.info('photo_deleted', { photoId: undoState.deletedPhoto.id })
        } else {
          // Restore on failure
          setPhotos(prev => [undoState.deletedPhoto!, ...prev])
          sessionLogger.error('photo_delete_failed', new Error(error || 'Unknown error'))
          Alert.alert(t.common.error, 'Failed to delete photo. Photo has been restored.')
        }
      } catch (err) {
        // Restore on failure
        setPhotos(prev => [undoState.deletedPhoto!, ...prev])
        sessionLogger.error('photo_delete_error', err)
        Alert.alert(t.common.error, 'Failed to delete photo. Photo has been restored.')
      }
    }
    setUndoState({ visible: false, deletedPhoto: null, message: '' })
  }, [undoState.deletedPhoto, t.common.error])
  
  // Infinite scroll - load more photos
  const handleEndReached = useCallback(async () => {
    if (isLoadingMore || !hasMore || !myDeviceId) return
    
    setIsLoadingMore(true)
    try {
      const { captures } = await capturesApi.getByDevice(myDeviceId, { 
        limit: PAGE_SIZE, 
        offset: (page + 1) * PAGE_SIZE 
      })
      
      if (captures.length < PAGE_SIZE) {
        setHasMore(false)
      }
      
      if (captures.length > 0) {
        const newPhotos: Photo[] = captures.map(capture => ({
          id: capture.id,
          uri: capture.storage_path || capture.thumbnail_path || '',
          byMe: capture.captured_by === 'camera',
          timestamp: capture.created_at ? new Date(capture.created_at) : new Date(),
        }))
        
        setPhotos(prev => [...prev, ...newPhotos])
        setPage(prev => prev + 1)
      }
    } catch (err) {
      sessionLogger.error('gallery_load_more_error', err)
    } finally {
      setIsLoadingMore(false)
    }
  }, [isLoadingMore, hasMore, myDeviceId, page])

  const renderPhoto = useCallback(({ item, index }: ListRenderItemInfo<Photo>) => (
    <Animated.View entering={FadeInUp.delay(index * 25).duration(250)}>
      <Pressable 
        style={[
          styles.photoItem, 
          { 
            backgroundColor: colors.surfaceAlt,
            width: photoSize,
            height: photoSize,
          }
        ]} 
        onPress={() => {
          setSelectedPhoto(item)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        accessibilityLabel={`Photo ${index + 1}${item.byMe ? ', taken by you' : ', taken by partner'}`}
        accessibilityHint="Double tap to view full size"
        accessibilityRole="image"
      >
        <Image 
          source={item.uri} 
          style={styles.thumbnail} 
          contentFit="cover"
          cachePolicy="memory-disk"
          placeholder={colors.surfaceAlt}
          transition={200}
        />
        {!item.byMe && (
          <View 
            style={[styles.partnerBadge, { backgroundColor: colors.primary }]}
            accessibilityElementsHidden
          >
            <Icon name="user" size={10} color={colors.primaryText} />
          </View>
        )}
      </Pressable>
    </Animated.View>
  ), [colors, photoSize])

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>

      {isLoading ? (
        <View style={styles.zenLoadingContainer}>
          <ZenLoader variant="breathe" size="large" message="Loading your memories..." />
        </View>
      ) : filteredPhotos.length === 0 ? (
        <ZenEmptyState
          icon="gallery"
          title={t.gallery.noPhotos}
          description={t.gallery.noPhotosDesc}
          action={{
            label: 'Start a session',
            onPress: () => router.push('/pairing'),
          }}
        />
      ) : (
        // @ts-expect-error FlashList v2 types are incomplete
        <FlashList
          data={filteredPhotos}
          keyExtractor={(item: Photo) => item.id}
          numColumns={COLUMN_COUNT}
          renderItem={renderPhoto}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={photoSize}
          drawDistance={photoSize * 3}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textMuted}
              colors={[colors.primary]}
            />
          }
          // Infinite scroll with prefetching
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          ListFooterComponent={isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ZenLoader variant="dots" size="small" />
            </View>
          ) : null}
          accessible={true}
          accessibilityLabel={`Photo gallery with ${filteredPhotos.length} photos`}
        />
      )}

      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          onClose={() => {
            setSelectedPhoto(null)
            setAnalysisResult(null)
          }}
          onShare={handleShare}
          onDelete={handleDelete}
          onDownload={handleDownload}
          onCloudUpload={handleCloudUpload}
          onAnalyze={handleAnalyze}
          isUploading={isUploading}
          isAnalyzing={isAnalyzing}
          analysisResult={analysisResult}
          t={t}
        />
      )}

      {/* Undo Toast for delete actions */}
      <UndoToast
        visible={undoState.visible}
        message={undoState.message}
        onUndo={handleUndo}
        onDismiss={handleUndoDismiss}
      />

      {/* Floating Add Button */}
      <Pressable
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={handleAddFromGallery}
        disabled={isAdding}
        accessibilityLabel="Add photos from gallery"
        accessibilityHint="Opens your photo library to select photos to add"
        accessibilityRole="button"
      >
        {isAdding ? (
          <ActivityIndicator size="small" color={colors.primaryText} />
        ) : (
          <Icon name="plus" size={24} color={colors.primaryText} />
        )}
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  grid: {
    padding: GAP,
  },
  photoItem: {
    margin: GAP / 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  partnerBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    borderRadius: 4,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zenLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyContent: {
    alignItems: 'center',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  emptyHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  // Viewer styles
  viewerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  viewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 56,
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '100%',
    height: '70%',
  },
  viewerFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 44,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  photoInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    marginBottom: 16,
  },
  viewerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextDanger: {
    color: '#FCA5A5',
  },
  // AI Analysis Panel
  analysisPanel: {
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    maxHeight: 280,
  },
  analysisPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  analysisPanelTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  analysisSection: {
    marginBottom: 10,
  },
  analysisSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  analysisScore: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 4,
  },
  analysisSuggestion: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 18,
    marginLeft: 4,
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Undo toast styles
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  undoContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  undoMessage: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  undoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minHeight: 40,
    justifyContent: 'center',
  },
  undoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  undoProgress: {
    height: 3,
    borderRadius: 1.5,
  },
  // Loading more styles
  loadingMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    fontWeight: '500',
  },
})
