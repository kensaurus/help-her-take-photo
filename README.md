# 📸 Help Her Take Photo

> Because he always messes up the shot... 📷

[![EAS Build](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml/badge.svg)](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml)
[![EAS Update](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml/badge.svg)](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml)

A mobile app that helps couples take better photos by allowing one person to remotely guide the other's camera in real-time. Built with **Expo SDK 54** and **React Native 0.81**.

## ✨ Features

- 🔗 **Quick Pairing** - Connect devices with a simple 4-digit code
- 📱 **Real-time Camera View** - See what your partner sees (WebRTC P2P)
- 🎬 **Direction Commands** - Tell them to move left, right, up, down
- 📷 **Remote Capture** - Take the perfect shot from anywhere
- 🖼️ **Instant Gallery** - Photo library with Supabase sync
- 🌍 **Multi-language** - English, Thai, Chinese, Japanese (selectable in onboarding)
- 🌙 **Dark Mode** - Easy on the eyes
- 🎮 **Gamification** - Track your "scoldings saved"
- 📝 **Feedback** - Submit suggestions directly from the app
- 🎯 **Onboarding** - First-time user experience with language selection
- 📊 **Debug Logging** - All events logged to Supabase for debugging

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

## 🏗 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router v6 |
| State | Zustand |
| Animations | Reanimated 4 |
| Camera | expo-camera, vision-camera |
| Storage | AsyncStorage, expo-secure-store |
| Lists | @shopify/flash-list |
| Images | expo-image |
| Haptics | expo-haptics |
| **Backend** | **Supabase (Direct)** |

## 🏛️ Architecture

```
┌─────────────────────────────────────────┐
│          MOBILE APP (Expo)              │
│  React Native + Zustand + Reanimated    │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐   ┌───────────────────┐
│   SUPABASE    │   │     WEBRTC        │
│   BACKEND     │   │   (P2P Video)     │
├───────────────┤   ├───────────────────┤
│ • PostgreSQL  │   │ • Video Stream    │
│ • RLS Policies│   │ • Commands        │
│ • Realtime    │◄──│ • Signaling       │
│ • Logging     │   │   (via Supabase)  │
└───────────────┘   └───────────────────┘
```

**Note:** No separate API server required. Video streams peer-to-peer; signaling via Supabase Realtime.

## 📁 Project Structure

```
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root navigation & store initialization
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
│   │   └── ui/           # Base UI (Icon, Skeleton, PressableScale)
│   ├── stores/           # Zustand state stores
│   ├── services/         # Business logic
│   │   ├── api.ts        # Supabase API client
│   │   ├── supabase.ts   # Supabase configuration
│   │   ├── sessionLogger.ts  # Supabase logging service
│   │   └── webrtc.ts     # WebRTC P2P video streaming
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Translations (EN, TH, ZH, JA)
│   ├── types/            # TypeScript definitions
│   └── config/           # Build configuration
├── supabase/
│   └── migrations/       # SQL migrations for Supabase
├── assets/               # Images, icons, sounds
└── scripts/              # Build & utility scripts
```

## 🗄️ Database Schema (Supabase)

| Table | Purpose |
|-------|---------|
| `pairing_sessions` | 4-digit code pairing |
| `devices` | Device registration |
| `captures` | Photo metadata |
| `user_stats` | Gamification (XP, levels) |
| `user_settings` | User preferences |
| `feedback` | Bug reports & feature requests |
| `session_events` | Analytics |
| `active_connections` | Real-time connections |
| `app_logs` | **Debug logging** |
| `webrtc_signals` | **WebRTC signaling** |
| `commands` | **Direction commands** |

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
| **EAS Build** | Push to `main` | Builds preview APK/IPA |
| **EAS Update** | Push to `main` | OTA update to preview channel |
| **PR Preview** | Pull Request | Creates preview deployment |

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

Create `.env` in project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these from **Supabase Dashboard → Settings → API**

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

## 🎨 UI Components

### Base Components (`src/components/ui/`)

| Component | Description |
|-----------|-------------|
| `Icon` | Custom vector icons using View shapes |
| `Skeleton` | Loading placeholder with shimmer |
| `PressableScale` | Pressable with scale animation & haptics |
| `AnimatedButton` | Button with spring animation |
| `FadeView` | View with fade-in animation |

### Icon Names

Available icons: `camera`, `eye`, `image`, `user`, `settings`, `check`, `close`, `arrow-right`, `arrow-left`, `chevron-right`, `chevron-left`, `chevron-down`, `sun`, `moon`, `link`, `unlink`, `send`, `star`, `heart`, `flash`, `grid`, `share`, `trash`, `refresh`, `plus`, `minus`, `dot`, `loading`

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
- [Expo Documentation](https://docs.expo.dev)
- [Supabase Documentation](https://supabase.com/docs)

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

---

**Made with 💜 by [kensaurus](https://kensaur.us) © 2025**
