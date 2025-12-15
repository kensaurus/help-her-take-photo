/**
 * Validation Schemas
 * 
 * Using simple runtime validation (Zod-like patterns)
 * for input validation before API calls.
 */

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean
  data?: T
  error?: string
  fieldErrors?: Record<string, string>
}

// ─────────────────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

/**
 * Validate pairing code format (4 digits)
 */
export function isValidPairingCode(code: string): boolean {
  return /^\d{4}$/.test(code)
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Sanitize string input
 */
export function sanitizeString(str: string, maxLength = 255): string {
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim()
    .substring(0, maxLength)
}

// ─────────────────────────────────────────────────────────────────────────────────
// Schema Definitions
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Device registration input
 */
export interface DeviceRegistrationInput {
  deviceId: string
  deviceName?: string
  pushToken?: string
  locale?: string
  timezone?: string
}

export function validateDeviceRegistration(data: unknown): ValidationResult<DeviceRegistrationInput> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' }
  }

  const body = data as Record<string, unknown>
  const fieldErrors: Record<string, string> = {}

  // Required: deviceId
  if (typeof body.deviceId !== 'string' || !isValidUUID(body.deviceId)) {
    fieldErrors.deviceId = 'Invalid device ID format'
  }

  // Optional: deviceName (max 100 chars)
  if (body.deviceName !== undefined && typeof body.deviceName !== 'string') {
    fieldErrors.deviceName = 'Device name must be a string'
  }

  // Optional: pushToken
  if (body.pushToken !== undefined && typeof body.pushToken !== 'string') {
    fieldErrors.pushToken = 'Push token must be a string'
  }

  // Optional: locale (max 10 chars)
  if (body.locale !== undefined) {
    if (typeof body.locale !== 'string' || body.locale.length > 10) {
      fieldErrors.locale = 'Invalid locale format'
    }
  }

  // Optional: timezone (max 50 chars)
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== 'string' || body.timezone.length > 50) {
      fieldErrors.timezone = 'Invalid timezone format'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  return {
    success: true,
    data: {
      deviceId: body.deviceId as string,
      deviceName: body.deviceName ? sanitizeString(body.deviceName as string, 100) : undefined,
      pushToken: body.pushToken as string | undefined,
      locale: body.locale as string | undefined,
      timezone: body.timezone as string | undefined,
    },
  }
}

/**
 * Create pairing input
 */
export interface CreatePairingInput {
  deviceId: string
  role?: 'camera' | 'viewer'
}

export function validateCreatePairing(data: unknown): ValidationResult<CreatePairingInput> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' }
  }

  const body = data as Record<string, unknown>

  if (typeof body.deviceId !== 'string' || !isValidUUID(body.deviceId)) {
    return { success: false, error: 'Invalid device ID', fieldErrors: { deviceId: 'Must be a valid UUID' } }
  }

  if (body.role !== undefined && body.role !== 'camera' && body.role !== 'viewer') {
    return { success: false, error: 'Invalid role', fieldErrors: { role: 'Must be "camera" or "viewer"' } }
  }

  return {
    success: true,
    data: {
      deviceId: body.deviceId,
      role: body.role as 'camera' | 'viewer' | undefined,
    },
  }
}

/**
 * Join pairing input
 */
export interface JoinPairingInput {
  deviceId: string
  code: string
}

export function validateJoinPairing(data: unknown): ValidationResult<JoinPairingInput> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' }
  }

  const body = data as Record<string, unknown>
  const fieldErrors: Record<string, string> = {}

  if (typeof body.deviceId !== 'string' || !isValidUUID(body.deviceId)) {
    fieldErrors.deviceId = 'Must be a valid UUID'
  }

  if (typeof body.code !== 'string' || !isValidPairingCode(body.code)) {
    fieldErrors.code = 'Must be a 4-digit code'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  return {
    success: true,
    data: {
      deviceId: body.deviceId as string,
      code: body.code as string,
    },
  }
}

/**
 * Profile update input
 */
export interface ProfileUpdateInput {
  displayName: string
  avatarEmoji?: string
}

