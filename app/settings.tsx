/**
 * Settings - Clean, minimal design with icons
 */

import { useEffect, useState } from 'react'
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable, 
  Switch, 
  Modal, 
  FlatList,
  ScrollView,
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
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../src/stores/settingsStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Language, languageNames } from '../src/i18n/translations'
import { getBuildInfo } from '../src/config/build'
import { Icon } from '../src/components/ui/Icon'
import { profileApi } from '../src/services/api'

function SettingRow({ 
  label, 
  description, 
  value, 
  onToggle,
  index = 0,
}: { 
  label: string
  description?: string
  value: boolean
  onToggle: () => void
  index?: number
}) {
  const { colors, mode } = useThemeStore()
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View entering={FadeInUp.delay(index * 30).duration(200)}>
      <Pressable 
        style={styles.settingRow} 
        onPress={onToggle}
        onPressIn={() => {
          scale.value = withSpring(0.99, { damping: 15, stiffness: 400 })
          opacity.value = withTiming(0.8, { duration: 50 })
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 })
          opacity.value = withTiming(1, { duration: 100 })
        }}
        accessibilityLabel={`${label}${description ? `. ${description}` : ''}`}
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
      >
        <Animated.View style={[styles.settingRowInner, animatedStyle]}>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
            {description && (
              <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                {description}
              </Text>
            )}
          </View>
          <Switch
            value={value}
            onValueChange={onToggle}
            trackColor={{ 
              false: mode === 'dark' ? '#4A4A4A' : '#D1D5DB', 
              true: colors.success 
            }}
            thumbColor={value ? '#FFFFFF' : (mode === 'dark' ? '#9CA3AF' : '#FFFFFF')}
            ios_backgroundColor={mode === 'dark' ? '#4A4A4A' : '#D1D5DB'}
            accessibilityLabel={label}
          />
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

