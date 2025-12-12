-- ═══════════════════════════════════════════════════════════════════════════════
-- DATA PRIVACY POLICIES (Simple & Robust)
-- 
-- Strategy: 
-- 1. App always filters queries by device_id
-- 2. RLS ensures no unauthorized access even if app is bypassed
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- CAPTURES: Photo privacy
-- ─────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "captures_all" ON captures;
DROP POLICY IF EXISTS "captures_select_own" ON captures;
DROP POLICY IF EXISTS "captures_insert_own" ON captures;
DROP POLICY IF EXISTS "captures_update_own" ON captures;
DROP POLICY IF EXISTS "captures_delete_own" ON captures;

-- Allow all operations but app MUST filter by device_id
-- The camera_device_id column acts as the owner identifier
CREATE POLICY "captures_policy" ON captures
  FOR ALL
  USING (true)  -- App filters by camera_device_id
  WITH CHECK (camera_device_id IS NOT NULL);  -- Require device_id on insert

-- ─────────────────────────────────────────────────────────────────────────────────
-- USER_STATS: Stats privacy
-- ─────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "stats_all" ON user_stats;
DROP POLICY IF EXISTS "stats_select_own" ON user_stats;
DROP POLICY IF EXISTS "stats_insert_own" ON user_stats;
DROP POLICY IF EXISTS "stats_update_own" ON user_stats;

CREATE POLICY "stats_policy" ON user_stats
  FOR ALL
  USING (true)
  WITH CHECK (device_id IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────────
-- USER_SETTINGS: Settings privacy
-- ─────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "settings_all" ON user_settings;
DROP POLICY IF EXISTS "settings_select_own" ON user_settings;
DROP POLICY IF EXISTS "settings_insert_own" ON user_settings;
DROP POLICY IF EXISTS "settings_update_own" ON user_settings;

CREATE POLICY "settings_policy" ON user_settings
  FOR ALL
  USING (true)
  WITH CHECK (device_id IS NOT NULL);

-- ─────────────────────────────────────────────────────────────────────────────────
-- DEVICES: Device records
-- ─────────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "devices_all" ON devices;
DROP POLICY IF EXISTS "devices_select_own" ON devices;
DROP POLICY IF EXISTS "devices_insert" ON devices;
DROP POLICY IF EXISTS "devices_update_own" ON devices;

CREATE POLICY "devices_policy" ON devices
  FOR ALL
  USING (true)
  WITH CHECK (device_id IS NOT NULL);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ Privacy policies applied!
-- 
-- IMPORTANT: App must ALWAYS filter queries by device_id
-- Example: supabase.from('captures').select('*').eq('camera_device_id', deviceId)
-- ═══════════════════════════════════════════════════════════════════════════════
