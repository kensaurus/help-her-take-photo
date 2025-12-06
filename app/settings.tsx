/**
 * Settings - Clean, minimal design
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
  withSpring 
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../src/stores/settingsStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { useThemeStore } from '../src/stores/themeStore'
import { Language, languageNames } from '../src/i18n/translations'
import { getBuildInfo } from '../src/config/build'

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
  const { colors } = useThemeStore()
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(250)}>
      <Pressable 
        style={styles.settingRow} 
        onPress={onToggle}
        onPressIn={() => {
          scale.value = withSpring(0.99, { damping: 15 })
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 15 })
        }}
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
            trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
            thumbColor={colors.switchThumb}
            ios_backgroundColor={colors.switchTrackOff}
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
          <Text style={[styles.checkmark, { color: colors.primaryText }]}>✓</Text>
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
        <Animated.View entering={FadeIn.delay(50).duration(250)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            APPEARANCE
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.settingRow}>
              <View style={styles.settingRowInner}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                  <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                    {mode === 'dark' ? 'On' : 'Off'}
                  </Text>
                </View>
                <Switch
                  value={mode === 'dark'}
                  onValueChange={() => {
                    toggleMode()
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
                  }}
                  trackColor={{ false: colors.switchTrackOff, true: colors.switchTrackOn }}
                  thumbColor={colors.switchThumb}
                  ios_backgroundColor={colors.switchTrackOff}
                />
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Camera Settings */}
        <Animated.View entering={FadeIn.delay(80).duration(250)} style={styles.section}>
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

        {/* Language */}
        <Animated.View entering={FadeIn.delay(110).duration(250)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            {t.settings.language.toUpperCase()}
          </Text>
          <Pressable 
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} 
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.languageRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                {t.settings.selectLanguage}
              </Text>
              <View style={styles.languageValue}>
                <Text style={[styles.languageValueText, { color: colors.textSecondary }]}>
                  {languageNames[language]}
                </Text>
                <Text style={[styles.chevron, { color: colors.textMuted }]}>→</Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Connection */}
        <Animated.View entering={FadeIn.delay(140).duration(250)} style={styles.section}>
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
        <Animated.View entering={FadeIn.delay(170).duration(250)} style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>
            FEEDBACK
          </Text>
          <Pressable 
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} 
            onPress={() => router.push('/feedback')}
          >
            <View style={styles.languageRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                Send Feedback
              </Text>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>→</Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeIn.delay(200).duration(250)} style={styles.footer}>
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
              © 2025 kensaur.us
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
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageValueText: {
    fontSize: 15,
  },
  chevron: {
    fontSize: 16,
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
    fontSize: 12,
    fontWeight: '500',
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
  checkmark: {
    fontSize: 16,
    fontWeight: '600',
  },
})
