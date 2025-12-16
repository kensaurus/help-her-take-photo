# 📸 Help Her Take Photo

> Because he always messes up the shot... 📷

[![EAS Build](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml/badge.svg)](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml)
[![EAS Update](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml/badge.svg)](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml)

A mobile app that helps couples take better photos by allowing one person to remotely guide the other's camera in real-time. Built with **Expo SDK 54** and **React Native 0.81**.

## ✨ Features

- 🔗 **Quick Pairing** - Connect devices with a simple 4-digit code
- 📱 **Real-time Camera View** - See what your partner sees (WebRTC P2P)
- 🎬 **Direction Commands** - Large, prominent arrow overlays (up, down, left, right, closer, back)
- 📷 **Remote Capture** - Take the perfect shot from anywhere
- 🖼️ **Instant Gallery** - Photo library with Supabase sync
- 🌍 **Multi-language** - English, Thai, Chinese, Japanese (selectable in onboarding)
- 🌙 **Dark Mode** - Easy on the eyes
- 🎮 **Gamification** - Track your "scoldings saved"
- 📝 **Feedback** - Submit suggestions directly from the app
- 🎯 **Onboarding** - First-time user experience with language selection
- 📊 **Debug Logging** - All events logged to Supabase for debugging
- ✨ **Micro-interactions** - Physics-based animations, haptic feedback, visual polish

## 🏗 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Expo SDK 54, React Native 0.81.5 |
| Navigation | Expo Router v6 |
| State | Zustand |
| Animations | Reanimated 4 |
| Camera | expo-camera, vision-camera |
| Video Streaming | react-native-webrtc (P2P), LiveKit (planned) |
| Storage | AsyncStorage, expo-secure-store |
| Lists | @shopify/flash-list |
| Images | expo-image |
| Haptics | expo-haptics |
| **Backend** | **Supabase (PostgreSQL, Auth, Edge Functions)** |
| **Error Tracking** | **Sentry (@sentry/react-native)** |
| **Validation** | Custom Zod-like schemas |

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x or higher
- npm or yarn
- Expo Go app on your phone
- (Optional) Android Studio / Xcode for native builds

### Installation

```bash
# Clone the repository
git clone https://github.com/kensaurus/help-her-take-photo.git
cd help-her-take-photo

# Install dependencies
npm install

# Start development server
npx expo start
```

### Running the App

