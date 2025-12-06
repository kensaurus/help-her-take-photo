/**
 * Changelog - What's new in the app
 */

import { ScrollView, View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated'
import { useThemeStore } from '../src/stores/themeStore'
import { CHANGELOG, getBuildInfo } from '../src/config/build'

export default function ChangelogScreen() {
  const { colors } = useThemeStore()
  const buildInfo = getBuildInfo()

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Current Version */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Text style={[styles.currentVersion, { color: colors.text }]}>
            {buildInfo.fullVersion}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Current version
          </Text>
        </Animated.View>

        {/* Changelog Entries */}
        {CHANGELOG.map((entry, index) => (
          <Animated.View 
            key={entry.version}
            entering={FadeInUp.delay(index * 80).duration(300)}
            style={[styles.entry, { borderColor: colors.border }]}
          >
            <View style={styles.entryHeader}>
              <Text style={[styles.entryVersion, { color: colors.text }]}>
                v{entry.version}
              </Text>
              <Text style={[styles.entryDate, { color: colors.textMuted }]}>
                {entry.date}
              </Text>
            </View>
            
            <Text style={[styles.entryBuild, { color: colors.textMuted }]}>
              Build {entry.build}
            </Text>
            
            <View style={styles.changesList}>
              {entry.changes.map((change, i) => (
                <Text 
                  key={i} 
                  style={[styles.changeItem, { color: colors.textSecondary }]}
                >
                  {change}
                </Text>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Thank you for using Help Her Take Photo!
          </Text>
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
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 16,
  },
  currentVersion: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  entry: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  entryVersion: {
    fontSize: 18,
    fontWeight: '600',
  },
  entryDate: {
    fontSize: 13,
  },
  entryBuild: {
    fontSize: 12,
    marginBottom: 12,
  },
  changesList: {
    gap: 6,
  },
  changeItem: {
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  footerText: {
    fontSize: 13,
  },
})

