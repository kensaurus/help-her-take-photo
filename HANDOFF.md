# 📱 Help Her Take Photo - Developer Handoff Documentation

> **Last Updated:** December 6, 2025
> **Version:** 1.0.0
> **Author:** kensaurus

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack & Libraries](#tech-stack--libraries)
4. [Project Structure](#project-structure)
5. [Development Setup](#development-setup)
6. [Build & Deployment](#build--deployment)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Environment Variables](#environment-variables)
9. [Known Issues & Technical Debt](#known-issues--technical-debt)
10. [Feature Status](#feature-status)
11. [Quick Answers to Common Questions](#quick-answers)

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
- ✅ Multi-language support (EN, TH, ZH, JA)
- ✅ Dark/Light theme
- ✅ Gamification (scoldings saved counter)
- ✅ Feedback submission
- ✅ OTA updates via EAS

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│   React Native + Expo SDK 54 + Expo Router v6               │
├─────────────────────────────────────────────────────────────┤
│   • Zustand (State Management)                               │
│   • react-native-reanimated (Animations)                     │
│   • expo-camera / vision-camera (Camera)                     │
│   • react-native-udp (P2P Streaming)                         │
│   • react-native-zeroconf (mDNS Discovery)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS (Pairing API)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        BACKEND                               │
│   Fastify + Prisma + Supabase PostgreSQL                    │
├─────────────────────────────────────────────────────────────┤
│   Endpoints:                                                 │
│   • POST /api/pair/create    - Generate 4-digit code        │
│   • POST /api/pair/join      - Join with code               │
│   • POST /api/pair/partner   - Get partner info             │
│   • POST /api/pair/unpair    - Disconnect devices           │
│   • GET  /api/pair/status/:code - Poll pairing status       │
│   • POST /api/feedback/submit - Submit user feedback        │
│   • POST /api/session/*      - Multi-session management     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        DATABASE                              │
│   Supabase PostgreSQL                                        │
├─────────────────────────────────────────────────────────────┤
│   Tables: devices, device_pairs, feedbacks, sessions        │
└─────────────────────────────────────────────────────────────┘
```

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
| **Vision** | react-native-vision-camera | 4.7.3 | Advanced camera |
| **Storage** | @react-native-async-storage | 2.2.0 | Persistent storage |
| **Haptics** | expo-haptics | 15.0.8 | Tactile feedback |
| **OTA Updates** | expo-updates | 29.0.14 | Over-the-air updates |

### Backend (help-her-take-photo-api)

| Category | Library | Version | Purpose |
|----------|---------|---------|---------|
| **Server** | Fastify | 5.6.2 | HTTP server |
| **ORM** | Prisma | 6.9.0 | Database ORM |
| **Validation** | Zod | 3.25.56 | Schema validation |
| **WebSockets** | @fastify/websocket | 11.2.0 | Real-time comms |
| **CORS** | @fastify/cors | 11.1.0 | Cross-origin |

### ✅ Library Status
All libraries are **up-to-date** as of December 2025:
- Using latest Expo SDK 54 (released Sep 2025)
- React Native 0.81.5 with New Architecture
- Reanimated v4 (New Architecture only)

---

## 📁 Project Structure

### Frontend
```
help-her-take-photo/
├── app/                    # Expo Router pages
│   ├── _layout.tsx        # Root layout with navigation
│   ├── index.tsx          # Home screen (role selection)
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
│   │   └── ui/           # AnimatedButton, FadeView
│   ├── stores/           # Zustand stores
│   │   ├── pairingStore.ts
│   │   ├── connectionStore.ts
│   │   ├── settingsStore.ts
│   │   ├── languageStore.ts
│   │   ├── statsStore.ts
│   │   └── themeStore.ts
│   ├── services/         # API client
│   ├── i18n/             # Translations (EN, TH, ZH, JA)
│   ├── config/           # Build info, changelog
│   └── types/            # TypeScript types
├── assets/               # Images, icons
├── scripts/              # Build scripts
├── .github/workflows/    # CI/CD
├── app.json              # Expo config
├── eas.json              # EAS Build config
└── package.json
```

### Backend
```
help-her-take-photo-api/
├── src/
│   ├── index.ts          # Fastify server entry
│   ├── lib/
│   │   └── prisma.ts     # Prisma client
│   ├── routes/
│   │   ├── pairing.ts    # Pairing endpoints
│   │   ├── feedback.ts   # Feedback endpoints
│   │   └── session.ts    # Session endpoints
│   └── schemas/          # Zod schemas
├── prisma/
│   └── schema.prisma     # Database schema
├── package.json
└── .env                  # Environment variables
```

---

## 🚀 Development Setup

### Prerequisites
- Node.js 20.19.4+
- npm or yarn
- Expo Go app (for testing)
- Android Studio (for Android builds)
- Xcode 26+ (for iOS builds, macOS only)

### Frontend Setup
```bash
cd help-her-take-photo
npm install
npx expo start
```

### Backend Setup
```bash
cd help-her-take-photo-api
npm install
cp .env.example .env  # Configure DATABASE_URL
npx prisma generate
npx prisma db push
npm run dev
```

### Environment Variables
Frontend `.env`:
```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Backend `.env`:
```env
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
PORT=3000
```

---

## 📦 Build & Deployment

### Build Profiles (eas.json)

| Profile | Distribution | Use Case |
|---------|--------------|----------|
| `development` | internal | Dev client with localhost API |
| `preview` | internal | Testing with production API |
| `staging` | internal | Pre-release testing |
| `production` | store | App Store / Play Store |

### Manual Build Commands
```bash
# Android only
eas build --platform android --profile preview

# iOS only (requires Apple credentials)
eas build --platform ios --profile preview

# Both platforms
eas build --platform all --profile preview
```

### OTA Updates
```bash
# Push update to preview channel
eas update --branch preview --message "Bug fixes"
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|----------|---------|--------|
| `eas-build.yml` | Push to main | Build Android + iOS |
| `eas-update.yml` | Push to main | OTA update |
| `pr-preview.yml` | PR opened | Preview build |

### Required GitHub Secrets
```
EXPO_TOKEN  # Personal access token from expo.dev
```

### Pipeline Status ✅
The current setup follows **Expo best practices**:
- Uses `expo/expo-github-action@v8`
- Parallel Android + iOS builds
- Non-interactive mode with `--no-wait`
- Concurrency control to cancel stale builds
- Path filtering to skip doc changes

---

## ⚙️ Environment Variables

### Expo Console (expo.dev)

**You do NOT need to add env vars on Expo console** if they're in `eas.json`. The `env` block in each profile handles this:

```json
{
  "build": {
    "preview": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://your-api.vercel.app/api"
      }
    }
  }
}
```

### When to Use Expo Console Env Vars
- Secrets that shouldn't be in code (API keys)
- Team-shared variables
- Override values per build

---

## ⚠️ Known Issues & Technical Debt

### Current Issues

1. **iOS Build Not Triggered**
   - **Cause:** Apple Developer credentials not configured
   - **Fix:** Run `eas credentials` to set up iOS signing

2. **Build Speed (~15 min)**
   - Normal for first builds
   - Subsequent builds cache dependencies
   - Use OTA updates for faster iteration

3. **Node Version Warning**
   - React Native 0.81.5 prefers Node 20.19.4+
   - Current `eas.json` uses 20.18.0
   - Consider updating to 22.x LTS

### Technical Debt

| Item | Priority | Description |
|------|----------|-------------|
| P2P Streaming | Medium | UDP streaming needs more testing |
| Tests | High | No unit/integration tests yet |
| Error Boundaries | Medium | Add crash recovery UI |
| Analytics | Low | Add event tracking |

---

## ✅ Feature Status

### Completed ✅
- [x] Device pairing (4-digit code)
- [x] Camera capture and preview
- [x] Photo gallery with sharing
- [x] Multi-language (EN, TH, ZH, JA)
- [x] Dark/Light theme
- [x] User profile with gamification
- [x] Feedback form to Supabase
- [x] OTA updates configured
- [x] CI/CD pipeline

### In Progress 🚧
- [ ] Real-time P2P streaming
- [ ] iOS build credentials
- [ ] Production deployment

### Planned 📋
- [ ] Push notifications
- [ ] SSO login (Google/Apple)
- [ ] Photo editing features
- [ ] Leaderboard system

---

## ❓ Quick Answers

### Why no iOS builds?
iOS requires Apple Developer Program membership ($99/year) and credentials setup. Run:
```bash
eas credentials --platform ios
```

### Why do builds take 15+ minutes?
- First builds compile all native code
- EAS free tier has queue time
- **Speed up options:**
  - Paid EAS plan (priority queue, M1 workers)
  - Use OTA updates for JS-only changes
  - Enable build cache (SDK 53+)

### Are libraries up to date?
✅ Yes! Using Expo SDK 54 (latest), React Native 0.81.5, Reanimated 4.

### Do I need env vars on Expo console?
No, they're in `eas.json`. Only add secrets there if needed.

### How to test quickly?
```bash
# Local development
npx expo start --tunnel

# OTA update (faster than full build)
eas update --branch preview
```

---

## 👤 Contact & Resources

- **Repository:** github.com/kensaurus/help-her-take-photo
- **Expo Dashboard:** expo.dev/accounts/kensaurus
- **Author:** kensaurus (kensaur.us)

### Useful Links
- [Expo Documentation](https://docs.expo.dev)
- [EAS Build Guide](https://docs.expo.dev/build/introduction/)
- [React Native 0.81](https://reactnative.dev/blog/2025/08/12/react-native-0.81)
- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)

---

*© 2025 kensaurus - kensaur.us*

