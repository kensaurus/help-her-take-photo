# 📸 Help Her Take Photo

> Because he always messes up the shot... 📷

[![EAS Build](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml/badge.svg)](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml)
[![EAS Update](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml/badge.svg)](https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml)

A mobile app that helps couples take better photos by allowing one person to remotely guide the other's camera in real-time. Built with **Expo SDK 54** and **React Native 0.81**.

## ✨ Features

- 🔗 **Quick Pairing** - Connect devices with a simple 4-digit code
- 📱 **Real-time Camera View** - See what your partner sees
- 📷 **Remote Capture** - Take the perfect shot from anywhere
- 🖼️ **Instant Gallery** - Share high-res photos immediately
- 🌍 **Multi-language** - English, Thai, Chinese, Japanese
- 🌙 **Dark Mode** - Easy on the eyes
- 🎮 **Gamification** - Track your "scoldings saved"
- 📝 **Feedback** - Submit suggestions directly from the app
- 🎯 **Onboarding** - First-time user experience with 4-slide walkthrough

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
| Backend | Fastify + Prisma + Supabase |

## 📁 Project Structure

```
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root navigation & store initialization
│   ├── index.tsx          # Home screen (role selection)
│   ├── onboarding.tsx     # First-time user flow
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
│   │   ├── ui/           # Base UI (Icon, Skeleton, PressableScale)
│   │   └── *.tsx         # Feature components
│   ├── stores/           # Zustand state stores
│   │   ├── connectionStore.ts  # WebSocket connection state
│   │   ├── pairingStore.ts     # Device pairing state
│   │   ├── languageStore.ts    # i18n translations
│   │   ├── themeStore.ts       # Dark/Light mode
│   │   ├── statsStore.ts       # User statistics
│   │   ├── settingsStore.ts    # App preferences
│   │   └── onboardingStore.ts  # First-run state
│   ├── services/         # Business logic
│   │   ├── api.ts        # REST API client
│   │   ├── streaming.ts  # WebSocket streaming
│   │   ├── p2p.ts        # Peer-to-peer connection
│   │   ├── notifications.ts  # Push notifications
│   │   ├── security.ts   # Secure storage & biometrics
│   │   ├── logging.ts    # Console logging
│   │   └── sound.ts      # Audio feedback
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Translations (EN, TH, ZH, JA)
│   ├── types/            # TypeScript definitions
│   └── config/           # Build configuration
├── assets/               # Images, icons, sounds
└── scripts/              # Build & utility scripts
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

| Profile | Use Case | Distribution | API |
|---------|----------|--------------|-----|
| `development` | Local testing with dev client | Internal APK | localhost:3000 |
| `preview` | Internal QA testing | Internal APK | Production |
| `staging` | Pre-production validation | Internal APK | Staging |
| `production` | App Store / Play Store | Store Bundle | Production |

### Build Commands

```bash
# Development (with hot reload)
eas build --profile development --platform android

# Preview (internal testing)
eas build --profile preview --platform all

# Staging (pre-production)
eas build --profile staging --platform all

# Production (store submission)
eas build --profile production --platform all
```

### OTA Updates

```bash
# Push update to preview channel
eas update --branch preview --message "Your message"

# Push update to production
eas update --branch production --message "Your message"
```

## 🔐 Environment Variables

Create `.env` in project root:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

Environment variables per profile (configured in `eas.json`):

| Profile | API URL |
|---------|---------|
| development | `http://localhost:3000/api` |
| preview | `https://help-her-take-photo-api.vercel.app/api` |
| staging | `https://help-her-take-photo-api-staging.vercel.app/api` |
| production | `https://help-her-take-photo-api.vercel.app/api` |

## 📱 State Management

Zustand stores are initialized in `app/_layout.tsx` after native modules are ready:

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
- [Backend API](../help-her-take-photo-api/README.md)

## 📄 License

MIT License - See [LICENSE](./LICENSE) for details.

---

**Made with 💜 by [kensaurus](https://kensaur.us) © 2025**
