/**
 * Profile - With stats, ranking, and SSO options
 */

import { useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  TextInput, 
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'

function StatCard({ value, label, emoji }: { value: number; label: string; emoji: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statEmoji}>{emoji}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function SSOButton({ 
  provider, 
  icon, 
  onPress 
}: { 
  provider: string
  icon: string
  onPress: () => void 
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97) }}
      onPressOut={() => { scale.value = withSpring(1) }}
    >
      <Animated.View style={[styles.ssoButton, animatedStyle]}>
        <Text style={styles.ssoIcon}>{icon}</Text>
        <Text style={styles.ssoText}>Continue with {provider}</Text>
      </Animated.View>
    </Pressable>
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
  const { myDeviceId, isPaired, clearPairing } = usePairingStore()
  const { t } = useLanguageStore()
  const { stats, getRank } = useStatsStore()
  const [displayName, setDisplayName] = useState('Photography Survivor')
  const [refreshing, setRefreshing] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  const rank = getRank()
  const rankText = t.profile.ranks[rank as keyof typeof t.profile.ranks]
  const rankMessage = rankMessages[rank as keyof typeof rankMessages][
    Math.floor(Math.random() * 3)
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 500))
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
    ? (stats.scoldingsSaved - currentThreshold) / (nextThreshold - currentThreshold)
    : 1

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#1a1a1a"
          />
        }
      >
        {/* Rank Banner */}
        <Animated.View entering={FadeIn} style={styles.rankBanner}>
          <Text style={styles.rankEmoji}>{rankText.split(' ')[0]}</Text>
          <Text style={styles.rankTitle}>{rankText.slice(2)}</Text>
          <Text style={styles.rankMessage}>{rankMessage}</Text>
          
          {nextRank && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>
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
          />
          <StatCard 
            value={stats.photosTaken} 
            label={t.profile.photosTaken} 
            emoji="📸" 
          />
          <StatCard 
            value={stats.sessionsCompleted} 
            label={t.profile.sessions} 
            emoji="✨" 
          />
        </View>

        {/* Profile Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PROFILE</Text>
          <View style={styles.card}>
            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>{t.profile.displayName}</Text>
              <TextInput
                style={styles.textInput}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor="#999"
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.infoRow}>
              <Text style={styles.inputLabel}>{t.profile.deviceId}</Text>
              <Text style={styles.infoValue}>{myDeviceId?.slice(0, 8) || '...'}</Text>
            </View>
          </View>
        </View>

        {/* Connection Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONNECTION</Text>
          <View style={styles.card}>
            <View style={styles.connectionRow}>
              <View>
                <Text style={styles.connectionLabel}>{t.profile.status}</Text>
                <View style={styles.statusRow}>
                  <View style={[
                    styles.statusDot,
                    isPaired ? styles.statusDotOn : styles.statusDotOff
                  ]} />
                  <Text style={styles.statusText}>
                    {isPaired ? t.profile.connected : t.profile.notConnected}
                  </Text>
                </View>
              </View>
              
              {isPaired ? (
                <Pressable style={styles.disconnectButton} onPress={handleDisconnect}>
                  <Text style={styles.disconnectText}>{t.profile.disconnect}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.connectButton} onPress={() => router.push('/pairing')}>
                  <Text style={styles.connectText}>{t.profile.connect}</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* SSO Login */}
        {!isLoggedIn && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SYNC YOUR PROGRESS</Text>
            <Text style={styles.sectionDesc}>
              Login to backup your stats and compete on the global leaderboard!
            </Text>
            
            <View style={styles.ssoContainer}>
              <SSOButton provider="Google" icon="🔵" onPress={() => handleSSO('Google')} />
              <SSOButton provider="Apple" icon="🍎" onPress={() => handleSSO('Apple')} />
              <SSOButton provider="LINE" icon="💚" onPress={() => handleSSO('LINE')} />
            </View>
          </View>
        )}

        {/* Fun facts */}
        <View style={styles.funFacts}>
          <Text style={styles.funFactTitle}>💡 Did you know?</Text>
          <Text style={styles.funFactText}>
            The average boyfriend takes 23 photos before one is "acceptable". 
            You're now at {stats.photosTaken} lifetime shots. 
            {stats.photosTaken > 23 ? " You're above average! 🎉" : " Keep practicing!"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  rankBanner: {
    backgroundColor: '#1a1a1a',
    margin: 20,
    marginBottom: 16,
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  rankEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  rankTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  rankMessage: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FCD34D',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  statEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
  },
  inputRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  inputLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  textInput: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  infoRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  connectionLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusDotOn: {
    backgroundColor: '#22C55E',
  },
  statusDotOff: {
    backgroundColor: '#DC2626',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  disconnectButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#DC2626',
    borderRadius: 4,
  },
  disconnectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#DC2626',
  },
  connectButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
  },
  connectText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  ssoContainer: {
    gap: 8,
  },
  ssoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 12,
  },
  ssoIcon: {
    fontSize: 20,
  },
  ssoText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  funFacts: {
    margin: 20,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 4,
  },
  funFactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  funFactText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
})
