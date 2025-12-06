/**
 * API service for backend communication
 */

import type { PairingCode, PairingResult, PartnerInfo, ApiError } from '../types'

// Configure this to your backend URL
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'

class ApiService {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      const error = data as ApiError
      throw new Error(
        typeof error.error === 'string' 
          ? error.error 
          : 'Request failed'
      )
    }

    return data as T
  }

  /**
   * Create a new pairing code
   */
  async createPairingCode(deviceToken: string): Promise<PairingCode> {
    return this.request<PairingCode>('/pair/create', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    })
  }

  /**
   * Join with a pairing code
   */
  async joinWithCode(deviceToken: string, code: string): Promise<PairingResult> {
    return this.request<PairingResult>('/pair/join', {
      method: 'POST',
      body: JSON.stringify({ deviceToken, code }),
    })
  }

  /**
   * Get partner device info
   */
  async getPartner(deviceToken: string): Promise<PartnerInfo> {
    return this.request<PartnerInfo>('/pair/partner', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    })
  }

  /**
   * Unpair devices
   */
  async unpair(deviceToken: string): Promise<{ unpaired: boolean }> {
    return this.request<{ unpaired: boolean }>('/pair/unpair', {
      method: 'POST',
      body: JSON.stringify({ deviceToken }),
    })
  }

  /**
   * Check pairing code status (polling)
   */
  async checkPairingStatus(code: string): Promise<{ status: string; paired: boolean }> {
    return this.request<{ status: string; paired: boolean }>(`/pair/status/${code}`, {
      method: 'GET',
    })
  }
}

export const api = new ApiService(API_BASE_URL)

/**
 * Pairing API wrapper with better error handling
 */
export const pairingApi = {
  async createPairing(deviceId: string): Promise<{ code?: string; error?: string }> {
    try {
      const result = await api.createPairingCode(deviceId)
      return { code: result.code }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Failed to create code' }
    }
  },

  async joinPairing(deviceId: string, code: string): Promise<{ partnerId?: string; error?: string }> {
    try {
      const result = await api.joinWithCode(deviceId, code)
      return { partnerId: result.paired ? result.partnerId : undefined }
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Invalid code' }
    }
  },

  async getPartner(deviceId: string, code: string): Promise<{ partnerId?: string; error?: string }> {
    try {
      const result = await api.checkPairingStatus(code)
      if (result.paired) {
        const partner = await api.getPartner(deviceId)
        return { partnerId: partner.partnerId }
      }
      return {}
    } catch {
      return {}
    }
  },
}

/**
 * Feedback API
 */
export interface FeedbackInput {
  deviceToken?: string
  type: 'feature' | 'bug' | 'other'
  message: string
  email?: string
  rating?: number
}

export const feedbackApi = {
  async submit(input: FeedbackInput): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        return { success: false, error: data.error || 'Failed to submit feedback' }
      }
      
      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Network error' 
      }
    }
  },
}

