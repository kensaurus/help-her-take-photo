/**
 * Gallery - Enhanced with share, zoom, skeleton loaders, and theme support
 * Full accessibility support and responsive design
 * Now loads photos from Supabase captures table
 */

import { useState, useCallback, useEffect } from 'react'
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
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { Icon } from '../src/components/ui/Icon'
import { capturesApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'

const COLUMN_COUNT = 3
const GAP = 3

interface Photo {
  id: string
  uri: string
  byMe: boolean
  timestamp: Date
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
  accessibilityHint,
}: { 
  label: string
  icon: 'share' | 'image' | 'trash'
  onPress: () => void
  danger?: boolean
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
      onPressIn={() => { 
        scale.value = withSpring(0.94, { damping: 15, stiffness: 400 })
        opacity.value = withTiming(0.8, { duration: 50 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
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
        animatedStyle
      ]}>
        <Icon 
          name={icon} 
          size={18} 
          color={danger ? '#FCA5A5' : '#FFFFFF'} 
        />
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
  t,
}: { 
  photo: Photo
  onClose: () => void
  onShare: () => void
  onDelete: () => void
  onDownload: () => void
  t: typeof import('../src/i18n/translations').translations.en
}) {
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
          <Text 
            style={styles.photoInfo}
            accessibilityLabel={`Photo taken ${photo.byMe ? 'by you' : 'by partner'} on ${photo.timestamp.toLocaleDateString()}`}
          >
            {photo.byMe ? t.gallery.byYou : t.gallery.byPartner} · {photo.timestamp.toLocaleDateString()}
          </Text>
          
          <View style={styles.viewerActions} accessibilityRole="toolbar">
            <ActionButton 
              label={t.gallery.share} 
              icon="share" 
              onPress={onShare}
              accessibilityHint="Share this photo with others"
            />
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

function FilterTab({ 
  label, 
  active, 
  onPress 
}: { 
  label: string
  active: boolean
  onPress: () => void
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15, stiffness: 400 })
        opacity.value = withTiming(0.8, { duration: 50 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
        opacity.value = withTiming(1, { duration: 100 })
      }}
      accessibilityLabel={`Filter: ${label}`}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[
        styles.filterTab, 
        { backgroundColor: active ? colors.primary : colors.surfaceAlt },
        animatedStyle
      ]}>
        <Text style={[
          styles.filterText, 
          { color: active ? colors.primaryText : colors.textSecondary }
        ]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export default function GalleryScreen() {
  const { colors } = useThemeStore()
  const { t } = useLanguageStore()
  const { stats } = useStatsStore()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'byMe' | 'byPartner'>('all')

  const [photos, setPhotos] = useState<Photo[]>([])
  const { myDeviceId } = usePairingStore()
  
  // Calculate responsive photo size
  const photoSize = (screenWidth - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT

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
        timestamp: new Date(capture.created_at),
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

  const filteredPhotos = photos.filter(p => {
    if (filter === 'all') return true
    if (filter === 'byMe') return p.byMe
    return !p.byMe
  })

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

  const handleDelete = () => {
    if (!selectedPhoto) return
    Alert.alert(
      t.gallery.delete,
      'Are you sure?',
      [
        { text: t.common.cancel, style: 'cancel' },
        { 
          text: t.common.delete, 
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete from Supabase
              const { success, error } = await capturesApi.delete(selectedPhoto.id)
              
              if (success) {
                setPhotos(prev => prev.filter(p => p.id !== selectedPhoto.id))
                setSelectedPhoto(null)
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                sessionLogger.info('photo_deleted', { photoId: selectedPhoto.id })
              } else {
                sessionLogger.error('photo_delete_failed', new Error(error || 'Unknown error'))
                Alert.alert(t.common.error, 'Failed to delete photo')
              }
            } catch (err) {
              sessionLogger.error('photo_delete_error', err)
              Alert.alert(t.common.error, 'Failed to delete photo')
            }
          }
        },
      ]
    )
  }

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
      {/* Filter tabs */}
      <View style={[styles.filterRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <FilterTab
          label={t.gallery.photos}
          active={filter === 'all'}
          onPress={() => setFilter('all')}
        />
        <FilterTab
          label={t.gallery.byYou}
          active={filter === 'byMe'}
          onPress={() => setFilter('byMe')}
        />
        <FilterTab
          label={t.gallery.byPartner}
          active={filter === 'byPartner'}
          onPress={() => setFilter('byPartner')}
        />
      </View>

      {/* Stats banner */}
      {stats.photosTaken > 0 && (
        <Animated.View 
          entering={FadeIn.duration(350)} 
          style={[styles.statsBanner, { backgroundColor: colors.surfaceAlt }]}
        >
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Icon name="camera" size={14} color={colors.accent} />
              <Text style={[styles.statsText, { color: colors.accent }]}>
                {stats.photosTaken} {t.gallery.photos}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Icon name="star" size={14} color={colors.accent} />
              <Text style={[styles.statsText, { color: colors.accent }]}>
                {stats.scoldingsSaved} saved
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {isLoading ? (
        <PhotoGridSkeleton count={12} />
      ) : filteredPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyContent}>
            <View 
              style={[styles.emptyIconContainer, { backgroundColor: colors.surfaceAlt }]}
              accessibilityElementsHidden
            >
              <Icon name="image" size={40} color={colors.textMuted} />
            </View>
            <Text 
              style={[styles.emptyTitle, { color: colors.text }]}
              accessibilityRole="header"
            >
              {t.gallery.noPhotos}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {t.gallery.noPhotosDesc}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              {filter === 'all' 
                ? "Start a session and the magic happens"
                : filter === 'byMe'
                ? "You haven't taken any yet"
                : "Waiting for partner's photos"}
            </Text>
          </Animated.View>
        </View>
      ) : (
        <FlashList<Photo>
          data={filteredPhotos}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          renderItem={renderPhoto}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          estimatedItemSize={photoSize}
          drawDistance={photoSize * 2}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textMuted}
              colors={[colors.primary]}
            />
          }
          accessible={true}
          accessibilityLabel={`Photo gallery with ${filteredPhotos.length} photos`}
        />
      )}

      {selectedPhoto && (
        <PhotoViewer
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onShare={handleShare}
          onDelete={handleDelete}
          onDownload={handleDownload}
          t={t}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statsBanner: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(128,128,128,0.3)',
  },
  statsText: {
    fontSize: 13,
    fontWeight: '600',
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
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextDanger: {
    color: '#FCA5A5',
  },
})
