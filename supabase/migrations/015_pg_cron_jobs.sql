-- ═══════════════════════════════════════════════════════════════════════════════
-- HELP HER TAKE PHOTO - pg_cron Scheduled Jobs
-- December 16, 2025
-- 
-- IMPORTANT: pg_cron extension must be enabled in Supabase Dashboard first!
-- Go to: Database > Extensions > Search "pg_cron" > Enable
-- 
-- These jobs handle automatic maintenance tasks:
-- 1. Cleanup expired pairing sessions
-- 2. Cleanup old logs
-- 3. Cleanup stale rate limits
-- 4. Aggregate daily analytics
-- 5. Cleanup old notifications
-- ═══════════════════════════════════════════════════════════════════════════════

-- Note: Uncomment and run these after enabling pg_cron extension

-- ─────────────────────────────────────────────────────────────────────────────────
-- 1. CLEANUP EXPIRED PAIRING SESSIONS
-- Runs every 5 minutes
-- Removes sessions that are expired and still pending
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'cleanup-expired-sessions',
--   '*/5 * * * *',  -- Every 5 minutes
--   $$
--     DELETE FROM pairing_sessions 
--     WHERE expires_at < NOW() 
--       AND status = 'pending';
--   $$
-- );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 2. CLEANUP OLD APP LOGS
-- Runs daily at midnight
-- Removes logs older than 30 days
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'cleanup-old-logs',
--   '0 0 * * *',  -- Daily at midnight
--   $$
--     DELETE FROM app_logs 
--     WHERE created_at < NOW() - INTERVAL '30 days';
--   $$
-- );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 3. CLEANUP STALE RATE LIMITS
-- Runs every 10 minutes
-- Removes rate limit entries with expired windows
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'cleanup-rate-limits',
--   '*/10 * * * *',  -- Every 10 minutes
--   $$
--     DELETE FROM rate_limits 
--     WHERE window_start + (window_duration_seconds || ' seconds')::interval < NOW();
--   $$
-- );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 4. AGGREGATE DAILY ANALYTICS
-- Runs daily at 1 AM
-- Computes and stores daily aggregated metrics
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'aggregate-daily-analytics',
--   '0 1 * * *',  -- Daily at 1 AM
--   $$
--     INSERT INTO analytics_daily (
--       date,
--       total_sessions,
--       active_devices,
--       new_devices,
--       total_photos,
--       total_commands,
--       avg_session_duration_seconds
--     )
--     SELECT 
--       CURRENT_DATE - 1 as date,
--       COUNT(DISTINCT ps.id) as total_sessions,
--       COUNT(DISTINCT ps.device_id) as active_devices,
--       COUNT(DISTINCT CASE WHEN d.created_at::date = CURRENT_DATE - 1 THEN d.device_id END) as new_devices,
--       COUNT(DISTINCT c.id) as total_photos,
--       COUNT(DISTINCT se.id) FILTER (WHERE se.event_type = 'direction_command') as total_commands,
--       AVG(EXTRACT(EPOCH FROM (ps.ended_at - ps.created_at)))::int as avg_session_duration_seconds
--     FROM pairing_sessions ps
--     LEFT JOIN devices d ON d.device_id = ps.device_id
--     LEFT JOIN captures c ON c.session_id = ps.id
--     LEFT JOIN session_events se ON se.session_id = ps.id
--     WHERE ps.created_at::date = CURRENT_DATE - 1
--     ON CONFLICT (date) DO UPDATE SET
--       total_sessions = EXCLUDED.total_sessions,
--       active_devices = EXCLUDED.active_devices,
--       new_devices = EXCLUDED.new_devices,
--       total_photos = EXCLUDED.total_photos,
--       total_commands = EXCLUDED.total_commands,
--       avg_session_duration_seconds = EXCLUDED.avg_session_duration_seconds,
--       updated_at = NOW();
--   $$
-- );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 5. CLEANUP OLD NOTIFICATIONS
-- Runs daily at 2 AM
-- Removes processed notifications older than 7 days
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'cleanup-old-notifications',
--   '0 2 * * *',  -- Daily at 2 AM
--   $$
--     DELETE FROM notification_queue 
--     WHERE created_at < NOW() - INTERVAL '7 days'
--       AND status IN ('sent', 'delivered', 'failed');
--   $$
-- );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 6. CLEANUP OLD SYNC RECORDS
-- Runs daily at 3 AM
-- Removes synced records older than 30 days
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'cleanup-sync-records',
--   '0 3 * * *',  -- Daily at 3 AM
--   $$
--     DELETE FROM pending_sync 
--     WHERE status = 'synced' 
--       AND synced_at < NOW() - INTERVAL '30 days';
--   $$
-- );

