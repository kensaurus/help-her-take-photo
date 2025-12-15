/**
 * Home - Your relationship's photography insurance
 * 
 * Zen Design Philosophy:
 * - Generous whitespace for breathing room
 * - Calm, muted colors
 * - Gentle, deliberate animations
 * - Clear focus on essential actions
 */

import { useEffect, useState, useCallback } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  ScrollView, 
  RefreshControl,
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
import { connectionHistoryApi } from '../src/services/api'
import { sessionLogger } from '../src/services/sessionLogger'

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
  icon: 'camera' | 'eye' | 'image' | 'link'
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
    // Zen: gentler, more deliberate press animation
    scale.value = withSpring(0.985, { damping: 20, stiffness: 300 })
    pressed.value = withTiming(1, { duration: 120 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
  }
  
  const handlePressOut = () => {
    // Zen: slower spring back
    scale.value = withSpring(1, { damping: 18, stiffness: 250 })
    pressed.value = withTiming(0, { duration: 200 })
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
              size={26} 
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
 * Animated nav item with press feedback
 */
function NavItem({ 
  icon, 
  label, 
  active = false,
  onPress,
}: { 
  icon: 'user' | 'settings'
  label: string
  active?: boolean
  onPress: () => void
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 })
  }
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 300 })
  }

  return (
    <Pressable 
      style={styles.navItem}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={label}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Animated.View style={[styles.navItemInner, animatedStyle]}>
        <Icon name={icon} size={20} color={active ? colors.text : colors.textMuted} />
        <Text style={[styles.navLabel, { color: active ? colors.text : colors.textMuted }]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  )
}


/**
 * Status pill component - Tappable to navigate to Settings
 */
