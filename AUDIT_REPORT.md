# Audit Report: Help Her Take Photo

## 1. Security (Critical)
**Issue:** Current Row Level Security (RLS) policies are too permissive.
- **Finding:** In `008_fix_logging_policies.sql`, tables `app_logs`, `session_events`, `webrtc_signals`, and `commands` have policies `USING (true)`.
- **Impact:** Any user with the Anon Key (public) can READ and WRITE to these tables. They can potentially spy on WebRTC signaling metadata or inject fake commands/logs.
- **Recommendation:** 
    1. **Implement Supabase Auth (Anonymous):** Instead of relying solely on a client-generated `device_id`, use `supabase.auth.signInAnonymously()`. This assigns a secure `auth.uid()`.
    2. **Scope RLS:** Update policies to `USING (auth.uid() = user_id)` (after adding a `user_id` column linking to `auth.users`).
    3. **Short-term Fix:** If staying with `device_id`, ensure your application code strictly filters by `device_id`, but be aware this is spoofable.

## 2. Architecture & Code Quality
**Issue:** "Kitchen Sink" structure in `src/services`.
- **Finding:** `src/services` contains `api`, `discovery`, `logging`, `p2p`, `streaming`, `supabase`, `webrtc`. This violates the "Feature-Sliced" recommendation in your system rules.
- **Recommendation:** Refactor into features:
    - `src/features/pairing/` (contains `p2p`, `discovery`, `webrtc`, `stores/pairingStore`)
    - `src/features/camera/` (contains `CameraView`, `useCamera`)
    - `src/features/analytics/` (contains `logging`, `sessionLogger`)

## 3. Automated Versioning (Implemented)
- **Status:** ✅ Implemented.
- **Mechanism:**
    - **Build Time:** `scripts/update-build.js` generates a `YYYYMMDD.HHMM` timestamp.
    - **Database:** `app_versions` table now stores this as `build_number`.
    - **Client:** `useAppUpdate` hook compares the running build's timestamp against the database.
    - **Release:** New script `scripts/publish-release.js` automates the DB update.

## 4. Performance
- **Finding:** No indexes on foreign keys in some tables (e.g., `session_id` in `session_events`).
- **Recommendation:** Add indexes to frequently queried columns like `device_id` and `session_id` to prevent full table scans as data grows.

## 5. Next Steps
1. Run the new migration `010_add_build_number.sql` in Supabase.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in your `.env` for the release script.
3. Consider the RLS security upgrade (Migrating to Supabase Auth).
