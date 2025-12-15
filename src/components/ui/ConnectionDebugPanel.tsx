/**
 * Connection Debug Panel
 * Shows real-time connection status, session info, and recent events
 * Tap header to expand/collapse
 * 
 * Enhanced with:
 * - Camera error details
 * - Stream health monitoring
 * - Performance metrics
 */

import { useState, useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

export interface DebugEvent {
  id: string
  time: string
  type: 'info' | 'warn' | 'error' | 'success'
  message: string
}

interface ConnectionDebugPanelProps {
  role: 'photographer' | 'director'
  sessionId: string | null
  myDeviceId: string | null
  partnerDeviceId: string | null
  partnerOnline: boolean | null
  webrtcState: string
  isConnected: boolean
  isSharing?: boolean
  hasLocalStream?: boolean
  hasRemoteStream?: boolean
  events?: DebugEvent[]
  // New props for enhanced debugging
  cameraError?: string | null
  streamReady?: boolean
  cameraReady?: boolean
  facing?: string
}

function truncateId(id: string | null): string {
  if (!id) return '—'
  return id.substring(0, 8)
}

function StatusDot({ status }: { status: 'success' | 'warning' | 'error' | 'neutral' }) {
  const colors = {
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    neutral: '#6B7280',
  }
  return <View style={[styles.dot, { backgroundColor: colors[status] }]} />
}

export function ConnectionDebugPanel({
  role,
  sessionId,
  myDeviceId,
  partnerDeviceId,
  partnerOnline,
  webrtcState,
  isConnected,
  isSharing,
  hasLocalStream,
  hasRemoteStream,
  events = [],
  cameraError,
  streamReady,
  cameraReady,
  facing,
}: ConnectionDebugPanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [internalEvents, setInternalEvents] = useState<DebugEvent[]>([])
  const eventIdCounter = useRef(0)
  const [uptime, setUptime] = useState(0)
  const mountTime = useRef(Date.now())

  // Track uptime
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(Math.floor((Date.now() - mountTime.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Merge external events with internal tracking
  useEffect(() => {
    if (events.length > 0) {
      setInternalEvents(prev => [...events, ...prev].slice(0, 20))
    }
  }, [events])

  // Auto-log state changes
  useEffect(() => {
    addEvent('info', `WebRTC: ${webrtcState}`)
  }, [webrtcState])

  useEffect(() => {
    if (partnerOnline !== null) {
      addEvent(
        partnerOnline ? 'success' : 'warn',
        `Partner ${partnerOnline ? 'online' : 'offline'}`
      )
    }
  }, [partnerOnline])

  useEffect(() => {
    if (isConnected) {
      addEvent('success', 'P2P Connected!')
    }
  }, [isConnected])

  // Log camera errors
  useEffect(() => {
    if (cameraError) {
      addEvent('error', `Camera: ${cameraError.substring(0, 50)}`)
    }
  }, [cameraError])

  // Log stream ready state
  useEffect(() => {
    if (streamReady) {
      addEvent('success', 'Stream ready')
    }
  }, [streamReady])

  // Log camera ready state
  useEffect(() => {
    if (cameraReady) {
      addEvent('info', 'Camera ready')
    }
  }, [cameraReady])

  const addEvent = (type: DebugEvent['type'], message: string) => {
    const event: DebugEvent = {
      id: `evt-${eventIdCounter.current++}`,
      time: new Date().toLocaleTimeString('en-US', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      }),
      type,
      message,
    }
    setInternalEvents(prev => [event, ...prev].slice(0, 20))
  }

  const getOverallStatus = (): 'success' | 'warning' | 'error' | 'neutral' => {
    if (isConnected && partnerOnline) return 'success'
    if (partnerOnline === false) return 'error'
    if (webrtcState === 'failed') return 'error'
    if (isSharing || webrtcState === 'connecting') return 'warning'
    return 'neutral'
  }

  const getStatusText = (): string => {
    if (isConnected && partnerOnline) return 'Connected'
    if (partnerOnline === false) return 'Partner Offline'
    if (webrtcState === 'failed') return 'Failed'
    if (isSharing) return 'Connecting...'
    return 'Waiting'
  }

  return (
    <View style={styles.container}>
      {/* Collapsed header - always visible */}
      <Pressable 
        style={styles.header}
        onPress={() => setExpanded(!expanded)}
      >
        <View style={styles.headerLeft}>
          <StatusDot status={getOverallStatus()} />
          <Text style={styles.roleText}>
            {role === 'photographer' ? '📸' : '👁️'} {role.toUpperCase()}
          </Text>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        <Text style={styles.expandIcon}>{expanded ? '▼' : '▶'}</Text>
      </Pressable>

      {/* Expanded details */}
      {expanded && (
        <Animated.View 
          entering={FadeIn.duration(200)} 
          exiting={FadeOut.duration(150)}
          style={styles.details}
        >
          {/* IDs section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Session Info</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Session:</Text>
              <Text style={styles.value}>{truncateId(sessionId)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Me:</Text>
              <Text style={styles.value}>{truncateId(myDeviceId)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Partner:</Text>
              <Text style={styles.value}>{truncateId(partnerDeviceId)}</Text>
            </View>
          </View>

          {/* Connection status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connection Status</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Partner:</Text>
              <View style={styles.statusBadge}>
                <StatusDot status={partnerOnline ? 'success' : partnerOnline === false ? 'error' : 'neutral'} />
                <Text style={styles.badgeText}>
                  {partnerOnline === null ? 'Unknown' : partnerOnline ? 'Online' : 'Offline'}
                </Text>
              </View>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>WebRTC:</Text>
              <Text style={styles.value}>{webrtcState}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>P2P:</Text>
              <View style={styles.statusBadge}>
                <StatusDot status={isConnected ? 'success' : 'neutral'} />
                <Text style={styles.badgeText}>{isConnected ? 'Connected' : 'Not connected'}</Text>
              </View>
            </View>
            {role === 'photographer' && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Sharing:</Text>
                  <Text style={styles.value}>{isSharing ? 'Yes' : 'No'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Local Stream:</Text>
                  <Text style={styles.value}>{hasLocalStream ? '✓' : '✗'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Stream Ready:</Text>
                  <Text style={styles.value}>{streamReady ? '✓' : '✗'}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Camera Ready:</Text>
                  <Text style={styles.value}>{cameraReady ? '✓' : '✗'}</Text>
                </View>
                {facing && (
                  <View style={styles.row}>
                    <Text style={styles.label}>Facing:</Text>
                    <Text style={styles.value}>{facing}</Text>
                  </View>
                )}
              </>
            )}
            {role === 'director' && (
              <View style={styles.row}>
                <Text style={styles.label}>Remote Stream:</Text>
                <Text style={styles.value}>{hasRemoteStream ? '✓' : '✗'}</Text>
              </View>
            )}
          </View>

          {/* Camera Error (if any) */}
          {cameraError && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⚠️ Camera Error</Text>
              <Text style={styles.errorText}>{cameraError}</Text>
            </View>
          )}

          {/* Performance metrics */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance</Text>
            <View style={styles.row}>
              <Text style={styles.label}>Uptime:</Text>
              <Text style={styles.value}>{uptime}s</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Platform:</Text>
              <Text style={styles.value}>{Platform.OS} {Platform.Version}</Text>
            </View>
          </View>

          {/* Recent events */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Events</Text>
            <ScrollView style={styles.eventsList} nestedScrollEnabled>
              {internalEvents.length === 0 ? (
                <Text style={styles.noEvents}>No events yet</Text>
              ) : (
                internalEvents.slice(0, 10).map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <Text style={styles.eventTime}>{event.time}</Text>
                    <View style={[
                      styles.eventDot,
                      { backgroundColor: 
                        event.type === 'success' ? '#22C55E' :
                        event.type === 'warn' ? '#F59E0B' :
                        event.type === 'error' ? '#EF4444' : '#6B7280'
                      }
                    ]} />
                    <Text style={styles.eventMessage} numberOfLines={1}>
                      {event.message}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderRadius: 8,
    marginHorizontal: 12,
    marginVertical: 8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  roleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 12,
    marginLeft: 4,
  },
  expandIcon: {
    color: '#6B7280',
    fontSize: 10,
  },
  details: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  section: {
    marginTop: 10,
  },
  sectionTitle: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  label: {
    color: '#6B7280',
    fontSize: 11,
  },
  value: {
    color: '#E5E7EB',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    color: '#E5E7EB',
    fontSize: 11,
  },
  eventsList: {
    maxHeight: 120,
  },
  noEvents: {
    color: '#6B7280',
    fontSize: 11,
    fontStyle: 'italic',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 6,
  },
  eventTime: {
    color: '#6B7280',
    fontSize: 9,
    fontFamily: 'monospace',
    width: 55,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventMessage: {
    color: '#D1D5DB',
    fontSize: 10,
    flex: 1,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
  },
})

