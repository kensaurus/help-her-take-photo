/**
 * Settings - Clean, minimal design with icons
 */

import { useState } from 'react'
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

export default function SettingsScreen() {
  const router = useRouter()
  const { colors, mode, toggleMode } = useThemeStore()
  const { settings, updateSettings } = useSettingsStore()
  const { isPaired, clearPairing } = usePairingStore()
  const { language, setLanguage, t } = useLanguageStore()
  const [showLanguageModal, setShowLanguageModal] = useState(false)

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
        {/* Appearance */}
        <Animated.View entering={FadeIn.delay(50).duration(200)} style={styles.section}>
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
        <Animated.View entering={FadeIn.delay(80).duration(200)} style={styles.section}>
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
        <Animated.View entering={FadeIn.delay(110).duration(200)} style={styles.section}>
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
        <Animated.View entering={FadeIn.delay(140).duration(200)} style={styles.section}>
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

        {/* Connection */}
        <Animated.View entering={FadeIn.delay(170).duration(200)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.connection.toUpperCase()}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
                {t.profile.status}
              </Text>
              <View style={styles.statusValue}>
                <View style={[
                  styles.statusDot,
                  { backgroundColor: isPaired ? colors.success : colors.error }
                ]} />
                <Text style={[styles.infoValue, { color: colors.text }]}>
                  {isPaired ? t.profile.connected : t.profile.notConnected}
                </Text>
              </View>
            </View>
            
            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
            
            {isPaired ? (
              <Pressable 
                style={styles.actionRow} 
                onPress={handleUnpair}
              >
                <Text style={[styles.actionTextDanger, { color: colors.error }]}>
                  {t.profile.disconnect}
                </Text>
              </Pressable>
            ) : (
              <Pressable 
                style={styles.actionRow} 
                onPress={() => router.replace('/pairing')}
              >
                <Text style={[styles.actionText, { color: colors.accent }]}>
                  {t.profile.connect}
                </Text>
              </Pressable>
            )}
          </View>
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionTextDanger: {
    fontSize: 15,
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
})