1. **Expo Go** (quickest): Scan QR code with Expo Go app
2. **Android Emulator**: Press `a` in terminal
3. **iOS Simulator** (macOS only): Press `i` in terminal
4. **Development Build**: See [Development Builds](#-development-builds) below

## 🏛️ Architecture

```
┌─────────────────────────────────────────┐
│          MOBILE APP (Expo)              │
│  React Native + Zustand + Reanimated    │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┼─────────┐
        │         │         │
        ▼         ▼         ▼
┌───────────────┐ │ ┌───────────────────┐
│   SUPABASE    │ │ │   LIVEKIT CLOUD   │
│   BACKEND     │ │ │  (Video Service)  │
├───────────────┤ │ ├───────────────────┤
│ • PostgreSQL  │ │ │ • Video Rooms     │
│ • RLS Policies│ │ │ • Auto-scaling    │
│ • Realtime    │ │ │ • TURN/STUN       │
│ • Logging     │ │ │ • Data Messages   │
│ • Edge Funcs  │◄┘ └───────────────────┘
│   (tokens)    │
└───────────────┘
```

**Video Streaming Options:**
- **Primary:** LiveKit Cloud - Reliable WebRTC-as-a-Service with built-in TURN servers
- **Fallback:** Direct WebRTC P2P - For when LiveKit is unavailable

**Note:** No separate API server required. Supabase Edge Functions generate LiveKit tokens.

## 📁 Project Structure

```
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root navigation, Sentry init, Auth provider
│   ├── index.tsx          # Home screen (role selection)
│   ├── onboarding.tsx     # First-time user flow + language selection
│   ├── pairing.tsx        # Device pairing (4-digit code)
│   ├── camera.tsx         # Camera view (photographer)
│   ├── viewer.tsx         # Remote viewer (director)
│   ├── gallery.tsx        # Photo gallery with FlashList
│   ├── profile.tsx        # User stats & achievements
│   ├── settings.tsx       # App settings
│   ├── feedback.tsx       # Submit feedback
│   └── changelog.tsx      # Version history
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── CaptureButton.tsx  # Enhanced capture with animations
│   │   ├── ErrorBoundary.tsx  # React error boundary
│   │   └── ui/           # Base UI components
│   │       ├── DebugMenu.tsx  # Dev-only debug utilities
│   │       └── ...       # Icon, Skeleton, AnimatedPressable, etc.
│   ├── contexts/         # React contexts
│   │   └── AuthContext.tsx   # Supabase auth state provider
│   ├── schemas/          # Input validation
│   │   └── index.ts      # Zod-like validation schemas
│   ├── stores/           # Zustand state stores
│   ├── services/         # Business logic
│   │   ├── api.ts        # Supabase API client
│   │   ├── supabase.ts   # Supabase client + anonymous auth
│   │   ├── errorTracking.ts  # Sentry integration
│   │   ├── logging.ts    # Structured logging service
│   │   ├── connectionManager.ts  # WebRTC connection management
│   │   ├── sessionLogger.ts  # Supabase logging service
│   │   ├── soundService.ts   # Sound + haptic feedback
│   │   └── webrtc.ts     # WebRTC P2P video streaming
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility libraries
│   │   └── microInteractions.ts  # Animation configs & haptics
│   ├── i18n/             # Translations (EN, TH, ZH, JA)
│   ├── types/            # TypeScript definitions
│   └── config/           # Build configuration
├── supabase/
│   ├── functions/        # Edge Functions (Deno)
│   │   ├── create-pairing/   # Create pairing session
│   │   ├── join-pairing/     # Join pairing session
│   │   ├── livekit-token/    # Generate LiveKit room tokens
│   │   ├── send-notification/  # Push notifications (Expo)
│   │   ├── upload-photo/     # Cloud backup to Storage
│   │   ├── analyze-photo/    # AI photo analysis (GPT-4o)
│   │   ├── get-analytics/    # Dashboard metrics API
│   │   ├── manage-album/     # Photo albums CRUD
│   │   └── manage-friends/   # Social features
│   └── migrations/       # SQL migrations for Supabase
├── assets/               # Images, icons, sounds
└── scripts/              # Build & utility scripts
```

## 🗄️ Database Schema (Supabase)

### Core Tables
| Table | Purpose |
|-------|---------|
| `pairing_sessions` | 4-digit code pairing |
| `devices` | Device registration |
| `captures` | Photo metadata + cloud URLs |
| `user_stats` | Gamification (XP, levels) |
| `user_settings` | User preferences |
| `feedback` | Bug reports & feature requests |
| `session_events` | Analytics |
| `active_connections` | Real-time connections |
| `app_logs` | **Debug logging** |
| `webrtc_signals` | **WebRTC signaling** |
| `commands` | **Direction commands** |

### Enhanced Features Tables (v2)
| Table | Purpose |
|-------|---------|
| `notification_queue` | Push notification tracking |
| `photo_albums` | Photo organization with sharing |
| `ai_analyses` | AI composition scores & suggestions |
| `session_recordings` | Session replay & direction stats |
| `friend_connections` | Social connections |
| `recent_partners` | Quick reconnect with frequent partners |
| `rate_limits` | Database-backed rate limiting |
| `analytics_daily` | Pre-computed daily metrics |
| `pending_sync` | Offline-first sync queue |

## ⚡ Supabase Edge Functions

### create-pairing
Creates a new pairing session with a 4-digit code.

```bash
# Request
curl -X POST 'https://your-project.supabase.co/functions/v1/create-pairing' \
  -H 'Content-Type: application/json' \
  -d '{"deviceId": "uuid-here", "role": "camera"}'

# Response
{
  "success": true,
  "code": "1234",
  "sessionId": "uuid",
  "expiresAt": "2025-12-15T11:00:00Z"
}
```

### join-pairing
Joins an existing pairing session using the 4-digit code.

```bash
# Request
curl -X POST 'https://your-project.supabase.co/functions/v1/join-pairing' \
  -H 'Content-Type: application/json' \
  -d '{"deviceId": "uuid-here", "code": "1234"}'

# Response
{
  "success": true,
  "sessionId": "uuid",
  "partnerId": "partner-uuid",
  "creatorRole": "camera"
}
```

### livekit-token
Generates JWT tokens for LiveKit video room access.

```bash
# Request
curl -X POST 'https://your-project.supabase.co/functions/v1/livekit-token' \
  -H 'Content-Type: application/json' \
  -d '{"roomName": "session-uuid", "participantName": "device-uuid", "role": "camera"}'

# Response
{
  "token": "eyJ...",
  "room": "session-uuid",
  "identity": "device-uuid",
  "canPublish": true
}
```

### send-notification
Sends push notifications via Expo Push API.

```bash
# Request (by device ID and template)
curl -X POST 'https://your-project.supabase.co/functions/v1/send-notification' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"deviceId": "uuid-here", "type": "partner_joined"}'

# Available types: partner_joined, photo_captured, session_expiring, friend_request
```

### upload-photo
Uploads photos to Supabase Storage with cloud backup.

```bash
# Request
curl -X POST 'https://your-project.supabase.co/functions/v1/upload-photo' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"captureId": "uuid", "deviceId": "uuid", "imageData": "base64..."}'

# Response
{
  "success": true,
  "cloudUrl": "https://...supabase.co/storage/v1/object/public/captures/...",
  "fileSize": 12345
}
```

### analyze-photo
AI-powered photo analysis using OpenAI GPT-4o Vision.

```bash
# Request
curl -X POST 'https://your-project.supabase.co/functions/v1/analyze-photo' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{"captureId": "uuid", "imageUrl": "https://..."}'

# Response
{
  "success": true,
  "analysis": {
    "compositionScore": 9.0,
    "compositionSuggestions": ["Consider rule of thirds", "..."],
    "detectedObjects": [{"name": "mountains", "confidence": 0.98}],
    "sceneType": "landscape",
    "mood": "serene",
    "lightingQuality": "excellent"
  }
}
```

### get-analytics
Dashboard analytics API with daily metrics.

```bash
# Request
curl -X GET 'https://your-project.supabase.co/functions/v1/get-analytics?period=7d' \
  -H 'Authorization: Bearer YOUR_ANON_KEY'

# Response
{
  "success": true,
  "analytics": {
    "totalSessions": 7,
    "activeDevices": 11,
    "totalPhotos": 25,
    "avgAiScore": 7.5,
    "dailyMetrics": [...]
  }
}
```

### manage-album
Photo album CRUD with sharing capabilities.

```bash
# List albums
curl -X POST '.../manage-album' -d '{"action": "list", "deviceId": "uuid"}'

# Create album
curl -X POST '.../manage-album' -d '{"action": "create", "deviceId": "uuid", "name": "Vacation 2025"}'

# Share album (generates 8-char code)
curl -X POST '.../manage-album' -d '{"action": "share", "deviceId": "uuid", "albumId": "uuid"}'
```

### manage-friends
Social features for connecting with photo partners.

```bash
# List friends & pending requests
curl -X POST '.../manage-friends' -d '{"action": "list", "deviceId": "uuid"}'

# Recent partners (quick reconnect)
curl -X POST '.../manage-friends' -d '{"action": "recent", "deviceId": "uuid"}'

# Send friend request
curl -X POST '.../manage-friends' -d '{"action": "request", "deviceId": "uuid", "friendDeviceId": "uuid"}'
```

### Deploying Edge Functions

```bash
# Deploy all functions
supabase functions deploy create-pairing --no-verify-jwt
supabase functions deploy join-pairing --no-verify-jwt
supabase functions deploy livekit-token --no-verify-jwt
supabase functions deploy send-notification
supabase functions deploy upload-photo
supabase functions deploy analyze-photo
supabase functions deploy get-analytics
supabase functions deploy manage-album
supabase functions deploy manage-friends

# Set required secrets
supabase secrets set LIVEKIT_API_KEY=your-api-key
supabase secrets set LIVEKIT_API_SECRET=your-api-secret
supabase secrets set EXPO_ACCESS_TOKEN=your-expo-token      # For push notifications
supabase secrets set OPENAI_API_KEY=your-openai-key          # For AI analysis
```

## 📊 Logging & Debugging

All app events are logged to Supabase for debugging. Use these SQL queries:

### Retrieve App Logs

```sql
-- Recent logs (last 20)
SELECT * FROM app_logs ORDER BY timestamp DESC LIMIT 20;

-- Filter by device
SELECT * FROM app_logs 
WHERE device_id = 'YOUR_DEVICE_ID' 
ORDER BY timestamp DESC;

-- Filter by error level
SELECT * FROM app_logs 
WHERE level = 'error' 
ORDER BY timestamp DESC;

-- Filter by event type
SELECT * FROM app_logs 
WHERE event LIKE 'webrtc_%' 
ORDER BY timestamp DESC;

-- Filter by time range
SELECT * FROM app_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

### Log Entry Fields

| Field | Description |
|-------|-------------|
| `device_id` | Unique device identifier |
| `session_id` | Current pairing session (if any) |
| `level` | Log level (debug/info/warn/error) |
| `event` | Event name (e.g., `webrtc_connected`) |
| `data` | JSON payload with event data |
| `timestamp` | ISO 8601 timestamp |
| `platform` | Device platform (`android 35`, `ios 17`) |
| `app_version` | App version from `expo-application` |

### Log Levels

| Level | Usage |
|-------|-------|
| `debug` | Development only (verbose) |
| `info` | Normal operations |
| `warn` | Potential issues |
| `error` | Failures (includes stack trace) |

### WebRTC Connection Events

```sql
-- Track WebRTC signaling
SELECT * FROM webrtc_signals 
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at;

-- Track commands sent
SELECT * FROM commands 
WHERE session_id = 'YOUR_SESSION_ID'
ORDER BY created_at;
```

## 🔧 Development

### Available Scripts

```bash
npm start           # Start Expo dev server
npm run android     # Run on Android
npm run ios         # Run on iOS
npm run web         # Run on web
npm run lint        # Run ESLint
npm run typecheck   # TypeScript check
```

### Development Builds

Development builds include native modules (camera, haptics, etc.) that Expo Go doesn't support:

```bash
# Build development client for Android
eas build --profile development --platform android

# Install on emulator
eas build:run --profile development --platform android --latest

# Start dev server for development client
npx expo start --dev-client
```

## 🚢 Build & Deployment Pipeline

### CI/CD Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| **EAS Build** | GitHub Release / Manual | Builds preview APK/IPA |
| **EAS Update** | Push to `main` | OTA update to preview channel |

### Build Profiles

| Profile | Use Case | Distribution |
|---------|----------|--------------|
| `development` | Local testing with dev client | Internal APK |
| `preview` | Internal QA testing | Internal APK |
| `staging` | Pre-production validation | Internal APK |
| `production` | App Store / Play Store | Store Bundle |

### Build Commands

```bash
# Preview (internal testing)
eas build --profile preview --platform all

# Production (store submission)
eas build --profile production --platform all
```

### OTA Updates

```bash
# Push update to preview channel
eas update --branch preview --message "Your message"
```

## 🔐 Environment Variables

Create `.env.local` in project root:

```env
# Supabase (required)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Sentry (optional but recommended)
EXPO_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# LiveKit (for video streaming)
EXPO_PUBLIC_LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=your-api-key          # Server-side only
LIVEKIT_API_SECRET=your-api-secret    # Server-side only

# Metered TURN (fallback for WebRTC)
EXPO_PUBLIC_METERED_API_KEY=your-metered-key
EXPO_PUBLIC_METERED_API_URL=https://your-app.metered.live/api/v1/turn/credentials
```

Get these from:
- **Supabase:** Dashboard → Settings → API
- **Sentry:** Dashboard → Settings → Projects → Client Keys (DSN)
- **LiveKit:** Cloud Dashboard → Project Settings → Keys

## 🔒 Security Features

The app implements production-grade security best practices:

### Authentication & Session Management
| Feature | Implementation |
|---------|----------------|
| **Anonymous Auth** | Supabase Auth with `signInAnonymously()` for RLS |
| **Session Refresh** | Auto-refresh on app foreground via `AppState` listener |
| **Secure Storage** | Device ID stored in `expo-secure-store` (encrypted) |
| **Auth Context** | React Context provides auth state throughout app |

```typescript
// Session auto-refresh on app state change
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh()
  } else {
    supabase.auth.stopAutoRefresh()
  }
})
```

### Edge Functions (Secure Endpoints)
| Function | Purpose | Security |
|----------|---------|----------|
| `create-pairing` | Create pairing session | Rate limiting, input validation |
| `join-pairing` | Join existing session | Rate limiting, UUID validation |

**Edge Function Security Features:**
- ✅ Input validation (UUID format, code format)
- ✅ Rate limiting (10 requests/minute per device)
- ✅ CORS headers for mobile clients
- ✅ Service role key for database operations
- ✅ Detailed error messages in dev, generic in prod

### Input Validation
Client-side validation schemas in `src/schemas/index.ts`:

```typescript
// Zod-like validation for all API inputs
validateCreatePairing({ deviceId, role })
validateJoinPairing({ deviceId, code })
validateFeedback({ type, message, email, rating })
validateSettings({ theme, language, ... })
```

### Error Tracking (Sentry)
| Feature | Description |
|---------|-------------|
| **Automatic capture** | Unhandled exceptions sent to Sentry |
| **User context** | Device ID attached to errors |
| **Breadcrumbs** | Navigation and action trails |
| **PII scrubbing** | Auth headers removed before send |
| **Source maps** | Stack traces point to original code |

```typescript
// Sentry initialized in _layout.tsx
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
})
```

### Row Level Security (RLS)
All Supabase tables have RLS enabled:
- `pairing_sessions` - Device-based access
- `devices` - Own device only
- `captures` - Session participants only
- `user_stats` / `user_settings` - Own device only
- `feedback` - Insert only (public)

### Debug Menu (Development Only)
Available in dev builds via shake gesture or debug button:
- View current session
- Clear AsyncStorage
- View network state
- Test Supabase connection
- **Test Crash (Sentry)** - Trigger test error

## 📱 State Management

| Store | Purpose |
|-------|---------|
| `pairingStore` | Device pairing state & code |
| `connectionStore` | WebSocket connection & role |
| `themeStore` | Dark/light mode preference |
| `languageStore` | i18n translation loading |
| `statsStore` | User statistics (photos, scoldings saved) |
| `settingsStore` | App preferences |
| `onboardingStore` | First-run completion flag |

## 🛠️ Services

| Service | Purpose |
|---------|---------|
| `supabase.ts` | Supabase client with anonymous auth, session management |
| `livekit.ts` | **LiveKit video streaming** (primary, more reliable) |
| `webrtc.ts` | P2P video streaming (fallback) |
| `realtimeCommands.ts` | **Supabase Realtime Broadcast** for instant direction commands |
| `errorTracking.ts` | Sentry integration for crash reporting |
| `logging.ts` | Structured logging with levels (debug/info/warn/error) |
| `connectionManager.ts` | WebRTC connection state machine |
| `api.ts` | Supabase database operations |

### Realtime Commands (New)
Uses Supabase Realtime Broadcast for instant direction delivery:

```typescript
import { useRealtimeCommands } from '@/services/realtimeCommands'

