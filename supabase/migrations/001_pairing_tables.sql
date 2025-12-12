-- Pairing Sessions Table
-- Run this SQL in your Supabase SQL Editor (Dashboard > SQL Editor)

-- Create pairing_sessions table
CREATE TABLE IF NOT EXISTS pairing_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(4) NOT NULL,
  device_id VARCHAR(255) NOT NULL,
  partner_device_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paired', 'expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_pairing_code ON pairing_sessions(code);
CREATE INDEX IF NOT EXISTS idx_pairing_device ON pairing_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_partner ON pairing_sessions(partner_device_id);
CREATE INDEX IF NOT EXISTS idx_pairing_status ON pairing_sessions(status);

-- Enable Row Level Security
ALTER TABLE pairing_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow all operations for anonymous users (mobile app)
-- In production, you'd want more restrictive policies
CREATE POLICY "Allow all operations on pairing_sessions" ON pairing_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Auto-expire old sessions (optional - run as a cron job or Edge Function)
-- DELETE FROM pairing_sessions WHERE expires_at < NOW();

-- Feedback Table (optional)
CREATE TABLE IF NOT EXISTS feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_token VARCHAR(255),
  type VARCHAR(20) CHECK (type IN ('feature', 'bug', 'other')),
  message TEXT NOT NULL,
  email VARCHAR(255),
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on feedback
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Allow inserts on feedback
CREATE POLICY "Allow insert on feedback" ON feedback
  FOR INSERT
  WITH CHECK (true);

