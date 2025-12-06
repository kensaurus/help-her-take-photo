/**
 * Home - Your relationship's photography insurance
 */

import { useEffect, useState } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { usePairingStore } from '../src/stores/pairingStore'
import { useConnectionStore } from '../src/stores/connectionStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useStatsStore } from '../src/stores/statsStore'

function BigButton({ 
  label, 
  subtitle, 
  onPress,
  highlight = false,
}: { 
  label: string
  subtitle: string
  onPress: () => void
  highlight?: boolean
}) {
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  
  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15 })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 })
  }

  return (
    <Pressable 
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.bigButtonPressable}
    >
      <Animated.View style={[
        styles.bigButton, 
        highlight && styles.bigButtonHighlight,
        animatedStyle
      ]}>
        <View style={styles.bigButtonContent}>
          <Text style={[styles.bigButtonLabel, highlight && styles.bigButtonLabelHighlight]}>
            {label}
          </Text>
          <Text style={[styles.bigButtonSubtitle, highlight && styles.bigButtonSubtitleHighlight]}>
            {subtitle}
          </Text>
        </View>
        <Text style={[styles.bigButtonArrow, highlight && styles.bigButtonArrowHighlight]}>›</Text>
      </Animated.View>
    </Pressable>
  )
}

export default function HomeScreen() {
  const router = useRouter()
  const { isPaired } = usePairingStore()
  const { setRole } = useConnectionStore()
  const { t, loadLanguage } = useLanguageStore()
  const { stats, getRank, loadStats } = useStatsStore()
  const [refreshing, setRefreshing] = useState(false)
  
  const taglines = t.home.taglines
  const [taglineIndex, setTaglineIndex] = useState(0)

  useEffect(() => {
    loadLanguage()
    loadStats()
  }, [loadLanguage, loadStats])

  // Rotate taglines
  useEffect(() => {
    const interval = setInterval(() => {
      setTaglineIndex((i) => (i + 1) % taglines.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [taglines.length])

  const handleRefresh = async () => {
    setRefreshing(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await new Promise(r => setTimeout(r, 500))
    setRefreshing(false)
  }

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
    <SafeAreaView style={styles.container} edges={['top']}>
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
        {/* Header */}
        <Animated.View entering={FadeIn.duration(400)} style={styles.header}>
          <View style={styles.brand}>
            <Text style={styles.brandLight}>Help Her</Text>
            <Text style={styles.brandBold}>Take Photo</Text>
          </View>
          
          <Text style={styles.tagline}>{taglines[taglineIndex]}</Text>
          
          {/* Status */}
          <View style={styles.statusRow}>
            {isPaired && (
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>{t.home.paired}</Text>
              </View>
            )}
            
            {stats.scoldingsSaved > 0 && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{rankText}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Stats card */}
        {stats.scoldingsSaved > 0 && (
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.scoldingsSaved}</Text>
              <Text style={styles.statLabel}>{t.profile.scoldingsSaved}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.photosTaken}</Text>
              <Text style={styles.statLabel}>{t.profile.photosTaken}</Text>
            </View>
          </View>
        )}

        {/* Main Actions */}
        <View style={styles.actions}>
          <Text style={styles.sectionLabel}>{t.home.selectRole}</Text>
          
          <BigButton
            label={t.home.photographer}
            subtitle={t.home.photographerDesc}
            onPress={handleCamera}
            highlight
          />
          
          <BigButton
            label={t.home.director}
            subtitle={t.home.directorDesc}
            onPress={handleViewer}
          />
          
          <View style={styles.spacer} />
          
          <BigButton
            label={t.home.gallery}
            subtitle={t.home.galleryDesc}
            onPress={() => router.push('/gallery')}
          />
        </View>

        {/* Footer nav */}
        <View style={styles.footer}>
          <Pressable style={styles.footerButton} onPress={() => router.push('/profile')}>
            <Text style={styles.footerButtonText}>{t.profile.title}</Text>
          </Pressable>
          
          <View style={styles.footerDivider} />
          
          <Pressable style={styles.footerButton} onPress={() => router.push('/settings')}>
            <Text style={styles.footerButtonText}>{t.settings.title}</Text>
          </Pressable>
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
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
  },
  brand: {
    marginBottom: 12,
  },
  brandLight: {
    fontSize: 34,
    fontWeight: '300',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  brandBold: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginTop: -8,
  },
  tagline: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    minHeight: 44,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 12,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
  },
  rankBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  rankText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    padding: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
    marginHorizontal: 16,
  },
  actions: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 12,
  },
  bigButtonPressable: {
    marginBottom: 8,
  },
  bigButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
  },
  bigButtonHighlight: {
    backgroundColor: '#1a1a1a',
    borderColor: '#1a1a1a',
  },
  bigButtonContent: {
    flex: 1,
  },
  bigButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  bigButtonLabelHighlight: {
    color: '#fff',
  },
  bigButtonSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  bigButtonSubtitleHighlight: {
    color: 'rgba(255,255,255,0.7)',
  },
  bigButtonArrow: {
    fontSize: 28,
    color: '#CCC',
    fontWeight: '300',
  },
  bigButtonArrowHighlight: {
    color: 'rgba(255,255,255,0.5)',
  },
  spacer: {
    height: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  footerButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  footerButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  footerDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#DDD',
  },
})
