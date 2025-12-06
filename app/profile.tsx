/**
 * Profile - With stats, ranking, and SSO options
 * Enhanced with theme support and micro-interactions
 */

import { useState, useMemo } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
  FadeInDown,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'

function StatCard({ 
  value, 
  label, 
  emoji,
  index = 0,
}: { 
  value: number
  label: string
  emoji: string
  index?: number
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 80).duration(400).springify()}
      style={animatedStyle}
    >
      <Pressable 
        style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPressIn={() => {
          scale.value = withSpring(0.95, { damping: 15 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 })
        }}
      >
        <Text style={styles.statEmoji}>{emoji}</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

function SSOButton({ 
  provider, 
  icon, 
  onPress,
  index = 0,
}: { 
  provider: string
  icon: string
  onPress: () => void
  index?: number
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View entering={FadeInUp.delay(100 + index * 60).duration(300)}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { 
          scale.value = withSpring(0.97, { damping: 15 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }) }}
      >
        <Animated.View style={[
          styles.ssoButton, 
          { backgroundColor: colors.surface, borderColor: colors.border },
          animatedStyle
        ]}>
          <Text style={styles.ssoIcon}>{icon}</Text>
          <Text style={[styles.ssoText, { color: colors.text }]}>
            Continue with {provider}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

// Rank messages (funny)
const rankMessages = {
  rookie: [
    "Just getting started. Don't worry, everyone fails at first! 😅",
    "Even pro photographers started somewhere... probably not here though.",
    "Your girlfriend is being very patient. Treasure that.",
  ],
  amateur: [
    "Making progress! She only sighed 3 times last session!",
    "You're learning! The photos are... recognizable now.",
    "Keep going! Rome wasn't photographed in a day.",
  ],
  decent: [
    "Not bad! She actually smiled at one of your shots!",
    "Getting there! Only 2 retakes per photo now!",
    "Your Instagram game is improving. Slightly.",
  ],
  pro: [
    "Impressive! She's posting your photos without editing!",
    "You've unlocked 'boyfriend photographer' achievement!",
    "She's bragging about you to her friends. Savor it.",
  ],
  legend: [
    "Legendary! Other boyfriends are asking for tips!",
    "She's considering letting you take engagement photos!",
    "Your photos get more likes than hers. Don't tell her.",
  ],
  master: [
    "MAXIMUM LEVEL ACHIEVED! You are the chosen one!",
    "She wants to make a photobook of YOUR shots!",
    "Relationship status: Photographer > Boyfriend 📸👑",
  ],
}

export default function ProfileScreen() {
  const router = useRouter()
  const { colors } = useThemeStore()
  const { myDeviceId, isPaired, clearPairing } = usePairingStore()
  const { t } = useLanguageStore()
  const { stats, getRank } = useStatsStore()
  const [displayName, setDisplayName] = useState('Photography Survivor')
  const [refreshing, setRefreshing] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const rank = getRank()
  const rankText = t.profile.ranks[rank as keyof typeof t.profile.ranks]
  
  // Memoize to prevent re-random on every render
  const rankMessage = useMemo(() => {
    const messages = rankMessages[rank as keyof typeof rankMessages]
    return messages[Math.floor(Math.random() * messages.length)]
  }, [rank])

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }

  const handleSSO = (provider: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    Alert.alert(
      'Coming Soon!',
      `${provider} login will be available in the next update. For now, your stats are saved locally.`,
      [{ text: 'OK' }]
    )
  }

  const handleDisconnect = () => {
    Alert.alert(
      t.profile.disconnect,
      'Disconnect from your partner? (You can reconnect anytime)',
      [
        { text: t.common.cancel, style: 'cancel' },
        { 
          text: t.profile.disconnect, 
          style: 'destructive',
          onPress: () => {
            clearPairing()
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
          }
        },
      ]
    )
  }

  // Calculate progress to next rank
  const rankThresholds = { rookie: 0, amateur: 5, decent: 10, pro: 25, legend: 50, master: 100 }
  const rankOrder = ['rookie', 'amateur', 'decent', 'pro', 'legend', 'master']
  const currentRankIndex = rankOrder.indexOf(rank)
  const nextRank = currentRankIndex < rankOrder.length - 1 ? rankOrder[currentRankIndex + 1] : null
  const nextThreshold = nextRank ? rankThresholds[nextRank as keyof typeof rankThresholds] : null
  const currentThreshold = rankThresholds[rank as keyof typeof rankThresholds]
  const progress = nextThreshold 
    ? Math.min((stats.scoldingsSaved - currentThreshold) / (nextThreshold - currentThreshold), 1)
    : 1

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
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
        {/* Rank Banner */}
        <Animated.View 
          entering={FadeIn.duration(500)} 
          style={[styles.rankBanner, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.rankEmoji}>{rankText.split(' ')[0]}</Text>
          <Text style={[styles.rankTitle, { color: colors.primaryText }]}>
            {rankText.slice(2)}
          </Text>
          <Text style={[styles.rankMessage, { color: `${colors.primaryText}99` }]}>
            {rankMessage}
          </Text>
          
          {nextRank && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: `${colors.primaryText}30` }]}>
                <Animated.View 
                  entering={FadeIn.delay(300).duration(800)}
                  style={[
                    styles.progressFill, 
                    { width: `${progress * 100}%`, backgroundColor: colors.accent }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: `${colors.primaryText}66` }]}>
                {stats.scoldingsSaved}/{nextThreshold} to {t.profile.ranks[nextRank as keyof typeof t.profile.ranks]}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard 
            value={stats.scoldingsSaved} 
            label={t.profile.scoldingsSaved} 
            emoji="🛡️"
            index={0}
          />
          <StatCard 
            value={stats.photosTaken} 
            label={t.profile.photosTaken} 
            emoji="📸"
            index={1}
          />
          <StatCard 
            value={stats.sessionsCompleted} 
            label={t.profile.sessions} 
            emoji="✨"
            index={2}
          />
        </View>

        {/* Profile Info */}
        <Animated.View 
          entering={FadeInUp.delay(200).duration(400)} 
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PROFILE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.inputRow}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t.profile.displayName}
              </Text>
              <TextInput
                style={[styles.textInput, { color: colors.text }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            
            <View style={styles.infoRow}>
              <Text style={[styles.inputLabel, { color: colors.textMuted }]}>
                {t.profile.deviceId}
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {myDeviceId?.slice(0, 8) || '...'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Connection Status */}
        <Animated.View 
          entering={FadeInUp.delay(250).duration(400)} 
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CONNECTION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.connectionRow}>
              <View>
                <Text style={[styles.connectionLabel, { color: colors.textMuted }]}>
                  {t.profile.status}
                </Text>
                <View style={styles.statusRow}>
                  <View style={[
                    styles.statusDot,
                    { backgroundColor: isPaired ? colors.success : colors.error }
                  ]} />
                  <Text style={[styles.statusText, { color: colors.text }]}>
                    {isPaired ? t.profile.connected : t.profile.notConnected}
                  </Text>
                </View>
              </View>
              
              {isPaired ? (
                <Pressable 
                  style={[styles.disconnectButton, { borderColor: colors.error }]} 
                  onPress={handleDisconnect}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.disconnectText, { color: colors.error }]}>
                    {t.profile.disconnect}
                  </Text>
                </Pressable>
              ) : (
                <Pressable 
                  style={[styles.connectButton, { backgroundColor: colors.primary }]} 
                  onPress={() => router.push('/pairing')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.connectText, { color: colors.primaryText }]}>
                    {t.profile.connect}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>

        {/* SSO Login */}
        {!isLoggedIn && (
          <Animated.View 
            entering={FadeInUp.delay(300).duration(400)} 
            style={styles.section}
          >
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
              SYNC YOUR PROGRESS
            </Text>
            <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>
              Login to backup your stats and compete on the global leaderboard!
            </Text>
            
            <View style={styles.ssoContainer}>
              <SSOButton provider="Google" icon="🔵" onPress={() => handleSSO('Google')} index={0} />
              <SSOButton provider="Apple" icon="🍎" onPress={() => handleSSO('Apple')} index={1} />
              <SSOButton provider="LINE" icon="💚" onPress={() => handleSSO('LINE')} index={2} />
            </View>
          </Animated.View>
        )}

        {/* Fun facts */}
        <Animated.View 
          entering={FadeInUp.delay(350).duration(400)} 
          style={[styles.funFacts, { backgroundColor: colors.surfaceAlt }]}
        >
          <Text style={[styles.funFactTitle, { color: colors.accent }]}>💡 Did you know?</Text>
          <Text style={[styles.funFactText, { color: colors.textSecondary }]}>
            The average boyfriend takes 23 photos before one is "acceptable". 
            You're now at {stats.photosTaken} lifetime shots. 
            {stats.photosTaken > 23 ? " You're above average! 🎉" : " Keep practicing!"}
          </Text>
        </Animated.View>

        {/* Credit */}
        <View style={styles.credit}>
          <Pressable 
            onPress={() => Linking.openURL('https://kensaur.us')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.creditText, { color: colors.textMuted }]}>
              © 2025 kensaur.us
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  rankBanner: {
    margin: 24,
    marginBottom: 20,
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  rankTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  rankMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  progressContainer: {
    width: '100%',
    marginTop: 20,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    marginTop: 10,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 15,
    marginBottom: 16,
    lineHeight: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  inputRow: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    fontSize: 17,
    fontWeight: '500',
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  infoRow: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  infoValue: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  connectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disconnectButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderRadius: 10,
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '700',
  },
  connectButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  connectText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ssoContainer: {
    gap: 12,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    gap: 14,
  },
  ssoIcon: {
    fontSize: 22,
  },
  ssoText: {
    fontSize: 17,
    fontWeight: '600',
  },
  funFacts: {
    marginHorizontal: 24,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
  },
  funFactTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  funFactText: {
    fontSize: 15,
    lineHeight: 22,
  },
  credit: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  creditText: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
})
