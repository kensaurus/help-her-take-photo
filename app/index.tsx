/**
 * Home - Your relationship's photography insurance
 * 
 * Cutesy Pastel Design Philosophy:
 * - Soft, dreamy pastel colors
 * - Asymmetric artistic card shapes
 * - Distinct buttons vs badges styling
 * - Playful yet sophisticated aesthetic
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
import { fonts, typography } from '../src/config/typography'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

/**
 * Animated action card with cutesy asymmetric design
 * - Chamfered corners (not generic rounded)
 * - Decorative blob accents
 * - Clear button vs badge differentiation
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
  const glow = useSharedValue(0)
  
  // Subtle shimmer animation on highlight
  useEffect(() => {
    if (highlight) {
      shimmer.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      )
    }
  }, [highlight, shimmer])
  
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(pressed.value, [0, 1], [1, 0.96]),
  }))

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0, 0.12]),
  }))

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0, 0.4]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [0.98, 1.01]) }],
  }))
  
  const handlePressIn = () => {
    // Cutesy: playful bounce with glow
    scale.value = withSpring(0.97, { damping: 18, stiffness: 350 })
    pressed.value = withTiming(1, { duration: 100 })
    glow.value = withTiming(1, { duration: 100 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  
  const handlePressOut = () => {
    // Cutesy: bouncy spring back
    scale.value = withSpring(1, { damping: 14, stiffness: 280 })
    pressed.value = withTiming(0, { duration: 180 })
    glow.value = withTiming(0, { duration: 250 })
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
        {/* Glow layer - indicates clickability */}
        <Animated.View 
          style={[
            styles.cardGlow, 
            { backgroundColor: colors.buttonGlow },
            glowStyle
          ]} 
        />
        
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
          
          {/* Decorative blob - artistic touch */}
          <View 
            style={[
              styles.decorBlob,
              { backgroundColor: highlight ? `${colors.primaryText}15` : colors.pastelPink }
            ]}
          />
          
          {/* Icon - asymmetric container */}
          <View 
            style={[
              styles.cardIcon,
              { backgroundColor: highlight ? `${colors.primaryText}20` : colors.surfaceAlt }
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
              { color: highlight ? `${colors.primaryText}85` : colors.textMuted }
            ]}>
              {subtitle}
            </Text>
          </View>
          
          {/* Arrow - indicates action */}
          <View style={styles.cardArrowContainer} accessibilityElementsHidden>
            <Icon 
              name="chevron-right" 
              size={16} 
              color={highlight ? `${colors.primaryText}60` : colors.textMuted} 
            />
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}


/**
 * Status badge component - Soft pill design (distinct from buttons)
 * Uses badge styling: rounded pill, no glow, muted colors
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
          withTiming(1.3, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
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
      {/* Badge style: soft pill, no harsh shadows */}
      <Animated.View style={[styles.statusPill, { backgroundColor: colors.badgeBg, borderColor: `${colors.success}30` }, pressStyle]}>
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
              {t.appName}
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
    paddingBottom: 100, // Extra space for ZenDock
  },
  header: {
    paddingTop: 24,
    paddingBottom: 36,
  },
  brand: {
    marginBottom: 18,
  },
  brandBold: {
    fontFamily: fonts.bold,
    fontSize: 30,
    letterSpacing: -0.3,
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 26,
    minHeight: 52,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
    flexWrap: 'wrap',
  },
  // Badge style: soft pill, distinct from angular buttons
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,           // Soft pill shape (badge)
    borderWidth: 1,
    minHeight: 44,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Badge style for rank
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,           // Soft pill shape (badge)
    minHeight: 44,
  },
  rankText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  // Stats card with asymmetric corners
  statsCard: {
    flexDirection: 'row',
    borderWidth: 1.5,
    // Artistic asymmetric corners
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    padding: 22,
    marginBottom: 32,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 6,
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    marginHorizontal: 18,
  },
  actions: {
    flex: 1,
  },
  sectionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  cardPressable: {
    marginBottom: 14,
    position: 'relative',
  },
  // Glow layer for buttons - indicates clickability
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    // Match card shape
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
  },
  // Artistic asymmetric card shape
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    // Artistic asymmetric corners - NOT generic rounded
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 6,
    overflow: 'hidden',
    minHeight: 92,
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
  },
  // Decorative blob - artistic touch
  decorBlob: {
    position: 'absolute',
    top: -15,
    right: -15,
    width: 50,
    height: 50,
    borderRadius: 25,
    opacity: 0.25,
  },
  // Asymmetric icon container
  cardIcon: {
    width: 52,
    height: 52,
    // Asymmetric shape matching card
    borderTopLeftRadius: 14,
    borderBottomRightRadius: 14,
    borderTopRightRadius: 4,
    borderBottomLeftRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 17,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    marginTop: 5,
    lineHeight: 21,
  },
  cardArrowContainer: {
    paddingLeft: 12,
    paddingRight: 2,
    overflow: 'visible',
    opacity: 0.6,
  },
  spacer: {
    height: 18,
  },
})
