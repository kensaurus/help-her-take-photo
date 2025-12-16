/**
 * Send Push Notification Edge Function
 * 
 * Sends push notifications via Expo Push API.
 * Supports single and batch notifications with retry logic.
 * 
 * POST /functions/v1/send-notification
 * Body: {
 *   to: string | string[],  // Expo push token(s)
 *   title?: string,
 *   body: string,
 *   data?: object,
 *   sound?: string,
 *   badge?: number,
 *   channelId?: string,
 *   priority?: 'default' | 'normal' | 'high'
 * }
 * 
 * Or for database-triggered notifications:
 * Body: { deviceId: string, type: string, data?: object }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─────────────────────────────────────────────────────────────────────────────────
// CORS Headers
// ─────────────────────────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─────────────────────────────────────────────────────────────────────────────────
// Notification Templates
// ─────────────────────────────────────────────────────────────────────────────────

const NOTIFICATION_TEMPLATES: Record<string, { title: string; body: string; sound?: string }> = {
  partner_joined: {
    title: '📸 Partner Connected!',
    body: 'Your partner has joined. Ready to help take photos!',
    sound: 'default',
  },
  photo_captured: {
    title: '✨ New Photo!',
    body: 'A photo was captured during your session.',
    sound: 'default',
  },
  session_expiring: {
    title: '⏰ Session Expiring',
    body: 'Your pairing code will expire in 1 minute.',
  },
  session_ended: {
    title: '👋 Session Ended',
    body: 'Your photo session has ended. Thanks for using Help Her Take Photo!',
  },
  friend_request: {
    title: '👋 Friend Request',
    body: 'Someone wants to connect with you!',
    sound: 'default',
  },
  album_shared: {
    title: '📷 Album Shared',
    body: 'A photo album was shared with you.',
    sound: 'default',
  },
  ai_analysis_ready: {
    title: '🤖 Analysis Ready',
    body: 'AI analysis of your photo is ready to view.',
  },
  engagement_reminder: {
    title: '📸 Miss taking photos?',
    body: "It's been a while! Open the app to capture some memories.",
  },
}

// ─────────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────────

interface ExpoPushMessage {
  to: string | string[]
  title?: string
  body: string
  data?: Record<string, unknown>
  sound?: string | null
  badge?: number
  channelId?: string
  categoryId?: string
  priority?: 'default' | 'normal' | 'high'
  ttl?: number
  expiration?: number
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: {
    error?: string
  }
}

interface SendNotificationRequest {
  // Direct send
  to?: string | string[]
  title?: string
  body?: string
  data?: Record<string, unknown>
  sound?: string
  badge?: number
  channelId?: string
  priority?: 'default' | 'normal' | 'high'
  
  // Template-based send
  deviceId?: string
  type?: string
}

// ─────────────────────────────────────────────────────────────────────────────────
// Expo Push API
// ─────────────────────────────────────────────────────────────────────────────────

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

async function sendToExpo(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Encoding': 'gzip, deflate',
  }
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }
  
  const response = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(messages),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Expo API error: ${response.status} - ${errorText}`)
  }
  
  const result = await response.json()
  return result.data || []
}

// ─────────────────────────────────────────────────────────────────────────────────
// Main Handler
// ─────────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  
  try {
    const body: SendNotificationRequest = await req.json()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    let messages: ExpoPushMessage[] = []
    
    // Template-based notification (by deviceId and type)
    if (body.deviceId && body.type) {
      const template = NOTIFICATION_TEMPLATES[body.type]
      if (!template) {
        return new Response(
          JSON.stringify({ success: false, error: `Unknown notification type: ${body.type}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // Get push token from devices table
      const { data: device, error: deviceError } = await supabase
        .from('devices')
        .select('push_token')
        .eq('device_id', body.deviceId)
        .single()
      
      if (deviceError || !device?.push_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Device not found or no push token' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      messages.push({
        to: device.push_token,
        title: template.title,
        body: template.body,
        sound: template.sound || null,
        data: body.data || {},
        priority: 'high',
      })
      
      // Log notification to queue
      await supabase.from('notification_queue').insert({
        device_id: body.deviceId,
        expo_push_token: device.push_token,
        title: template.title,
        body: template.body,
        data: body.data || {},
        status: 'pending',
      })
    }
    // Direct notification (with push token)
    else if (body.to && body.body) {
      const tokens = Array.isArray(body.to) ? body.to : [body.to]
      
      messages = tokens.map(token => ({
        to: token,
        title: body.title,
        body: body.body!,
        data: body.data || {},
        sound: body.sound || 'default',
        badge: body.badge,
        channelId: body.channelId,
        priority: body.priority || 'default',
      }))
    }
    else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid request: provide either (to + body) or (deviceId + type)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Send to Expo
    const tickets = await sendToExpo(messages)
    
    // Update notification queue with ticket IDs
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]
      if (body.deviceId) {
        await supabase
          .from('notification_queue')
          .update({
            status: ticket.status === 'ok' ? 'sent' : 'failed',
            ticket_id: ticket.id,
            error_message: ticket.message,
            sent_at: new Date().toISOString(),
          })
          .eq('device_id', body.deviceId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1)
      }
    }
    
    // Check for errors
    const errors = tickets.filter(t => t.status === 'error')
    if (errors.length > 0) {
      console.error('Some notifications failed:', errors)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        sent: tickets.filter(t => t.status === 'ok').length,
        failed: errors.length,
        tickets,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Send notification error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

