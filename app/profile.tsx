/**
 * Profile - Stats, ranking, and connection management
 * Clean minimal design
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
  Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInUp,
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
  index = 0,
}: { 
  value: number
  label: string
  index?: number
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View 
      entering={FadeInUp.delay(index * 60).duration(300)}
      style={[{ flex: 1 }, animatedStyle]}
    >
      <Pressable 
        style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 15 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 })
        }}
      >
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  )
}

// Rank descriptions
const rankDescriptions: Record<string, string> = {
  rookie: "Just getting started",
  amateur: "Making progress!",
  decent: "Getting better",
  pro: "Impressive skills",
  legend: "Legendary status",
  master: "Maximum level!",
}

export default function ProfileScreen() {
  const router = useRouter()
  const { colors, mode } = useThemeStore()
  const { myDeviceId, isPaired, clearPairing } = usePairingStore()
  const { t } = useLanguageStore()
  const { stats, getRank } = useStatsStore()
  const [displayName, setDisplayName] = useState('User')
  const [refreshing, setRefreshing] = useState(false)

  const rank = getRank()
  const rankText = t.profile.ranks[rank as keyof typeof t.profile.ranks]
  const rankDescription = rankDescriptions[rank] || ''

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 500))
    setRefreshing(false)
  }

  const handleDisconnect = () => {
    Alert.alert(
      t.profile.disconnect,
      'Disconnect from your partner?',
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
          entering={FadeIn.duration(400)} 
          style={[styles.rankBanner, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.rankTitle, { color: colors.primaryText }]}>
            {rankText}
          </Text>
          <Text style={[styles.rankDesc, { color: `${colors.primaryText}99` }]}>
            {rankDescription}
          </Text>
          
          {nextRank && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: `${colors.primaryText}30` }]}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${progress * 100}%`, backgroundColor: colors.accent }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: `${colors.primaryText}80` }]}>
                {stats.scoldingsSaved}/{nextThreshold} to next rank
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard 
            value={stats.scoldingsSaved} 
            label={t.profile.scoldingsSaved}
            index={0}
          />
          <StatCard 
            value={stats.photosTaken} 
            label={t.profile.photosTaken}
            index={1}
          />
          <StatCard 
            value={stats.sessionsCompleted} 
            label={t.profile.sessions}
            index={2}
          />
        </View>

        {/* Profile Info */}
        <Animated.View 
          entering={FadeInUp.delay(150).duration(300)} 
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PROFILE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                {t.profile.displayName}
              </Text>
              <TextInput
                style={[styles.textInput, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            
            <View style={styles.cardRow}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
                {t.profile.deviceId}
              </Text>
              <Text style={[styles.cardValue, { color: colors.text }]}>
                {myDeviceId?.slice(0, 8) || '...'}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Connection Status */}
        <Animated.View 
          entering={FadeInUp.delay(200).duration(300)} 
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CONNECTION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.connectionRow}>
              <View style={styles.connectionInfo}>
                <Text style={[styles.cardLabel, { color: colors.textMuted }]}>
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
                  style={[
                    styles.actionButton, 
                    { 
                      backgroundColor: mode === 'dark' ? colors.surfaceAlt : 'transparent',
                      borderColor: colors.error,
                    }
                  ]} 
                  onPress={handleDisconnect}
                >
                  <Text style={[styles.actionButtonText, { color: colors.error }]}>
                    {t.profile.disconnect}
                  </Text>
                </Pressable>
              ) : (
                <Pressable 
                  style={[styles.actionButton, { backgroundColor: colors.primary }]} 
                  onPress={() => router.push('/pairing')}
                >
                  <Text style={[styles.actionButtonText, { color: colors.primaryText }]}>
                    {t.profile.connect}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Credit */}
        <View style={styles.credit}>
          <Pressable onPress={() => Linking.openURL('https://kensaur.us')}>
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
    paddingBottom: 32,
  },
  rankBanner: {
    margin: 20,
    marginBottom: 16,
    padding: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  rankTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  rankDesc: {
    fontSize: 14,
  },
  progressContainer: {
    width: '100%',
    marginTop: 16,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    minHeight: 80,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardValue: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  textInput: {
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  connectionInfo: {
    flex: 1,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '500',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderRadius: 6,
    borderColor: 'transparent',
    minWidth: 100,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  credit: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  creditText: {
    fontSize: 12,
    fontWeight: '500',
  },
})
