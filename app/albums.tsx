/**
 * Albums - Create, organize, and share photo albums
 * Connected to Supabase manage-album Edge Function
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView,
  TextInput,
  Alert,
  Share,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Icon } from '../src/components/ui/Icon'
import { ZenLoader } from '../src/components/ui/ZenLoader'
import { ZenEmptyState } from '../src/components/ui/ZenEmptyState'
import { cloudApi, Album } from '../src/services/cloudApi'
import { sessionLogger } from '../src/services/sessionLogger'

function AlbumCard({ 
  album, 
  onPress, 
  onShare,
  onDelete,
  colors,
  index,
}: { 
  album: Album
  onPress: () => void
  onShare: () => void
  onDelete: () => void
  colors: any
  index: number
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 50).duration(300)}
      style={animatedStyle}
    >
      <Pressable
        style={[styles.albumCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 400 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 })
        }}
        accessibilityLabel={`Album: ${album.name}`}
        accessibilityRole="button"
      >
        <View style={styles.albumIcon}>
          <Text style={styles.albumIconText}>📁</Text>
        </View>
        
        <View style={styles.albumInfo}>
          <Text style={[styles.albumName, { color: colors.text }]}>{album.name}</Text>
          <Text style={[styles.albumMeta, { color: colors.textMuted }]}>
            {album.photo_count ?? 0} photos
            {album.is_public && ' • Public'}
          </Text>
        </View>

        <View style={styles.albumActions}>
          {album.share_code && (
            <Pressable
              style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
              onPress={(e) => {
                e.stopPropagation?.()
                onShare()
              }}
              accessibilityLabel="Share album"
            >
              <Icon name="share" size={16} color={colors.text} />
            </Pressable>
          )}
          <Pressable
            style={[styles.iconButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={(e) => {
              e.stopPropagation?.()
              onDelete()
            }}
            accessibilityLabel="Delete album"
          >
            <Icon name="trash" size={16} color={colors.error} />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  )
}

function CreateAlbumModal({
  visible,
  onClose,
  onCreate,
  colors,
}: {
  visible: boolean
  onClose: () => void
  onCreate: (name: string, isPublic: boolean) => void
  colors: any
}) {
  const [name, setName] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  if (!visible) return null

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      style={styles.modalOverlay}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <Animated.View 
        entering={FadeInUp.duration(300)}
        style={[styles.modalContent, { backgroundColor: colors.surface }]}
      >
        <Text style={[styles.modalTitle, { color: colors.text }]}>Create Album</Text>
        
        <TextInput
          style={[styles.input, { 
            backgroundColor: colors.surfaceAlt, 
            color: colors.text,
            borderColor: colors.border,
          }]}
          placeholder="Album name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoFocus
        />

        <Pressable
          style={styles.toggleRow}
          onPress={() => setIsPublic(!isPublic)}
        >
          <Text style={[styles.toggleLabel, { color: colors.text }]}>Make public</Text>
          <View style={[
            styles.toggle, 
            { backgroundColor: isPublic ? colors.primary : colors.surfaceAlt }
          ]}>
            <View style={[
              styles.toggleDot,
              isPublic && styles.toggleDotActive,
            ]} />
          </View>
        </Pressable>

        <View style={styles.modalActions}>
          <Pressable
            style={[styles.modalButton, { backgroundColor: colors.surfaceAlt }]}
            onPress={onClose}
          >
            <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[styles.modalButton, { backgroundColor: colors.primary }]}
            onPress={() => {
              if (name.trim()) {
                onCreate(name.trim(), isPublic)
                setName('')
                setIsPublic(false)
              }
            }}
            disabled={!name.trim()}
          >
            <Text style={[styles.modalButtonText, { color: colors.primaryText }]}>Create</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  )
}

export default function AlbumsScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { myDeviceId } = usePairingStore()
  
  const [albums, setAlbums] = useState<Album[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const loadAlbums = useCallback(async () => {
    if (!myDeviceId) {
      setIsLoading(false)
      return
    }

    try {
      const { albums: data, error } = await cloudApi.albums.list(myDeviceId)
      if (error) {
        sessionLogger.error('albums_load_failed', new Error(error))
      } else {
        setAlbums(data)
      }
    } catch (error) {
      sessionLogger.error('albums_load_error', error)
    } finally {
      setIsLoading(false)
    }
  }, [myDeviceId])

  useEffect(() => {
    loadAlbums()
  }, [loadAlbums])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadAlbums()
    setRefreshing(false)
  }

  const handleCreateAlbum = async (name: string, isPublic: boolean) => {
    if (!myDeviceId) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowCreateModal(false)

    try {
      const { album, error } = await cloudApi.albums.create({
        deviceId: myDeviceId,
        name,
        isPublic,
      })

      if (error) {
        Alert.alert('Error', error)
        return
      }

      if (album) {
        setAlbums(prev => [album, ...prev])
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        sessionLogger.info('album_created', { albumId: album.id, name })
      }
    } catch (error) {
      sessionLogger.error('album_create_error', error)
      Alert.alert('Error', 'Failed to create album')
    }
  }

  const handleShareAlbum = async (album: Album) => {
    if (!myDeviceId) return

    try {
      let shareCode = album.share_code

      // Generate share code if not exists
      if (!shareCode) {
        const { shareCode: newCode, error } = await cloudApi.albums.generateShareCode(
          album.id,
          myDeviceId
        )
        if (error) {
          Alert.alert('Error', error)
          return
        }
        shareCode = newCode

        // Update local album
        setAlbums(prev => prev.map(a => 
          a.id === album.id ? { ...a, share_code: newCode } : a
        ))
      }

      if (shareCode) {
        await Share.share({
          message: `Check out my photo album "${album.name}"!\n\nShare code: ${shareCode}`,
        })
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      }
    } catch (error) {
      sessionLogger.error('album_share_error', error)
    }
  }

  const handleDeleteAlbum = (album: Album) => {
    Alert.alert(
      'Delete Album',
      `Are you sure you want to delete "${album.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!myDeviceId) return

            try {
              const { success, error } = await cloudApi.albums.delete(album.id, myDeviceId)
              
              if (error) {
                Alert.alert('Error', error)
                return
              }

              if (success) {
                setAlbums(prev => prev.filter(a => a.id !== album.id))
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                sessionLogger.info('album_deleted', { albumId: album.id })
              }
            } catch (error) {
              sessionLogger.error('album_delete_error', error)
              Alert.alert('Error', 'Failed to delete album')
            }
          },
        },
      ]
    )
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ZenLoader variant="breathe" size="large" message="Loading albums..." />
        </View>
      ) : albums.length === 0 ? (
        <ZenEmptyState
          icon="gallery"
          title="No Albums Yet"
          description="Create albums to organize your photos and share them with friends."
          action={{
            label: 'Create Album',
            onPress: () => setShowCreateModal(true),
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.textMuted}
            />
          }
        >
          {albums.map((album, index) => (
            <AlbumCard
              key={album.id}
              album={album}
              index={index}
              colors={colors}
              onPress={() => {
                // Navigate to album detail (TODO: implement)
                Alert.alert('Album', `${album.name} - ${album.photo_count ?? 0} photos`)
              }}
              onShare={() => handleShareAlbum(album)}
              onDelete={() => handleDeleteAlbum(album)}
            />
          ))}
        </ScrollView>
      )}

      {/* Floating Add Button */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
          setShowCreateModal(true)
        }}
        accessibilityLabel="Create new album"
        accessibilityRole="button"
      >
        <Icon name="plus" size={24} color={colors.primaryText} />
      </Pressable>

      <CreateAlbumModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateAlbum}
        colors={colors}
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  albumIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  albumIconText: {
    fontSize: 24,
  },
  albumInfo: {
    flex: 1,
  },
  albumName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  albumMeta: {
    fontSize: 13,
  },
  albumActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '85%',
    maxWidth: 360,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  toggleLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggleDotActive: {
    alignSelf: 'flex-end',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
})

