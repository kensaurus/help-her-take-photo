# Help Her Take Photo

> Your relationship's photography insurance — because "just take it again" hits different the 47th time.

A React Native mobile app that connects two devices so your partner can guide your camera framing in real-time.

## Features

- **4-Digit Pairing** — Quick and easy device connection
- **Real-time Camera Streaming** — See what your partner sees
- **Director Mode** — Guide the photographer with directional commands
- **Remote Capture** — Partner triggers the shot when framing is perfect
- **Shared Gallery** — Photos sync between both devices
- **Multi-language** — EN, TH, ZH, JA with localized humor
- **Dark/Light Theme** — Automatic or manual switching
- **Gamification** — Track "scoldings saved" and rank up
- **Feedback System** — Submit feature requests and bug reports
- **Multi-Session Support** — Connect multiple cameras simultaneously
- **Build Info & Changelog** — In-app version and what's new

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo 54 |
| Navigation | Expo Router |
| State | Zustand |
| Storage | AsyncStorage |
| Animations | Reanimated 4 |
| Camera | expo-camera, react-native-vision-camera |
| Backend | Fastify + Prisma + Supabase |

## Project Structure

```
app/
├── _layout.tsx      # Root navigation
├── index.tsx        # Home screen
├── pairing.tsx      # Device pairing (4-digit code)
├── camera.tsx       # Photographer mode
├── viewer.tsx       # Director mode
├── gallery.tsx      # Photo gallery
├── profile.tsx      # User stats & rank
├── settings.tsx     # App settings
├── feedback.tsx     # Feature requests & bug reports
└── changelog.tsx    # What's new

src/
├── components/      # Reusable UI components
├── config/          # Build info & constants
├── hooks/           # Custom React hooks
├── i18n/            # Translations (EN/TH/ZH/JA)
├── services/        # API clients
├── stores/          # Zustand stores
└── types/           # TypeScript definitions

scripts/
└── update-build.js  # Auto-update build timestamp
```

## Installation

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on device
npx expo run:android
npx expo run:ios
```

## Environment Variables

Create `.env`:

```env
EXPO_PUBLIC_API_URL=http://localhost:3000/api
```

## Scripts

```bash
npm start              # Start Expo dev server
npm run android        # Run on Android
npm run ios            # Run on iOS
npm run lint           # ESLint check
npm run typecheck      # TypeScript check
npm run build:preview  # Build preview APK
npm run build:production # Build for stores
```

## CI/CD

GitHub Actions workflows:
- **eas-build.yml** — Auto builds on push to main
- **eas-update.yml** — OTA updates
- **pr-preview.yml** — Preview builds for PRs

## Stores

| Store | Purpose |
|-------|---------|
| `pairingStore` | Device pairing state |
| `connectionStore` | P2P connection state |
| `settingsStore` | App settings |
| `languageStore` | i18n management |
| `themeStore` | Theme (light/dark) |
| `statsStore` | Gamification stats |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/pair/create` | POST | Generate 4-digit code |
| `/api/pair/join` | POST | Join with code |
| `/api/pair/partner` | POST | Get partner info |
| `/api/pair/unpair` | POST | Disconnect |
| `/api/feedback` | POST | Submit feedback |
| `/api/session/create` | POST | Create new session |
| `/api/session/join` | POST | Join existing session |
| `/api/session/list` | POST | List all sessions |
| `/api/session/end` | POST | End a session |

## Build Number

Build number uses datetime format: `YYYYMMDD.HHMM`

Automatically updated on build via `npm run update-build`.

Displayed in Settings → tap version to see changelog.

## Design Principles

- **Minimal** — Clean, compact UI with 8px border radius
- **Responsive** — Touch targets ≥ 48px
- **Accessible** — Proper contrast, labels
- **Performant** — Optimized animations

## License

MIT — © 2025 kensaur.us