// In your component
const { isConnected, lastCommand, sendDirection } = useRealtimeCommands(
  sessionId,
  'viewer',  // or 'camera'
  (cmd) => handleDirectionCommand(cmd)
)

// Send direction
await sendDirection('up', deviceId)
```

### Key Service Functions

```typescript
// Authentication (supabase.ts)
await ensureAuthenticated()  // Anonymous auth for RLS
await getDeviceId()          // From SecureStore
await signOut()              // Clear session

// LiveKit Video Streaming (livekit.ts)
await livekitService.init(deviceId, peerId, sessionId, 'camera', callbacks)
await livekitService.sendCommand('capture')
livekitService.onCommand((cmd, data) => handleCommand(cmd, data))
await livekitService.destroy()

// WebRTC Fallback (webrtc.ts)
await webrtcService.init(deviceId, peerId, sessionId, 'camera', callbacks)
await webrtcService.sendCommand('direction', { direction: 'left' })

// Error Tracking (errorTracking.ts)
captureException(error, { context })
captureMessage('User action', 'info')
setUser({ id, deviceId })
addBreadcrumb('navigation', 'Opened settings')

// Logging (logging.ts)
logger.info('Action completed', { data })
logger.error('Failed to connect', error, { sessionId })
logger.warn('Deprecation warning')
```

## 🎨 UI Components

### Base Components (`src/components/ui/`)

| Component | Description |
|-----------|-------------|
| `Icon` | Custom vector icons using View shapes |
| `Skeleton` | Loading placeholder with shimmer |
| `PressableScale` | Pressable with scale animation & haptics |
| `AnimatedButton` | Button with spring animation |
| `AnimatedPressable` | Physics-based pressable with configurable presets |
| `FadeView` | View with fade-in animation |

### Enhanced Components (`src/components/`)

| Component | Description |
|-----------|-------------|
| `CaptureButton` | Photo capture with ring pulse, flash effect, spring physics |

### Icon Names

Available icons: `camera`, `eye`, `image`, `user`, `settings`, `check`, `close`, `arrow-right`, `arrow-left`, `chevron-right`, `chevron-left`, `chevron-down`, `sun`, `moon`, `link`, `unlink`, `send`, `star`, `heart`, `flash`, `grid`, `share`, `trash`, `refresh`, `plus`, `minus`, `dot`, `loading`

## ✨ Micro-interactions & Animations

The app uses physics-based animations for a premium feel. Configuration is centralized in `src/lib/microInteractions.ts`.

### Spring Configurations

| Preset | Use Case | Properties |
|--------|----------|------------|
| `button` | Snappy button presses | damping: 15, stiffness: 400 |
| `bouncy` | Celebratory moments | damping: 8, stiffness: 180 |
| `gentle` | Subtle transitions | damping: 20, stiffness: 200 |
| `stiff` | Precision interactions | damping: 25, stiffness: 500 |
| `wobbly` | Playful elements | damping: 6, stiffness: 120 |

### Haptic Patterns

| Pattern | When to Use |
|---------|-------------|
| `tap` | Light button press |
| `select` | Selection/medium impact |
| `heavy` | Important actions (capture) |
| `rigid` | Toggle switches |
| `success` | Completed actions |
| `error` | Error feedback |

### Interaction Presets

```typescript
import { InteractionPresets } from '@/lib/microInteractions'

