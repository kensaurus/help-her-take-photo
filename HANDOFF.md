# 📱 Help Her Take Photo - Developer Handoff Documentation

> **Last Updated:** December 12, 2025
> **Version:** 1.1.0
> **Author:** kensaurus

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack & Libraries](#tech-stack--libraries)
4. [Project Structure](#project-structure)
5. [Database Schema](#database-schema)
6. [Development Setup](#development-setup)
7. [Build & Deployment](#build--deployment)
8. [CI/CD Pipeline](#cicd-pipeline)
9. [Environment Variables](#environment-variables)
10. [Known Issues & Technical Debt](#known-issues--technical-debt)
11. [Feature Status](#feature-status)
12. [Quick Answers to Common Questions](#quick-answers)

---

## 🎯 Project Overview

**Help Her Take Photo** is a mobile app that helps couples take better photos by allowing one person to remotely guide the other's camera in real-time.

### Business Purpose
- Solve the common problem of boyfriends taking bad photos
- Allow remote camera guidance and control
- Enable real-time photo sharing between paired devices

### Key Features
- ✅ Device pairing via 4-digit code
- ✅ Real-time camera streaming (P2P UDP)
- ✅ Remote photo capture
- ✅ Photo gallery with sharing
- ✅ Multi-language support (EN, TH, ZH, JA) - **selectable in onboarding**
- ✅ Dark/Light theme
- ✅ Gamification (scoldings saved counter)
- ✅ Feedback submission
- ✅ OTA updates via EAS

---

## 🏗 Architecture

### Current Architecture (Direct Supabase)

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│   React Native + Expo SDK 54 + Expo Router v6               │
├─────────────────────────────────────────────────────────────┤
│   • Zustand (State Management)                               │
│   • react-native-reanimated (Animations)                     │
│   • expo-camera / vision-camera (Camera)                     │
│   • @supabase/supabase-js (Database Client)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Direct Connection (HTTPS)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE BACKEND                         │
├─────────────────────────────────────────────────────────────┤
│   Database Tables:                                           │
│   • pairing_sessions  - 4-digit code pairing                │
│   • devices           - Device registration                 │
│   • captures          - Photo metadata                      │
│   • user_stats        - Gamification (XP, levels)           │
│   • user_settings     - User preferences                    │
│   • feedback          - Bug reports & feature requests      │
│   • session_events    - Analytics                           │
│   • active_connections- Real-time connections               │
├─────────────────────────────────────────────────────────────┤
│   Security:                                                  │
│   • Row Level Security (RLS) enabled on all tables          │
│   • Privacy enforced at application level (device_id filter)│
└─────────────────────────────────────────────────────────────┘
```

### Why Direct Supabase (No API Server)?

| Aspect | Old (Separate API) | New (Direct Supabase) |
|--------|-------------------|----------------------|
| **Deployment** | Server maintenance | Zero maintenance |
| **Cost** | Pay for hosting | Free tier |
| **Latency** | Extra hop | Direct connection |
| **Scaling** | Manual | Automatic |
| **Security** | Custom auth | Built-in RLS |

**Note:** The `help-her-take-photo-api` repo is **archived** and no longer needed.

---

## 📚 Tech Stack & Libraries

### Frontend (help-her-take-photo)

| Category | Library | Version | Purpose |
|----------|---------|---------|---------|
| **Framework** | Expo SDK | 54.0.27 | React Native tooling |
| **Navigation** | expo-router | 6.0.17 | File-based routing |
| **React** | React | 19.1.0 | UI library |
| **React Native** | react-native | 0.81.5 | Mobile framework |
| **State** | Zustand | 5.0.9 | State management |
| **Animations** | react-native-reanimated | 4.1.1 | 60fps animations |
| **Gestures** | react-native-gesture-handler | 2.28.0 | Touch handling |
| **Camera** | expo-camera | 17.0.10 | Camera access |
| **Storage** | @react-native-async-storage | 2.2.0 | Persistent storage |
| **Haptics** | expo-haptics | 15.0.8 | Tactile feedback |
| **OTA Updates** | expo-updates | 29.0.14 | Over-the-air updates |
| **Backend** | @supabase/supabase-js | 2.86.2 | Database client |

### ✅ Library Status
All libraries are **up-to-date** as of December 2025:
- Using latest Expo SDK 54 (released Sep 2025)
- React Native 0.81.5 with New Architecture
- Reanimated v4 (New Architecture only)

---

## 📁 Project Structure

```
help-her-take-photo/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout with navigation
│   ├── index.tsx          # Home screen (role selection)
│   ├── onboarding.tsx     # First-time flow + language selection
│   ├── pairing.tsx        # Device pairing screen
│   ├── camera.tsx         # Camera view (photographer)
│   ├── viewer.tsx         # Remote viewer (director)
│   ├── gallery.tsx        # Photo gallery
│   ├── profile.tsx        # User profile & stats
│   ├── settings.tsx       # App settings
│   ├── feedback.tsx       # Feedback form
│   └── changelog.tsx      # Version changelog
├── src/
│   ├── components/        # Reusable components
│   │   └── ui/           # AnimatedButton, FadeView, Icon
│   ├── stores/           # Zustand stores
│   │   ├── pairingStore.ts
│   │   ├── connectionStore.ts
│   │   ├── settingsStore.ts
│   │   ├── languageStore.ts
│   │   ├── statsStore.ts
│   │   ├── themeStore.ts
│   │   └── onboardingStore.ts
│   ├── services/         # API & business logic
│   │   ├── api.ts        # Supabase API methods
│   │   ├── supabase.ts   # Supabase client config
│   │   ├── sessionLogger.ts  # Supabase debug logging
│   │   └── webrtc.ts     # WebRTC P2P video streaming
│   ├── i18n/             # Translations (EN, TH, ZH, JA)
│   ├── config/           # Build info, changelog
│   └── types/            # TypeScript types
├── supabase/
│   └── migrations/       # SQL migration files
│       ├── 001_pairing_tables.sql
│       ├── 004_simple_migration.sql
│       └── 006_simple_rls.sql
├── assets/               # Images, icons
├── scripts/              # Build scripts
├── .github/workflows/    # CI/CD
├── app.config.ts         # Expo config (dynamic)
├── eas.json              # EAS Build config
└── package.json
```

---

## 🗄️ Database Schema

### Tables in Supabase

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `pairing_sessions` | 4-digit code pairing | `code`, `device_id`, `partner_device_id`, `status` |
| `devices` | Device registration | `device_id`, `platform`, `push_token` |
| `captures` | Photo metadata | `camera_device_id`, `storage_path`, `is_favorite` |
| `user_stats` | Gamification | `device_id`, `photos_taken`, `level`, `xp` |
| `user_settings` | Preferences | `device_id`, `theme`, `language` |
| `feedback` | Bug reports | `device_token`, `type`, `message` |
| `session_events` | Analytics | `device_id`, `event_type`, `event_data` |
| `active_connections` | Real-time | `camera_device_id`, `viewer_device_id` |
| **`app_logs`** | Debug logging | `device_id`, `level`, `event`, `data`, `timestamp` |
| **`webrtc_signals`** | WebRTC signaling | `session_id`, `from_device_id`, `signal_type`, `signal_data` |
| **`commands`** | Direction commands | `session_id`, `command_type`, `command_data` |

### Privacy Model

Since there's no user authentication:
- Each device has a unique `device_id` (UUID)
- All queries filter by `device_id`
- RLS policies allow all operations (privacy at app level)
- Users can only see their own data

### SQL Migrations

Migrations are in `supabase/migrations/`. Run them in order:
1. `001_pairing_tables.sql` - Initial pairing & feedback
2. `004_simple_migration.sql` - All new tables
3. `006_simple_rls.sql` - RLS policies
4. `007_logging_tables.sql` - Logging & WebRTC tables
5. `008_fix_logging_policies.sql` - Fix duplicate policies (if needed)

---

## 📊 Logging & Debugging

### Session Logger Service

The app uses `sessionLogger` (`src/services/sessionLogger.ts`) to log all events to Supabase.

```typescript
// Usage in components
import { sessionLogger } from '../src/services/sessionLogger'

// Initialize (done in _layout.tsx)
sessionLogger.init(deviceId, sessionId)

// Log events
sessionLogger.info('event_name', { data: 'value' })
sessionLogger.warn('warning_event', { issue: 'description' })
sessionLogger.error('error_event', error, { context: 'data' })
sessionLogger.debug('debug_info', { verbose: true }) // Only in __DEV__
```

### Retrieve Logs from Supabase

Run these queries in Supabase SQL Editor:

```sql
-- 1. All recent logs
SELECT * FROM app_logs ORDER BY timestamp DESC LIMIT 50;

-- 2. Filter by device
SELECT * FROM app_logs 
WHERE device_id = 'abc123' 
ORDER BY timestamp DESC;

-- 3. Filter by log level
SELECT level, event, data, timestamp 
FROM app_logs 
WHERE level = 'error' 
ORDER BY timestamp DESC;

-- 4. Filter by event type
SELECT * FROM app_logs 
WHERE event LIKE 'webrtc_%' 
ORDER BY timestamp DESC;

-- 5. Filter by session
SELECT * FROM app_logs 
WHERE session_id = 'session-uuid' 
ORDER BY timestamp DESC;

-- 6. Time-based query (last hour)
SELECT * FROM app_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- 7. Search in data JSON
SELECT * FROM app_logs 
WHERE data->>'error_message' IS NOT NULL
ORDER BY timestamp DESC;
```

### Log Levels

| Level | When to Use | Stored in Supabase |
|-------|-------------|-------------------|
| `debug` | Verbose debugging | **Only in dev** |
| `info` | Normal operations | ✅ Yes |
| `warn` | Potential issues | ✅ Yes |
| `error` | Failures | ✅ Yes (+ stack trace) |

### WebRTC & Command Logs

```sql
-- Track WebRTC connection attempts
SELECT * FROM webrtc_signals 
WHERE session_id = 'your-session' 
ORDER BY created_at;

-- Track commands sent between devices
SELECT * FROM commands 
WHERE session_id = 'your-session' 
ORDER BY created_at;

-- Connection state changes
SELECT * FROM session_events 
WHERE event_type LIKE 'connection_%'
ORDER BY created_at DESC;
```

### Automatic Cleanup (Optional)

Add this as a scheduled Supabase function to clean old logs:

```sql
-- Delete logs older than 7 days
DELETE FROM app_logs WHERE timestamp < NOW() - INTERVAL '7 days';
DELETE FROM webrtc_signals WHERE created_at < NOW() - INTERVAL '1 day';
DELETE FROM commands WHERE created_at < NOW() - INTERVAL '1 day';
```

---

## 🚀 Development Setup

### Prerequisites
- Node.js 20.x+
- npm or yarn
- Expo Go app (for testing)
- Supabase account

### Setup Steps

```bash
# 1. Clone repo
git clone https://github.com/kensaurus/help-her-take-photo.git
cd help-her-take-photo

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start development
npx expo start
```

### Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these from **Supabase Dashboard → Settings → API**

---

## 📦 Build & Deployment

### Build Profiles (eas.json)

| Profile | Distribution | Use Case |
|---------|--------------|----------|
| `development` | internal | Dev client with hot reload |
| `preview` | internal | Testing with production DB |
| `staging` | internal | Pre-release testing |
| `production` | store | App Store / Play Store |

### Build Commands

```bash
# Preview build (Android)
eas build --platform android --profile preview

# Production build (both platforms)
eas build --platform all --profile production

# OTA Update
eas update --branch preview --message "Bug fixes"
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `eas-build.yml` | Push to main | Build Android + iOS |
| `eas-update.yml` | Push to main | OTA update |

### Required GitHub Secrets

```
EXPO_TOKEN  # Personal access token from expo.dev
```

---

## ⚠️ Known Issues & Technical Debt

### Current Issues

1. **iOS Build Not Configured**
   - **Cause:** Apple Developer credentials not set up
   - **Fix:** Run `eas credentials --platform ios`

2. **WebRTC NAT Traversal**
   - **Issue:** Video may not connect if devices are on different networks
   - **Cause:** Using only STUN servers (Google's free ones)
   - **Fix:** Add TURN server for production (Twilio, or self-hosted)

3. **Same WiFi Requirement**
   - WebRTC works best when both devices are on same WiFi
   - For different networks, need TURN server

### Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| Tests | High | No unit/integration tests yet |
| TURN Server | High | Add TURN for cross-network video |
| Error Boundaries | Medium | Add crash recovery UI |
| Offline Mode | Low | Handle offline scenarios |

---

## ✅ Feature Status

### Completed ✅
- [x] Device pairing (4-digit code)
- [x] Camera capture and preview (real expo-camera)
- [x] Photo gallery with Supabase sync
- [x] Multi-language (EN, TH, ZH, JA)
- [x] Language selection in onboarding
- [x] Dark/Light theme
- [x] User profile with gamification
- [x] Feedback form to Supabase
- [x] OTA updates configured
- [x] CI/CD pipeline
- [x] Direct Supabase integration
- [x] **WebRTC P2P video streaming**
- [x] **Direction commands (left, right, up, down)**
- [x] **Debug logging to Supabase (app_logs)**
- [x] **Session tracking & analytics**

### In Progress 🚧
- [ ] iOS build credentials
- [ ] Production deployment
- [ ] TURN server for NAT traversal

### Planned 📋
- [ ] Push notifications
- [ ] SSO login (Google/Apple)
- [ ] Photo editing features
- [ ] Leaderboard system

---

## ❓ Quick Answers

### Why no iOS builds?
iOS requires Apple Developer Program ($99/year). Run:
```bash
eas credentials --platform ios
```

### How does pairing work?
1. Device A generates 4-digit code (stored in Supabase)
2. Device B enters code
3. Supabase updates session with partner
4. Both devices navigate to camera/viewer

### How is privacy handled?
- Each device has a unique `device_id`
- All API calls filter by this ID
- RLS policies ensure data isolation

### How to test quickly?
```bash
# Local with tunnel
npx expo start --tunnel

# OTA update (faster than full build)
eas update --branch preview
```

### Where's the API server?
**Archived!** We now use direct Supabase access. The `help-her-take-photo-api` repo is deprecated.

---

## 👤 Contact & Resources

- **Repository:** github.com/kensaurus/help-her-take-photo
- **Expo Dashboard:** expo.dev/accounts/kensaurus
- **Supabase Dashboard:** supabase.com/dashboard
- **Author:** kensaurus (kensaur.us)

### Useful Links
- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)

---

*© 2025 kensaurus - kensaur.us*
