/**
 * Security Service - Secure storage and biometric authentication
 * Uses expo-secure-store for encrypted key-value storage
 */

import * as SecureStore from 'expo-secure-store'
import * as LocalAuthentication from 'expo-local-authentication'
import { Platform } from 'react-native'

// Storage keys
const KEYS = {
  USER_TOKEN: 'user_token',
  DEVICE_ID: 'device_id',
  PARTNER_ID: 'partner_id',
  SESSION_KEY: 'session_key',
  PREFERENCES: 'secure_preferences',
} as const

/**
 * Secure Storage Service
 * Encrypts data using iOS Keychain / Android Keystore
 */
export const secureStorage = {
  /**
   * Store a value securely
   */
  async set(key: string, value: string): Promise<boolean> {
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED,
      })
      return true
    } catch (error) {
      console.error('SecureStore set error:', error)
      return false
    }
  },

  /**
   * Retrieve a secure value
   */
  async get(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key)
    } catch (error) {
      console.error('SecureStore get error:', error)
      return null
    }
  },

  /**
   * Delete a secure value
   */
  async delete(key: string): Promise<boolean> {
    try {
      await SecureStore.deleteItemAsync(key)
      return true
    } catch (error) {
      console.error('SecureStore delete error:', error)
      return false
    }
  },

  /**
   * Store user authentication token
   */
  async setToken(token: string): Promise<boolean> {
    return this.set(KEYS.USER_TOKEN, token)
  },

  /**
   * Get user authentication token
   */
  async getToken(): Promise<string | null> {
    return this.get(KEYS.USER_TOKEN)
  },

  /**
   * Store device pairing info
   */
  async setPairingInfo(deviceId: string, partnerId?: string): Promise<boolean> {
    const results = await Promise.all([
      this.set(KEYS.DEVICE_ID, deviceId),
      partnerId ? this.set(KEYS.PARTNER_ID, partnerId) : Promise.resolve(true),
    ])
    return results.every(Boolean)
  },

  /**
   * Clear all secure data (logout)
   */
  async clearAll(): Promise<void> {
    await Promise.all([
      this.delete(KEYS.USER_TOKEN),
      this.delete(KEYS.PARTNER_ID),
      this.delete(KEYS.SESSION_KEY),
    ])
  },
}

/**
 * Biometric Authentication Service
 */
export const biometricAuth = {
  /**
   * Check if biometric authentication is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync()
      if (!compatible) return false

      const enrolled = await LocalAuthentication.isEnrolledAsync()
      return enrolled
    } catch {
      return false
    }
  },

  /**
   * Get supported authentication types
   */
  async getSupportedTypes(): Promise<LocalAuthentication.AuthenticationType[]> {
    try {
      return await LocalAuthentication.supportedAuthenticationTypesAsync()
    } catch {
      return []
    }
  },

  /**
   * Authenticate user with biometrics
   */
  async authenticate(
    promptMessage = 'Authenticate to continue'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const available = await this.isAvailable()
      if (!available) {
        return { success: false, error: 'Biometric authentication not available' }
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel: 'Cancel',
        disableDeviceFallback: false,
        fallbackLabel: 'Use passcode',
      })

      if (result.success) {
        return { success: true }
      }

      return {
        success: false,
        error: result.error || 'Authentication failed',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  /**
   * Get biometric type name for UI
   */
  async getBiometricTypeName(): Promise<string> {
    const types = await this.getSupportedTypes()
    
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition'
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint'
    }
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return 'Iris Recognition'
    }
    
    return 'Biometric'
  },
}

/**
 * Security utilities
 */
export const securityUtils = {
  /**
   * Generate a secure random string
   */
  generateSecureId(length = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },

  /**
   * Hash a string (simple hash for non-cryptographic use)
   */
  simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  },

  /**
   * Sanitize user input
   */
  sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .trim()
  },

  /**
   * Validate URL is safe
   */
  isSafeUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  },
}





