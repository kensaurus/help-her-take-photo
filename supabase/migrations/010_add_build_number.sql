-- Add build_number to app_versions
ALTER TABLE app_versions ADD COLUMN IF NOT EXISTS build_number TEXT;

-- Update the existing row (example)
UPDATE app_versions 
SET build_number = '20250101.0000' 
WHERE build_number IS NULL;

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_app_versions_build_number ON app_versions(build_number DESC);
