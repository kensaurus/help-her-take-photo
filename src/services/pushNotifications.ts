/**
 * Push Notifications Service
 * 
 * Handles Expo Push Notifications registration and token management.
 * Works with the send-notification Edge Function for sending.
 */

import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { deviceApi } from './api'
import { logger } from './logging'

// ─────────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────────

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface PushNotificationData {
  type?: 'photo_captured' | 'session_invite' | 'friend_request' | 'general'
  count?: number
  sessionId?: string
  partnerDeviceId?: string
  [key: string]: unknown
}

export type NotificationListener = (notification: Notifications.Notification) => void
export type NotificationResponseListener = (response: Notifications.NotificationResponse) => void

// ─────────────────────────────────────────────────────────────────────────────────
// Push Notifications Service
// ─────────────────────────────────────────────────────────────────────────────────

class PushNotificationsService {
  private token: string | null = null
  private deviceId: string | null = null
  private notificationListener: Notifications.Subscription | null = null
  private responseListener: Notifications.Subscription | null = null

  /**
   * Register for push notifications and get token
   */
  async register(deviceId: string): Promise<string | null> {
    this.deviceId = deviceId

    // Must be a physical device
    if (!Device.isDevice) {
      logger.warn('push_notifications_unavailable', { reason: 'not_physical_device' })
      return null
    }

    try {
      // Check current permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync()
      let finalStatus = existingStatus

      // Request if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync()
        finalStatus = status
      }

      if (finalStatus !== 'granted') {
        logger.info('push_notifications_denied')
        return null
      }

      // Get push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      })

      this.token = tokenData.data
      logger.info('push_token_obtained', { 
        tokenPrefix: this.token.substring(0, 20),
        platform: Platform.OS,
      })

      // Update device record with push token
      await deviceApi.updatePushToken(deviceId, this.token)
      logger.info('push_token_registered')

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF6B6B',
          sound: 'default',
        })
      }

      return this.token
    } catch (error) {
      logger.error('push_registration_error', error)
      return null
    }
  }

  /**
   * Get the current push token
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * Add listener for received notifications (when app is in foreground)
   */
  addNotificationListener(callback: NotificationListener): () => void {
    this.notificationListener = Notifications.addNotificationReceivedListener(callback)
    
    return () => {
      if (this.notificationListener) {
        Notifications.removeNotificationSubscription(this.notificationListener)
        this.notificationListener = null
      }
    }
  }

  /**
   * Add listener for notification responses (when user taps notification)
   */
  addResponseListener(callback: NotificationResponseListener): () => void {
    this.responseListener = Notifications.addNotificationResponseReceivedListener(callback)
    
    return () => {
      if (this.responseListener) {
        Notifications.removeNotificationSubscription(this.responseListener)
        this.responseListener = null
      }
    }
  }

  /**
   * Get the notification that launched the app (if any)
   */
  async getInitialNotification(): Promise<Notifications.NotificationResponse | null> {
    return await Notifications.getLastNotificationResponseAsync()
  }

  /**
   * Schedule a local notification
   */
  async scheduleLocal(params: {
    title: string
    body: string
    data?: PushNotificationData
    trigger?: Notifications.NotificationTriggerInput
  }): Promise<string> {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        data: params.data,
        sound: true,
      },
      trigger: params.trigger ?? null, // null = immediate
    })

    logger.debug('local_notification_scheduled', { identifier })
    return identifier
  }

  /**
   * Cancel a scheduled notification
   */
  async cancel(identifier: string): Promise<void> {
    await Notifications.cancelScheduledNotificationAsync(identifier)
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAll(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync()
  }

  /**
   * Get badge count
   */
  async getBadgeCount(): Promise<number> {
    return await Notifications.getBadgeCountAsync()
  }

  /**
   * Set badge count
   */
  async setBadgeCount(count: number): Promise<void> {
    await Notifications.setBadgeCountAsync(count)
  }

  /**
   * Clear all notifications from notification center
   */
  async dismissAll(): Promise<void> {
    await Notifications.dismissAllNotificationsAsync()
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener)
      this.notificationListener = null
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener)
      this.responseListener = null
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Singleton Export
// ─────────────────────────────────────────────────────────────────────────────────

export const pushNotifications = new PushNotificationsService()

// ─────────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'expo-router'

export function usePushNotifications(deviceId: string | null) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [lastNotification, setLastNotification] = useState<Notifications.Notification | null>(null)

  // Register and setup listeners
  useEffect(() => {
    if (!deviceId) return

    // Register for push
    pushNotifications.register(deviceId).then(t => {
      if (t) setToken(t)
    })

    // Listen for notifications in foreground
    const removeNotificationListener = pushNotifications.addNotificationListener((notification) => {
      setLastNotification(notification)
      logger.info('notification_received_foreground', { 
        title: notification.request.content.title,
        data: notification.request.content.data,
      })
    })

    // Listen for notification taps
    const removeResponseListener = pushNotifications.addResponseListener((response) => {
      const data = response.notification.request.content.data as PushNotificationData
      
      logger.info('notification_tapped', { type: data?.type })

      // Navigate based on notification type
      switch (data?.type) {
        case 'session_invite':
          router.push('/pairing')
          break
        case 'photo_captured':
          router.push('/gallery')
          break
        case 'friend_request':
          router.push('/friends')
          break
        default:
          // Default: go home
          router.push('/')
      }
    })

    // Check if app was opened from notification
    pushNotifications.getInitialNotification().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as PushNotificationData
        logger.info('app_opened_from_notification', { type: data?.type })
      }
    })

    return () => {
      removeNotificationListener()
      removeResponseListener()
    }
  }, [deviceId, router])

  const clearBadge = useCallback(async () => {
    await pushNotifications.setBadgeCount(0)
  }, [])

  return {
    token,
    lastNotification,
    clearBadge,
  }
}

