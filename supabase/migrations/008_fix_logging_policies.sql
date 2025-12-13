-- Fix: Drop existing policies before recreating them
-- Run this if you get "policy already exists" error

-- Drop existing policies on app_logs
DROP POLICY IF EXISTS "Allow insert logs" ON app_logs;
DROP POLICY IF EXISTS "Allow read own logs" ON app_logs;

-- Drop existing policies on session_events
DROP POLICY IF EXISTS "Allow insert session_events" ON session_events;
DROP POLICY IF EXISTS "Allow read session_events" ON session_events;

-- Drop existing policies on webrtc_signals
DROP POLICY IF EXISTS "Allow all webrtc_signals" ON webrtc_signals;

-- Drop existing policies on commands
DROP POLICY IF EXISTS "Allow all commands" ON commands;

-- Recreate RLS policies
CREATE POLICY "Allow insert logs" ON app_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read own logs" ON app_logs FOR SELECT USING (true);

CREATE POLICY "Allow insert session_events" ON session_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow read session_events" ON session_events FOR SELECT USING (true);

CREATE POLICY "Allow all webrtc_signals" ON webrtc_signals FOR ALL USING (true);
CREATE POLICY "Allow all commands" ON commands FOR ALL USING (true);

-- Verify RLS is enabled
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

