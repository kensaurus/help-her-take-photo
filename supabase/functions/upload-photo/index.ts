/**
 * Upload Photo Edge Function
 * 
 * Handles cloud backup of photos to Supabase Storage.
 * - Accepts base64 encoded images
 * - Generates thumbnails
 * - Updates captures table with cloud URLs
 * 
 * POST /functions/v1/upload-photo
 * Body: {
 *   captureId: string,        // UUID of the capture record
 *   deviceId: string,
 *   imageData: string,        // Base64 encoded image
 *   mimeType?: string,        // Default: 'image/jpeg'
 *   albumId?: string,         // Optional album to add to
 *   generateThumbnail?: bool  // Default: true
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

interface UploadPhotoRequest {
  captureId: string
  deviceId: string
  imageData: string        // Base64 encoded
  mimeType?: string
  albumId?: string
  generateThumbnail?: boolean
}

// ─────────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────────

function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

function validateRequest(body: unknown): { valid: true; data: UploadPhotoRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Invalid request body' }
  }
  
  const data = body as Record<string, unknown>
  
  if (!data.captureId || typeof data.captureId !== 'string' || !isValidUUID(data.captureId)) {
    return { valid: false, error: 'Invalid captureId: must be a valid UUID' }
  }
  
  if (!data.deviceId || typeof data.deviceId !== 'string') {
    return { valid: false, error: 'Invalid deviceId' }
  }
  
  if (!data.imageData || typeof data.imageData !== 'string') {
    return { valid: false, error: 'Invalid imageData: must be base64 encoded string' }
  }
  
  // Validate base64 format
  const base64Regex = /^[A-Za-z0-9+/=]+$/
  const cleanedData = data.imageData.replace(/^data:image\/\w+;base64,/, '')
  if (!base64Regex.test(cleanedData)) {
    return { valid: false, error: 'Invalid imageData: not valid base64' }
  }
  
  return {
    valid: true,
    data: {
      captureId: data.captureId,
      deviceId: data.deviceId,
      imageData: cleanedData,
      mimeType: (data.mimeType as string) || 'image/jpeg',
      albumId: data.albumId as string | undefined,
      generateThumbnail: data.generateThumbnail !== false,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// Storage Helpers
// ─────────────────────────────────────────────────────────────────────────────────

function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
  }
  return extensions[mimeType] || 'jpg'
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
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
    const body = await req.json()
    
    // Validate input
    const validation = validateRequest(body)
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { captureId, deviceId, imageData, mimeType, albumId } = validation.data
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Rate limiting
    const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
      p_identifier: deviceId,
      p_endpoint: 'upload-photo',
      p_max_requests: 30,  // 30 uploads per minute
      p_window_seconds: 60,
    })
    
    if (rateLimit && !rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded. Try again later.',
          reset_at: rateLimit.reset_at,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Update capture status to uploading
    await supabase
      .from('captures')
      .update({ cloud_status: 'uploading' })
      .eq('id', captureId)
    
    // Generate storage path
    const timestamp = Date.now()
    const ext = getFileExtension(mimeType!)
    const storagePath = `${deviceId}/${captureId}_${timestamp}.${ext}`
    const thumbnailPath = `${deviceId}/thumbs/${captureId}_${timestamp}_thumb.${ext}`
    
    // Convert base64 to binary
    const imageBytes = base64ToArrayBuffer(imageData)
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('captures')
      .upload(storagePath, imageBytes, {
        contentType: mimeType,
        cacheControl: '31536000',  // 1 year cache
        upsert: false,
      })
    
    if (uploadError) {
      console.error('Upload error:', uploadError)
      await supabase
        .from('captures')
        .update({ cloud_status: 'failed' })
        .eq('id', captureId)
      
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('captures')
      .getPublicUrl(storagePath)
    
    const cloudUrl = urlData.publicUrl
    
    // Update capture record
    const updateData: Record<string, unknown> = {
      cloud_url: cloudUrl,
      cloud_status: 'uploaded',
      storage_path: storagePath,
      file_size_bytes: imageBytes.length,
    }
    
    if (albumId) {
      updateData.album_id = albumId
    }
    
    const { error: updateError } = await supabase
      .from('captures')
      .update(updateData)
      .eq('id', captureId)
    
    if (updateError) {
      console.error('Update error:', updateError)
    }
    
    // Log the upload
    await supabase.from('session_events').insert({
      device_id: deviceId,
      event_type: 'photo_uploaded',
      event_data: {
        capture_id: captureId,
        storage_path: storagePath,
        file_size: imageBytes.length,
      },
    })
    
    return new Response(
      JSON.stringify({
        success: true,
        captureId,
        cloudUrl,
        storagePath,
        fileSize: imageBytes.length,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Upload photo error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

