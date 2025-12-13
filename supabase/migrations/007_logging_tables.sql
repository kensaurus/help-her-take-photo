                                                                -- Session Logger Tables for Debugging
                                                                -- Run this in Supabase SQL Editor

                                                                -- App logs table for debugging
                                                                CREATE TABLE IF NOT EXISTS app_logs (
                                                                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                                device_id TEXT NOT NULL,
                                                                session_id TEXT,
                                                                level TEXT NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error')),
                                                                event TEXT NOT NULL,
                                                                data JSONB,
                                                                timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                                                platform TEXT,
                                                                app_version TEXT,
                                                                created_at TIMESTAMPTZ DEFAULT NOW()
                                                                );

                                                                -- Session events table for connection tracking
                                                                CREATE TABLE IF NOT EXISTS session_events (
                                                                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                                event_type TEXT NOT NULL,
                                                                device_id TEXT NOT NULL,
                                                                session_id TEXT,
                                                                peer_device_id TEXT,
                                                                metadata JSONB,
                                                                created_at TIMESTAMPTZ DEFAULT NOW()
                                                                );

                                                                -- WebRTC signaling table for peer connection
                                                                CREATE TABLE IF NOT EXISTS webrtc_signals (
                                                                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                                session_id TEXT NOT NULL,
                                                                from_device_id TEXT NOT NULL,
                                                                to_device_id TEXT NOT NULL,
                                                                signal_type TEXT NOT NULL CHECK (signal_type IN ('offer', 'answer', 'ice-candidate')),
                                                                signal_data JSONB NOT NULL,
                                                                processed BOOLEAN DEFAULT FALSE,
                                                                created_at TIMESTAMPTZ DEFAULT NOW()
                                                                );

                                                                -- Commands table for direction/capture commands
                                                                CREATE TABLE IF NOT EXISTS commands (
                                                                id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                                session_id TEXT NOT NULL,
                                                                from_device_id TEXT NOT NULL,
                                                                to_device_id TEXT NOT NULL,
                                                                command_type TEXT NOT NULL,
                                                                command_data JSONB,
                                                                acknowledged BOOLEAN DEFAULT FALSE,
                                                                created_at TIMESTAMPTZ DEFAULT NOW()
                                                                );

                                                                -- Indexes for fast queries
                                                                CREATE INDEX IF NOT EXISTS idx_app_logs_device_id ON app_logs(device_id);
                                                                CREATE INDEX IF NOT EXISTS idx_app_logs_session_id ON app_logs(session_id);
                                                                CREATE INDEX IF NOT EXISTS idx_app_logs_timestamp ON app_logs(timestamp DESC);
                                                                CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);

                                                                CREATE INDEX IF NOT EXISTS idx_session_events_device_id ON session_events(device_id);
                                                                CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id);
                                                                CREATE INDEX IF NOT EXISTS idx_session_events_type ON session_events(event_type);

                                                                CREATE INDEX IF NOT EXISTS idx_webrtc_signals_session ON webrtc_signals(session_id);
                                                                CREATE INDEX IF NOT EXISTS idx_webrtc_signals_to_device ON webrtc_signals(to_device_id, processed);

                                                                CREATE INDEX IF NOT EXISTS idx_commands_session ON commands(session_id);
                                                                CREATE INDEX IF NOT EXISTS idx_commands_to_device ON commands(to_device_id, acknowledged);

                                                                -- Enable RLS
                                                                ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;
                                                                ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
                                                                ALTER TABLE webrtc_signals ENABLE ROW LEVEL SECURITY;
                                                                ALTER TABLE commands ENABLE ROW LEVEL SECURITY;

                                                                -- RLS Policies - Allow all operations for now (anonymous users)
                                                                -- In production, you'd want more restrictive policies

                                                                CREATE POLICY "Allow insert logs" ON app_logs FOR INSERT WITH CHECK (true);
                                                                CREATE POLICY "Allow read own logs" ON app_logs FOR SELECT USING (true);

                                                                CREATE POLICY "Allow insert session_events" ON session_events FOR INSERT WITH CHECK (true);
                                                                CREATE POLICY "Allow read session_events" ON session_events FOR SELECT USING (true);

                                                                CREATE POLICY "Allow all webrtc_signals" ON webrtc_signals FOR ALL USING (true);
                                                                CREATE POLICY "Allow all commands" ON commands FOR ALL USING (true);

                                                                -- Auto-delete old logs (optional - run as scheduled job)
                                                                -- DELETE FROM app_logs WHERE timestamp < NOW() - INTERVAL '7 days';
                                                                -- DELETE FROM session_events WHERE created_at < NOW() - INTERVAL '7 days';
                                                                -- DELETE FROM webrtc_signals WHERE created_at < NOW() - INTERVAL '1 day';
                                                                -- DELETE FROM commands WHERE created_at < NOW() - INTERVAL '1 day';

