/**
 * Push Notifications Service
 * Uses expo-notifications for push notification handling
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { logger } from './logging'

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

/**
 * Push token type
 */
export interface PushToken {
  token: string
  type: 'expo' | 'fcm' | 'apns'
}

/**
 * Notification data
 */
export interface NotificationData {
  title: string
  body: string
  data?: Record<string, unknown>
  sound?: boolean
  badge?: number
}

/**
 * Notifications Service
 */
export const notificationService = {
  /**
   * Register for push notifications
   * Returns the Expo push token
   */
  async registerForPushNotifications(): Promise<PushToken | null> {
    // Must be a physical device
    if (!Device.isDevice) {
      logger.warn('Push notifications require a physical device')
      return null
    }

    try {
      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      // Request permission if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        logger.warn('Push notification permission not granted')
        return null
      }

      // Get the token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      })

      logger.info('Push token registered', { token: tokenData.data.slice(0, 20) + '...' })

      // Configure Android channel
      if (Platform.OS === 'android') {
        await this.createAndroidChannel()
      }

      return {
        token: tokenData.data,
        type: 'expo',
      }
    } catch (error) {
      logger.error('Failed to register for push notifications', error)
      return null
    }
  },

  /**
   * Create Android notification channel
   */
  async createAndroidChannel() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
      sound: 'default',
      enableVibrate: true,
      enableLights: true,
    })

    await Notifications.setNotificationChannelAsync('photo-session', {
      name: 'Photo Sessions',
      description: 'Notifications about photo sessions',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B6B',
      sound: 'default',
    })
  },

  /**
   * Schedule a local notification
   */
  async scheduleLocalNotification(
    notification: NotificationData,
    trigger?: Notifications.NotificationTriggerInput
  ): Promise<string> {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        sound: notification.sound !== false,
        badge: notification.badge,
      },
      trigger: trigger || null, // null = immediate
    })

    logger.trackAction('notification_scheduled', { id, title: notification.title })
    return id
  },

  /**
   * Cancel a scheduled notification
   */
  async cancelNotification(id: string) {
    await Notifications.cancelScheduledNotificationAsync(id)
  },

  /**
   * Cancel all notifications
   */
  async cancelAllNotifications() {
    await Notifications.cancelAllScheduledNotificationsAsync()
  },

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync()
  },

  /**
   * Set badge count
   */
  async setBadgeCount(count: number) {
    await Notifications.setBadgeCountAsync(count)
  },

  /**
   * Clear badge
   */
  async clearBadge() {
    await Notifications.setBadgeCountAsync(0)
  },

  /**
   * Add notification received listener
   */
  addNotificationReceivedListener(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback)
  },

  /**
   * Add notification response listener (when user taps notification)
   */
  addNotificationResponseListener(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback)
  },

  /**
   * Get last notification response (for app opened via notification)
   */
  async getLastNotificationResponse() {
    return await Notifications.getLastNotificationResponseAsync()
  },

  /**
   * Send notification for partner connected
   */
  async notifyPartnerConnected(partnerName?: string) {
    await this.scheduleLocalNotification({
      title: 'Partner Connected! 📸',
      body: partnerName 
        ? `${partnerName} is ready for the photo session`
        : 'Your partner is ready for the photo session',
      data: { type: 'partner_connected' },
    })
  },

  /**
   * Send notification for photo captured
   */
  async notifyPhotoCaptured() {
    await this.scheduleLocalNotification({
      title: 'Photo Captured! ✨',
      body: 'A new photo has been saved to your gallery',
      data: { type: 'photo_captured' },
    })
  },

  /**
   * Send notification for session ended
   */
  async notifySessionEnded(photoCount: number) {
    await this.scheduleLocalNotification({
      title: 'Session Complete 🎉',
      body: `${photoCount} photos captured. Another scolding avoided!`,
      data: { type: 'session_ended', photoCount },
    })
  },
}

/**
 * Hook to use notification listeners
 */
export function useNotificationListeners(
  onReceived?: (notification: Notifications.Notification) => void,
  onResponse?: (response: Notifications.NotificationResponse) => void
) {
  // These should be set up in useEffect
  return {
    setupListeners: () => {
      const subscriptions: Notifications.Subscription[] = []

      if (onReceived) {
        subscriptions.push(
          notificationService.addNotificationReceivedListener(onReceived)
        )
      }

      if (onResponse) {
        subscriptions.push(
          notificationService.addNotificationResponseListener(onResponse)
        )
      }

      return () => {
        subscriptions.forEach(sub => sub.remove())
      }
    },
  }
}





