/**
 * Settings - With language selection
 */

import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, Switch, Modal, FlatList } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { 
  FadeIn, 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring 
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../src/stores/settingsStore'
import { usePairingStore } from '../src/stores/pairingStore'
import { useLanguageStore } from '../src/stores/languageStore'
import { Language, languageNames } from '../src/i18n/translations'

function SettingRow({ 
  label, 
  description, 
  value, 
  onToggle,
}: { 
  label: string
  description?: string
  value: boolean
  onToggle: () => void
}) {
  return (
    <Pressable style={styles.settingRow} onPress={onToggle}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDesc}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E5E5', true: '#1a1a1a' }}
        thumbColor="#fff"
        ios_backgroundColor="#E5E5E5"
      />
    </Pressable>
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
  const scale = useSharedValue(1)
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      onPress={onSelect}
      onPressIn={() => { scale.value = withSpring(0.97) }}
      onPressOut={() => { scale.value = withSpring(1) }}
    >
      <Animated.View style={[styles.languageOption, selected && styles.languageOptionSelected, animatedStyle]}>
        <Text style={[styles.languageText, selected && styles.languageTextSelected]}>{name}</Text>
        {selected && <Text style={styles.checkmark}>✓</Text>}
      </Animated.View>
    </Pressable>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Camera Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.settings.camera}</Text>
        <View style={styles.card}>
          <SettingRow
            label={t.settings.gridOverlay}
            description={t.settings.gridDesc}
            value={settings.showGrid}
            onToggle={() => toggleSetting('showGrid')}
          />
          <View style={styles.divider} />
          <SettingRow
            label={t.settings.flash}
            description={t.settings.flashDesc}
            value={settings.flash}
            onToggle={() => toggleSetting('flash')}
          />
          <View style={styles.divider} />
          <SettingRow
            label={t.settings.sound}
            value={settings.sound}
            onToggle={() => toggleSetting('sound')}
          />
          <View style={styles.divider} />
          <SettingRow
            label={t.settings.autoSave}
            value={settings.autoSave}
            onToggle={() => toggleSetting('autoSave')}
          />
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.settings.language}</Text>
        <Pressable style={styles.card} onPress={() => setShowLanguageModal(true)}>
          <View style={styles.languageRow}>
            <Text style={styles.settingLabel}>{t.settings.selectLanguage}</Text>
            <View style={styles.languageValue}>
              <Text style={styles.languageValueText}>{languageNames[language]}</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>
        </Pressable>
      </View>

      {/* Connection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.settings.connection}</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>{t.profile.status}</Text>
            <View style={styles.statusValue}>
              <View style={[
                styles.statusDot,
                isPaired ? styles.statusDotOn : styles.statusDotOff
              ]} />
              <Text style={styles.infoValue}>
                {isPaired ? t.profile.connected : t.profile.notConnected}
              </Text>
            </View>
          </View>
          
          <View style={styles.divider} />
          
          {isPaired ? (
            <Pressable style={styles.actionRow} onPress={handleUnpair}>
              <Text style={styles.actionTextDanger}>{t.profile.disconnect}</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.actionRow} onPress={() => router.replace('/pairing')}>
              <Text style={styles.actionText}>{t.profile.connect}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* About */}
      <View style={styles.footer}>
        <Text style={styles.appName}>{t.appName}</Text>
        <Text style={styles.version}>v1.0.0</Text>
        <Text style={styles.taglineFooter}>{t.tagline}</Text>
      </View>

      {/* Language Modal */}
      <Modal
        visible={showLanguageModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.settings.selectLanguage}</Text>
            <Pressable style={styles.modalClose} onPress={() => setShowLanguageModal(false)}>
              <Text style={styles.modalCloseText}>{t.common.done}</Text>
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
    backgroundColor: '#FAFAFA',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 1,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  settingDesc: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  languageValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  languageValueText: {
    fontSize: 16,
    color: '#666',
  },
  chevron: {
    fontSize: 20,
    color: '#CCC',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  infoLabel: {
    fontSize: 16,
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    color: '#1a1a1a',
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
  statusDotOn: {
    backgroundColor: '#22C55E',
  },
  statusDotOff: {
    backgroundColor: '#DC2626',
  },
  actionRow: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 16,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  actionTextDanger: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '500',
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 24,
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  version: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  taglineFooter: {
    fontSize: 12,
    color: '#AAA',
    marginTop: 8,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalClose: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  languageList: {
    padding: 20,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 4,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  languageOptionSelected: {
    borderColor: '#1a1a1a',
    backgroundColor: '#1a1a1a',
  },
  languageText: {
    fontSize: 17,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  languageTextSelected: {
    color: '#fff',
  },
  checkmark: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
})
