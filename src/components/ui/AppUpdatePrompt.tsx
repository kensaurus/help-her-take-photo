import React from 'react'
import { View, Text, StyleSheet, Modal, Linking } from 'react-native'
import { useAppUpdate } from '../../hooks/useAppUpdate'
import { PressableScale } from './PressableScale'
import { Icon } from './Icon'
import { getBuildInfo } from '../../config/build'

export function AppUpdatePrompt() {
  const { isUpdateAvailable, latestVersion, loading } = useAppUpdate()
  const [isVisible, setIsVisible] = React.useState(true)
  const buildInfo = getBuildInfo()

  if (loading || !isUpdateAvailable || !latestVersion) {
    return null
  }

  const handleUpdate = () => {
    if (latestVersion.download_url) {
      Linking.openURL(latestVersion.download_url)
    }
  }

  const handleDismiss = () => {
    if (!latestVersion.force_update) {
      setIsVisible(false)
    }
  }

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={handleDismiss}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon name="download" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Update Available</Text>
          </View>

          <Text style={styles.versionText}>
            New: v{latestVersion.version} ({latestVersion.build_number || 'latest'})
          </Text>
          <Text style={styles.currentVersion}>
            Current: {buildInfo.fullVersion}
          </Text>
          
          {latestVersion.changelog && (
            <Text style={styles.changelog}>
              {latestVersion.changelog}
            </Text>
          )}

          <View style={styles.buttonContainer}>
            {!latestVersion.force_update && (
              <PressableScale
                style={[styles.button, styles.buttonClose]}
                onPress={handleDismiss}
              >
                <Text style={styles.textStyleCancel}>Later</Text>
              </PressableScale>
            )}
            
            <PressableScale
              style={[styles.button, styles.buttonUpdate]}
              onPress={handleUpdate}
            >
              <Text style={styles.textStyleUpdate}>Update Now</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: '85%',
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  versionText: {
    fontSize: 16,
    marginBottom: 4,
    textAlign: 'center',
    color: '#000',
    fontWeight: '600',
  },
  currentVersion: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    color: '#888',
  },
  changelog: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 24,
    backgroundColor: '#F5F5F5',
    padding: 12,
    borderRadius: 12,
    width: '100%',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonUpdate: {
    backgroundColor: '#000',
  },
  buttonClose: {
    backgroundColor: '#F0F0F0',
  },
  textStyleUpdate: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  textStyleCancel: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
})
