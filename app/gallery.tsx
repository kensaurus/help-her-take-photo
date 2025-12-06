/**
 * Gallery - Enhanced with share, zoom, and actions
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
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated'
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'
import * as MediaLibrary from 'expo-media-library'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')
const COLUMN_COUNT = 3
const GAP = 2
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
      onPressIn={() => { scale.value = withSpring(0.95) }}
      onPressOut={() => { scale.value = withSpring(1) }}
    >
      <Animated.View style={[styles.actionButton, danger && styles.actionButtonDanger, animatedStyle]}>
        <Text style={[styles.actionButtonText, danger && styles.actionButtonTextDanger]}>{label}</Text>
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
          <Pressable style={styles.closeButton} onPress={onClose}>
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

export default function GalleryScreen() {
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
    // Simulate refresh
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
    } catch (err) {
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
    } catch (err) {
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

  const renderPhoto = useCallback(({ item }: { item: Photo }) => (
    <Pressable 
      style={styles.photoItem} 
      onPress={() => {
        setSelectedPhoto(item)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
    >
      <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      {!item.byMe && <View style={styles.partnerBadge}><Text style={styles.partnerBadgeText}>👸</Text></View>}
    </Pressable>
  ), [])

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(['all', 'byMe', 'byPartner'] as const).map((f) => (
          <Pressable 
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => {
              setFilter(f)
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            }}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? t.gallery.photos : f === 'byMe' ? t.gallery.byYou : t.gallery.byPartner}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Stats banner */}
      {stats.photosTaken > 0 && (
        <Animated.View entering={FadeIn} style={styles.statsBanner}>
          <Text style={styles.statsText}>
            📸 {stats.photosTaken} {t.gallery.photos} • 🛡️ {stats.scoldingsSaved} {t.profile.scoldingsSaved}
          </Text>
        </Animated.View>
      )}

      {filteredPhotos.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>{t.gallery.noPhotos}</Text>
          <Text style={styles.emptyDesc}>{t.gallery.noPhotosDesc}</Text>
          <Text style={styles.emptyHint}>
            {filter === 'all' 
              ? "Start a session and the magic happens"
              : filter === 'byMe'
              ? "You haven't taken any yet (typical 😏)"
              : "She's waiting for you to get it right"}
          </Text>
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
              tintColor="#1a1a1a"
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
    backgroundColor: '#FAFAFA',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
    backgroundColor: '#fff',
  },
  filterTab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: '#F5F5F5',
    minWidth: 80,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#1a1a1a',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  statsBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  statsText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
    textAlign: 'center',
  },
  grid: {
    padding: GAP,
  },
  photoItem: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    margin: GAP / 2,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: '#E5E5E5',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  partnerBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerBadgeText: {
    fontSize: 10,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyHint: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
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
    paddingHorizontal: 20,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    fontSize: 18,
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
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  photoInfo: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  viewerActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 100,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(220,38,38,0.3)',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  actionButtonTextDanger: {
    color: '#FCA5A5',
  },
})
