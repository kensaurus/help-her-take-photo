/**
 * Debug Menu - Development-only debugging tools
 * 
 * Provides quick access to:
 * - Auth state inspection
 * - Storage management
 * - Log viewing
 * - Network state
 * - Crash testing
 */

import React, { useState, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SecureStore from 'expo-secure-store'
import NetInfo from '@react-native-community/netinfo'
import { supabase, getDeviceId, clearDeviceId } from '../../services/supabase'
import { sessionLogger } from '../../services/sessionLogger'
import { logger } from '../../services/logging'
import { usePairingStore } from '../../stores/pairingStore'
import { useThemeStore } from '../../stores/themeStore'
import { captureException } from '../../services/errorTracking'

// Only render in development
const IS_DEV = __DEV__

interface DebugMenuProps {
  /** Trigger element (default: floating button) */
  trigger?: React.ReactNode
}

export function DebugMenu({ trigger }: DebugMenuProps) {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'auth' | 'storage' | 'logs' | 'network'>('auth')
  const [info, setInfo] = useState<string>('')
  
  const { colors } = useThemeStore()
  const { myDeviceId, isPaired, sessionId, pairedDeviceId } = usePairingStore()

  // Don't render in production
  if (!IS_DEV) return null

  const showInfo = useCallback((content: string) => {
    setInfo(content)
  }, [])

  // Auth tab handlers
  const handleShowSession = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const deviceId = await getDeviceId()
      showInfo(JSON.stringify({
        session: data.session ? {
          userId: data.session.user.id,
          expiresAt: data.session.expires_at,
          isAnonymous: data.session.user.is_anonymous,
        } : null,
        deviceId,
        isPaired,
        sessionId: sessionId?.substring(0, 8),
        pairedDeviceId: pairedDeviceId?.substring(0, 8),
      }, null, 2))
    } catch (error) {
      showInfo(`Error: ${error}`)
    }
    setLoading(false)
  }, [isPaired, sessionId, pairedDeviceId, showInfo])

  const handleRefreshToken = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.refreshSession()
      if (error) throw error
      showInfo(`Token refreshed!\nNew expiry: ${data.session?.expires_at}`)
    } catch (error) {
      showInfo(`Refresh failed: ${error}`)
    }
    setLoading(false)
  }, [showInfo])

  const handleSignOut = useCallback(async () => {
    Alert.alert(
      'Sign Out',
      'This will clear your session. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
            showInfo('Signed out')
          },
        },
      ]
    )
  }, [showInfo])

  // Storage tab handlers
  const handleShowStorage = useCallback(async () => {
    setLoading(true)
    try {
      const keys = await AsyncStorage.getAllKeys()
      const items = await AsyncStorage.multiGet(keys)
      const storage: Record<string, unknown> = {}
      items.forEach(([key, value]) => {
        try {
          storage[key] = value ? JSON.parse(value) : null
        } catch {
          storage[key] = value?.substring(0, 100)
        }
      })
      showInfo(JSON.stringify(storage, null, 2))
    } catch (error) {
      showInfo(`Error: ${error}`)
    }
    setLoading(false)
  }, [showInfo])

  const handleClearStorage = useCallback(() => {
    Alert.alert(
      'Clear Storage',
      'This will clear ALL app data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear()
            await clearDeviceId()
            showInfo('Storage cleared!')
          },
        },
      ]
    )
  }, [showInfo])

  const handleShowSecureStorage = useCallback(async () => {
    setLoading(true)
    try {
      const deviceId = await SecureStore.getItemAsync('secure_device_id')
      showInfo(JSON.stringify({
        secure_device_id: deviceId?.substring(0, 8) + '...',
      }, null, 2))
    } catch (error) {
      showInfo(`SecureStore error: ${error}`)
    }
    setLoading(false)
  }, [showInfo])

  // Logs tab handlers
  const handleShowLogs = useCallback(() => {
    const logs = logger.getRecentLogs()
    showInfo(JSON.stringify(logs.slice(-20), null, 2))
  }, [showInfo])

  const handleClearLogs = useCallback(() => {
    logger.clearLogs()
    showInfo('Logs cleared')
  }, [showInfo])

  const handleFlushLogs = useCallback(async () => {
    setLoading(true)
    try {
      await sessionLogger.flush()
      showInfo('Logs flushed to Supabase')
    } catch (error) {
      showInfo(`Flush error: ${error}`)
    }
    setLoading(false)
  }, [showInfo])

  // Network tab handlers
  const handleShowNetwork = useCallback(async () => {
    setLoading(true)
    try {
      const state = await NetInfo.fetch()
      showInfo(JSON.stringify({
        isConnected: state.isConnected,
        type: state.type,
        isInternetReachable: state.isInternetReachable,
        details: state.details,
      }, null, 2))
    } catch (error) {
      showInfo(`Error: ${error}`)
    }
    setLoading(false)
  }, [showInfo])

  const handleTestSupabase = useCallback(async () => {
    setLoading(true)
    try {
      const start = Date.now()
      const { error } = await supabase.from('devices').select('count').limit(1)
      const duration = Date.now() - start
      
      if (error) {
        showInfo(`Supabase error: ${error.message}`)
      } else {
        showInfo(`Supabase OK! Latency: ${duration}ms`)
      }
    } catch (error) {
      showInfo(`Connection error: ${error}`)
    }
    setLoading(false)
  }, [showInfo])

  // Test crash (for Sentry)
  const handleTestCrash = useCallback(() => {
    Alert.alert(
      'Test Crash',
      'This will throw an error to test error tracking.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash',
          style: 'destructive',
          onPress: () => {
            const error = new Error('Test crash from Debug Menu')
            captureException(error, { source: 'debug_menu' })
            throw error
          },
        },
      ]
    )
  }, [])

  const renderTab = () => {
    switch (activeTab) {
      case 'auth':
        return (
          <View style={styles.tabContent}>
            <DebugButton title="Show Session" onPress={handleShowSession} />
            <DebugButton title="Refresh Token" onPress={handleRefreshToken} />
            <DebugButton title="Sign Out" onPress={handleSignOut} destructive />
          </View>
        )
      case 'storage':
        return (
          <View style={styles.tabContent}>
            <DebugButton title="Show AsyncStorage" onPress={handleShowStorage} />
            <DebugButton title="Show SecureStore" onPress={handleShowSecureStorage} />
            <DebugButton title="Clear All Storage" onPress={handleClearStorage} destructive />
          </View>
        )
      case 'logs':
        return (
          <View style={styles.tabContent}>
            <DebugButton title="Show Recent Logs" onPress={handleShowLogs} />
            <DebugButton title="Flush to Supabase" onPress={handleFlushLogs} />
            <DebugButton title="Clear Local Logs" onPress={handleClearLogs} />
          </View>
        )
      case 'network':
        return (
          <View style={styles.tabContent}>
            <DebugButton title="Show Network State" onPress={handleShowNetwork} />
            <DebugButton title="Test Supabase" onPress={handleTestSupabase} />
            <DebugButton title="Test Crash (Sentry)" onPress={handleTestCrash} destructive />
          </View>
        )
    }
  }

  return (
    <>
      {/* Trigger */}
      {trigger ? (
        <Pressable onPress={() => setVisible(true)}>{trigger}</Pressable>
      ) : (
        <Pressable
          style={styles.floatingButton}
          onPress={() => setVisible(true)}
        >
          <Text style={styles.floatingButtonText}>🐛</Text>
        </Pressable>
      )}

      {/* Modal */}
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={[styles.modal, { backgroundColor: colors.card }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Debug Menu</Text>
              <Pressable onPress={() => setVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
              {(['auth', 'storage', 'logs', 'network'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  style={[
                    styles.tab,
                    activeTab === tab && styles.activeTab,
                  ]}
                  onPress={() => {
                    setActiveTab(tab)
                    setInfo('')
                  }}
                >
                  <Text
                    style={[
                      styles.tabText,
                      { color: activeTab === tab ? colors.primary : colors.textSecondary },
                    ]}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Tab Content */}
            {loading ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              renderTab()
            )}

            {/* Info Output */}
            {info ? (
              <ScrollView style={styles.infoContainer}>
                <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                  {info}
                </Text>
              </ScrollView>
            ) : null}

            {/* Device Info */}
            <View style={styles.deviceInfo}>
              <Text style={[styles.deviceInfoText, { color: colors.textSecondary }]}>
                Device: {myDeviceId?.substring(0, 8)}...
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  )
}

// Debug button component
function DebugButton({
  title,
  onPress,
  destructive,
}: {
  title: string
  onPress: () => void
  destructive?: boolean
}) {
  return (
    <Pressable
      style={[styles.button, destructive && styles.destructiveButton]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, destructive && styles.destructiveButtonText]}>
        {title}
      </Text>
    </Pressable>
  )
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    zIndex: 1000,
  },
  floatingButtonText: {
    fontSize: 24,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    maxHeight: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#888',
  },
  tabs: {
    flexDirection: 'row',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#22c55e',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    gap: 8,
  },
  button: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  destructiveButton: {
    backgroundColor: '#dc2626',
  },
  destructiveButtonText: {
    color: '#fff',
  },
  loader: {
    padding: 20,
  },
  infoContainer: {
    marginTop: 16,
    maxHeight: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
  },
  infoText: {
    fontFamily: 'monospace',
    fontSize: 11,
  },
  deviceInfo: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  deviceInfoText: {
    fontSize: 12,
    textAlign: 'center',
  },
})

export default DebugMenu