// Use presets for consistent feel:
InteractionPresets.button      // Standard buttons
InteractionPresets.captureButton  // Photo capture
InteractionPresets.card        // Card selection
InteractionPresets.toggle      // Switches
InteractionPresets.destructive // Danger actions
```

### CaptureButton Effects

The capture button (`src/components/CaptureButton.tsx`) includes:
- **Press Animation** - Scale 0.92 with spring physics
- **Ring Pulse** - Expanding ring (1.0 → 1.8) on capture
- **Flash Effect** - White overlay flash
- **Heavy Haptic** - Tactile feedback on capture
- **3D Shadows** - Depth appearance

### Direction Overlay (Photographer Screen)

When the director sends positioning commands, the photographer sees a **large, prominent overlay**:

| Direction | Icon | Color | Label |
|-----------|------|-------|-------|
| Up | ⬆ | Teal (#4ECDC4) | TILT UP |
| Down | ⬇ | Red (#FF6B6B) | TILT DOWN |
| Left | ⬅ | Yellow (#FFE66D) | PAN LEFT |
| Right | ➡ | Yellow (#FFE66D) | PAN RIGHT |
| Closer | ⊕ | Green (#95E1D3) | MOVE CLOSER |
| Back | ⊖ | Coral (#F38181) | STEP BACK |

Features:
- **80px icons** - Large and impossible to miss
- **Full-screen overlay** - Dims camera view to focus attention
- **Color-coded borders** - Visual distinction per direction
- **2.5 second display** - Auto-hides after showing
- **Smooth animations** - Fade in/out with spring effect

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Convention

```
feat: add new feature
fix: bug fix
docs: documentation update
style: formatting changes
refactor: code refactoring
test: add tests
chore: maintenance
```

## 📖 Documentation

- [Handoff Documentation](./HANDOFF.md) - Comprehensive developer guide
- [UX/UI Audit Report](./AUDIT_REPORT.md) - UX best practices audit
- [Production Audit](./PRODUCTION_AUDIT.md) - Security & production readiness
- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)
- [Sentry Documentation](https://docs.sentry.io/platforms/react-native/)

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

---

**Made with 💜 by [kensaurus](https://kensaur.us) © 2025**
