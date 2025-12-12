-- ═══════════════════════════════════════════════════════════════════════════════
-- SIMPLE RLS POLICIES (No auth, app-level filtering)
-- 
-- For apps WITHOUT user authentication:
-- - RLS allows all operations
-- - Privacy enforced by app filtering queries by device_id
-- ═══════════════════════════════════════════════════════════════════════════════

-- CAPTURES
DROP POLICY IF EXISTS "captures_all" ON captures;
DROP POLICY IF EXISTS "captures_policy" ON captures;
CREATE POLICY "captures_access" ON captures FOR ALL USING (true) WITH CHECK (true);

-- USER_STATS  
DROP POLICY IF EXISTS "stats_all" ON user_stats;
DROP POLICY IF EXISTS "stats_policy" ON user_stats;
CREATE POLICY "stats_access" ON user_stats FOR ALL USING (true) WITH CHECK (true);

-- USER_SETTINGS
DROP POLICY IF EXISTS "settings_all" ON user_settings;
DROP POLICY IF EXISTS "settings_policy" ON user_settings;
CREATE POLICY "settings_access" ON user_settings FOR ALL USING (true) WITH CHECK (true);

-- DEVICES
DROP POLICY IF EXISTS "devices_all" ON devices;
DROP POLICY IF EXISTS "devices_policy" ON devices;
CREATE POLICY "devices_access" ON devices FOR ALL USING (true) WITH CHECK (true);

-- ACTIVE_CONNECTIONS
DROP POLICY IF EXISTS "connections_all" ON active_connections;
DROP POLICY IF EXISTS "connections_policy" ON active_connections;
CREATE POLICY "connections_access" ON active_connections FOR ALL USING (true) WITH CHECK (true);

-- SESSION_EVENTS
DROP POLICY IF EXISTS "events_all" ON session_events;
DROP POLICY IF EXISTS "events_policy" ON session_events;
CREATE POLICY "events_access" ON session_events FOR ALL USING (true) WITH CHECK (true);

-- PAIRING_SESSIONS (should already exist)
DROP POLICY IF EXISTS "Allow all operations on pairing_sessions" ON pairing_sessions;
DROP POLICY IF EXISTS "pairing_policy" ON pairing_sessions;
CREATE POLICY "pairing_access" ON pairing_sessions FOR ALL USING (true) WITH CHECK (true);

-- FEEDBACK (should already exist)
DROP POLICY IF EXISTS "Allow insert on feedback" ON feedback;
DROP POLICY IF EXISTS "feedback_policy" ON feedback;
CREATE POLICY "feedback_access" ON feedback FOR ALL USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ✅ DONE! All tables have RLS enabled with permissive policies.
-- Privacy is enforced at the application level by filtering queries.
-- ═══════════════════════════════════════════════════════════════════════════════

