/**
 * Error Boundary - Global error handling with recovery UI
 * 
 * Catches JavaScript errors and provides:
 * - User-friendly error display
 * - Option to retry
 * - Option to reset app state
 * - Automatic error logging
 */

import React, { Component, ErrorInfo, ReactNode } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { sessionLogger } from '../services/sessionLogger'
import { connectionManager } from '../services/connectionManager'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isResetting: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isResetting: false,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to session logger
    sessionLogger.error('error_boundary_caught', error, {
      componentStack: errorInfo.componentStack?.substring(0, 1000),
    })
    
    this.setState({ errorInfo })
    
    // Report to connection manager
    connectionManager.reportFatalError(error, true)
  }

  handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleReset = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    this.setState({ isResetting: true })
    
    try {
      // Force reset all connection state
      await connectionManager.forceReset()
      
      // Call parent reset handler if provided
      this.props.onReset?.()
      
      // Clear error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isResetting: false,
      })
    } catch (resetError) {
      sessionLogger.error('error_boundary_reset_failed', resetError)
      this.setState({ isResetting: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.content}>
              {/* Error Icon */}
              <Text style={styles.errorIcon}>⚠️</Text>
              
              {/* Title */}
              <Text style={styles.title}>Something went wrong</Text>
              
              {/* Description */}
              <Text style={styles.description}>
                The app encountered an unexpected error. You can try again or reset the app to its initial state.
              </Text>
              
              {/* Error Details (collapsed by default) */}
              {__DEV__ && this.state.error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorName}>{this.state.error.name}</Text>
                  <Text style={styles.errorMessage}>{this.state.error.message}</Text>
                  {this.state.error.stack && (
                    <Text style={styles.errorStack} numberOfLines={10}>
                      {this.state.error.stack}
                    </Text>
                  )}
                </View>
              )}
              
              {/* Action Buttons */}
              <View style={styles.actions}>
                <Pressable
                  style={[styles.button, styles.retryButton]}
                  onPress={this.handleRetry}
                  disabled={this.state.isResetting}
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
                
                <Pressable
                  style={[styles.button, styles.resetButton]}
                  onPress={this.handleReset}
                  disabled={this.state.isResetting}
                >
                  <Text style={styles.resetButtonText}>
                    {this.state.isResetting ? 'Resetting...' : 'Reset App'}
                  </Text>
                </Pressable>
              </View>
              
              {/* Help Text */}
              <Text style={styles.helpText}>
                If the problem persists, try closing and reopening the app.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      )
    }

    return this.props.children
  }
}

const { width } = Dimensions.get('window')

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: width * 0.8,
  },
  errorDetails: {
    backgroundColor: '#262626',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    maxWidth: width * 0.9,
  },
  errorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 13,
    color: '#f87171',
    marginBottom: 8,
  },
  errorStack: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'column',
    gap: 12,
    width: '100%',
    maxWidth: 280,
    marginBottom: 24,
  },
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#22c55e',
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resetButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9ca3af',
  },
  helpText: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
  },
})
