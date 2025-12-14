-- Create device profiles table for display names and preferences
CREATE TABLE IF NOT EXISTS device_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL DEFAULT 'User',
    avatar_emoji TEXT DEFAULT '👤',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE device_profiles ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read profiles (needed for seeing partner names)
CREATE POLICY "Allow read device_profiles" ON device_profiles FOR SELECT USING (true);

-- Allow insert/update for own device (using device_id match)
CREATE POLICY "Allow insert own profile" ON device_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update own profile" ON device_profiles FOR UPDATE USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_device_profiles_device_id ON device_profiles(device_id);

-- Function to auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for device_profiles
DROP TRIGGER IF EXISTS device_profiles_updated_at ON device_profiles;
CREATE TRIGGER device_profiles_updated_at
    BEFORE UPDATE ON device_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
