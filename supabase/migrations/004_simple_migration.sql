-- ═══════════════════════════════════════════════════════════════════════════════
-- SIMPLE MIGRATION - Run this one!
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. DEVICES TABLE
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

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices_all" ON devices FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. ACTIVE CONNECTIONS TABLE
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS active_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID,
  camera_device_id VARCHAR(255) NOT NULL,
  viewer_device_id VARCHAR(255) NOT NULL,
  signaling_channel VARCHAR(255),
  is_streaming BOOLEAN DEFAULT false,
  quality VARCHAR(20) DEFAULT 'high',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE active_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "connections_all" ON active_connections FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. CAPTURES TABLE
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS captures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID,
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

ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captures_all" ON captures FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. USER STATS TABLE
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

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stats_all" ON user_stats FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. USER SETTINGS TABLE
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

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_all" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. SESSION EVENTS TABLE (Analytics)
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID,
  device_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_all" ON session_events FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DONE!
-- ═══════════════════════════════════════════════════════════════════════════════

