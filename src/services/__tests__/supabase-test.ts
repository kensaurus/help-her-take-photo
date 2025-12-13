/**
 * Supabase Endpoint Test Script
 * Run this to verify all API endpoints are working
 * 
 * Usage: Import and call testAllEndpoints() in development
 */

import { supabase } from '../supabase'
import { pairingApi, deviceApi, capturesApi, statsApi, settingsApi, eventsApi, feedbackApi } from '../api'
import { sessionLogger } from '../sessionLogger'

interface TestResult {
  name: string
  success: boolean
  error?: string
  data?: unknown
}

const TEST_DEVICE_ID = 'test-device-' + Date.now()

export async function testAllEndpoints(): Promise<TestResult[]> {
  const results: TestResult[] = []
  
  console.log('🧪 Starting Supabase Endpoint Tests...\n')

  // Test 1: Supabase Connection
  results.push(await testSupabaseConnection())
  
  // Test 2: Device Registration
  results.push(await testDeviceRegistration())
  
  // Test 3: Pairing Flow
  results.push(await testPairingFlow())
  
  // Test 4: Stats API
  results.push(await testStatsApi())
  
  // Test 5: Settings API
  results.push(await testSettingsApi())
  
  // Test 6: Events API
  results.push(await testEventsApi())
  
  // Test 7: Feedback API
  results.push(await testFeedbackApi())
  
  // Test 8: Logging Tables
  results.push(await testLoggingTables())
  
  // Test 9: WebRTC Signals Table
  results.push(await testWebRTCSignals())
  
  // Test 10: Commands Table
  results.push(await testCommandsTable())

  // Print summary
  console.log('\n📊 Test Summary:')
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  
  results.forEach(r => {
    console.log(`${r.success ? '✅' : '❌'} ${r.name}${r.error ? ': ' + r.error : ''}`)
  })

  // Cleanup
  await cleanup()

  return results
}

