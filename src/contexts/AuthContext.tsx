/**
 * Auth Context - Manages Supabase authentication state
 * 
 * Features:
 * - Anonymous authentication on app start
 * - Session persistence across app restarts
 * - Token refresh handling
 * - Auth state change listener
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { supabase, ensureAuthenticated, getDeviceId, signOut as supabaseSignOut } from '../services/supabase'
import { sessionLogger } from '../services/sessionLogger'
import { logger } from '../services/logging'
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

interface AuthState {
  user: User | null
  session: Session | null
  deviceId: string | null
  isLoading: boolean
  isAuthenticated: boolean
  error: string | null
}

interface AuthContextValue extends AuthState {
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null)

// ─────────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    deviceId: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  })

  // Initialize auth on mount
  useEffect(() => {
    let isMounted = true

    const initializeAuth = async () => {
      try {
        // Get device ID first
        const deviceId = await getDeviceId()
        
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          if (isMounted) {
            setState({
              user: session.user,
              session,
              deviceId,
              isLoading: false,
              isAuthenticated: true,
              error: null,
            })
          }
          sessionLogger.info('auth_session_restored', { 
            userId: session.user.id.substring(0, 8) 
          })
        } else {
          // No session, attempt anonymous auth
          const { userId, error } = await ensureAuthenticated()
          
          if (isMounted) {
            if (userId) {
              const { data: { session: newSession } } = await supabase.auth.getSession()
              setState({
                user: newSession?.user ?? null,
                session: newSession,
                deviceId,
                isLoading: false,
                isAuthenticated: !!newSession,
                error: null,
              })
            } else {
              setState({
                user: null,
                session: null,
                deviceId,
                isLoading: false,
                isAuthenticated: false,
                error: error ?? 'Authentication failed',
              })
            }
          }
        }
      } catch (error) {
        logger.error('Auth initialization failed', error)
        if (isMounted) {
          const deviceId = await getDeviceId().catch(() => null)
          setState({
            user: null,
            session: null,
            deviceId,
            isLoading: false,
            isAuthenticated: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return

        sessionLogger.info('auth_state_change', { 
          event, 
          hasSession: !!session,
          userId: session?.user?.id?.substring(0, 8),
        })

        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            setState(prev => ({
              ...prev,
              user: session?.user ?? null,
              session,
              isAuthenticated: !!session,
              error: null,
            }))
            break

          case 'SIGNED_OUT':
            setState(prev => ({
              ...prev,
              user: null,
              session: null,
              isAuthenticated: false,
              error: null,
            }))
            break

          case 'USER_UPDATED':
            setState(prev => ({
              ...prev,
              user: session?.user ?? prev.user,
              session: session ?? prev.session,
            }))
            break

          case 'INITIAL_SESSION':
            // Handled in initializeAuth
            break
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      await supabaseSignOut()
      sessionLogger.info('auth_sign_out')
    } catch (error) {
      logger.error('Sign out failed', error)
    }
  }, [])

  // Refresh session handler
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        logger.error('Session refresh failed', error)
        return
      }
      
      if (data.session) {
        sessionLogger.info('auth_session_refreshed')
      }
    } catch (error) {
      logger.error('Session refresh error', error)
    }
  }, [])

  const value: AuthContextValue = {
    ...state,
    signOut: handleSignOut,
    refreshSession,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  
  return context
}

// ─────────────────────────────────────────────────────────────────────────────────
// Utility Hook - Get auth user ID for API calls
// ─────────────────────────────────────────────────────────────────────────────────

export function useAuthUserId(): string | null {
  const { user } = useAuth()
  return user?.id ?? null
}

export default AuthContext
