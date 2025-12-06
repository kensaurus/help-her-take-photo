/**
 * Home - Your relationship's photography insurance
 * Minimal, artistic design with micro-interactions
 */

import { useEffect, useState, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  RefreshControl,
  Linking,
  Dimensions,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useConnectionStore } from '../src/stores/connectionStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

/**
 * Animated action card with press feedback
 */
function ActionCard({ 
  label, 
  subtitle, 
  onPress,
  highlight = false,
  index = 0,
}: { 
  label: string
  subtitle: string
  onPress: () => void
  highlight?: boolean
  index?: number
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  const bgOpacity = useSharedValue(0)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    backgroundColor: highlight 
      ? colors.primary 
      : `rgba(${colors.mode === 'dark' ? '255,255,255' : '0,0,0'}, ${bgOpacity.value * 0.02})`,
  }))
  
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 })
    bgOpacity.value = withTiming(1, { duration: 100 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
    bgOpacity.value = withTiming(0, { duration: 200 })
  }

  return (
    <Animated.View 
      entering={FadeInUp.delay(100 + index * 80).duration(500).springify()}
    >
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardPressable}
      >
        <Animated.View style={[
          styles.card, 
          { borderColor: colors.border },
          highlight && { backgroundColor: colors.primary, borderColor: colors.primary },
          animatedStyle
        ]}>
          <View style={styles.cardContent}>
            <Text style={[
              styles.cardLabel, 
              { color: highlight ? colors.primaryText : colors.text }
            ]}>
              {label}
            </Text>
            <Text style={[
              styles.cardSubtitle, 
              { color: highlight ? `${colors.primaryText}99` : colors.textMuted }
            ]}>
              {subtitle}
            </Text>
          </View>
          <Text style={[
            styles.cardArrow, 
            { color: highlight ? `${colors.primaryText}66` : colors.textMuted }
          ]}>
            →
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Minimal nav button
 */
function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable 
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15 })
      }}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
    >
      <Animated.View style={[styles.navButton, animatedStyle]}>
        <Text style={[styles.navButtonText, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { colors, mode, toggleMode } = useThemeStore()
  const { isPaired } = usePairingStore()
  const { setRole } = useConnectionStore()
  const { t, loadLanguage } = useLanguageStore()
  const { stats, getRank, loadStats } = useStatsStore()
  const [refreshing, setRefreshing] = useState(false)
  
  const taglines = t.home.taglines
  const [taglineIndex, setTaglineIndex] = useState(0)
  const taglineOpacity = useSharedValue(1)

  useEffect(() => {
    loadLanguage()
    loadStats()
  }, [loadLanguage, loadStats])

  // Smooth tagline rotation with fade
  useEffect(() => {
    const interval = setInterval(() => {
      taglineOpacity.value = withSequence(
        withTiming(0, { duration: 300 }),
        withTiming(1, { duration: 300 })
      )
      setTimeout(() => {
        setTaglineIndex((i) => (i + 1) % taglines.length)
      }, 300)
    }, 5000)
    return () => clearInterval(interval)
  }, [taglines.length, taglineOpacity])

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
  }))

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 600))
    setRefreshing(false)
  }, [])

  const handleCamera = () => {
    setRole('camera')
    router.push(isPaired ? '/camera' : '/pairing')
  }

  const handleViewer = () => {
    setRole('viewer')
    router.push(isPaired ? '/viewer' : '/pairing')
  }

  const rank = getRank()
  const rankText = t.profile.ranks[rank as keyof typeof t.profile.ranks]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
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
        {/* Header */}
        <Animated.View entering={FadeIn.duration(600)} style={styles.header}>
          {/* Theme toggle */}
          <Pressable 
            style={styles.themeToggle}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              toggleMode()
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.themeIcon, { color: colors.textMuted }]}>
              {mode === 'dark' ? '◐' : '◑'}
            </Text>
          </Pressable>

          <View style={styles.brand}>
            <Text style={[styles.brandLight, { color: colors.textSecondary }]}>
              Help Her
            </Text>
            <Text style={[styles.brandBold, { color: colors.text }]}>
              Take Photo
            </Text>
          </View>
          
          <Animated.Text style={[styles.tagline, { color: colors.textMuted }, taglineStyle]}>
            {taglines[taglineIndex]}
          </Animated.Text>
          
          {/* Status pills */}
          {(isPaired || stats.scoldingsSaved > 0) && (
            <Animated.View 
              entering={FadeInDown.delay(200).duration(400)}
              style={styles.statusRow}
            >
              {isPaired && (
                <View style={[styles.statusPill, { backgroundColor: `${colors.success}15` }]}>
                  <View style={[styles.statusDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.statusText, { color: colors.success }]}>
                    {t.home.paired}
                  </Text>
                </View>
              )}
              
              {stats.scoldingsSaved > 0 && (
                <View style={[styles.rankPill, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.rankText, { color: colors.accent }]}>
                    {rankText}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </Animated.View>

        {/* Stats mini card */}
        {stats.scoldingsSaved > 0 && (
          <Animated.View 
            entering={FadeInUp.delay(300).duration(500)}
            style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.scoldingsSaved}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t.profile.scoldingsSaved}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.photosTaken}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t.profile.photosTaken}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Action cards */}
        <View style={styles.actions}>
          <Animated.Text 
            entering={FadeIn.delay(50).duration(400)}
            style={[styles.sectionLabel, { color: colors.textMuted }]}
          >
            {t.home.selectRole}
          </Animated.Text>
          
          <ActionCard
            label={t.home.photographer}
            subtitle={t.home.photographerDesc}
            onPress={handleCamera}
            highlight
            index={0}
          />
          
          <ActionCard
            label={t.home.director}
            subtitle={t.home.directorDesc}
            onPress={handleViewer}
            index={1}
          />
          
          <View style={styles.spacer} />
          
          <ActionCard
            label={t.home.gallery}
            subtitle={t.home.galleryDesc}
            onPress={() => router.push('/gallery')}
            index={2}
          />
        </View>

        {/* Footer nav */}
        <Animated.View 
          entering={FadeIn.delay(400).duration(500)}
          style={styles.footer}
        >
          <NavButton label={t.profile.title} onPress={() => router.push('/profile')} />
          <View style={[styles.footerDot, { backgroundColor: colors.border }]} />
          <NavButton label={t.settings.title} onPress={() => router.push('/settings')} />
        </Animated.View>

        {/* Credit */}
        <Animated.View 
          entering={FadeIn.delay(600).duration(500)}
          style={styles.credit}
        >
          <Pressable 
            onPress={() => Linking.openURL('https://kensaur.us')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.creditText, { color: colors.textMuted }]}>
              © 2025 kensaur.us
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
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 32,
  },
  themeToggle: {
    position: 'absolute',
    top: 16,
    right: 0,
    padding: 8,
    zIndex: 1,
  },
  themeIcon: {
    fontSize: 22,
  },
  brand: {
    marginBottom: 16,
  },
  brandLight: {
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: -1,
  },
  brandBold: {
    fontSize: 38,
    fontWeight: '800',
    letterSpacing: -1.5,
    marginTop: -4,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
    minHeight: 48,
    fontWeight: '400',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  rankPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    marginHorizontal: 20,
  },
  actions: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  cardPressable: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    marginTop: 4,
    fontWeight: '400',
  },
  cardArrow: {
    fontSize: 20,
    fontWeight: '300',
    marginLeft: 12,
  },
  spacer: {
    height: 20,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 24,
  },
  navButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  credit: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  creditText: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
})