function LanguageOption({ 
  code, 
  name, 
  selected, 
  onSelect 
}: { 
  code: Language
  name: string
  selected: boolean
  onSelect: () => void 
}) {
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={() => { 
        scale.value = withSpring(0.98, { damping: 15 }) 
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 15 }) }}
      accessibilityLabel={`${name}${selected ? ', selected' : ''}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Animated.View style={[
        styles.languageOption, 
        { 
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        animatedStyle
      ]}>
        <Text style={[
          styles.languageText, 
          { color: selected ? colors.primaryText : colors.text }
        ]}>
          {name}
        </Text>
        {selected && (
          <Icon name="check" size={16} color={colors.primaryText} />
        )}
      </Animated.View>
    </Pressable>
  )
}

// Helper to format relative time
function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  
  if (diffDay > 0) return `${diffDay}d ago`
  if (diffHour > 0) return `${diffHour}h ago`
  if (diffMin > 0) return `${diffMin}m ago`
  return 'Just now'
}

// Format duration
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

export default function SettingsScreen() {
  const router = useRouter()
  const { colors, mode, toggleMode } = useThemeStore()
  const { settings, updateSettings } = useSettingsStore()
  const { 
    isPaired, 
    clearPairing, 
    partnerDisplayName, 
    partnerAvatar, 
    sessionId,
    connectionHistory,
    setConnectionHistory,
  } = usePairingStore()
  const { language, setLanguage, t } = useLanguageStore()
  const [showLanguageModal, setShowLanguageModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  // Hydrate missing connection history display names/avatars (improves UX)
  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      const missing = connectionHistory.filter((c) => !c.partnerDisplayName)
      if (missing.length === 0) return

      const updates = await Promise.all(
        missing.map(async (c) => {
          const { profile } = await profileApi.get(c.partnerDeviceId)
          return profile
            ? { partnerDeviceId: c.partnerDeviceId, display_name: profile.display_name, avatar_emoji: profile.avatar_emoji }
            : null
        })
      )

      if (cancelled) return

      const map = new Map(updates.filter(Boolean).map((u: any) => [u.partnerDeviceId, u]))
      if (map.size === 0) return

      const hydrated = connectionHistory.map((c) => {
        const u = map.get(c.partnerDeviceId)
        if (!u) return c
        return {
          ...c,
          partnerDisplayName: c.partnerDisplayName ?? u.display_name ?? null,
          partnerAvatar: c.partnerAvatar || u.avatar_emoji || '👤',
        }
      })

      setConnectionHistory(hydrated)
    }

    hydrate().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [connectionHistory, setConnectionHistory])

  const toggleSetting = (key: keyof typeof settings) => {
    updateSettings({ [key]: !settings[key] })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  const handleUnpair = () => {
    clearPairing()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  const handleLanguageSelect = (lang: Language) => {
    setLanguage(lang)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    setShowLanguageModal(false)
  }

  const languages: { code: Language; name: string }[] = [
    { code: 'en', name: 'English' },
    { code: 'th', name: 'ไทย (Thai)' },
    { code: 'zh', name: '中文 (Chinese)' },
    { code: 'ja', name: '日本語 (Japanese)' },
  ]

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Connection - MOVED TO TOP for better UX */}
        <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.connection.toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {isPaired ? (
              <>
                {/* Connected state - Partner Info */}
                <View style={styles.connectionStatusRow}>
                  <View style={[styles.partnerAvatarLarge, { backgroundColor: `${colors.primary}15` }]}>
                    <Text style={styles.partnerAvatarEmoji}>{partnerAvatar || '📸'}</Text>
                  </View>
                  <View style={styles.connectionStatusInfo}>
                    <Text style={[styles.connectionStatusTitle, { color: colors.text }]}>
                      {partnerDisplayName || 'Partner'}
                    </Text>
                    <View style={styles.statusBadge}>
                      <View style={[styles.statusDotGreen]} />
                      <Text style={styles.statusBadgeText}>Connected</Text>
                    </View>
                  </View>
                </View>
                
                {/* Session Info */}
                {sessionId && (
                  <>
                    <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                    <View style={styles.sessionInfoRow}>
                      <Text style={[styles.sessionLabel, { color: colors.textMuted }]}>Session ID</Text>
                      <Text style={[styles.sessionValue, { color: colors.text }]}>
                        {sessionId.substring(0, 8)}...
                      </Text>
                    </View>
                  </>
                )}
                
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                
                <Pressable 
                  style={styles.actionRow} 
                  onPress={handleUnpair}
                >
                  <Text style={[styles.actionTextDanger, { color: colors.error }]}>
                    Disconnect from Partner
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* Disconnected state */}
                <View style={styles.connectionStatusRow}>
                  <View style={[styles.connectionStatusIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={styles.connectionStatusEmoji}>📱</Text>
                  </View>
                  <View style={styles.connectionStatusInfo}>
                    <Text style={[styles.connectionStatusTitle, { color: colors.text }]}>
                      Not Connected
                    </Text>
                    <Text style={[styles.connectionStatusDesc, { color: colors.textMuted }]}>
                      Pair with partner to start
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                
                <Pressable 
                  style={[styles.connectButton, { backgroundColor: colors.primary }]} 
                  onPress={() => router.replace('/pairing')}
                >
                  <Text style={[styles.connectButtonText, { color: colors.primaryText }]}>
                    Connect with Partner
                  </Text>
                </Pressable>
              </>
            )}
          </View>
          
          {/* Connection History */}
          {connectionHistory.length > 0 && (
            <Pressable 
              style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setShowHistoryModal(true)}
            >
              <View style={styles.historyHeader}>
                <Text style={[styles.historyTitle, { color: colors.text }]}>
                  Recent Connections
                </Text>
                <View style={styles.historyBadge}>
                  <Text style={[styles.historyBadgeText, { color: colors.textMuted }]}>
                    {connectionHistory.length}
                  </Text>
                </View>
              </View>
              
              {/* Show last 2 connections preview */}
              {connectionHistory.slice(0, 2).map((conn, index) => (
                <View 
                  key={conn.id} 
                  style={[
                    styles.historyItem,
                    index > 0 && { borderTopWidth: 1, borderTopColor: colors.borderLight }
                  ]}
                >
                  <Text style={styles.historyAvatar}>{conn.partnerAvatar || '👤'}</Text>
                  <View style={styles.historyItemInfo}>
                    <Text style={[styles.historyItemName, { color: colors.text }]}>
                      {conn.partnerDisplayName || 'Unknown'}
                    </Text>
                    <Text style={[styles.historyItemMeta, { color: colors.textMuted }]}>
                      {formatRelativeTime(conn.connectedAt)} · {conn.role || 'unknown'} · {formatDuration(conn.durationSeconds)}
                    </Text>
                  </View>
                  <View style={[
                    styles.historyStatusDot,
                    { backgroundColor: conn.status === 'connected' ? '#22C55E' : colors.textMuted }
                  ]} />
                </View>
              ))}
              
              {connectionHistory.length > 2 && (
                <Text style={[styles.historyMore, { color: colors.accent }]}>
                  View all ({connectionHistory.length}) →
                </Text>
              )}
            </Pressable>
          )}
        </Animated.View>

        {/* Appearance */}
        <Animated.View entering={FadeIn.delay(80).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            APPEARANCE
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable 
              style={styles.settingRow}
              onPress={() => {
                toggleMode()
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              }}
            >
              <View style={styles.settingRowInner}>
                <View style={styles.settingRowLeft}>
                  <View style={[styles.iconContainer, { backgroundColor: colors.surfaceAlt }]}>
                    <Icon name={mode === 'dark' ? 'moon' : 'sun'} size={16} color={colors.text} />
                  </View>
                  <View style={styles.settingInfo}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                    <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                      {mode === 'dark' ? 'On' : 'Off'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={() => {
                    toggleMode()
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  }}
                  trackColor={{ 
                    false: mode === 'dark' ? '#4A4A4A' : '#D1D5DB', 
                    true: colors.success 
                  }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor={mode === 'dark' ? '#4A4A4A' : '#D1D5DB'}
                />
              </View>
            </Pressable>
          </View>
        </Animated.View>

        {/* Camera Settings */}
        <Animated.View entering={FadeIn.delay(110).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.camera.toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow
              label={t.settings.gridOverlay}
              description={t.settings.gridDesc}
              value={settings.showGrid}
              onToggle={() => toggleSetting('showGrid')}
              index={0}
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingRow
              label={t.settings.flash}
              description={t.settings.flashDesc}
              value={settings.flash}
              onToggle={() => toggleSetting('flash')}
              index={1}
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingRow
              label={t.settings.sound}
              value={settings.sound}
              onToggle={() => toggleSetting('sound')}
              index={2}
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingRow
              label={t.settings.autoSave}
              value={settings.autoSave}
              onToggle={() => toggleSetting('autoSave')}
              index={3}
            />
          </View>
        </Animated.View>

        {/* Accessibility */}
        <Animated.View entering={FadeIn.delay(140).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            ACCESSIBILITY
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow
              label="Reduce Motion"
              description="Minimize animations throughout the app"
              value={settings.reduceMotion}
              onToggle={() => toggleSetting('reduceMotion')}
              index={0}
            />
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            <SettingRow
              label="Reduce Haptics"
              description="Turn off vibration feedback"
              value={settings.reduceHaptics}
              onToggle={() => toggleSetting('reduceHaptics')}
              index={1}
            />
          </View>
        </Animated.View>

        {/* Language */}
        <Animated.View entering={FadeIn.delay(170).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.language.toUpperCase()}
          </Text>
          <Pressable 
            style={[styles.card, styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]} 
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.linkCardContent}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                {t.settings.selectLanguage}
              </Text>
              <View style={styles.languageValue}>
                <Text style={[styles.languageValueText, { color: colors.textSecondary }]}>
                  {languageNames[language]}
                </Text>
                <Icon name="chevron-right" size={14} color={colors.textMuted} />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Feedback */}
        <Animated.View entering={FadeIn.delay(200).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            FEEDBACK
          </Text>
          <Pressable 
            style={[styles.card, styles.linkCard, { backgroundColor: colors.surface, borderColor: colors.border }]} 
            onPress={() => router.push('/feedback')}
          >
            <View style={styles.linkCardContent}>
              <View style={styles.linkCardLeft}>
                <View style={[styles.iconContainer, { backgroundColor: colors.surfaceAlt }]}>
                  <Icon name="send" size={14} color={colors.text} />
                </View>
                <Text style={[styles.settingLabel, { color: colors.text }]}>
                  Send Feedback
                </Text>
              </View>
              <Icon name="chevron-right" size={14} color={colors.textMuted} />
            </View>
          </Pressable>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeIn.delay(230).duration(200)} style={styles.footer}>
          <Text style={[styles.appName, { color: colors.text }]}>{t.appName}</Text>
          <Pressable onPress={() => router.push('/changelog')}>
            <Text style={[styles.version, { color: colors.accent }]}>
              {getBuildInfo().fullVersion}
            </Text>
          </Pressable>
          <Text style={[styles.taglineFooter, { color: colors.textMuted }]}>
            {t.tagline}
          </Text>
          
          <Pressable 
            style={styles.creditLink}
            onPress={() => Linking.openURL('https://kensaur.us')}
          >
            <Text style={[styles.creditText, { color: colors.textMuted }]}>
              kensaur.us / 2025
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t.settings.selectLanguage}
            </Text>
            <Pressable 
              style={styles.modalClose} 
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={[styles.modalCloseText, { color: colors.accent }]}>
                {t.common.done}
              </Text>
            </Pressable>
          </View>
          
          <FlatList
            data={languages}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.languageList}
            renderItem={({ item }) => (
              <LanguageOption
                code={item.code}
                name={item.name}
                selected={language === item.code}
                onSelect={() => handleLanguageSelect(item.code)}
              />
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Connection History Modal */}
      <Modal
        visible={showHistoryModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Connection History
            </Text>
            <Pressable 
              style={styles.modalClose} 
              onPress={() => setShowHistoryModal(false)}
            >
              <Text style={[styles.modalCloseText, { color: colors.accent }]}>
                {t.common.done}
              </Text>
            </Pressable>
          </View>
          
          <FlatList
            data={connectionHistory}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.historyList}
            ListEmptyComponent={
              <View style={styles.emptyHistory}>
                <Text style={styles.emptyHistoryEmoji}>📭</Text>
                <Text style={[styles.emptyHistoryText, { color: colors.textMuted }]}>
                  No connection history yet
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.historyListItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.historyListItemHeader}>
                  <Text style={styles.historyListAvatar}>{item.partnerAvatar || '👤'}</Text>
                  <View style={styles.historyListItemInfo}>
                    <Text style={[styles.historyListItemName, { color: colors.text }]}>
                      {item.partnerDisplayName || 'Unknown Partner'}
                    </Text>
                    <Text style={[styles.historyListItemRole, { color: colors.accent }]}>
                      {item.role === 'camera' ? '📸 Photographer' : '👁️ Director'}
                    </Text>
                  </View>
                  <View style={[
                    styles.historyListStatusBadge,
                    { backgroundColor: item.status === 'connected' ? '#22C55E20' : `${colors.textMuted}20` }
                  ]}>
                    <View style={[
                      styles.historyListStatusDot,
                      { backgroundColor: item.status === 'connected' ? '#22C55E' : colors.textMuted }
                    ]} />
                    <Text style={[
                      styles.historyListStatusText,
                      { color: item.status === 'connected' ? '#22C55E' : colors.textMuted }
                    ]}>
                      {item.status === 'connected' ? 'Active' : 'Ended'}
                    </Text>
                  </View>
                </View>
                
                <View style={[styles.historyListItemMeta, { borderTopColor: colors.borderLight }]}>
                  <View style={styles.historyMetaItem}>
                    <Text style={[styles.historyMetaLabel, { color: colors.textMuted }]}>Connected</Text>
                    <Text style={[styles.historyMetaValue, { color: colors.text }]}>
                      {formatRelativeTime(item.connectedAt)}
                    </Text>
                  </View>
                  <View style={styles.historyMetaItem}>
                    <Text style={[styles.historyMetaLabel, { color: colors.textMuted }]}>Duration</Text>
                    <Text style={[styles.historyMetaValue, { color: colors.text }]}>
                      {formatDuration(item.durationSeconds)}
                    </Text>
                  </View>
                  <View style={styles.historyMetaItem}>
                    <Text style={[styles.historyMetaLabel, { color: colors.textMuted }]}>Session</Text>
                    <Text style={[styles.historyMetaValue, { color: colors.text }]}>
                      {item.sessionId?.substring(0, 8) || 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        </SafeAreaView>
      </Modal>
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
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
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
  linkCard: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'visible', // Prevent icon clipping
  },
  linkCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingRow: {
    minHeight: 56,
  },
  settingRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 2, // Extra space for chevron icon
  },
  languageValueText: {
    fontSize: 15,
  },
  connectionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  partnerAvatarLarge: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerAvatarEmoji: {
    fontSize: 28,
  },
  connectionStatusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionStatusEmoji: {
    fontSize: 24,
  },
  connectionStatusInfo: {
    flex: 1,
  },
  connectionStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  statusBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#22C55E',
  },
  sessionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sessionLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  sessionValue: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  connectionStatusDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  actionTextDanger: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  connectButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
  },
  version: {
    fontSize: 13,
    marginTop: 2,
  },
  taglineFooter: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 18,
  },
  creditLink: {
    marginTop: 16,
    paddingVertical: 6,
  },
  creditText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  modalClose: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },
  languageList: {
    padding: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  languageText: {
    fontSize: 16,
    fontWeight: '500',
  },
  // History styles
  historyCard: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 12,
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  historyAvatar: {
    fontSize: 22,
  },
  historyItemInfo: {
    flex: 1,
  },
  historyItemName: {
    fontSize: 14,
    fontWeight: '500',
  },
  historyItemMeta: {
    fontSize: 11,
    marginTop: 2,
  },
  historyStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyMore: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    paddingVertical: 12,
  },
  // History modal styles
  historyList: {
    padding: 16,
  },
  emptyHistory: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyHistoryEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyHistoryText: {
    fontSize: 15,
  },
  historyListItem: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  historyListItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  historyListAvatar: {
    fontSize: 32,
  },
  historyListItemInfo: {
    flex: 1,
  },
  historyListItemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyListItemRole: {
    fontSize: 13,
    marginTop: 2,
  },
  historyListStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 5,
  },
  historyListStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  historyListStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyListItemMeta: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  historyMetaItem: {
    flex: 1,
  },
  historyMetaLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  historyMetaValue: {
    fontSize: 13,
    fontWeight: '600',
  },
})