-- ─────────────────────────────────────────────────────────────────────────────────
-- 7. UPDATE DEVICE LAST ACTIVE
-- Runs every hour
-- Marks devices as inactive if no activity for 30 days
-- ─────────────────────────────────────────────────────────────────────────────────

-- SELECT cron.schedule(
--   'update-device-activity',
--   '0 * * * *',  -- Every hour
--   $$
--     UPDATE devices
--     SET push_token = NULL
--     WHERE last_active_at < NOW() - INTERVAL '90 days'
--       AND push_token IS NOT NULL;
--   $$
-- );

-- ═══════════════════════════════════════════════════════════════════════════════
-- MANUAL CLEANUP FUNCTIONS (can be called anytime)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Function to manually run all cleanup tasks
CREATE OR REPLACE FUNCTION run_all_cleanup_tasks()
RETURNS JSONB AS $$
DECLARE
  sessions_deleted INT;
  logs_deleted INT;
  rate_limits_deleted INT;
  notifications_deleted INT;
BEGIN
  -- Cleanup expired sessions
  WITH deleted AS (
    DELETE FROM pairing_sessions 
    WHERE expires_at < NOW() AND status = 'pending'
    RETURNING *
  )
  SELECT COUNT(*) INTO sessions_deleted FROM deleted;
  
  -- Cleanup old logs (if table exists)
  BEGIN
    WITH deleted AS (
      DELETE FROM app_logs 
      WHERE created_at < NOW() - INTERVAL '30 days'
      RETURNING *
    )
    SELECT COUNT(*) INTO logs_deleted FROM deleted;
  EXCEPTION WHEN undefined_table THEN
    logs_deleted := 0;
  END;
  
  -- Cleanup stale rate limits
  WITH deleted AS (
    DELETE FROM rate_limits 
    WHERE window_start + (window_duration_seconds || ' seconds')::interval < NOW()
    RETURNING *
  )
  SELECT COUNT(*) INTO rate_limits_deleted FROM deleted;
  
  -- Cleanup old notifications
  WITH deleted AS (
    DELETE FROM notification_queue 
    WHERE created_at < NOW() - INTERVAL '7 days'
      AND status IN ('sent', 'delivered', 'failed')
    RETURNING *
  )
  SELECT COUNT(*) INTO notifications_deleted FROM deleted;
  
  RETURN jsonb_build_object(
    'sessions_deleted', sessions_deleted,
    'logs_deleted', logs_deleted,
    'rate_limits_deleted', rate_limits_deleted,
    'notifications_deleted', notifications_deleted,
    'executed_at', NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ═══════════════════════════════════════════════════════════════════════════════
-- HOW TO ENABLE pg_cron JOBS
-- 
-- 1. Go to Supabase Dashboard > Database > Extensions
-- 2. Search for "pg_cron" and enable it
-- 3. Uncomment the SELECT cron.schedule(...) statements above
-- 4. Run this migration file again
-- 
-- To view scheduled jobs:
--   SELECT * FROM cron.job;
-- 
-- To view job run history:
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
-- 
-- To unschedule a job:
--   SELECT cron.unschedule('job-name');
-- ═══════════════════════════════════════════════════════════════════════════════

