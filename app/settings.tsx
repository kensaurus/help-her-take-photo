/**
 * Settings - With language and theme selection
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
    <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
      <Pressable 
        style={styles.settingRow} 
        onPress={onToggle}
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 15 })
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
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
            ios_backgroundColor={colors.border}
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
        scale.value = withSpring(0.97, { damping: 15 }) 
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
        <Animated.View entering={FadeIn.delay(50).duration(300)} style={styles.section}>
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
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
                <Text style={[styles.settingDesc, { color: colors.textMuted }]}>
                  {mode === 'dark' ? 'Currently dark' : 'Currently light'}
                </Text>
              </View>
              <Switch
                value={mode === 'dark'}
                onValueChange={toggleMode}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.surface}
                ios_backgroundColor={colors.border}
              />
            </Pressable>
          </View>
        </Animated.View>

        {/* Camera Settings */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.section}>
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
        <Animated.View entering={FadeIn.delay(150).duration(300)} style={styles.section}>
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
        <Animated.View entering={FadeIn.delay(200).duration(300)} style={styles.section}>
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
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.actionTextDanger, { color: colors.error }]}>
                  {t.profile.disconnect}
                </Text>
              </Pressable>
            ) : (
              <Pressable 
                style={styles.actionRow} 
                onPress={() => router.replace('/pairing')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.actionText, { color: colors.accent }]}>
                  {t.profile.connect}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeIn.delay(250).duration(300)} style={styles.footer}>
          <Text style={[styles.appName, { color: colors.text }]}>{t.appName}</Text>
          <Text style={[styles.version, { color: colors.textMuted }]}>v1.0.0</Text>
          <Text style={[styles.taglineFooter, { color: colors.textMuted }]}>
            {t.tagline}
          </Text>
          
          <Pressable 
            style={styles.creditLink}
            onPress={() => Linking.openURL('https://kensaur.us')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
    paddingBottom: 40,
  },
  section: {
    marginTop: 28,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingRow: {
    minHeight: 64,
  },
  settingRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 14,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginHorizontal: 20,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    minHeight: 64,
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageValueText: {
    fontSize: 16,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '300',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
    minHeight: 64,
  },
  infoLabel: {
    fontSize: 16,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  statusValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionRow: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    minHeight: 56,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 17,
    fontWeight: '600',
  },
  actionTextDanger: {
    fontSize: 17,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  appName: {
    fontSize: 17,
    fontWeight: '700',
  },
  version: {
    fontSize: 14,
    marginTop: 4,
  },
  taglineFooter: {
    fontSize: 13,
    marginTop: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
  },
  creditLink: {
    marginTop: 24,
    paddingVertical: 8,
  },
  creditText: {
    fontSize: 13,
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalClose: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCloseText: {
    fontSize: 17,
    fontWeight: '600',
  },
  languageList: {
    padding: 24,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  languageText: {
    fontSize: 18,
    fontWeight: '500',
  },
  checkmark: {
    fontSize: 18,
    fontWeight: '700',
  },
})
