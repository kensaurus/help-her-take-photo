/**
 * Manage Friends Edge Function
 * 
 * Handle friend connections and recent partners.
 * 
 * POST /functions/v1/manage-friends
 * Body: {
 *   action: 'request' | 'accept' | 'reject' | 'block' | 'remove' | 'list' | 'recent',
 *   deviceId: string,
 *   friendDeviceId?: string,   // Required for request, accept, reject, block, remove
 *   nickname?: string,         // Optional for request
 * }
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
// Types
// ─────────────────────────────────────────────────────────────────────────────────

interface ManageFriendsRequest {
  action: 'request' | 'accept' | 'reject' | 'block' | 'remove' | 'list' | 'recent' | 'update'
  deviceId: string
  friendDeviceId?: string
  nickname?: string
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
    const body: ManageFriendsRequest = await req.json()
    
    if (!body.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!body.deviceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'deviceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    switch (body.action) {
      // ─────────────────────────────────────────────────────────────────────────
      // SEND FRIEND REQUEST
      // ─────────────────────────────────────────────────────────────────────────
      case 'request': {
        if (!body.friendDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'friendDeviceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Check if connection already exists
        const { data: existing } = await supabase
          .from('friend_connections')
          .select('*')
          .eq('device_id', body.deviceId)
          .eq('friend_device_id', body.friendDeviceId)
          .single()
        
        if (existing) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Connection already exists with status: ${existing.status}`,
            }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Create friend request
        const { data: connection, error } = await supabase
          .from('friend_connections')
          .insert({
            device_id: body.deviceId,
            friend_device_id: body.friendDeviceId,
            nickname: body.nickname || null,
            status: 'pending',
          })
          .select()
          .single()
        
        if (error) {
          throw error
        }
        
        // Send notification to friend
        fetch(`${supabaseUrl}/functions/v1/send-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: body.friendDeviceId,
            type: 'friend_request',
            data: { fromDeviceId: body.deviceId },
          }),
        }).catch(console.error)
        
        return new Response(
          JSON.stringify({ success: true, connection }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // ACCEPT FRIEND REQUEST
      // ─────────────────────────────────────────────────────────────────────────
      case 'accept': {
        if (!body.friendDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'friendDeviceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Accept incoming request
        const { data: connection, error } = await supabase
          .from('friend_connections')
          .update({ status: 'accepted', updated_at: new Date().toISOString() })
          .eq('device_id', body.friendDeviceId)
          .eq('friend_device_id', body.deviceId)
          .eq('status', 'pending')
          .select()
          .single()
        
        if (error || !connection) {
          return new Response(
            JSON.stringify({ success: false, error: 'Friend request not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Create reciprocal connection
        await supabase.from('friend_connections').upsert({
          device_id: body.deviceId,
          friend_device_id: body.friendDeviceId,
          status: 'accepted',
        })
        
        return new Response(
          JSON.stringify({ success: true, connection }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // REJECT FRIEND REQUEST
      // ─────────────────────────────────────────────────────────────────────────
      case 'reject': {
        if (!body.friendDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'friendDeviceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Delete incoming request
        const { error } = await supabase
          .from('friend_connections')
          .delete()
          .eq('device_id', body.friendDeviceId)
          .eq('friend_device_id', body.deviceId)
          .eq('status', 'pending')
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, rejected: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // BLOCK USER
      // ─────────────────────────────────────────────────────────────────────────
      case 'block': {
        if (!body.friendDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'friendDeviceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Update or create blocked connection
        const { data: connection, error } = await supabase
          .from('friend_connections')
          .upsert({
            device_id: body.deviceId,
            friend_device_id: body.friendDeviceId,
            status: 'blocked',
            updated_at: new Date().toISOString(),
          })
          .select()
          .single()
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, connection }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // REMOVE FRIEND
      // ─────────────────────────────────────────────────────────────────────────
      case 'remove': {
        if (!body.friendDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'friendDeviceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Delete both directions of friendship
        await supabase
          .from('friend_connections')
          .delete()
          .eq('device_id', body.deviceId)
          .eq('friend_device_id', body.friendDeviceId)
        
        await supabase
          .from('friend_connections')
          .delete()
          .eq('device_id', body.friendDeviceId)
          .eq('friend_device_id', body.deviceId)
        
        return new Response(
          JSON.stringify({ success: true, removed: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // UPDATE FRIEND (nickname)
      // ─────────────────────────────────────────────────────────────────────────
      case 'update': {
        if (!body.friendDeviceId) {
          return new Response(
            JSON.stringify({ success: false, error: 'friendDeviceId is required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const { data: connection, error } = await supabase
          .from('friend_connections')
          .update({
            nickname: body.nickname,
            updated_at: new Date().toISOString(),
          })
          .eq('device_id', body.deviceId)
          .eq('friend_device_id', body.friendDeviceId)
          .select()
          .single()
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, connection }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // LIST FRIENDS
      // ─────────────────────────────────────────────────────────────────────────
      case 'list': {
        // Get accepted friends
        const { data: friends, error: friendsError } = await supabase
          .from('friend_connections')
          .select('*')
          .eq('device_id', body.deviceId)
          .eq('status', 'accepted')
          .order('last_session_at', { ascending: false, nullsFirst: false })
        
        if (friendsError) {
          throw friendsError
        }
        
        // Get pending requests (incoming)
        const { data: pending, error: pendingError } = await supabase
          .from('friend_connections')
          .select('*')
          .eq('friend_device_id', body.deviceId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
        
        if (pendingError) {
          throw pendingError
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            friends: friends || [],
            pendingRequests: pending || [],
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // LIST RECENT PARTNERS
      // ─────────────────────────────────────────────────────────────────────────
      case 'recent': {
        const { data: partners, error } = await supabase
          .from('recent_partners')
          .select('*')
          .eq('device_id', body.deviceId)
          .order('last_session_at', { ascending: false })
          .limit(10)
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, partners: partners || [] }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      default:
        return new Response(
          JSON.stringify({ success: false, error: `Unknown action: ${body.action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
    
  } catch (error) {
    console.error('Manage friends error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

