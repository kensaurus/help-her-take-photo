/**
 * LiveKit Token Generator
 * 
 * Generates JWT tokens for LiveKit room access.
 * Called by the app when joining a video session.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { AccessToken } from 'npm:livekit-server-sdk@2.0.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')

    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      console.error('LiveKit credentials not configured')
      return new Response(
        JSON.stringify({ error: 'LiveKit not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { roomName, participantName, role } = await req.json()

    if (!roomName || !participantName) {
      return new Response(
        JSON.stringify({ error: 'Missing roomName or participantName' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create access token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      ttl: '2h', // Token valid for 2 hours
    })

    // Grant permissions based on role
    // camera = can publish video, director = can only subscribe
    const canPublish = role === 'camera'
    
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: canPublish,
      canPublishData: true, // Both can send commands
      canSubscribe: true,
    })

    const jwt = await token.toJwt()

    console.log(`Token generated for ${participantName} in room ${roomName} (role: ${role})`)

    return new Response(
      JSON.stringify({ 
        token: jwt,
        room: roomName,
        identity: participantName,
        canPublish,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Token generation error:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to generate token' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
