<p align="center">
  <img src="assets/icon.png" alt="Help Her Take Photo" width="120" />
</p>

<h1 align="center">📸 Help Her Take Photo</h1>

<p align="center">
  <strong>Your relationship's photography insurance</strong><br>
  <em>Because "just take it again" hits different the 47th time</em>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#testing">Testing</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.74-blue?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-51-black?logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 🎯 The Problem

Every boyfriend knows this pain:
- *"You cut off my head!"*
- *"Why is it so blurry?"*
- *"My legs look weird from that angle"*
- *"Just... give me the phone"*

**Help Her Take Photo** solves this by connecting two devices, letting your partner see exactly what you're framing and guide you to the perfect shot in real-time.

---

## ✨ Features

### 📱 Core Functionality
| Feature | Description |
|---------|-------------|
| **Real-time Streaming** | Share your camera view with your partner instantly |
| **Director Mode** | Partner can guide with directional commands |
| **Remote Capture** | She triggers the shot when framing is perfect |
| **Shared Gallery** | Photos sync between both devices automatically |

### 🎮 User Experience
- **Big Touch Targets** — Easy to tap, even with shaky hands (80x70px buttons)
- **Haptic Feedback** — Satisfying vibrations on every interaction
- **Pull-to-Refresh** — Swipe down to refresh on all screens
- **Gesture Navigation** — Swipe right to go back
- **Click Animations** — Smooth spring animations throughout

### 🌍 Multi-Language Support
| Language | Status | Style |
|----------|--------|-------|
| 🇺🇸 English | ✅ Complete | Humorous |
| 🇹🇭 Thai (ไทย) | ✅ Complete | Humorous |
| 🇨🇳 Chinese (中文) | ✅ Complete | Humorous |
| 🇯🇵 Japanese (日本語) | ✅ Complete | Humorous |

Each language has **uniquely localized humor**, not direct translations!

### 🏆 Gamification
- **Scoldings Saved Counter** — Track arguments avoided
- **Ranking System** — Progress from "🐣 Rookie" to "🏆 Relationship Saver"
- **Session Stats** — Photos taken, sessions completed

---

## 🏗️ Architecture

```
help-her-take-photo/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root navigation
│   ├── index.tsx                 # Home (role selection)
│   ├── pairing.tsx               # Device pairing
│   ├── camera.tsx                # Photographer mode
│   ├── viewer.tsx                # Director mode
│   ├── gallery.tsx               # Shared photos
│   ├── profile.tsx               # User profile & stats
│   └── settings.tsx              # App settings
│
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── CameraView.tsx        # Camera preview wrapper
│   │   ├── CaptureButton.tsx     # Shutter button
│   │   ├── ConnectionStatus.tsx  # Connection indicator
│   │   ├── GridOverlay.tsx       # Rule of thirds grid
│   │   └── PreviewDisplay.tsx    # Stream preview
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useCamera.ts          # Camera control
│   │   ├── useConnection.ts      # P2P connection state
│   │   ├── useDiscovery.ts       # mDNS discovery
│   │   └── useFrameStream.ts     # Frame streaming
│   │
│   ├── i18n/                     # Internationalization
│   │   └── translations.ts       # All language strings
│   │
│   ├── services/                 # External services
│   │   ├── api.ts                # Backend API client
│   │   ├── discovery.ts          # Zeroconf/mDNS
│   │   ├── p2p.ts                # UDP peer-to-peer
│   │   └── streaming.ts          # Frame encoding
│   │
│   ├── stores/                   # Zustand state management
│   │   ├── connectionStore.ts    # Connection state
│   │   ├── languageStore.ts      # i18n state
│   │   ├── pairingStore.ts       # Pairing state
│   │   ├── settingsStore.ts      # App settings
│   │   └── statsStore.ts         # Gamification stats
│   │
│   └── types/                    # TypeScript definitions
│       ├── declarations.d.ts     # Module declarations
│       └── index.ts              # App types
│
├── assets/                       # Static assets
├── app.json                      # Expo config
├── babel.config.js               # Babel config (Reanimated)
├── metro.config.js               # Metro bundler config
├── tsconfig.json                 # TypeScript config
└── package.json                  # Dependencies
```

