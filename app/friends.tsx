/**
 * Friends - Social features and recent partners for quick reconnect
 * Connected to Supabase manage-friends Edge Function
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView,
  Alert,
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
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Icon } from '../src/components/ui/Icon'
import { ZenLoader } from '../src/components/ui/ZenLoader'
import { ZenEmptyState } from '../src/components/ui/ZenEmptyState'
import { cloudApi, Friend, RecentPartner } from '../src/services/cloudApi'
import { sessionLogger } from '../src/services/sessionLogger'

function PartnerCard({ 
  partner, 
  onConnect, 
  colors,
  index,
}: { 
  partner: RecentPartner
  onConnect: () => void
  colors: any
  index: number
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const formatLastSession = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    return date.toLocaleDateString()
  }

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 50).duration(300)}
      style={animatedStyle}
    >
      <Pressable
        style={[styles.partnerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onConnect}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15, stiffness: 400 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 })
        }}
        accessibilityLabel={`Connect with ${partner.partner_name || 'Partner'}`}
        accessibilityRole="button"
      >
        <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={styles.avatarText}>{partner.partner_avatar || '👤'}</Text>
        </View>
        
        <View style={styles.partnerInfo}>
          <Text style={[styles.partnerName, { color: colors.text }]}>
            {partner.partner_name || 'Partner'}
          </Text>
          <Text style={[styles.partnerMeta, { color: colors.textMuted }]}>
            {partner.session_count} sessions • {partner.total_photos} photos
          </Text>
          <Text style={[styles.lastSession, { color: colors.textSecondary }]}>
            Last: {formatLastSession(partner.last_session_at)}
          </Text>
        </View>

        <View style={[styles.connectButton, { backgroundColor: colors.primary }]}>
          <Icon name="link" size={18} color={colors.primaryText} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

function FriendCard({ 
  friend, 
  onAccept,
  onRemove, 
  colors,
  index,
}: { 
  friend: Friend
  onAccept?: () => void
  onRemove: () => void
  colors: any
  index: number
}) {
  const isPending = friend.status === 'pending'

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 50).duration(300)}
    >
      <View style={[styles.friendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={styles.avatarText}>{friend.avatar_emoji || '👤'}</Text>
        </View>
        
        <View style={styles.friendInfo}>
          <Text style={[styles.friendName, { color: colors.text }]}>
            {friend.display_name || 'Friend'}
          </Text>
          <Text style={[styles.friendStatus, { color: colors.textMuted }]}>
            {isPending ? 'Pending request' : 'Connected'}
          </Text>
        </View>

        <View style={styles.friendActions}>
          {isPending && onAccept && (
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={onAccept}
              accessibilityLabel="Accept friend request"
            >
              <Icon name="check" size={16} color={colors.primaryText} />
            </Pressable>
          )}
          <Pressable
            style={[styles.actionBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={onRemove}
            accessibilityLabel="Remove friend"
          >
            <Icon name="close" size={16} color={colors.error} />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  )
}

export default function FriendsScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { myDeviceId } = usePairingStore()
  
  const [recentPartners, setRecentPartners] = useState<RecentPartner[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'recent' | 'friends'>('recent')

  const loadData = useCallback(async () => {
    if (!myDeviceId) {
      setIsLoading(false)
      return
    }

    try {
      // Load recent partners and friends in parallel
      const [partnersResult, friendsResult] = await Promise.all([
        cloudApi.friends.getRecentPartners(myDeviceId, 10),
        cloudApi.friends.list(myDeviceId),
      ])

      if (partnersResult.partners) {
        setRecentPartners(partnersResult.partners)
      }
      if (friendsResult.friends) {
        setFriends(friendsResult.friends)
      }
    } catch (error) {
      sessionLogger.error('friends_load_error', error)
    } finally {
      setIsLoading(false)
    }
  }, [myDeviceId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleConnectPartner = (partner: RecentPartner) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    sessionLogger.info('quick_connect_initiated', { partnerDeviceId: partner.partner_device_id })
    
    Alert.alert(
      'Quick Connect',
      `Start a new session with ${partner.partner_name || 'this partner'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Connect',
          onPress: () => {
            // Navigate to pairing with partner ID pre-filled
            router.push({
              pathname: '/pairing',
              params: { quickConnect: partner.partner_device_id },
            })
          },
        },
      ]
    )
  }

  const handleAcceptFriend = async (friend: Friend) => {
    if (!myDeviceId) return
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    
    try {
      const { success, error } = await cloudApi.friends.acceptRequest(
        myDeviceId,
        friend.friend_device_id
      )

      if (error) {
        Alert.alert('Error', error)
        return
      }

      if (success) {
        // Update local state
        setFriends(prev => prev.map(f => 
          f.id === friend.id ? { ...f, status: 'accepted' } : f
        ))
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        sessionLogger.info('friend_accepted', { friendId: friend.id })
      }
    } catch (error) {
      sessionLogger.error('friend_accept_error', error)
      Alert.alert('Error', 'Failed to accept friend request')
    }
  }

  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Friend',
      `Remove ${friend.display_name || 'this friend'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!myDeviceId) return

            try {
              const { success, error } = await cloudApi.friends.remove(
                myDeviceId,
                friend.friend_device_id
              )

              if (error) {
                Alert.alert('Error', error)
                return
              }

              if (success) {
                setFriends(prev => prev.filter(f => f.id !== friend.id))
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
                sessionLogger.info('friend_removed', { friendId: friend.id })
              }
            } catch (error) {
              sessionLogger.error('friend_remove_error', error)
              Alert.alert('Error', 'Failed to remove friend')
            }
          },
        },
      ]
    )
  }

  const pendingFriends = friends.filter(f => f.status === 'pending')
  const acceptedFriends = friends.filter(f => f.status === 'accepted')

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Tab Header */}
      <View style={styles.tabHeader}>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'recent' && [styles.tabActive, { borderColor: colors.primary }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setActiveTab('recent')
          }}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'recent' ? colors.primary : colors.textMuted },
          ]}>
            Recent
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tab,
            activeTab === 'friends' && [styles.tabActive, { borderColor: colors.primary }],
          ]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setActiveTab('friends')
          }}
        >
          <Text style={[
            styles.tabText,
            { color: activeTab === 'friends' ? colors.primary : colors.textMuted },
          ]}>
            Friends
            {pendingFriends.length > 0 && (
              <Text style={[styles.badge, { color: colors.error }]}> ({pendingFriends.length})</Text>
            )}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ZenLoader variant="breathe" size="large" message="Loading..." />
        </View>
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
          {activeTab === 'recent' ? (
            recentPartners.length === 0 ? (
              <ZenEmptyState
                icon="user"
                title="No Recent Partners"
                description="Complete photo sessions to see your recent partners here for quick reconnect."
              />
            ) : (
              <Animated.View entering={FadeIn.duration(300)}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                  QUICK RECONNECT
                </Text>
                {recentPartners.map((partner, index) => (
                  <PartnerCard
                    key={partner.id}
                    partner={partner}
                    index={index}
                    colors={colors}
                    onConnect={() => handleConnectPartner(partner)}
                  />
                ))}
              </Animated.View>
            )
          ) : (
            <>
              {pendingFriends.length > 0 && (
                <Animated.View entering={FadeIn.duration(300)}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    PENDING REQUESTS
                  </Text>
                  {pendingFriends.map((friend, index) => (
                    <FriendCard
                      key={friend.id}
                      friend={friend}
                      index={index}
                      colors={colors}
                      onAccept={() => handleAcceptFriend(friend)}
                      onRemove={() => handleRemoveFriend(friend)}
                    />
                  ))}
                </Animated.View>
              )}

              {acceptedFriends.length === 0 && pendingFriends.length === 0 ? (
                <ZenEmptyState
                  icon="user"
                  title="No Friends Yet"
                  description="Connect with photo partners to add them as friends."
                />
              ) : acceptedFriends.length > 0 && (
                <Animated.View entering={FadeIn.duration(300)}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
                    FRIENDS
                  </Text>
                  {acceptedFriends.map((friend, index) => (
                    <FriendCard
                      key={friend.id}
                      friend={friend}
                      index={index}
                      colors={colors}
                      onRemove={() => handleRemoveFriend(friend)}
                    />
                  ))}
                </Animated.View>
              )}
            </>
          )}
        </ScrollView>
      )}
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
  tabHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  badge: {
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 24,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  partnerMeta: {
    fontSize: 13,
    marginBottom: 2,
  },
  lastSession: {
    fontSize: 12,
  },
  connectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  friendStatus: {
    fontSize: 13,
  },
  friendActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
})

