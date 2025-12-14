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

-- IMPORTANT: Do NOT seed with a version higher than the deployed app!
-- Insert the CURRENT deployed version (1.0.0)
-- Update this row AFTER publishing a new build
INSERT INTO app_versions (version, download_url, force_update, changelog)
VALUES (
    '1.0.0', 
    'https://expo.dev/artifacts/eas/8zFbHW3U8cUJV3iNpntVAm.apk', 
    false, 
    'Initial release with WebRTC streaming, real-time guidance, and photo capture.'
);
