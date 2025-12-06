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
4. **Development Build**: `npx expo run:android` or `npx expo run:ios`

## 🏗 Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Expo SDK 54, React Native 0.81 |
| Navigation | Expo Router v6 |
| State | Zustand |
| Animations | Reanimated 4 |
| Camera | expo-camera, vision-camera |
| Storage | AsyncStorage |
| Backend | Fastify + Prisma + Supabase |

## 📁 Project Structure

```
├── app/                 # Expo Router screens
│   ├── _layout.tsx     # Root navigation
│   ├── index.tsx       # Home screen
│   ├── pairing.tsx     # Device pairing
│   ├── camera.tsx      # Camera view
│   ├── viewer.tsx      # Remote viewer
│   └── ...
├── src/
│   ├── components/     # Reusable UI components
│   ├── stores/         # Zustand state stores
│   ├── services/       # API client
│   ├── i18n/          # Translations
│   └── config/        # Build info
├── assets/            # Images, icons
└── scripts/           # Build scripts
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

### Build Commands

```bash
# Development build (with dev client)
eas build --profile development --platform android

# Preview build (internal testing)
eas build --profile preview --platform all

# Production build (store submission)
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
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

For production, env vars are configured in `eas.json`.

## 📱 Build Profiles

| Profile | Distribution | API URL |
|---------|--------------|---------|
| `development` | Internal | localhost:3000 |
| `preview` | Internal | Production API |
| `staging` | Internal | Staging API |
| `production` | Store | Production API |

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
