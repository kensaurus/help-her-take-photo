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
  <a href="#cicd">CI/CD</a> •
  <a href="#testing">Testing</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React_Native-0.81-blue?logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/Expo-54-black?logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

<p align="center">
  <a href="https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml">
    <img src="https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-build.yml/badge.svg" alt="EAS Build" />
  </a>
  <a href="https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml">
    <img src="https://github.com/kensaurus/help-her-take-photo/actions/workflows/eas-update.yml/badge.svg" alt="EAS Update" />
  </a>
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
| **Dark/Light Theme** | Automatic or manual theme switching |

### 🎮 User Experience
- **Big Touch Targets** — Easy to tap, even with shaky hands (80x70px buttons)
- **Haptic Feedback** — Satisfying vibrations on every interaction
- **Pull-to-Refresh** — Swipe down to refresh on all screens
- **Gesture Navigation** — Swipe right to go back
- **Fade Animations** — Smooth spring animations throughout
- **Tap Feedback** — Visual and haptic response on all buttons

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

## 🚀 CI/CD Pipeline

### Automated Workflows

This project uses **GitHub Actions** + **EAS Build** for automated builds and deployments:

| Workflow | Trigger | Description |
|----------|---------|-------------|
| `eas-build.yml` | Push to `main` | Builds Android & iOS apps |
| `eas-update.yml` | Push to `main` | Publishes OTA updates |
| `pr-preview.yml` | Pull Request | Creates preview builds for PRs |

### Build Profiles

| Profile | Channel | Distribution | Use Case |
|---------|---------|--------------|----------|
| `development` | `development` | Internal | Local dev with dev client |
| `preview` | `preview` | Internal APK | Testing & QA |
| `staging` | `staging` | Internal | Pre-production testing |
| `production` | `production` | Store | App Store / Play Store |

### Setup GitHub Secrets

Add these secrets to your GitHub repository (`Settings → Secrets → Actions`):

```
EXPO_TOKEN=your_expo_token_here
```

To get your Expo token:
1. Go to https://expo.dev/settings/access-tokens
2. Create a new token with "Read and write" permissions
3. Copy the token to GitHub secrets

### Manual Build Triggers

You can also trigger builds manually from GitHub Actions:

1. Go to `Actions` tab in your repository
2. Select `EAS Build` workflow
3. Click `Run workflow`
4. Select platform (android/ios/all) and profile

### OTA Updates

When you push changes to `main`, the app automatically:
1. Builds new native binaries (if native code changed)
2. Publishes OTA update (for JS/asset changes)

Users on the `preview` channel will receive updates automatically!

---

## 🏗️ Architecture

```
help-her-take-photo/
├── .github/workflows/             # CI/CD pipelines
│   ├── eas-build.yml              # Auto build on push
│   ├── eas-update.yml             # OTA updates
│   └── pr-preview.yml             # PR preview builds
│
├── app/                           # Expo Router screens
│   ├── _layout.tsx                # Root navigation
│   ├── index.tsx                  # Home (role selection)
│   ├── pairing.tsx                # Device pairing
│   ├── camera.tsx                 # Photographer mode
│   ├── viewer.tsx                 # Director mode
│   ├── gallery.tsx                # Shared photos
│   ├── profile.tsx                # User profile & stats
│   └── settings.tsx               # App settings
│
├── src/
│   ├── components/                # Reusable UI components
│   │   ├── ui/                    # Base UI components
│   │   │   ├── AnimatedButton.tsx # Button with animations
│   │   │   └── FadeView.tsx       # Fade in/out wrapper
│   │   ├── CameraView.tsx         # Camera preview
│   │   ├── CaptureButton.tsx      # Shutter button
│   │   ├── ConnectionStatus.tsx   # Connection indicator
│   │   ├── GridOverlay.tsx        # Rule of thirds
│   │   └── PreviewDisplay.tsx     # Stream preview
│   │
│   ├── hooks/                     # Custom React hooks
│   ├── i18n/                      # Internationalization
│   ├── services/                  # External services
│   ├── stores/                    # Zustand state stores
│   └── types/                     # TypeScript types
│
├── assets/                        # Static assets
├── app.json                       # Expo configuration
├── eas.json                       # EAS Build configuration
├── .eslintrc.js                   # ESLint rules
├── .prettierrc                    # Prettier config
└── package.json                   # Dependencies
```