export function validateProfileUpdate(data: unknown): ValidationResult<ProfileUpdateInput> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' }
  }

  const body = data as Record<string, unknown>

  if (typeof body.displayName !== 'string' || body.displayName.trim().length === 0) {
    return { success: false, error: 'Display name is required', fieldErrors: { displayName: 'Cannot be empty' } }
  }

  if (body.displayName.length > 50) {
    return { success: false, error: 'Display name too long', fieldErrors: { displayName: 'Max 50 characters' } }
  }

  return {
    success: true,
    data: {
      displayName: sanitizeString(body.displayName, 50),
      avatarEmoji: typeof body.avatarEmoji === 'string' ? body.avatarEmoji.substring(0, 4) : undefined,
    },
  }
}

/**
 * Feedback submission input
 */
export interface FeedbackInput {
  type: 'feature' | 'bug' | 'other' | 'rating'
  message: string
  email?: string
  rating?: number
}

export function validateFeedback(data: unknown): ValidationResult<FeedbackInput> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' }
  }

  const body = data as Record<string, unknown>
  const fieldErrors: Record<string, string> = {}

  // Required: type
  const validTypes = ['feature', 'bug', 'other', 'rating']
  if (typeof body.type !== 'string' || !validTypes.includes(body.type)) {
    fieldErrors.type = 'Must be feature, bug, other, or rating'
  }

  // Required: message
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    fieldErrors.message = 'Message is required'
  } else if (body.message.length > 2000) {
    fieldErrors.message = 'Max 2000 characters'
  }

  // Optional: email
  if (body.email !== undefined) {
    if (typeof body.email !== 'string' || !isValidEmail(body.email)) {
      fieldErrors.email = 'Invalid email format'
    }
  }

  // Optional: rating (1-5)
  if (body.rating !== undefined) {
    if (typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
      fieldErrors.rating = 'Rating must be between 1 and 5'
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  return {
    success: true,
    data: {
      type: body.type as FeedbackInput['type'],
      message: sanitizeString(body.message as string, 2000),
      email: body.email as string | undefined,
      rating: body.rating as number | undefined,
    },
  }
}

/**
 * Settings update input
 */
export interface SettingsInput {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  defaultRole?: 'camera' | 'viewer'
  cameraQuality?: 'low' | 'medium' | 'high'
  saveToGallery?: boolean
  showGrid?: boolean
  enableFlash?: boolean
  notificationsEnabled?: boolean
  soundEnabled?: boolean
  hapticsEnabled?: boolean
}

export function validateSettings(data: unknown): ValidationResult<SettingsInput> {
  if (!data || typeof data !== 'object') {
    return { success: false, error: 'Invalid input' }
  }

  const body = data as Record<string, unknown>
  const fieldErrors: Record<string, string> = {}
  const result: SettingsInput = {}

  // theme
  if (body.theme !== undefined) {
    if (!['light', 'dark', 'system'].includes(body.theme as string)) {
      fieldErrors.theme = 'Must be light, dark, or system'
    } else {
      result.theme = body.theme as SettingsInput['theme']
    }
  }

  // language
  if (body.language !== undefined) {
    if (typeof body.language !== 'string' || body.language.length > 10) {
      fieldErrors.language = 'Invalid language code'
    } else {
      result.language = body.language
    }
  }

  // defaultRole
  if (body.defaultRole !== undefined) {
    if (!['camera', 'viewer'].includes(body.defaultRole as string)) {
      fieldErrors.defaultRole = 'Must be camera or viewer'
    } else {
      result.defaultRole = body.defaultRole as SettingsInput['defaultRole']
    }
  }

  // cameraQuality
  if (body.cameraQuality !== undefined) {
    if (!['low', 'medium', 'high'].includes(body.cameraQuality as string)) {
      fieldErrors.cameraQuality = 'Must be low, medium, or high'
    } else {
      result.cameraQuality = body.cameraQuality as SettingsInput['cameraQuality']
    }
  }

  // Boolean fields
  const booleanFields = ['saveToGallery', 'showGrid', 'enableFlash', 'notificationsEnabled', 'soundEnabled', 'hapticsEnabled'] as const
  for (const field of booleanFields) {
    if (body[field] !== undefined) {
      if (typeof body[field] !== 'boolean') {
        fieldErrors[field] = 'Must be true or false'
      } else {
        result[field] = body[field] as boolean
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, error: 'Validation failed', fieldErrors }
  }

  return { success: true, data: result }
}
