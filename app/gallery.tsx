/**
 * Gallery - Enhanced with share, zoom, and theme support
 */

import { useState, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  FlatList, 
  Modal, 
  Dimensions,
  Image,
  Share,
  Alert,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const COLUMN_COUNT = 3
const GAP = 3
const PHOTO_SIZE = (SCREEN_WIDTH - GAP * (COLUMN_COUNT + 1)) / COLUMN_COUNT

// Mock photos for demo
interface Photo {
  id: string
  uri: string
  byMe: boolean
  timestamp: Date
}

function ActionButton({ 
  label, 
  onPress, 
  danger = false 
}: { 
  label: string
  onPress: () => void
  danger?: boolean
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { 
        scale.value = withSpring(0.95, { damping: 15 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }) }}
    >
      <Animated.View style={[
        styles.actionButton, 
        danger && styles.actionButtonDanger, 
        animatedStyle
      ]}>
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
  t: ReturnType<typeof useLanguageStore>['t']
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
          >
            <Text style={styles.closeButtonText}>✕</Text>
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
          <Text style={styles.photoInfo}>
            {photo.byMe ? t.gallery.byYou : t.gallery.byPartner} • {photo.timestamp.toLocaleDateString()}
          </Text>
          
          <View style={styles.viewerActions}>
            <ActionButton label={t.gallery.share} onPress={onShare} />
            <ActionButton label={t.gallery.download} onPress={onDownload} />
            <ActionButton label={t.gallery.delete} onPress={onDelete} danger />
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
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15 })
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
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
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'byMe' | 'byPartner'>('all')

  // Demo photos (would come from real storage)
  const [photos, setPhotos] = useState<Photo[]>([
    // Add demo photos here when real photos are captured
  ])

  const filteredPhotos = photos.filter(p => {
    if (filter === 'all') return true
    if (filter === 'byMe') return p.byMe
    return !p.byMe
  })

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 800))
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
          onPress: () => {
            setPhotos(prev => prev.filter(p => p.id !== selectedPhoto.id))
            setSelectedPhoto(null)
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
        },
      ]
    )
  }

  const renderPhoto = useCallback(({ item, index }: { item: Photo; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 30).duration(300)}>
      <Pressable 
        style={[styles.photoItem, { backgroundColor: colors.surfaceAlt }]} 
        onPress={() => {
          setSelectedPhoto(item)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
      >
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
        {!item.byMe && (
          <View style={styles.partnerBadge}>
            <Text style={styles.partnerBadgeText}>👸</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  ), [colors.surfaceAlt])

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
          entering={FadeIn.duration(400)} 
          style={[styles.statsBanner, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.statsText, { color: colors.accent }]}>
            📸 {stats.photosTaken} {t.gallery.photos} • 🛡️ {stats.scoldingsSaved} {t.profile.scoldingsSaved}
          </Text>
        </Animated.View>
      )}

      {filteredPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Animated.View entering={FadeIn.duration(500)}>
            <Text style={styles.emptyIcon}>📷</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t.gallery.noPhotos}
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {t.gallery.noPhotosDesc}
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              {filter === 'all' 
                ? "Start a session and the magic happens"
                : filter === 'byMe'
                ? "You haven't taken any yet (typical 😏)"
                : "She's waiting for you to get it right"}
            </Text>
          </Animated.View>
        </View>
      ) : (
        <FlatList
          data={filteredPhotos}
          keyExtractor={item => item.id}
          numColumns={COLUMN_COUNT}
          renderItem={renderPhoto}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textMuted}
            />
          }
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
    paddingVertical: 16,
    gap: 10,
    borderBottomWidth: 1,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  statsBanner: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  statsText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  grid: {
    padding: GAP,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: GAP / 2,
    borderRadius: 8,
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerBadgeText: {
    fontSize: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
    textAlign: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  emptyHint: {
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
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
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  closeButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.7,
  },
  viewerFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  photoInfo: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 20,
  },
  viewerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  actionButtonTextDanger: {
    color: '#FCA5A5',
  },
})
