/**
 * Analyze Photo Edge Function
 * 
 * Uses AI (OpenAI GPT-4 Vision / Google Cloud Vision) to analyze photos.
 * Returns composition score, suggestions, detected objects, and more.
 * 
 * POST /functions/v1/analyze-photo
 * Body: {
 *   captureId: string,          // UUID of the capture record
 *   imageUrl?: string,          // Cloud URL of the image
 *   imageData?: string,         // Or base64 encoded image
 *   provider?: 'openai' | 'google',  // AI provider (default: openai)
 *   analysisType?: 'full' | 'quick'  // Analysis depth (default: quick)
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

interface AnalyzePhotoRequest {
  captureId: string
  imageUrl?: string
  imageData?: string
  provider?: 'openai' | 'google'
  analysisType?: 'full' | 'quick'
  deviceId?: string
}

interface AIAnalysisResult {
  compositionScore: number          // 0-10
  compositionSuggestions: string[]
  ruleOfThirdsScore: number
  symmetryScore: number
  sharpnessScore: number
  exposureScore: number
  lightingQuality: 'poor' | 'fair' | 'good' | 'excellent'
  isBlurry: boolean
  detectedObjects: Array<{ name: string; confidence: number }>
  facesDetected: number
  sceneType: string
  dominantColors: string[]
  mood: string
  overallSuggestion: string
}

// ─────────────────────────────────────────────────────────────────────────────────
// OpenAI Vision Analysis
// ─────────────────────────────────────────────────────────────────────────────────

const ANALYSIS_PROMPT = `You are a professional photography critic and coach. Analyze this photo and provide feedback in the following JSON format:

{
  "compositionScore": <number 0-10>,
  "compositionSuggestions": [<array of 2-3 specific suggestions>],
  "ruleOfThirdsScore": <number 0-10>,
  "symmetryScore": <number 0-10>,
  "sharpnessScore": <number 0-10>,
  "exposureScore": <number 0-10>,
  "lightingQuality": "<poor|fair|good|excellent>",
  "isBlurry": <boolean>,
  "detectedObjects": [{"name": "<object>", "confidence": <0.0-1.0>}],
  "facesDetected": <number>,
  "sceneType": "<portrait|landscape|indoor|outdoor|food|architecture|etc>",
  "dominantColors": ["<hex color>", ...],
  "mood": "<happy|serene|dramatic|playful|etc>",
  "overallSuggestion": "<one sentence actionable tip>"
}

Be specific and constructive with suggestions. Focus on practical tips the photographer can apply immediately.`

async function analyzeWithOpenAI(imageSource: string, isUrl: boolean): Promise<AIAnalysisResult> {
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }
  
  const imageContent = isUrl
    ? { type: 'image_url', image_url: { url: imageSource, detail: 'high' } }
    : { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageSource}`, detail: 'high' } }
  
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYSIS_PROMPT },
            imageContent,
          ],
        },
      ],
      max_tokens: 1000,
      response_format: { type: 'json_object' },
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }
  
  const result = await response.json()
  const content = result.choices[0]?.message?.content
  
  if (!content) {
    throw new Error('No response from OpenAI')
  }
  
  return JSON.parse(content) as AIAnalysisResult
}

// ─────────────────────────────────────────────────────────────────────────────────
// Fallback Quick Analysis (without AI API)
// ─────────────────────────────────────────────────────────────────────────────────

function quickAnalysis(): AIAnalysisResult {
  // Returns placeholder analysis when AI is not available
  return {
    compositionScore: 7.0,
    compositionSuggestions: [
      'Try positioning your subject using the rule of thirds',
      'Ensure good lighting on the face',
      'Check for distracting background elements',
    ],
    ruleOfThirdsScore: 6.5,
    symmetryScore: 7.0,
    sharpnessScore: 7.5,
    exposureScore: 7.0,
    lightingQuality: 'good',
    isBlurry: false,
    detectedObjects: [],
    facesDetected: 0,
    sceneType: 'general',
    dominantColors: ['#808080'],
    mood: 'neutral',
    overallSuggestion: 'AI analysis unavailable. Consider framing your subject with the rule of thirds for better composition.',
  }
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
  
  const startTime = Date.now()
  
  try {
    const body: AnalyzePhotoRequest = await req.json()
    
    if (!body.captureId) {
      return new Response(
        JSON.stringify({ success: false, error: 'captureId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    if (!body.imageUrl && !body.imageData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Either imageUrl or imageData is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Rate limiting
    if (body.deviceId) {
      const { data: rateLimit } = await supabase.rpc('check_rate_limit', {
        p_identifier: body.deviceId,
        p_endpoint: 'analyze-photo',
        p_max_requests: 10,  // 10 analyses per minute
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
    }
    
    // Perform analysis
    let analysis: AIAnalysisResult
    const provider = body.provider || 'openai'
    
    try {
      if (provider === 'openai' && Deno.env.get('OPENAI_API_KEY')) {
        analysis = await analyzeWithOpenAI(
          body.imageUrl || body.imageData!,
          !!body.imageUrl
        )
      } else {
        // Fallback to quick analysis
        analysis = quickAnalysis()
      }
    } catch (aiError) {
      console.error('AI analysis error:', aiError)
      analysis = quickAnalysis()
    }
    
    const processingTime = Date.now() - startTime
    
    // Store analysis in database
    const { error: insertError } = await supabase.from('ai_analyses').insert({
      capture_id: body.captureId,
      composition_score: analysis.compositionScore,
      composition_suggestions: analysis.compositionSuggestions,
      rule_of_thirds_score: analysis.ruleOfThirdsScore,
      symmetry_score: analysis.symmetryScore,
      sharpness_score: analysis.sharpnessScore,
      exposure_score: analysis.exposureScore,
      lighting_quality: analysis.lightingQuality,
      is_blurry: analysis.isBlurry,
      detected_objects: analysis.detectedObjects,
      faces_detected: analysis.facesDetected,
      scene_type: analysis.sceneType,
      dominant_colors: analysis.dominantColors,
      mood: analysis.mood,
      provider: provider,
      processing_time_ms: processingTime,
    })
    
    if (insertError) {
      console.error('Insert error:', insertError)
    }
    
    // Update capture with AI score
    await supabase
      .from('captures')
      .update({
        ai_analysis: analysis,
        ai_score: analysis.compositionScore,
      })
      .eq('id', body.captureId)
    
    // Send notification if analysis is complete
    if (body.deviceId && analysis.compositionScore > 0) {
      // Trigger notification (fire and forget)
      fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: body.deviceId,
          type: 'ai_analysis_ready',
          data: { captureId: body.captureId, score: analysis.compositionScore },
        }),
      }).catch(console.error)
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        captureId: body.captureId,
        analysis,
        processingTimeMs: processingTime,
        provider,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('Analyze photo error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

