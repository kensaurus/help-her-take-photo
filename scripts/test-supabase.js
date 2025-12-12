/**
 * Quick test script for Supabase connection
 * Run: node scripts/test-supabase.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

console.log('🔍 Testing Supabase Connection...\n')

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing credentials in .env:')
  console.error('   EXPO_PUBLIC_SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗ MISSING')
  console.error('   EXPO_PUBLIC_SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? '✓' : '✗ MISSING')
  process.exit(1)
}

console.log('✓ Credentials found')
console.log('  URL:', SUPABASE_URL)
console.log('  Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...\n')

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function test() {
  try {
    // Test 1: Check if table exists
    console.log('📋 Testing pairing_sessions table...')
    const { data, error } = await supabase
      .from('pairing_sessions')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Table error:', error.message)
      console.error('\n   Make sure you ran the SQL migration in Supabase Dashboard!')
      return
    }

    console.log('✓ Table exists and accessible\n')

    // Test 2: Create a test pairing
    console.log('🔗 Creating test pairing code...')
    const testCode = Math.floor(1000 + Math.random() * 9000).toString()
    const testDeviceId = 'test-device-' + Date.now()

    const { data: created, error: createError } = await supabase
      .from('pairing_sessions')
      .insert({
        code: testCode,
        device_id: testDeviceId,
        status: 'pending',
        expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    if (createError) {
      console.error('❌ Create error:', createError.message)
      return
    }

    console.log('✓ Created pairing code:', testCode)
    console.log('  Session ID:', created.id, '\n')

    // Test 3: Clean up test data
    console.log('🧹 Cleaning up test data...')
    await supabase
      .from('pairing_sessions')
      .delete()
      .eq('device_id', testDeviceId)

    console.log('✓ Cleanup complete\n')

    console.log('═══════════════════════════════════════')
    console.log('✅ ALL TESTS PASSED! Supabase is ready.')
    console.log('═══════════════════════════════════════')

  } catch (err) {
    console.error('❌ Unexpected error:', err.message)
  }
}

test()