---

## 📦 Installation

### Prerequisites

| Tool | Version | Required For |
|------|---------|--------------|
| Node.js | 20+ | Runtime |
| npm | Latest | Package management |
| Expo CLI | Latest | Development |
| Android Studio | Latest | Android testing |
| Xcode | Latest | iOS testing (Mac only) |

### Quick Start

```bash
# Clone repository
git clone https://github.com/kensaurus/help-her-take-photo.git
cd help-her-take-photo

# Install dependencies
npm install

# Start development server
npx expo start

# Run on specific platform
npx expo run:android    # Android
npx expo run:ios        # iOS (Mac only)
npx expo start --web    # Web preview
```

### Environment Setup

Create `.env` in the root:

```env
# Backend API
EXPO_PUBLIC_API_URL=http://localhost:3000/api
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
# 2. Create AVD (API 34+ recommended)
# 3. Start emulator
# 4. Set environment variables (Windows):
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk

# 5. Run app
npx expo run:android
```

### iOS Testing

#### From Windows (No Mac Required!)

| Method | Difficulty | Cost | Best For |
|--------|------------|------|----------|
| **Expo Go on iPhone** | Easy | Free | Quick testing |
| **EAS Build** | Medium | Free tier | Production builds |

##### Method 1: Expo Go (Easiest)
```bash
# 1. Install Expo Go from App Store
# 2. Login
npx expo login

# 3. Start dev server
npx expo start

# 4. Scan QR code with iPhone camera
```

##### Method 2: EAS Build (Production)
```bash
# Build iOS (runs in cloud, no Mac needed!)
npm run build:preview
# or
eas build --platform ios --profile preview
```

---

## 🎨 Design System

### Colors
```css
/* Light Theme */
--background: #FAFAFA;
--primary: #1A1A1A;
--secondary: #666666;
--card: #FFFFFF;
--border: #E5E5E5;

/* Dark Theme */
--background: #1A1A1A;
--primary: #FAFAFA;
--secondary: #AAAAAA;
--card: #2A2A2A;
--border: #444444;

/* Shared */
--success: #22C55E;
--danger: #DC2626;
--warning: #FCD34D;
```

### Touch Targets
- Minimum: 44×44px (Apple HIG)
- Direction buttons: 80×70px
- Capture button: 80×80px

---

## 🔧 Key Dependencies

| Package | Purpose |
|---------|---------|
| `expo-router` | File-based navigation |
| `zustand` | State management |
| `@react-native-async-storage/async-storage` | Persistent storage |
| `react-native-reanimated` | Animations |
| `react-native-gesture-handler` | Gestures |
| `expo-haptics` | Haptic feedback |
| `expo-camera` | Camera access |
| `expo-media-library` | Photo gallery |
| `react-native-vision-camera` | Advanced camera features |

---

## 📝 Scripts

```bash
# Development
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run web            # Run on web

# Quality
npm run lint           # Run ESLint
npm run lint:fix       # Fix ESLint errors
npm run typecheck      # TypeScript check

# Build & Deploy
npm run build:preview      # Build preview APK
npm run build:production   # Build production
npm run update:preview     # Publish OTA to preview
npm run update:production  # Publish OTA to production
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: Add amazing feature'`
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
ci: CI/CD changes
```

---

## 📄 License

MIT License — See [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- Made by **kensaurus** — [kensaur.us](https://kensaur.us)
- All the boyfriends who inspired this app through countless photo retakes
- The partners who patiently waited while we figured out the "rule of thirds"
- [Expo](https://expo.dev) for making cross-platform development possible

---

<p align="center">
  <strong>Save your relationship, one photo at a time! 📸❤️</strong><br>
  <em>© 2025 kensaur.us</em>
</p>
