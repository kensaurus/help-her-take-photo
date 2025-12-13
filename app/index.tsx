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
  SlideInRight,
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useConnectionStore } from '../src/stores/connectionStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Icon } from '../src/components/ui/Icon'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

/**
 * Animated action card with press feedback and ripple effect
 */
function ActionCard({ 
  label, 
  subtitle,
  icon,
  onPress,
  highlight = false,
  index = 0,
  accessibilityHint,
}: { 
  label: string
  subtitle: string
  icon: 'camera' | 'eye' | 'image'
  onPress: () => void
  highlight?: boolean
  index?: number
  accessibilityHint?: string
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  const pressed = useSharedValue(0)
  const shimmer = useSharedValue(0)
  
  // Subtle shimmer animation on highlight
  useEffect(() => {
    if (highlight) {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    }
  }, [highlight, shimmer])
  
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.95]),
  }))

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0, 0.08]),
  }))
  
  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 400 })
    pressed.value = withTiming(1, { duration: 80 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
    pressed.value = withTiming(0, { duration: 150 })
  }

  return (
    <Animated.View 
      entering={FadeInUp.delay(100 + index * 60).duration(400).springify()}
    >
      <Pressable 
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.cardPressable}
        accessibilityLabel={`${label}. ${subtitle}`}
        accessibilityHint={accessibilityHint}
        accessibilityRole="button"
      >
        <Animated.View style={[
          styles.card, 
          { 
            borderColor: highlight ? colors.primary : colors.border,
            backgroundColor: highlight ? colors.primary : colors.surface,
          },
          cardStyle
        ]}>
          {/* Shimmer overlay */}
          {highlight && (
            <Animated.View style={[styles.shimmer, shimmerStyle, { backgroundColor: colors.primaryText }]} />
          )}
          
          {/* Icon */}
          <View 
            style={[
              styles.cardIcon,
              { backgroundColor: highlight ? `${colors.primaryText}15` : colors.surfaceAlt }
            ]}
            accessibilityElementsHidden
          >
            <Icon 
              name={icon} 
              size={22} 
              color={highlight ? colors.primaryText : colors.text} 
            />
          </View>
          
          {/* Content */}
          <View style={styles.cardContent}>
            <Text style={[
              styles.cardLabel, 
              { color: highlight ? colors.primaryText : colors.text }
            ]}>
              {label}
            </Text>
            <Text style={[
              styles.cardSubtitle, 
              { color: highlight ? `${colors.primaryText}80` : colors.textMuted }
            ]}>
              {subtitle}
            </Text>
          </View>
          
          {/* Arrow */}
          <View style={styles.cardArrowContainer} accessibilityElementsHidden>
            <Icon 
              name="chevron-right" 
              size={16} 
              color={highlight ? `${colors.primaryText}50` : colors.textMuted} 
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Minimal nav button with scale animation
 */
function NavButton({ 
  label, 
  icon,
  onPress,
  accessibilityHint,
}: { 
  label: string
  icon: 'user' | 'settings'
  onPress: () => void
  accessibilityHint?: string
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
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress()
      }}
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 15, stiffness: 400 })
        opacity.value = withTiming(0.7, { duration: 80 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 })
        opacity.value = withTiming(1, { duration: 150 })
      }}
      hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityRole="button"
    >
      <Animated.View style={[styles.navButton, animatedStyle]}>
        <Icon name={icon} size={18} color={colors.textSecondary} />
        <Text style={[styles.navButtonText, { color: colors.textSecondary }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}

/**
 * Theme toggle button
 */
function ThemeToggle() {
  const { colors, mode, toggleMode } = useThemeStore()
  const rotation = useSharedValue(0)
  const scale = useSharedValue(1)

  const handlePress = () => {
    rotation.value = withSpring(rotation.value + 180, { damping: 15 })
    scale.value = withSequence(
      withTiming(0.8, { duration: 100 }),
      withSpring(1, { damping: 10, stiffness: 200 })
    )
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    toggleMode()
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }))

  return (
    <Pressable
      style={styles.themeToggle}
      onPress={handlePress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityRole="button"
      accessibilityHint="Toggles between dark and light theme"
    >
      <Animated.View style={animatedStyle}>
        <Icon 
          name={mode === 'dark' ? 'sun' : 'moon'} 
          size={22} 
          color={colors.textMuted} 
        />
      </Animated.View>
    </Pressable>
  )
}

/**
 * Status pill component
 */
