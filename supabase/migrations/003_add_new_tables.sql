-- ═══════════════════════════════════════════════════════════════════════════════
-- HELP HER TAKE PHOTO - Add New Tables (Safe Migration)
-- Run this SQL in Supabase Dashboard > SQL Editor
-- This migration ONLY adds new tables, preserves existing ones
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. ADD MISSING COLUMNS TO PAIRING_SESSIONS (if not exist)
-- ─────────────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  -- Add creator_role column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pairing_sessions' AND column_name = 'creator_role') THEN
    ALTER TABLE pairing_sessions ADD COLUMN creator_role VARCHAR(20) DEFAULT 'camera';
  END IF;
  
  -- Add ended_at column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'pairing_sessions' AND column_name = 'ended_at') THEN
    ALTER TABLE pairing_sessions ADD COLUMN ended_at TIMESTAMPTZ;
  END IF;
END $$;

-- Update status check constraint to include 'ended'
ALTER TABLE pairing_sessions DROP CONSTRAINT IF EXISTS pairing_sessions_status_check;
ALTER TABLE pairing_sessions ADD CONSTRAINT pairing_sessions_status_check 
  CHECK (status IN ('pending', 'paired', 'expired', 'ended'));

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. ADD MISSING COLUMNS TO FEEDBACK (if not exist)
-- ─────────────────────────────────────────────────────────────────────────────────
DO $$ 
BEGIN
  -- Rename device_token to device_id for consistency
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'feedback' AND column_name = 'device_token') THEN
    ALTER TABLE feedback RENAME COLUMN device_token TO device_id;
  END IF;
  
  -- Add app_version column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'feedback' AND column_name = 'app_version') THEN
    ALTER TABLE feedback ADD COLUMN app_version VARCHAR(20);
  END IF;
  
  -- Add platform column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'feedback' AND column_name = 'platform') THEN
    ALTER TABLE feedback ADD COLUMN platform VARCHAR(50);
  END IF;
  
  -- Add status column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'feedback' AND column_name = 'status') THEN
    ALTER TABLE feedback ADD COLUMN status VARCHAR(20) DEFAULT 'new';
  END IF;
  
  -- Add admin_notes column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'feedback' AND column_name = 'admin_notes') THEN
    ALTER TABLE feedback ADD COLUMN admin_notes TEXT;
  END IF;
END $$;

-- Update type check constraint
ALTER TABLE feedback DROP CONSTRAINT IF EXISTS feedback_type_check;
ALTER TABLE feedback ADD CONSTRAINT feedback_type_check 
  CHECK (type IN ('feature', 'bug', 'other', 'rating'));

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. DEVICES TABLE (New)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  platform VARCHAR(50),
  push_token TEXT,
  app_version VARCHAR(20),
  locale VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_last_active ON devices(last_active_at);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devices_policy" ON devices;
CREATE POLICY "devices_policy" ON devices FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. ACTIVE CONNECTIONS TABLE (New)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE CASCADE,
  camera_device_id VARCHAR(255) NOT NULL,
  viewer_device_id VARCHAR(255) NOT NULL,
  signaling_channel VARCHAR(255),
  is_streaming BOOLEAN DEFAULT false,
  quality VARCHAR(20) DEFAULT 'high',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connections_camera ON active_connections(camera_device_id);
CREATE INDEX IF NOT EXISTS idx_connections_viewer ON active_connections(viewer_device_id);

ALTER TABLE active_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "connections_policy" ON active_connections;
CREATE POLICY "connections_policy" ON active_connections FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. CAPTURES TABLE (New)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS captures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE SET NULL,
  camera_device_id VARCHAR(255) NOT NULL,
  viewer_device_id VARCHAR(255),
  storage_path TEXT,
  thumbnail_path TEXT,
  width INTEGER,
  height INTEGER,
  file_size_bytes BIGINT,
  mime_type VARCHAR(50) DEFAULT 'image/jpeg',
  captured_by VARCHAR(20) DEFAULT 'camera',
  is_favorite BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_captures_camera ON captures(camera_device_id);
CREATE INDEX IF NOT EXISTS idx_captures_session ON captures(session_id);
CREATE INDEX IF NOT EXISTS idx_captures_created ON captures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_captures_favorites ON captures(camera_device_id, is_favorite) WHERE is_favorite = true;

ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "captures_policy" ON captures;
CREATE POLICY "captures_policy" ON captures FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. USER STATS TABLE (New)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  photos_taken INTEGER DEFAULT 0,
  photos_helped INTEGER DEFAULT 0,
  photos_received INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  camera_sessions INTEGER DEFAULT 0,
  viewer_sessions INTEGER DEFAULT 0,
  total_session_minutes INTEGER DEFAULT 0,
  current_streak_days INTEGER DEFAULT 0,
  longest_streak_days INTEGER DEFAULT 0,
  last_session_date DATE,
  achievements JSONB DEFAULT '[]'::jsonb,
  experience_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stats_device ON user_stats(device_id);
CREATE INDEX IF NOT EXISTS idx_stats_level ON user_stats(level DESC);
CREATE INDEX IF NOT EXISTS idx_stats_xp ON user_stats(experience_points DESC);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stats_policy" ON user_stats;
CREATE POLICY "stats_policy" ON user_stats FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 7. USER SETTINGS TABLE (New)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) UNIQUE NOT NULL,
  theme VARCHAR(20) DEFAULT 'system',
  language VARCHAR(10) DEFAULT 'en',
  default_role VARCHAR(20) DEFAULT 'camera',
  camera_quality VARCHAR(20) DEFAULT 'high',
  save_to_gallery BOOLEAN DEFAULT true,
  show_grid BOOLEAN DEFAULT true,
  enable_flash BOOLEAN DEFAULT false,
  notifications_enabled BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  haptics_enabled BOOLEAN DEFAULT true,
  analytics_enabled BOOLEAN DEFAULT true,
  crash_reports_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settings_device ON user_settings(device_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_policy" ON user_settings;
CREATE POLICY "settings_policy" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 8. SESSION EVENTS TABLE (New - Analytics)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE CASCADE,
  device_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON session_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_device ON session_events(device_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON session_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON session_events(created_at DESC);

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "events_policy" ON session_events;
CREATE POLICY "events_policy" ON session_events FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 9. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────────

-- Function to clean up expired pairing sessions
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

-- Function to calculate user level from XP
CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(1, FLOOR(SQRT(xp::float / 100)) + 1);
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DONE! All tables created successfully.
-- ═══════════════════════════════════════════════════════════════════════════════