async function testSupabaseConnection(): Promise<TestResult> {
  try {
    const { data, error } = await supabase.from('pairing_sessions').select('count').limit(1)
    
    if (error) throw error
    
    return { name: 'Supabase Connection', success: true }
  } catch (error) {
    return { 
      name: 'Supabase Connection', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testDeviceRegistration(): Promise<TestResult> {
  try {
    const { device, error } = await deviceApi.register(TEST_DEVICE_ID, {
      deviceName: 'Test Device',
      locale: 'en',
      timezone: 'UTC',
    })
    
    if (error) throw new Error(error)
    if (!device) throw new Error('No device returned')
    
    return { name: 'Device Registration', success: true, data: device }
  } catch (error) {
    return { 
      name: 'Device Registration', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testPairingFlow(): Promise<TestResult> {
  try {
    // Create pairing code
    const { code, error: createError } = await pairingApi.createPairing(TEST_DEVICE_ID)
    
    if (createError) throw new Error(createError)
    if (!code) throw new Error('No code returned')
    
    console.log(`  Created pairing code: ${code}`)
    
    // Check for partner (should be empty)
    const { partnerId } = await pairingApi.getPartner(TEST_DEVICE_ID, code)
    
    // Clean up
    await pairingApi.unpair(TEST_DEVICE_ID)
    
    return { name: 'Pairing Flow', success: true, data: { code, partnerId } }
  } catch (error) {
    return { 
      name: 'Pairing Flow', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testStatsApi(): Promise<TestResult> {
  try {
    // Get stats (should create default)
    const { stats, error } = await statsApi.get(TEST_DEVICE_ID)
    
    if (error) throw new Error(error)
    
    // Increment photos
    await statsApi.incrementPhotos(TEST_DEVICE_ID, 'taken')
    
    // Add XP
    await statsApi.addXP(TEST_DEVICE_ID, 10)
    
    return { name: 'Stats API', success: true, data: stats }
  } catch (error) {
    return { 
      name: 'Stats API', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testSettingsApi(): Promise<TestResult> {
  try {
    // Save settings
    const { success, error: saveError } = await settingsApi.save(TEST_DEVICE_ID, {
      theme_preference: 'dark',
      language: 'en',
      notifications_enabled: true,
    })
    
    if (saveError) throw new Error(saveError)
    
    // Get settings
    const { settings, error: getError } = await settingsApi.get(TEST_DEVICE_ID)
    
    if (getError) throw new Error(getError)
    
    return { name: 'Settings API', success: true, data: settings }
  } catch (error) {
    return { 
      name: 'Settings API', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testEventsApi(): Promise<TestResult> {
  try {
    await eventsApi.log({
      deviceId: TEST_DEVICE_ID,
      eventType: 'test_event',
      eventData: { test: true },
    })
    
    return { name: 'Events API', success: true }
  } catch (error) {
    return { 
      name: 'Events API', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testFeedbackApi(): Promise<TestResult> {
  try {
    const { success, error } = await feedbackApi.submit({
      deviceId: TEST_DEVICE_ID,
      type: 'other',
      message: 'Test feedback from endpoint test',
    })
    
    if (error) throw new Error(error)
    
    return { name: 'Feedback API', success: true }
  } catch (error) {
    return { 
      name: 'Feedback API', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testLoggingTables(): Promise<TestResult> {
  try {
    // Test app_logs insert
    const { error: logError } = await supabase.from('app_logs').insert({
      device_id: TEST_DEVICE_ID,
      level: 'info',
      event: 'test_log',
      data: { test: true },
      timestamp: new Date().toISOString(),
    })
    
    if (logError) throw logError
    
    // Test session_events insert
    const { error: eventError } = await supabase.from('session_events').insert({
      device_id: TEST_DEVICE_ID,
      event_type: 'test_session_event',
      metadata: { test: true },
    })
    
    if (eventError) throw eventError
    
    return { name: 'Logging Tables', success: true }
  } catch (error) {
    return { 
      name: 'Logging Tables', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testWebRTCSignals(): Promise<TestResult> {
  try {
    const { error } = await supabase.from('webrtc_signals').insert({
      session_id: 'test-session',
      from_device_id: TEST_DEVICE_ID,
      to_device_id: 'other-device',
      signal_type: 'offer',
      signal_data: { type: 'offer', sdp: 'test' },
    })
    
    if (error) throw error
    
    return { name: 'WebRTC Signals Table', success: true }
  } catch (error) {
    return { 
      name: 'WebRTC Signals Table', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function testCommandsTable(): Promise<TestResult> {
  try {
    const { error } = await supabase.from('commands').insert({
      session_id: 'test-session',
      from_device_id: TEST_DEVICE_ID,
      to_device_id: 'other-device',
      command_type: 'direction',
      command_data: { direction: 'left' },
    })
    
    if (error) throw error
    
    return { name: 'Commands Table', success: true }
  } catch (error) {
    return { 
      name: 'Commands Table', 
      success: false, 
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

async function cleanup(): Promise<void> {
  console.log('\n🧹 Cleaning up test data...')
  
  try {
    // Delete test device data
    await supabase.from('devices').delete().eq('device_id', TEST_DEVICE_ID)
    await supabase.from('user_stats').delete().eq('device_id', TEST_DEVICE_ID)
    await supabase.from('user_settings').delete().eq('device_id', TEST_DEVICE_ID)
    await supabase.from('pairing_sessions').delete().eq('device_id', TEST_DEVICE_ID)
    await supabase.from('session_events').delete().eq('device_id', TEST_DEVICE_ID)
    await supabase.from('app_logs').delete().eq('device_id', TEST_DEVICE_ID)
    await supabase.from('webrtc_signals').delete().eq('from_device_id', TEST_DEVICE_ID)
    await supabase.from('commands').delete().eq('from_device_id', TEST_DEVICE_ID)
    await supabase.from('feedback').delete().eq('device_token', TEST_DEVICE_ID)
    
    console.log('✅ Cleanup complete')
  } catch (error) {
    console.error('⚠️ Cleanup error:', error)
  }
}

// Export individual test functions for granular testing
export {
  testSupabaseConnection,
  testDeviceRegistration,
  testPairingFlow,
  testStatsApi,
  testSettingsApi,
  testEventsApi,
  testFeedbackApi,
  testLoggingTables,
  testWebRTCSignals,
  testCommandsTable,
}

