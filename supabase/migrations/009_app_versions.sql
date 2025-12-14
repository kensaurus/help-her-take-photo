-- Create app_versions table
CREATE TABLE IF NOT EXISTS app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version TEXT NOT NULL,
    download_url TEXT NOT NULL,
    force_update BOOLEAN DEFAULT FALSE,
    changelog TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (public table for checking updates)
CREATE POLICY "Allow read app_versions" ON app_versions FOR SELECT USING (true);

-- Insert the latest version provided by the user
INSERT INTO app_versions (version, download_url, force_update, changelog)
VALUES (
    '1.0.1', 
    'https://expo.dev/artifacts/eas/8zFbHW3U8cUJV3iNpntVAm.apk', 
    false, 
    'Latest preview build with WebRTC fixes and performance improvements.'
);