function StatusPill({ 
  connected, 
  label 
}: { 
  connected?: boolean
  label: string 
}) {
  const { colors } = useThemeStore()
  const pulse = useSharedValue(1)

  useEffect(() => {
    if (connected) {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      )
    }
  }, [connected, pulse])

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: connected ? pulse.value : 1 }],
  }))

  return (
    <View style={[styles.statusPill, { backgroundColor: `${colors.success}12` }]}>
      <Animated.View style={[
        styles.statusDot, 
        { backgroundColor: colors.success },
        dotStyle
      ]} />
      <Text style={[styles.statusText, { color: colors.success }]}>
        {label}
      </Text>
    </View>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { colors, mode } = useThemeStore()
  const { isPaired } = usePairingStore()
  const { setRole } = useConnectionStore()
  const { t, loadLanguage } = useLanguageStore()
  const { stats, getRank, loadStats } = useStatsStore()
  const [refreshing, setRefreshing] = useState(false)
  
  const taglines = t.home.taglines
  const [taglineIndex, setTaglineIndex] = useState(0)
  const taglineOpacity = useSharedValue(1)
  const taglineY = useSharedValue(0)

  useEffect(() => {
    loadLanguage()
    loadStats()
  }, [loadLanguage, loadStats])

  // Smooth tagline rotation with slide + fade
  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out and slide up
      taglineOpacity.value = withTiming(0, { duration: 250 })
      taglineY.value = withTiming(-8, { duration: 250 })
      
      setTimeout(() => {
        setTaglineIndex((i) => (i + 1) % taglines.length)
        // Reset position and fade in
        taglineY.value = 8
        taglineOpacity.value = withTiming(1, { duration: 300 })
        taglineY.value = withSpring(0, { damping: 20, stiffness: 200 })
      }, 250)
    }, 4500)
    return () => clearInterval(interval)
  }, [taglines.length, taglineOpacity, taglineY])

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineY.value }],
  }))

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    // Reload stats from Supabase
    await loadStats()
    setRefreshing(false)
  }, [loadStats])

  const handleCamera = () => {
    setRole('camera')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push(isPaired ? '/camera' : '/pairing')
  }

  const handleViewer = () => {
    setRole('viewer')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
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
        <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
          <ThemeToggle />

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
              entering={FadeInDown.delay(150).duration(350)}
              style={styles.statusRow}
            >
              {isPaired && (
                <StatusPill connected label={t.home.paired} />
              )}
              
              {stats.scoldingsSaved > 0 && (
                <View style={[styles.rankPill, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon name="star" size={12} color={colors.accent} />
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
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Pressable 
              style={styles.statItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                router.push('/profile')
              }}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.scoldingsSaved}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t.profile.scoldingsSaved}
              </Text>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <Pressable 
              style={styles.statItem}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                router.push('/gallery')
              }}
            >
              <Text style={[styles.statValue, { color: colors.text }]}>
                {stats.photosTaken}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {t.profile.photosTaken}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Action cards */}
        <View style={styles.actions}>
          <Animated.Text 
            entering={FadeIn.delay(50).duration(350)}
            style={[styles.sectionLabel, { color: colors.textMuted }]}
          >
            {t.home.selectRole}
          </Animated.Text>
          
          <ActionCard
            label={t.home.photographer}
            subtitle={t.home.photographerDesc}
            icon="camera"
            onPress={handleCamera}
            highlight
            index={0}
            accessibilityHint="Opens camera mode to take photos with real-time guidance"
          />
          
          <ActionCard
            label={t.home.director}
            subtitle={t.home.directorDesc}
            icon="eye"
            onPress={handleViewer}
            index={1}
            accessibilityHint="Opens viewer mode to guide the photographer"
          />
          
          <View style={styles.spacer} />
          
          <ActionCard
            label={t.home.gallery}
            subtitle={t.home.galleryDesc}
            icon="image"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/gallery')
            }}
            index={2}
            accessibilityHint="Opens the photo gallery to view saved photos"
          />
        </View>

        {/* Footer nav */}
        <Animated.View 
          entering={FadeIn.delay(350).duration(400)}
          style={styles.footer}
        >
          <NavButton 
            label={t.profile.title} 
            icon="user"
            onPress={() => router.push('/profile')}
            accessibilityHint="View your profile and statistics"
          />
          <View style={[styles.footerDot, { backgroundColor: colors.border }]} accessibilityElementsHidden />
          <NavButton 
            label={t.settings.title} 
            icon="settings"
            onPress={() => router.push('/settings')}
            accessibilityHint="Open app settings"
          />
        </Animated.View>

        {/* Credit */}
        <Animated.View 
          entering={FadeIn.delay(500).duration(400)}
          style={styles.credit}
        >
          <Pressable 
            onPress={() => Linking.openURL('https://kensaur.us')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.creditText, { color: colors.textMuted }]}>
              kensaur.us  /  2025
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
  brand: {
    marginBottom: 16,
  },
  brandLight: {
    fontSize: 28,
    fontWeight: '300',
    letterSpacing: -0.5,
  },
  brandBold: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: -2,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 44,
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
    borderRadius: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 8,
    padding: 18,
    marginBottom: 28,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 16,
  },
  actions: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  cardPressable: {
    marginBottom: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontWeight: '400',
  },
  cardArrowContainer: {
    paddingLeft: 12,
    paddingRight: 2, // Extra space to prevent icon clipping
    overflow: 'visible',
  },
  spacer: {
    height: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 20,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  footerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  credit: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  creditText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
  },
})