---

## 📦 Installation

### Prerequisites

| Tool | Version | Required For |
|------|---------|--------------|
| Node.js | 18+ | Runtime |
| npm/yarn | Latest | Package management |
| Expo CLI | Latest | Development |
| Android Studio | Latest | Android testing |
| Xcode | Latest | iOS testing (Mac only) |

### Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/help-her-take-photo.git
cd help-her-take-photo

# Install dependencies
npm install

# Start development server
npx expo start

# Run on specific platform
npx expo start --android    # Android
npx expo start --ios        # iOS (Mac only)
npx expo start --web        # Web preview
```

### Environment Setup

Create `.env` in the root:

```env
# Backend API
EXPO_PUBLIC_API_URL=http://localhost:3000/api

# Supabase (optional)
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## 📱 Testing

### Android Testing (Windows/Mac/Linux)

#### Option 1: Physical Device (Recommended)
```bash
# 1. Install Expo Go from Play Store
# 2. Start dev server
npx expo start

# 3. Scan QR code with Expo Go app
```

#### Option 2: Android Emulator
```bash
# 1. Open Android Studio → Virtual Device Manager
# 2. Create AVD (API 34 recommended)
# 3. Start emulator
# 4. Set environment variables (Windows):
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator

# 5. Run app
npx expo run:android
```

### iOS Testing

#### From Windows (No Mac Required!)

| Method | Difficulty | Cost | Best For |
|--------|------------|------|----------|
| **Expo Go on iPhone** | Easy | Free | Quick testing |
| **EAS Build** | Medium | Free tier | Production builds |
| **MacinCloud** | Medium | ~$20/mo | Full Xcode access |
| **GitHub Actions** | Advanced | Free | CI/CD builds |

##### Method 1: Expo Go (Easiest)
```bash
# 1. Install Expo Go from App Store on your iPhone
# 2. Create Expo account at expo.dev
# 3. Login in terminal
npx expo login

# 4. Start dev server
npx expo start

# 5. Scan QR code with iPhone camera → Opens in Expo Go
```

##### Method 2: EAS Build (Production)
```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Login
eas login

# 3. Configure project
eas build:configure

# 4. Build iOS (runs in cloud, no Mac needed!)
eas build --platform ios

# 5. Install via QR code or TestFlight
```

##### Method 3: Cloud Mac Services
- **MacinCloud** — Full Mac VM access ($20/month)
- **AWS EC2 Mac** — Pay per hour (~$1.08/hr)
- **GitHub Actions** — Free for public repos

#### From Mac
```bash
# Run on simulator
npx expo run:ios

# Run on device (requires Apple Developer account)
npx expo run:ios --device
```

---

## 🎨 Design System

### Colors
```css
--background: #FAFAFA;
--primary: #1A1A1A;
--success: #22C55E;
--danger: #DC2626;
--warning: #FCD34D;
--muted: #888888;
```

### Touch Targets
- Minimum: 44×44px (Apple HIG)
- Direction buttons: 80×70px
- Capture button: 80×80px

### Typography
- Headings: 600-700 weight, tracking -0.5
- Body: 400-500 weight
- Monospace: For codes and IDs

---

## 🔧 Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-router` | File-based navigation |
| `zustand` | State management |
| `react-native-mmkv` | Persistent storage |
| `react-native-reanimated` | Animations |
| `react-native-gesture-handler` | Gestures |
| `expo-haptics` | Haptic feedback |
| `expo-camera` | Camera access |
| `expo-media-library` | Photo gallery |

---

## 📝 Scripts

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web
npm run lint       # Run ESLint
npm run typecheck  # Run TypeScript check
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

### Commit Convention
```
feat: Add new feature
fix: Bug fix
docs: Documentation changes
style: Code style changes
refactor: Code refactoring
test: Add tests
chore: Maintenance
```

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- All the boyfriends who inspired this app through countless photo retakes
- The partners who patiently waited while we figured out the "rule of thirds"
- [Expo](https://expo.dev) for making cross-platform development possible
- Coffee ☕

---

<p align="center">
  <strong>Save your relationship, one photo at a time! 📸❤️</strong>
</p>
