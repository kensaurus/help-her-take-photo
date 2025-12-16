-- ═══════════════════════════════════════════════════════════════════════════════
-- HELP HER TAKE PHOTO - Enhanced Features Migration
-- December 16, 2025
-- 
-- New Features:
-- 1. Push Notification Queue
-- 2. Photo Albums & Cloud Backup
-- 3. AI Analysis Results
-- 4. Session Recordings
-- 5. Social/Friends System
-- 6. Database Rate Limiting
-- 7. Analytics Aggregations
-- 8. Offline Sync Queue
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. PUSH NOTIFICATION QUEUE
-- Queue notifications for delivery via Expo Push API
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  expo_push_token TEXT,                          -- ExponentPushToken[xxx]
  title VARCHAR(255),
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,                -- Custom payload
  priority VARCHAR(20) DEFAULT 'default',        -- 'default', 'normal', 'high'
  sound VARCHAR(50) DEFAULT 'default',
  badge INTEGER,
  channel_id VARCHAR(100),                       -- Android channel
  category_id VARCHAR(100),                      -- Notification category
  
  -- Status tracking
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
  ticket_id VARCHAR(255),                        -- Expo push ticket ID
  receipt_status VARCHAR(20),                    -- Receipt status from Expo
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Scheduling
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours'),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_queue_status ON notification_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notif_queue_device ON notification_queue(device_id);
CREATE INDEX IF NOT EXISTS idx_notif_queue_expires ON notification_queue(expires_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. PHOTO ALBUMS & CLOUD BACKUP
-- Organize photos into albums with sharing capabilities
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS photo_albums (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  cover_photo_id UUID,                           -- Reference to captures.id
  share_code VARCHAR(8) UNIQUE,                  -- 8-char code for sharing
  is_public BOOLEAN DEFAULT false,
  photo_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_albums_device ON photo_albums(device_id);
CREATE INDEX IF NOT EXISTS idx_albums_share_code ON photo_albums(share_code) WHERE share_code IS NOT NULL;

-- Add album and cloud columns to captures
ALTER TABLE captures ADD COLUMN IF NOT EXISTS album_id UUID REFERENCES photo_albums(id) ON DELETE SET NULL;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS cloud_url TEXT;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS cloud_thumbnail_url TEXT;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS cloud_status VARCHAR(20) DEFAULT 'local' CHECK (cloud_status IN ('local', 'uploading', 'uploaded', 'failed'));
ALTER TABLE captures ADD COLUMN IF NOT EXISTS ai_analysis JSONB;
ALTER TABLE captures ADD COLUMN IF NOT EXISTS ai_score DECIMAL(3,1);

CREATE INDEX IF NOT EXISTS idx_captures_album ON captures(album_id);
CREATE INDEX IF NOT EXISTS idx_captures_cloud ON captures(cloud_status);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. AI ANALYSIS RESULTS
-- Store detailed AI analysis for photos
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ai_analyses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  capture_id UUID REFERENCES captures(id) ON DELETE CASCADE,
  
  -- Composition Analysis
  composition_score DECIMAL(3,1),                -- 0.0 - 10.0
  composition_suggestions TEXT[],
  rule_of_thirds_score DECIMAL(3,1),
  symmetry_score DECIMAL(3,1),
  
  -- Technical Analysis
  sharpness_score DECIMAL(3,1),
  exposure_score DECIMAL(3,1),
  lighting_quality VARCHAR(20),                  -- 'poor', 'fair', 'good', 'excellent'
  is_blurry BOOLEAN DEFAULT false,
  
  -- Object Detection
  detected_objects JSONB DEFAULT '[]'::jsonb,    -- [{name, confidence, bbox}]
  faces_detected INTEGER DEFAULT 0,
  face_positions JSONB DEFAULT '[]'::jsonb,      -- [{x, y, width, height}]
  
  -- Scene Analysis
  scene_type VARCHAR(50),                        -- 'portrait', 'landscape', 'indoor', etc.
  dominant_colors JSONB DEFAULT '[]'::jsonb,     -- ['#FF0000', '#00FF00']
  mood VARCHAR(50),                              -- 'happy', 'serene', 'dramatic'
  
  -- AI Provider Info
  provider VARCHAR(50),                          -- 'openai', 'google', 'replicate'
  model_version VARCHAR(50),
  processing_time_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_analyses_capture ON ai_analyses(capture_id);
CREATE INDEX IF NOT EXISTS idx_ai_analyses_score ON ai_analyses(composition_score DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. SESSION RECORDINGS
-- Record events during photo sessions for replay
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS session_recordings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES pairing_sessions(id) ON DELETE CASCADE,
  camera_device_id VARCHAR(255) NOT NULL,
  viewer_device_id VARCHAR(255),
  
  -- Session metrics
  duration_seconds INTEGER DEFAULT 0,
  total_photos INTEGER DEFAULT 0,
  total_commands INTEGER DEFAULT 0,
  
  -- Direction command stats
  commands_up INTEGER DEFAULT 0,
  commands_down INTEGER DEFAULT 0,
  commands_left INTEGER DEFAULT 0,
  commands_right INTEGER DEFAULT 0,
  commands_closer INTEGER DEFAULT 0,
  commands_back INTEGER DEFAULT 0,
  
  -- Quality metrics
  avg_connection_quality DECIMAL(3,1),
  disconnection_count INTEGER DEFAULT 0,
  
  -- Events timeline
  events JSONB DEFAULT '[]'::jsonb,              -- [{timestamp, type, data}]
  
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recordings_session ON session_recordings(session_id);
CREATE INDEX IF NOT EXISTS idx_recordings_camera ON session_recordings(camera_device_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. SOCIAL/FRIENDS SYSTEM
-- Connect with frequent photo partners
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS friend_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  friend_device_id VARCHAR(255) NOT NULL,
  nickname VARCHAR(50),
  avatar_url TEXT,
  
  -- Connection status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  
  -- Session stats with this friend
  total_sessions INTEGER DEFAULT 0,
  total_photos_together INTEGER DEFAULT 0,
  last_session_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(device_id, friend_device_id)
);

CREATE INDEX IF NOT EXISTS idx_friends_device ON friend_connections(device_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_friend ON friend_connections(friend_device_id);

-- Quick reconnect with recent partners
CREATE TABLE IF NOT EXISTS recent_partners (
  device_id VARCHAR(255) NOT NULL,
  partner_device_id VARCHAR(255) NOT NULL,
  partner_nickname VARCHAR(50),
  session_count INTEGER DEFAULT 1,
  photos_taken INTEGER DEFAULT 0,
  last_session_at TIMESTAMPTZ DEFAULT NOW(),
  
  PRIMARY KEY (device_id, partner_device_id)
);

CREATE INDEX IF NOT EXISTS idx_recent_partners_last ON recent_partners(device_id, last_session_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. DATABASE RATE LIMITING
-- Persistent rate limiting that survives function restarts
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  identifier VARCHAR(255) PRIMARY KEY,
  endpoint VARCHAR(100) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  window_duration_seconds INTEGER DEFAULT 60,
  max_requests INTEGER DEFAULT 10,
  last_request_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_start);

-- Rate limit check function
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_endpoint TEXT DEFAULT 'default',
  p_max_requests INT DEFAULT 10,
  p_window_seconds INT DEFAULT 60
) RETURNS JSONB AS $$
DECLARE
  v_entry RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_allowed BOOLEAN;
  v_remaining INT;
BEGIN
  -- Get or create rate limit entry
  SELECT * INTO v_entry FROM rate_limits 
  WHERE identifier = p_identifier AND endpoint = p_endpoint;
  
  IF v_entry IS NULL THEN
    -- New entry
    INSERT INTO rate_limits (identifier, endpoint, request_count, window_start, max_requests, window_duration_seconds)
    VALUES (p_identifier, p_endpoint, 1, v_now, p_max_requests, p_window_seconds);
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1, 'reset_at', v_now + (p_window_seconds || ' seconds')::interval);
  END IF;
  
  -- Check if window has expired
  IF v_entry.window_start + (v_entry.window_duration_seconds || ' seconds')::interval < v_now THEN
    -- Reset window
    UPDATE rate_limits 
    SET request_count = 1, window_start = v_now, last_request_at = v_now
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1, 'reset_at', v_now + (p_window_seconds || ' seconds')::interval);
  END IF;
  
  -- Check if within limits
  IF v_entry.request_count >= p_max_requests THEN
    v_remaining := 0;
    v_allowed := false;
  ELSE
    v_remaining := p_max_requests - v_entry.request_count - 1;
    v_allowed := true;
    UPDATE rate_limits 
    SET request_count = request_count + 1, last_request_at = v_now
    WHERE identifier = p_identifier AND endpoint = p_endpoint;
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed, 
    'remaining', v_remaining, 
    'reset_at', v_entry.window_start + (v_entry.window_duration_seconds || ' seconds')::interval
  );
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────────
-- 7. ANALYTICS AGGREGATIONS
-- Pre-computed analytics for dashboard
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  
  -- Session metrics
  total_sessions INTEGER DEFAULT 0,
  active_devices INTEGER DEFAULT 0,
  new_devices INTEGER DEFAULT 0,
  
  -- Photo metrics
  total_photos INTEGER DEFAULT 0,
  photos_with_ai_analysis INTEGER DEFAULT 0,
  avg_ai_score DECIMAL(3,1),
  
  -- Direction command metrics
  total_commands INTEGER DEFAULT 0,
  commands_breakdown JSONB DEFAULT '{}'::jsonb,  -- {up: 100, down: 50, ...}
  
  -- Session quality
  avg_session_duration_seconds INTEGER DEFAULT 0,
  sessions_with_disconnects INTEGER DEFAULT 0,
  
  -- Engagement
  returning_devices INTEGER DEFAULT 0,
  sessions_per_device DECIMAL(3,1),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_daily(date DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- 8. OFFLINE SYNC QUEUE
-- Queue operations when device is offline
-- ─────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_sync (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id VARCHAR(255) NOT NULL,
  operation VARCHAR(20) NOT NULL CHECK (operation IN ('insert', 'update', 'delete')),
  table_name VARCHAR(50) NOT NULL,
  record_id UUID,
  record_data JSONB NOT NULL,
  
  -- Sync status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'conflict', 'failed')),
  conflict_resolution VARCHAR(20),               -- 'server_wins', 'client_wins', 'merge'
  conflict_data JSONB,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 5,
  last_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sync_device_status ON pending_sync(device_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_created ON pending_sync(created_at);

-- ─────────────────────────────────────────────────────────────────────────────────
-- REALTIME BROADCAST HELPERS
-- Functions for broadcasting messages from database
-- ─────────────────────────────────────────────────────────────────────────────────

-- Function to broadcast direction commands
CREATE OR REPLACE FUNCTION broadcast_direction_command()
RETURNS TRIGGER AS $$
BEGIN
  -- Broadcast to the session channel
  PERFORM realtime.send(
    jsonb_build_object(
      'type', 'direction',
      'direction', NEW.direction,
      'sender_device_id', NEW.sender_device_id,
      'timestamp', NEW.created_at
    ),
    'direction_command',
    'session:' || NEW.session_id::text,
    false  -- public channel
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for commands table (if it exists)
DROP TRIGGER IF EXISTS broadcast_command_trigger ON commands;
-- CREATE TRIGGER broadcast_command_trigger
--   AFTER INSERT ON commands
--   FOR EACH ROW
--   EXECUTE FUNCTION broadcast_direction_command();

-- ─────────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY POLICIES
-- ─────────────────────────────────────────────────────────────────────────────────

-- Enable RLS on all new tables
ALTER TABLE notification_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE recent_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_sync ENABLE ROW LEVEL SECURITY;

-- Basic policies (allow all for now - tighten in production)
CREATE POLICY "notification_queue_policy" ON notification_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "photo_albums_policy" ON photo_albums FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ai_analyses_policy" ON ai_analyses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "session_recordings_policy" ON session_recordings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "friend_connections_policy" ON friend_connections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "recent_partners_policy" ON recent_partners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "rate_limits_policy" ON rate_limits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "analytics_daily_policy" ON analytics_daily FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pending_sync_policy" ON pending_sync FOR ALL USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────────

-- Generate short share code
CREATE OR REPLACE FUNCTION generate_share_code(length INT DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  -- Exclude confusing chars
  result TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update photo album count trigger
CREATE OR REPLACE FUNCTION update_album_photo_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.album_id IS NOT NULL THEN
    UPDATE photo_albums SET photo_count = photo_count + 1, updated_at = NOW() WHERE id = NEW.album_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.album_id IS DISTINCT FROM NEW.album_id THEN
    IF OLD.album_id IS NOT NULL THEN
      UPDATE photo_albums SET photo_count = photo_count - 1, updated_at = NOW() WHERE id = OLD.album_id;
    END IF;
    IF NEW.album_id IS NOT NULL THEN
      UPDATE photo_albums SET photo_count = photo_count + 1, updated_at = NOW() WHERE id = NEW.album_id;
    END IF;
  ELSIF TG_OP = 'DELETE' AND OLD.album_id IS NOT NULL THEN
    UPDATE photo_albums SET photo_count = photo_count - 1, updated_at = NOW() WHERE id = OLD.album_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_album_count_trigger ON captures;
CREATE TRIGGER update_album_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON captures
  FOR EACH ROW
  EXECUTE FUNCTION update_album_photo_count();

-- Update recent partners after session
CREATE OR REPLACE FUNCTION update_recent_partners()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND NEW.partner_device_id IS NOT NULL THEN
    -- Update for creator
    INSERT INTO recent_partners (device_id, partner_device_id, session_count, last_session_at)
    VALUES (NEW.device_id, NEW.partner_device_id, 1, NOW())
    ON CONFLICT (device_id, partner_device_id) DO UPDATE
    SET session_count = recent_partners.session_count + 1,
        last_session_at = NOW();
    
    -- Update for partner
    INSERT INTO recent_partners (device_id, partner_device_id, session_count, last_session_at)
    VALUES (NEW.partner_device_id, NEW.device_id, 1, NOW())
    ON CONFLICT (device_id, partner_device_id) DO UPDATE
    SET session_count = recent_partners.session_count + 1,
        last_session_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_partners_trigger ON pairing_sessions;
CREATE TRIGGER update_partners_trigger
  AFTER UPDATE OF status ON pairing_sessions
  FOR EACH ROW
  WHEN (NEW.status = 'ended')
  EXECUTE FUNCTION update_recent_partners();

-- ═══════════════════════════════════════════════════════════════════════════════
-- DONE! Enhanced features schema ready.
-- Next: Deploy Edge Functions and set up pg_cron jobs
-- ═══════════════════════════════════════════════════════════════════════════════

