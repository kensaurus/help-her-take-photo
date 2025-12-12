-- ═══════════════════════════════════════════════════════════════════════════════
-- HELP HER TAKE PHOTO - Complete Database Schema
-- Run this SQL in Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. DEVICES TABLE
-- Stores anonymous device registrations (no user auth required)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,  -- Client-generated UUID
  device_name VARCHAR(255),                 -- Optional: "John's iPhone"
  platform VARCHAR(50),                     -- 'ios', 'android', 'web'
  push_token TEXT,                          -- For push notifications
  app_version VARCHAR(20),                  -- e.g., "1.0.0"
  locale VARCHAR(10) DEFAULT 'en',          -- Language preference
  timezone VARCHAR(50),                     -- e.g., "America/New_York"
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. PAIRING SESSIONS TABLE (Updated from previous migration)
-- Temporary pairing codes for connecting two devices
-- ─────────────────────────────────────────────────────────────────────────────────
-- Drop existing table if you want to recreate (uncomment if needed)
-- DROP TABLE IF EXISTS pairing_sessions CASCADE;

CREATE TABLE IF NOT EXISTS pairing_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(4) NOT NULL,
  device_id VARCHAR(255) NOT NULL,           -- Creator device
  partner_device_id VARCHAR(255),            -- Joiner device
  creator_role VARCHAR(20) DEFAULT 'camera', -- 'camera' or 'viewer'
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'expired', 'ended')),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairing_sessions(code);
CREATE INDEX IF NOT EXISTS idx_pairing_device ON pairing_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_partner ON pairing_sessions(partner_device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_status ON pairing_sessions(status);
CREATE INDEX IF NOT EXISTS idx_pairing_expires ON pairing_sessions(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. ACTIVE CONNECTIONS TABLE
-- Tracks currently active camera-viewer connections
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE CASCADE,
  camera_device_id VARCHAR(255) NOT NULL,
  viewer_device_id VARCHAR(255) NOT NULL,
  signaling_channel VARCHAR(255),            -- For WebRTC signaling
  is_streaming BOOLEAN DEFAULT false,
  quality VARCHAR(20) DEFAULT 'high',        -- 'low', 'medium', 'high'
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_camera ON active_connections(camera_device_id);
CREATE INDEX IF NOT EXISTS idx_connections_viewer ON active_connections(viewer_device_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. CAPTURES TABLE
-- Photos taken during sessions
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS captures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE SET NULL,
  camera_device_id VARCHAR(255) NOT NULL,
  viewer_device_id VARCHAR(255),
  
  -- Photo metadata
  storage_path TEXT,                         -- Supabase Storage path
  thumbnail_path TEXT,                       -- Thumbnail in storage
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  mime_type VARCHAR(50) DEFAULT 'image/jpeg',
  
  -- Capture context
  captured_by VARCHAR(20) DEFAULT 'camera',  -- 'camera' (self) or 'viewer' (remote)
  is_favorite BOOLEAN DEFAULT false,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_captures_camera ON captures(camera_device_id);
CREATE INDEX IF NOT EXISTS idx_captures_session ON captures(session_id);
CREATE INDEX IF NOT EXISTS idx_captures_created ON captures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_captures_favorites ON captures(camera_device_id, is_favorite) WHERE is_favorite = true;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. USER STATISTICS TABLE
-- Gamification: tracks photos taken, sessions, achievements
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- Photo stats
  photos_taken INTEGER DEFAULT 0,
  photos_helped INTEGER DEFAULT 0,           -- Photos guided as viewer
  photos_received INTEGER DEFAULT 0,         -- Remote captures received
  
  -- Session stats
  total_sessions INTEGER DEFAULT 0,
  camera_sessions INTEGER DEFAULT 0,
  viewer_sessions INTEGER DEFAULT 0,
  total_session_minutes INTEGER DEFAULT 0,
  
  -- Streak & engagement
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_session_date DATE,
  
  -- Achievements (stored as JSONB for flexibility)
  achievements JSONB DEFAULT '[]'::jsonb,
  
  -- Rank/Level
  experience_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_device ON user_stats(device_id);
CREATE INDEX IF NOT EXISTS idx_stats_level ON user_stats(level DESC);
CREATE INDEX IF NOT EXISTS idx_stats_xp ON user_stats(experience_points DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. USER SETTINGS TABLE
-- User preferences synchronized across sessions
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  
  -- App preferences
  theme VARCHAR(20) DEFAULT 'system',        -- 'light', 'dark', 'system'
  language VARCHAR(10) DEFAULT 'en',
  
  -- Camera settings
  default_role VARCHAR(20) DEFAULT 'camera', -- 'camera' or 'viewer'
  camera_quality VARCHAR(20) DEFAULT 'high',
  save_to_gallery BOOLEAN DEFAULT true,
  show_grid BOOLEAN DEFAULT true,
  enable_flash BOOLEAN DEFAULT false,
  
  -- Notification settings
  notifications_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  haptics_enabled BOOLEAN DEFAULT true,
  
  -- Privacy
  analytics_enabled BOOLEAN DEFAULT true,
  crash_reports_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_device ON user_settings(device_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 7. FEEDBACK TABLE (Updated from previous migration)
-- User feedback and bug reports
-- ─────────────────────────────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS feedback CASCADE;

CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255),
  type VARCHAR(20) CHECK (type IN ('feature', 'bug', 'other', 'rating')),
  message TEXT NOT NULL,
  email VARCHAR(255),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  app_version VARCHAR(20),
  platform VARCHAR(50),
  
  -- Admin fields
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewing', 'resolved', 'closed')),
  admin_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_device ON feedback(device_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 8. SESSION EVENTS TABLE (Analytics)
-- Track important events for debugging and analytics
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,           -- 'session_start', 'capture', 'disconnect', etc.
  event_data JSONB DEFAULT '{}'::jsonb,      -- Flexible event payload
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_device ON session_events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON session_events(created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- Best practice: Enable RLS on all tables, even with anon access
-- ─────────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE pairing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if recreating
DROP POLICY IF EXISTS "devices_policy" ON devices;
DROP POLICY IF EXISTS "pairing_policy" ON pairing_sessions;
DROP POLICY IF EXISTS "connections_policy" ON active_connections;
DROP POLICY IF EXISTS "captures_policy" ON captures;
DROP POLICY IF EXISTS "stats_policy" ON user_stats;
DROP POLICY IF EXISTS "settings_policy" ON user_settings;
DROP POLICY IF EXISTS "feedback_insert_policy" ON feedback;
DROP POLICY IF EXISTS "events_policy" ON session_events;

-- Devices: Full access (device manages its own record)
CREATE POLICY "devices_policy" ON devices FOR ALL USING (true) WITH CHECK (true);

-- Pairing Sessions: Full access for pairing flow
CREATE POLICY "pairing_policy" ON pairing_sessions FOR ALL USING (true) WITH CHECK (true);

-- Active Connections: Full access
CREATE POLICY "connections_policy" ON active_connections FOR ALL USING (true) WITH CHECK (true);

-- Captures: Full access (in production, restrict to device_id match)
CREATE POLICY "captures_policy" ON captures FOR ALL USING (true) WITH CHECK (true);

-- User Stats: Full access
CREATE POLICY "stats_policy" ON user_stats FOR ALL USING (true) WITH CHECK (true);

-- User Settings: Full access
CREATE POLICY "settings_policy" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- Feedback: Insert only (users can't read others' feedback)
CREATE POLICY "feedback_insert_policy" ON feedback FOR INSERT WITH CHECK (true);

-- Session Events: Full access
CREATE POLICY "events_policy" ON session_events FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────────

-- Function to clean up expired pairing sessions (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM pairing_sessions
    WHERE expires_at < NOW() AND status = 'pending'
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update user stats after a session
CREATE OR REPLACE FUNCTION update_user_stats_on_session_end()
RETURNS TRIGGER AS $$
BEGIN
  -- Update camera device stats
  INSERT INTO user_stats (device_id, total_sessions, camera_sessions)
  VALUES (NEW.device_id, 1, CASE WHEN NEW.creator_role = 'camera' THEN 1 ELSE 0 END)
  ON CONFLICT (device_id) DO UPDATE
  SET 
    total_sessions = user_stats.total_sessions + 1,
    camera_sessions = user_stats.camera_sessions + CASE WHEN NEW.creator_role = 'camera' THEN 1 ELSE 0 END,
    viewer_sessions = user_stats.viewer_sessions + CASE WHEN NEW.creator_role = 'viewer' THEN 1 ELSE 0 END,
    updated_at = NOW();
    
  -- Update partner device stats if exists
  IF NEW.partner_device_id IS NOT NULL THEN
    INSERT INTO user_stats (device_id, total_sessions, viewer_sessions)
    VALUES (NEW.partner_device_id, 1, CASE WHEN NEW.creator_role = 'camera' THEN 1 ELSE 0 END)
    ON CONFLICT (device_id) DO UPDATE
    SET 
      total_sessions = user_stats.total_sessions + 1,
      camera_sessions = user_stats.camera_sessions + CASE WHEN NEW.creator_role = 'viewer' THEN 1 ELSE 0 END,
      viewer_sessions = user_stats.viewer_sessions + CASE WHEN NEW.creator_role = 'camera' THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update stats when session ends
DROP TRIGGER IF EXISTS trigger_update_stats_on_session ON pairing_sessions;
CREATE TRIGGER trigger_update_stats_on_session
  AFTER UPDATE OF status ON pairing_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'ended')
  EXECUTE FUNCTION update_user_stats_on_session_end();

-- Function to calculate user level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Simple level formula: level = floor(sqrt(xp / 100)) + 1
  RETURN GREATEST(1, FLOOR(SQRT(xp::float / 100)) + 1);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────────
-- STORAGE BUCKET (Run separately in Storage settings)
-- ─────────────────────────────────────────────────────────────────────────────────
-- Create a storage bucket named 'captures' in Supabase Dashboard > Storage
-- Settings:
--   - Public: No (private bucket)
--   - File size limit: 10MB
--   - Allowed MIME types: image/jpeg, image/png, image/webp

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! Your database is ready.
-- ═══════════════════════════════════════════════════════════════════════════════

