/**
 * Manage Album Edge Function
 * 
 * Create, update, delete, and share photo albums.
 * 
 * POST /functions/v1/manage-album
 * Body: {
 *   action: 'create' | 'update' | 'delete' | 'share' | 'get' | 'list',
 *   deviceId: string,
 *   albumId?: string,         // Required for update, delete, share, get
 *   name?: string,            // For create/update
 *   description?: string,     // For create/update
 *   isPublic?: boolean,       // For create/update
 *   coverPhotoId?: string,    // For create/update
 *   shareCode?: string,       // For get (shared album)
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

interface ManageAlbumRequest {
  action: 'create' | 'update' | 'delete' | 'share' | 'get' | 'list'
  deviceId: string
  albumId?: string
  name?: string
  description?: string
  isPublic?: boolean
  coverPhotoId?: string
  shareCode?: string
}

// ─────────────────────────────────────────────────────────────────────────────────
// Share Code Generator
// ─────────────────────────────────────────────────────────────────────────────────

function generateShareCode(length = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  // Exclude confusing chars
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
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
    const body: ManageAlbumRequest = await req.json()
    
    if (!body.action) {
      return new Response(
        JSON.stringify({ success: false, error: 'action is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!body.deviceId && body.action !== 'get') {
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
      // CREATE ALBUM
      // ─────────────────────────────────────────────────────────────────────────
      case 'create': {
        if (!body.name) {
          return new Response(
            JSON.stringify({ success: false, error: 'name is required for create' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const { data: album, error } = await supabase
          .from('photo_albums')
          .insert({
            device_id: body.deviceId,
            name: body.name,
            description: body.description || null,
            is_public: body.isPublic || false,
            cover_photo_id: body.coverPhotoId || null,
          })
          .select()
          .single()
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, album }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // UPDATE ALBUM
      // ─────────────────────────────────────────────────────────────────────────
      case 'update': {
        if (!body.albumId) {
          return new Response(
            JSON.stringify({ success: false, error: 'albumId is required for update' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (body.name !== undefined) updateData.name = body.name
        if (body.description !== undefined) updateData.description = body.description
        if (body.isPublic !== undefined) updateData.is_public = body.isPublic
        if (body.coverPhotoId !== undefined) updateData.cover_photo_id = body.coverPhotoId
        
        const { data: album, error } = await supabase
          .from('photo_albums')
          .update(updateData)
          .eq('id', body.albumId)
          .eq('device_id', body.deviceId)  // Ensure ownership
          .select()
          .single()
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, album }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // DELETE ALBUM
      // ─────────────────────────────────────────────────────────────────────────
      case 'delete': {
        if (!body.albumId) {
          return new Response(
            JSON.stringify({ success: false, error: 'albumId is required for delete' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // First, unlink photos from album
        await supabase
          .from('captures')
          .update({ album_id: null })
          .eq('album_id', body.albumId)
        
        // Then delete album
        const { error } = await supabase
          .from('photo_albums')
          .delete()
          .eq('id', body.albumId)
          .eq('device_id', body.deviceId)  // Ensure ownership
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, deleted: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // SHARE ALBUM (Generate share code)
      // ─────────────────────────────────────────────────────────────────────────
      case 'share': {
        if (!body.albumId) {
          return new Response(
            JSON.stringify({ success: false, error: 'albumId is required for share' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Generate unique share code
        let shareCode = generateShareCode()
        let attempts = 0
        
        while (attempts < 5) {
          const { data: existing } = await supabase
            .from('photo_albums')
            .select('id')
            .eq('share_code', shareCode)
            .single()
          
          if (!existing) break
          shareCode = generateShareCode()
          attempts++
        }
        
        const { data: album, error } = await supabase
          .from('photo_albums')
          .update({
            share_code: shareCode,
            is_public: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', body.albumId)
          .eq('device_id', body.deviceId)  // Ensure ownership
          .select()
          .single()
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            album,
            shareUrl: `https://helpher.app/album/${shareCode}`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // GET ALBUM (by ID or share code)
      // ─────────────────────────────────────────────────────────────────────────
      case 'get': {
        let query = supabase.from('photo_albums').select('*')
        
        if (body.shareCode) {
          query = query.eq('share_code', body.shareCode).eq('is_public', true)
        } else if (body.albumId) {
          query = query.eq('id', body.albumId)
          if (body.deviceId) {
            query = query.eq('device_id', body.deviceId)
          }
        } else {
          return new Response(
            JSON.stringify({ success: false, error: 'albumId or shareCode is required for get' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        const { data: album, error: albumError } = await query.single()
        
        if (albumError || !album) {
          return new Response(
            JSON.stringify({ success: false, error: 'Album not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        
        // Get photos in album
        const { data: photos, error: photosError } = await supabase
          .from('captures')
          .select('id, cloud_url, cloud_thumbnail_url, ai_score, created_at')
          .eq('album_id', album.id)
          .order('created_at', { ascending: false })
        
        if (photosError) {
          throw photosError
        }
        
        return new Response(
          JSON.stringify({
            success: true,
            album: {
              ...album,
              photos: photos || [],
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // LIST ALBUMS
      // ─────────────────────────────────────────────────────────────────────────
      case 'list': {
        const { data: albums, error } = await supabase
          .from('photo_albums')
          .select('*')
          .eq('device_id', body.deviceId)
          .order('updated_at', { ascending: false })
        
        if (error) {
          throw error
        }
        
        return new Response(
          JSON.stringify({ success: true, albums: albums || [] }),
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
    console.error('Manage album error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