function StatusPill({
  connected,
  label,
  onPress,
}: {
  connected?: boolean
  label: string
  onPress?: () => void
}) {
  const { colors } = useThemeStore()
  const pulse = useSharedValue(1)
  const scale = useSharedValue(1)

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
  
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onPress?.()
      }}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 400 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 300 })
      }}
    >
      <Animated.View style={[styles.statusPill, { backgroundColor: `${colors.success}12` }, pressStyle]}>
        <Animated.View style={[
          styles.statusDot, 
          { backgroundColor: colors.success },
          dotStyle
        ]} />
        <Text style={[styles.statusText, { color: colors.success }]}>
          {label}
        </Text>
        <Icon name="chevron-right" size={12} color={colors.success} />
      </Animated.View>
    </Pressable>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { colors, mode } = useThemeStore()
  const { isPaired, myDeviceId, pairedDeviceId, sessionId, setPartnerPresence } = usePairingStore()
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

  // Presence should be tracked whenever we're paired (even on Home screen),
  // otherwise the director can auto-disconnect before photographer opens Camera.
  useEffect(() => {
    if (!isPaired || !myDeviceId || !pairedDeviceId || !sessionId) return

    sessionLogger.init(myDeviceId, sessionId)
    sessionLogger.info('presence_join_requested', {
      role: 'home',
      sessionId: sessionId.substring(0, 8),
      partnerDeviceId: pairedDeviceId.substring(0, 8),
    })

    const presenceSub = connectionHistoryApi.subscribeToSessionPresence({
      sessionId,
      myDeviceId,
      partnerDeviceId: pairedDeviceId,
      onPartnerOnlineChange: (isOnline) => {
        sessionLogger.info('partner_presence_changed', { partnerDeviceId: pairedDeviceId, isOnline })
        setPartnerPresence(isOnline)
      },
      onError: (message) => sessionLogger.warn('presence_error', { message }),
    })

    return () => {
      void presenceSub.unsubscribe()
    }
  }, [isPaired, myDeviceId, pairedDeviceId, sessionId])

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
    router.push('/camera')
  }

  const handleViewer = () => {
    setRole('viewer')
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    router.push('/viewer')
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
          <View style={styles.brand}>
            <Text style={[styles.brandBold, { color: colors.text }]}>
              {t.appName} 📸
            </Text>
          </View>

          <Animated.Text style={[styles.tagline, { color: colors.textMuted }, taglineStyle]}>
            {taglines[taglineIndex]}
          </Animated.Text>

          {/* Status pills - tappable for navigation */}
          {(isPaired || stats.scoldingsSaved > 0) && (
            <Animated.View
              entering={FadeInDown.delay(150).duration(350)}
              style={styles.statusRow}
            >
              {isPaired && (
                <StatusPill 
                  connected 
                  label={t.home.paired} 
                  onPress={() => router.push('/settings')}
                />
              )}

              {stats.scoldingsSaved > 0 && (
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    router.push('/profile')
                  }}
                >
                  <View style={[styles.rankPill, { backgroundColor: colors.surfaceAlt }]}>
                    <Icon name="star" size={12} color={colors.accent} />
                    <Text style={[styles.rankText, { color: colors.accent }]}>
                      {rankText}
                    </Text>
                    <Icon name="chevron-right" size={12} color={colors.accent} />
                  </View>
                </Pressable>
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
          {isPaired ? (
            <>
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
            </>
          ) : (
            <>
              <Animated.Text 
                entering={FadeIn.delay(50).duration(350)}
                style={[styles.sectionLabel, { color: colors.textMuted }]}
              >
                GET STARTED
              </Animated.Text>
              
              <ActionCard
                label="Connect with Partner"
                subtitle="Link devices first, then choose your role"
                icon="link"
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  router.push('/pairing')
                }}
                highlight
                index={0}
                accessibilityHint="Connect with your partner's device to start"
              />
            </>
          )}
          
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

        {/* Bottom nav bar - minimal with animated feedback */}
        <Animated.View 
          entering={FadeIn.delay(350).duration(400)}
          style={[styles.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
        >
          <NavItem 
            icon="user" 
            label={t.profile.title} 
            active
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/profile')
            }}
          />
          
          <NavItem 
            icon="settings" 
            label={t.settings.title}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push('/settings')
            }}
          />
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
    paddingHorizontal: 28,      // Zen: more breathing room
    paddingBottom: 40,
  },
  header: {
    paddingTop: 24,             // Zen: more space at top
    paddingBottom: 40,          // Zen: generous spacing
  },
  brand: {
    marginBottom: 20,
  },
  brandBold: {
    fontSize: 30,               // Zen: slightly smaller, more refined
    fontWeight: '700',          // Zen: less aggressive weight
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 24,             // Zen: more line height for readability
    minHeight: 48,
    fontWeight: '400',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,              // Zen: more space
    gap: 12,
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,           // Zen: softer corners
    minHeight: 48,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',          // Zen: lighter weight
    letterSpacing: 0.4,
  },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 48,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 16,           // Zen: softer corners
    padding: 24,                // Zen: more padding
    marginBottom: 36,           // Zen: more spacing
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,               // Zen: slightly smaller
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: '400',          // Zen: lighter
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 20,       // Zen: more space
  },
  actions: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',          // Zen: lighter
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 18,           // Zen: more space
  },
  cardPressable: {
    marginBottom: 14,           // Zen: more space between cards
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 26,        // Zen: more padding
    paddingHorizontal: 22,
    borderWidth: 1,
    borderRadius: 16,           // Zen: softer corners
    overflow: 'hidden',
    minHeight: 96,              // Zen: taller for breathing room
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  cardIcon: {
    width: 54,
    height: 54,
    borderRadius: 14,           // Zen: softer corners
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 17,               // Zen: slightly smaller
    fontWeight: '600',          // Zen: lighter weight
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 14,
    marginTop: 6,
    fontWeight: '400',
    lineHeight: 21,             // Zen: more line height
    opacity: 0.8,               // Zen: softer secondary text
  },
  cardArrowContainer: {
    paddingLeft: 14,
    paddingRight: 4,
    overflow: 'visible',
    opacity: 0.5,               // Zen: subtle arrow
  },
  spacer: {
    height: 20,                 // Zen: more space
  },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
    marginTop: 16,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: 48, // Accessibility: minimum touch target
  },
  navItemInner: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
})
