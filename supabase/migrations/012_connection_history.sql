-- Connection history table for tracking all connections
CREATE TABLE IF NOT EXISTS connection_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT NOT NULL,
    partner_device_id TEXT NOT NULL,
    partner_display_name TEXT,
    partner_avatar TEXT DEFAULT '👤',
    session_id UUID,
    role TEXT CHECK (role IN ('camera', 'director')),
    status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected')),
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    initiated_by TEXT CHECK (initiated_by IN ('self', 'partner')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE connection_history ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read their own history
CREATE POLICY "Allow read own connection_history" ON connection_history 
    FOR SELECT USING (true);

-- Allow insert for own connections
CREATE POLICY "Allow insert connection_history" ON connection_history 
    FOR INSERT WITH CHECK (true);

-- Allow update for own connections
CREATE POLICY "Allow update connection_history" ON connection_history 
    FOR UPDATE USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_connection_history_device_id ON connection_history(device_id);
CREATE INDEX IF NOT EXISTS idx_connection_history_partner ON connection_history(partner_device_id);
CREATE INDEX IF NOT EXISTS idx_connection_history_status ON connection_history(status);
CREATE INDEX IF NOT EXISTS idx_connection_history_connected_at ON connection_history(connected_at DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS connection_history_updated_at ON connection_history;
CREATE TRIGGER connection_history_updated_at
    BEFORE UPDATE ON connection_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- Add is_online column to device_profiles for disconnect sync
ALTER TABLE device_profiles 
    ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW();
