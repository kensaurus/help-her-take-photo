/**
 * Get Analytics Edge Function
 * 
 * Returns aggregated analytics data for dashboard.
 * 
 * GET /functions/v1/get-analytics?period=7d
 * Query params:
 *   - period: '1d' | '7d' | '30d' | '90d' (default: 7d)
 *   - deviceId: optional filter by device
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────────
// CORS Headers
// ─────────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

interface AnalyticsResponse {
  period: string
  dateRange: { start: string; end: string }
  
  // Session Metrics
  totalSessions: number
  activeDevices: number
  newDevices: number
  avgSessionDurationMinutes: number
  
  // Photo Metrics
  totalPhotos: number
  photosWithAiAnalysis: number
  avgAiScore: number | null
  
  // Direction Commands
  totalCommands: number
  commandsBreakdown: Record<string, number>
  
  // Engagement
  returningDevices: number
  sessionsPerDevice: number
  
  // Quality
  sessionsWithDisconnects: number
  
  // Trends (daily breakdown)
  dailyMetrics: Array<{
    date: string
    sessions: number
    photos: number
    devices: number
  }>
  
  // Top Stats
  topDevices: Array<{
    deviceId: string
    sessions: number
    photos: number
  }>
  
  peakHours: number[]
}

// ─────────────────────────────────────────────────────────────────────────────────
// Period Helpers
// ─────────────────────────────────────────────────────────────────────────────────

function getPeriodDays(period: string): number {
  switch (period) {
    case '1d': return 1
    case '7d': return 7
    case '30d': return 30
    case '90d': return 90
    default: return 7
  }
}

function getDateRange(days: number): { start: Date; end: Date } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return { start, end }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only accept GET
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    // Parse query params
    const url = new URL(req.url)
    const period = url.searchParams.get('period') || '7d'
    const deviceId = url.searchParams.get('deviceId')
    
    const days = getPeriodDays(period)
    const { start, end } = getDateRange(days)
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Fetch sessions
    let sessionsQuery = supabase
      .from('pairing_sessions')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    
    if (deviceId) {
      sessionsQuery = sessionsQuery.or(`device_id.eq.${deviceId},partner_device_id.eq.${deviceId}`)
    }
    
    const { data: sessions, error: sessionsError } = await sessionsQuery
    
    if (sessionsError) {
      throw sessionsError
    }
    
    // Fetch captures
    let capturesQuery = supabase
      .from('captures')
      .select('*')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    
    if (deviceId) {
      capturesQuery = capturesQuery.eq('camera_device_id', deviceId)
    }
    
    const { data: captures, error: capturesError } = await capturesQuery
    
    if (capturesError) {
      throw capturesError
    }
    
    // Fetch session events for commands
    let eventsQuery = supabase
      .from('session_events')
      .select('*')
      .eq('event_type', 'direction_command')
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
    
    if (deviceId) {
      eventsQuery = eventsQuery.eq('device_id', deviceId)
    }
    
    const { data: commandEvents, error: eventsError } = await eventsQuery
    
    if (eventsError) {
      throw eventsError
    }
    
    // Fetch devices
    let devicesQuery = supabase
      .from('devices')
      .select('device_id, created_at, last_active_at')
      .gte('last_active_at', start.toISOString())
    
    const { data: devices, error: devicesError } = await devicesQuery
    
    if (devicesError) {
      throw devicesError
    }
    
    // Calculate metrics
    const totalSessions = sessions?.length || 0
    const uniqueDevices = new Set([
      ...(sessions?.map(s => s.device_id) || []),
      ...(sessions?.filter(s => s.partner_device_id).map(s => s.partner_device_id) || []),
    ])
    const activeDevices = uniqueDevices.size
    
    const newDevices = devices?.filter(d => 
      new Date(d.created_at) >= start
    ).length || 0
    
    const returningDevices = activeDevices - newDevices
    
    // Calculate average session duration
    const endedSessions = sessions?.filter(s => s.ended_at) || []
    const totalDuration = endedSessions.reduce((sum, s) => {
      const duration = (new Date(s.ended_at).getTime() - new Date(s.created_at).getTime()) / 1000 / 60
      return sum + duration
    }, 0)
    const avgSessionDurationMinutes = endedSessions.length > 0 
      ? Math.round(totalDuration / endedSessions.length * 10) / 10 
      : 0
    
    // Photo metrics
    const totalPhotos = captures?.length || 0
    const photosWithAiAnalysis = captures?.filter(c => c.ai_score !== null).length || 0
    const aiScores = captures?.filter(c => c.ai_score !== null).map(c => c.ai_score) || []
    const avgAiScore = aiScores.length > 0 
      ? Math.round(aiScores.reduce((a, b) => a + b, 0) / aiScores.length * 10) / 10
      : null
    
    // Command breakdown
    const commandsBreakdown: Record<string, number> = {
      up: 0, down: 0, left: 0, right: 0, closer: 0, back: 0
    }
    commandEvents?.forEach(event => {
      const direction = event.event_data?.direction
      if (direction && commandsBreakdown.hasOwnProperty(direction)) {
        commandsBreakdown[direction]++
      }
    })
    const totalCommands = Object.values(commandsBreakdown).reduce((a, b) => a + b, 0)
    
    // Daily breakdown
    const dailyMetrics: Array<{ date: string; sessions: number; photos: number; devices: number }> = []
    for (let d = 0; d < days; d++) {
      const dayStart = new Date(start)
      dayStart.setDate(dayStart.getDate() + d)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      
      const daySessions = sessions?.filter(s => {
        const created = new Date(s.created_at)
        return created >= dayStart && created < dayEnd
      }).length || 0
      
      const dayPhotos = captures?.filter(c => {
        const created = new Date(c.created_at)
        return created >= dayStart && created < dayEnd
      }).length || 0
      
      const dayDevices = new Set([
        ...(sessions?.filter(s => {
          const created = new Date(s.created_at)
          return created >= dayStart && created < dayEnd
        }).map(s => s.device_id) || []),
      ]).size
      
      dailyMetrics.push({
        date: dayStart.toISOString().split('T')[0],
        sessions: daySessions,
        photos: dayPhotos,
        devices: dayDevices,
      })
    }
    
    // Top devices
    const deviceStats: Record<string, { sessions: number; photos: number }> = {}
    sessions?.forEach(s => {
      if (!deviceStats[s.device_id]) {
        deviceStats[s.device_id] = { sessions: 0, photos: 0 }
      }
      deviceStats[s.device_id].sessions++
    })
    captures?.forEach(c => {
      if (deviceStats[c.camera_device_id]) {
        deviceStats[c.camera_device_id].photos++
      }
    })
    
    const topDevices = Object.entries(deviceStats)
      .map(([deviceId, stats]) => ({ deviceId, ...stats }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10)
    
    // Peak hours
    const hourCounts: Record<number, number> = {}
    sessions?.forEach(s => {
      const hour = new Date(s.created_at).getHours()
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })
    const peakHours = Object.entries(hourCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => parseInt(hour))
    
    const response: AnalyticsResponse = {
      period,
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totalSessions,
      activeDevices,
      newDevices,
      avgSessionDurationMinutes,
      totalPhotos,
      photosWithAiAnalysis,
      avgAiScore,
      totalCommands,
      commandsBreakdown,
      returningDevices,
      sessionsPerDevice: activeDevices > 0 
        ? Math.round(totalSessions / activeDevices * 10) / 10 
        : 0,
      sessionsWithDisconnects: 0, // Would need connection tracking
      dailyMetrics,
      topDevices,
      peakHours,
    }
    
    return new Response(
      JSON.stringify({ success: true, analytics: response }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Get analytics error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

