/**
 * Join Pairing Edge Function
 * 
 * Joins an existing pairing session with a 4-digit code.
 * 
 * POST /functions/v1/join-pairing
 * Body: { deviceId: string, code: string }
 * Returns: { success: true, sessionId: string, partnerId: string }
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
// Validation
// ─────────────────────────────────────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

function isValidPairingCode(code: string): boolean {
  return /^\d{4}$/.test(code)
}

interface JoinPairingInput {
  deviceId: string
  code: string
}

function validateInput(data: unknown): { valid: true; data: JoinPairingInput } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }

  const body = data as Record<string, unknown>

  if (typeof body.deviceId !== 'string' || !isValidUUID(body.deviceId)) {
    return { valid: false, error: 'Invalid deviceId: must be a valid UUID' }
  }

  if (typeof body.code !== 'string' || !isValidPairingCode(body.code)) {
    return { valid: false, error: 'Invalid code: must be a 4-digit number' }
  }

  return {
    valid: true,
    data: {
      deviceId: body.deviceId,
      code: body.code,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Rate Limiting (simple in-memory)
// ─────────────────────────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(identifier: string, maxRequests = 20, windowMs = 60000): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= maxRequests) {
    return false
  }

  entry.count++
  return true
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
    // Parse body
    const body = await req.json()
    
    // Validate input
    const validation = validateInput(body)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { deviceId, code } = validation.data

    // Rate limiting by device (more lenient for join attempts)
    if (!checkRateLimit(deviceId, 20, 60000)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Too many attempts. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client with service role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find pending session with this code
    const { data: session, error: findError } = await supabase
      .from('pairing_sessions')
      .select('*')
      .eq('code', code)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .single()

    if (findError || !session) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid or expired code' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if trying to join own session
    if (session.device_id === deviceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Cannot join your own session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update session with partner
    const { error: updateError } = await supabase
      .from('pairing_sessions')
      .update({
        partner_device_id: deviceId,
        status: 'paired',
      })
      .eq('id', session.id)

    if (updateError) {
      console.error('Update error:', updateError)
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to join session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        partnerId: session.device_id,
        creatorRole: session.creator_role,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Join pairing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
