/**
 * Enhanced Haptic Feedback Utility
 * Based on Google Material Design Sound & Haptics guidelines
 * 
 * Key principles:
 * - Use silence intentionally (not every action needs feedback)
 * - Different haptic types for different actions
 * - Keep feedback under 8ms for satisfaction
 * - Support reduced motion/haptics accessibility
 */

import * as Haptics from 'expo-haptics'
import { useSettingsStore } from '../stores/settingsStore'

export type HapticType = 
  | 'selection'    // Light tap for selections, toggles
  | 'success'      // Celebration for completed actions
  | 'warning'      // Alert for warnings
  | 'error'        // Strong feedback for errors
  | 'impact'       // Button presses
  | 'tick'         // Scrolling through items
  | 'none'         // No feedback

/**
 * Trigger haptic feedback with accessibility support
 */
export async function triggerHaptic(type: HapticType): Promise<void> {
  // Check if haptics are disabled
  const { settings } = useSettingsStore.getState()
  if (settings.reduceHaptics || type === 'none') {
    return
  }

  try {
    switch (type) {
      case 'selection':
        // Light, quick feedback for toggles and selections
        await Haptics.selectionAsync()
        break
        
      case 'success':
        // Celebratory pattern: quick-quick-medium
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        break
        
      case 'warning':
        // Alert pattern
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        break
        
      case 'error':
        // Strong error feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        break
        
      case 'impact':
        // Standard button press
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        break
        
      case 'tick':
        // Very light for scrolling/progress
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        break
    }
  } catch (error) {
    // Silently fail - haptics are enhancement only
    console.debug('[Haptics] Failed:', error)
  }
}

/**
 * Haptic feedback for button presses with intensity levels
 */
export async function buttonHaptic(intensity: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  const { settings } = useSettingsStore.getState()
  if (settings.reduceHaptics) return

  try {
    const style = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    }[intensity]
    
    await Haptics.impactAsync(style)
  } catch {
    // Silent fail
  }
}

/**
 * Success celebration - use for completed tasks
 * Creates a satisfying "doompf" feeling
 */
export async function celebrateSuccess(): Promise<void> {
  const { settings } = useSettingsStore.getState()
  if (settings.reduceHaptics) return

  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  } catch {
    // Silent fail
  }
}

/**
 * Error shake pattern - strong feedback for errors
 */
export async function errorShake(): Promise<void> {
  const { settings } = useSettingsStore.getState()
  if (settings.reduceHaptics) return

  try {
    // Quick double tap for errors
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
  } catch {
    // Silent fail
  }
}

/**
 * Selection tick - very light feedback for item selection
 */
export async function selectionTick(): Promise<void> {
  const { settings } = useSettingsStore.getState()
  if (settings.reduceHaptics) return

  try {
    await Haptics.selectionAsync()
  } catch {
    // Silent fail
  }
}

