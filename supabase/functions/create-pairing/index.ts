/**
 * Create Pairing Edge Function
 * 
 * Creates a new pairing session with a 4-digit code.
 * 
 * POST /functions/v1/create-pairing
 * Body: { deviceId: string, role?: 'camera' | 'viewer' }
 * Returns: { success: true, code: string, sessionId: string, expiresAt: string }
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

interface CreatePairingInput {
  deviceId: string
  role?: 'camera' | 'viewer'
}

function validateInput(data: unknown): { valid: true; data: CreatePairingInput } | { valid: false; error: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }

  const body = data as Record<string, unknown>

  if (typeof body.deviceId !== 'string' || !isValidUUID(body.deviceId)) {
    return { valid: false, error: 'Invalid deviceId: must be a valid UUID' }
  }

  if (body.role !== undefined && body.role !== 'camera' && body.role !== 'viewer') {
    return { valid: false, error: 'role must be "camera" or "viewer"' }
  }

  return {
    valid: true,
    data: {
      deviceId: body.deviceId,
      role: body.role as 'camera' | 'viewer' | undefined,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Rate Limiting (simple in-memory)
// ─────────────────────────────────────────────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(identifier: string, maxRequests = 10, windowMs = 60000): boolean {
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
// Generate Code
// ─────────────────────────────────────────────────────────────────────────────────

function generateCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
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

    const { deviceId, role } = validation.data

    // Rate limiting by device
    if (!checkRateLimit(deviceId)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing env vars:', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey })
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Delete any existing pending sessions for this device
    await supabase
      .from('pairing_sessions')
      .delete()
      .eq('device_id', deviceId)
      .eq('status', 'pending')

    // Generate unique code (retry on collision)
    let code = generateCode()
    let attempts = 0

    while (attempts < 5) {
      const { data: existing } = await supabase
        .from('pairing_sessions')
        .select('code')
        .eq('code', code)
        .eq('status', 'pending')
        .single()

      if (!existing) break
      code = generateCode()
      attempts++
    }

    // Create session (expires in 5 minutes)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const { data: session, error: insertError } = await supabase
      .from('pairing_sessions')
      .insert({
        code,
        device_id: deviceId,
        creator_role: role || 'camera',
        status: 'pending',
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Insert error:', JSON.stringify(insertError))
      return new Response(
        JSON.stringify({ success: false, error: `Database error: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({
        success: true,
        code: session.code,
        sessionId: session.id,
        expiresAt: session.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Create pairing error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
