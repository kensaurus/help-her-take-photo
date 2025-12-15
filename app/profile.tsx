/**
 * Profile - Stats, ranking, and connection management
 * Clean minimal design with micro-interactions
 */

import { useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView,
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
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  interpolate,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Icon } from '../src/components/ui/Icon'

function StatCard({ 
  value, 
  label,
  icon,
  index = 0,
  onPress,
}: { 
  value: number
  label: string
  icon: 'star' | 'camera' | 'link'
  index?: number
  onPress?: () => void
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View 
      entering={FadeInUp.delay(100 + index * 50).duration(300).springify()}
      style={[styles.statCardWrapper, animatedStyle]}
    >
      <Pressable 
        style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={onPress}
        onPressIn={() => {
          scale.value = withSpring(0.96, { damping: 15, stiffness: 400 })
          opacity.value = withTiming(0.9, { duration: 50 })
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15, stiffness: 300 })
          opacity.value = withTiming(1, { duration: 100 })
        }}
      >
        <View style={[styles.statIconContainer, { backgroundColor: colors.surfaceAlt }]}>
          <Icon name={icon} size={14} color={colors.textSecondary} />
        </View>
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
  const { colors } = useThemeStore()
  const { isPaired } = usePairingStore()
  const { t } = useLanguageStore()
  const { stats, getRank, loadStats } = useStatsStore()
  const [refreshing, setRefreshing] = useState(false)

  const rank = getRank()
  const rankText = t.profile.ranks[rank as keyof typeof t.profile.ranks]
  const rankDescription = rankDescriptions[rank] || ''

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await loadStats()
    setRefreshing(false)
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
          entering={FadeIn.duration(350)} 
          style={[styles.rankBanner, { backgroundColor: colors.primary }]}
        >
          <View style={styles.rankHeader}>
            <Icon name="star" size={20} color={colors.primaryText} />
            <Text style={[styles.rankTitle, { color: colors.primaryText }]}>
              {rankText}
            </Text>
          </View>
          <Text style={[styles.rankDesc, { color: `${colors.primaryText}90` }]}>
            {rankDescription}
          </Text>
          
          {nextRank && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressBar, { backgroundColor: `${colors.primaryText}25` }]}>
                <Animated.View 
                  style={[
                    styles.progressFill, 
                    { width: `${progress * 100}%`, backgroundColor: colors.accent }
                  ]} 
                />
              </View>
              <Text style={[styles.progressText, { color: `${colors.primaryText}70` }]}>
                {stats.scoldingsSaved} / {nextThreshold}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard 
            value={stats.scoldingsSaved} 
            label={t.profile.scoldingsSaved}
            icon="star"
            index={0}
          />
          <StatCard 
            value={stats.photosTaken} 
            label={t.profile.photosTaken}
            icon="camera"
            index={1}
            onPress={() => router.push('/gallery')}
          />
          <StatCard 
            value={stats.sessionsCompleted} 
            label={t.profile.sessions}
            icon="link"
            index={2}
          />
        </View>

        {/* Quick Actions */}
        <Animated.View 
          entering={FadeInUp.delay(200).duration(300)} 
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>QUICK ACTIONS</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable 
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/gallery')}
            >
              <Icon name="image" size={24} color={colors.text} />
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>Gallery</Text>
            </Pressable>
            
            <Pressable 
              style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/settings')}
            >
              <Icon name="settings" size={24} color={colors.text} />
              <Text style={[styles.quickActionLabel, { color: colors.text }]}>Settings</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Connection Status - Simplified, view-only */}
        <Animated.View 
          entering={FadeInUp.delay(250).duration(300)} 
          style={styles.section}
        >
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>CONNECTION</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.connectionStatusRow}>
              <View style={[
                styles.statusDot,
                { backgroundColor: isPaired ? colors.success : colors.textMuted }
              ]} />
              <Text style={[styles.statusText, { color: colors.text }]}>
                {isPaired ? t.profile.connected : t.profile.notConnected}
              </Text>
            </View>
            <Text style={[styles.connectionHint, { color: colors.textMuted }]}>
              {isPaired ? 'Manage connection in Settings' : 'Go to Settings to connect'}
            </Text>
          </View>
        </Animated.View>

        {/* Credit */}
        <Animated.View 
          entering={FadeIn.delay(400).duration(300)}
          style={styles.credit}
        >
          <Pressable onPress={() => Linking.openURL('https://kensaur.us')}>
            <Text style={[styles.creditText, { color: colors.textMuted }]}>
              kensaur.us / 2025
            </Text>
          </Pressable>
        </Animated.View>
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
  },
  rankHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  rankTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  rankDesc: {
    fontSize: 14,
    marginLeft: 30,
  },
  progressContainer: {
    marginTop: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12, // Accessibility: minimum 12sp
    marginTop: 8,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 24,
  },
  statCardWrapper: {
    flex: 1,
  },
  statCard: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 10, // Keep slightly smaller for card layout but readable
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12, // Accessibility: minimum 12sp
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  connectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
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
  connectionHint: {
    fontSize: 13,
  },
  credit: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  creditText: {
    fontSize: 12, // Accessibility: minimum 12sp
    fontWeight: '500',
    letterSpacing: 0.5,
  },
})
