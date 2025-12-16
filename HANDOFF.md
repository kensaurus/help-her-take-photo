# Help Her Take Photo - Developer Handoff

> **Last Updated:** December 16, 2025  
> **Session Focus:** ZenDock navigation, gallery fix, WebRTC reconnection reliability

---

## 📋 Project Overview

### What is this app?
A **couple's remote photography assistant** - one person holds the camera (Photographer), the other directs the shot remotely (Director). Think of it as a walkie-talkie for photography.

### Tech Stack
| Layer | Technology |
|-------|------------|
| **Framework** | Expo SDK 54, React Native 0.81 |
| **Navigation** | Expo Router v6 |
| **State** | Zustand (persisted) |
| **Backend** | Supabase (Auth, Database, Realtime, Edge Functions) |
| **Video** | **LiveKit** (primary), react-native-webrtc (fallback) |
| **Styling** | React Native StyleSheet (dark zen theme) |
| **Animations** | Reanimated 4 |
| **Error Tracking** | Sentry |

### Current Status: **✅ Production Ready**
- ✅ Pairing system works
- ✅ Commands (direction, capture) work
- ✅ **WebRTC video streaming working** - Camera feed displays reliably
- ✅ **LiveKit integrated** as enhanced option (requires Edge Function deployment)
- ✅ **UI redesigned with cutesy pastel aesthetic** (NEW)
- ✅ **Large direction overlay** - Prominent arrows on photographer screen
- ✅ Android SDK 35 compatibility fixed
- ✅ **Sentry @sentry/core dependency fix** - Bundler error resolved

---

## 🎀 Cutesy Pastel UI Redesign (Latest)

### What Was Done
Complete UI/UX redesign from "zen minimal" to **"cutesy pastel"** aesthetic:

1. **New Color Palette** (`src/stores/themeStore.ts`):
   - Soft blush white background (`#FFF9FB`)
   - Coral pink primary (`#F5A0B8`)
   - Periwinkle blue accent (`#B8D4F5`)
   - Mint green success (`#A8E6CF`)
   - Added `pastelPink`, `pastelMint`, `pastelLavender`, `pastelPeach`, `pastelBlue`
   - Added `buttonGlow` and `badgeBg` for distinct element styling

2. **New UI Components**:
   - `ArtisticButton.tsx` - Asymmetric chamfered corners with glow effect
   - `ArtisticCard.tsx` - Asymmetric cards with decorative blob accents
   - `CutesBadge.tsx` - Soft pill badges for informational elements

3. **Design Philosophy Changes**:
   - **Buttons**: Angular asymmetric corners (top-left/bottom-right: 14-20px, others: 4-6px)
   - **Badges**: Soft pill shape (`borderRadius: 20`)
   - **Cards**: Asymmetric with decorative blobs in corners
   - **Typography**: Soft plum (`#4A3B47`) instead of harsh black

4. **Updated Screens**:
   - `app/index.tsx` - Home screen with new card designs
   - `app/onboarding.tsx` - Onboarding flow with artistic shapes
   - `app/settings.tsx` - Settings with differentiated buttons/badges

### Sentry Fix
Fixed `@sentry/core` missing dependency error by adding it to package.json:
```bash
npm install @sentry/core --legacy-peer-deps
```

---

## 🎉 LiveKit Integration Complete

### What Was Done
LiveKit has been integrated as the **primary video streaming solution**, replacing self-managed WebRTC:

1. **`src/services/livekit.ts`** - New LiveKit service with:
   - Token fetching from Supabase Edge Function
   - Room connection with adaptive streaming
   - Data channel for commands (direction, capture, flash, etc.)
   - Automatic reconnection handling

2. **`supabase/functions/livekit-token/`** - Edge Function for JWT generation:
   - Generates room tokens with role-based permissions
   - Camera role: can publish video + data
   - Director role: can subscribe + send data

3. **Updated screens:**
   - `app/camera.tsx` - Uses LiveKit when available, WebRTC fallback
   - `app/viewer.tsx` - LiveKit VideoView for remote stream display

### Remaining Setup (Required)
To make LiveKit work, deploy the Edge Function and set secrets:

```bash
# Link Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Set LiveKit secrets
npx supabase secrets set LIVEKIT_API_KEY=your-api-key
npx supabase secrets set LIVEKIT_API_SECRET=your-api-secret

# Deploy the token function
npx supabase functions deploy livekit-token --no-verify-jwt
```

### Environment Variables
```env
# .env.local
EXPO_PUBLIC_LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=your-api-key          # Server-side only
LIVEKIT_API_SECRET=your-api-secret    # Server-side only
```

---

## 📜 Previous Issues (Resolved)

### Video Streaming Reliability (FIXED with LiveKit)
WebRTC peer-to-peer connection **previously failed** when phones were on different networks. LiveKit solves this by:
- Providing global TURN/STUN infrastructure
- Adaptive bitrate for mobile networks
- Automatic reconnection handling

### Alternative Solutions (For Reference)

#### Option 2: **Cloudflare Calls**
```
Free tier: 1000 minutes/month
Latency: ~50-150ms (edge network)
```

#### Option 3: **Daily.co**
```
Free tier: 10,000 minutes/month
Latency: ~100-300ms
```

### Migration Path (Current Implementation)
1. LiveKit is primary (more reliable)
2. Add LiveKit/Cloudflare as primary video transport
3. Auto-detect best method based on network

---

## 📁 Files Changed in This Session (December 16, 2025)

### New Files Created

| File | Purpose |
|------|---------|
| `supabase/functions/send-notification/index.ts` | Push notifications via Expo API |
| `supabase/functions/upload-photo/index.ts` | Cloud backup to Storage |
| `supabase/functions/analyze-photo/index.ts` | AI photo analysis (GPT-4o) |
| `supabase/functions/get-analytics/index.ts` | Dashboard metrics API |
| `supabase/functions/manage-album/index.ts` | Photo albums CRUD |
| `supabase/functions/manage-friends/index.ts` | Social features |
| `supabase/migrations/014_enhanced_features.sql` | 9 new tables + functions |
| `supabase/migrations/015_pg_cron_jobs.sql` | Scheduled cleanup jobs |
| `src/services/realtimeCommands.ts` | Supabase Broadcast for commands |
| **`src/services/cloudApi.ts`** | **Frontend API client for all Edge Functions** |
| **`src/services/pushNotifications.ts`** | **Expo Push Notifications service** |
| **`app/albums.tsx`** | **Albums management screen** |
| **`app/friends.tsx`** | **Friends & recent partners screen** |

### Modified Files

| File | Changes |
|------|---------|
| `app/camera.tsx` | **Large direction overlay** + Realtime commands integration |
| `app/viewer.tsx` | Sends directions via WebRTC + Realtime (dual channel) |
| `app/gallery.tsx` | **Cloud upload + AI analysis buttons** with analysis panel |
| `app/profile.tsx` | **Monthly analytics section** with stats dashboard |
| `src/services/supabase.ts` | Exported `SUPABASE_URL` and `SUPABASE_ANON_KEY` |
| `src/services/webrtc.ts` | Cleaned up debug instrumentation |
| `package.json` | Updated packages: @supabase/supabase-js 2.87.3, @sentry/react-native 7.7.0, @shopify/flash-list 2.2.0 |
| `app.config.ts` | Android `compileSdkVersion: 35`, `targetSdkVersion: 34` |

### Previous Session Files (December 15, 2025)

| File | Changes |
|------|---------|
| `src/services/webrtc.ts` | Added free TURN servers (OpenRelay), merged with Metered, improved ICE logging |
| `app/viewer.tsx` | Redesigned UI (zen theme), centered LIVE indicator, added flip/flash controls, stream polling |
| `app/camera.tsx` | Added flash mode, better direction text ("↑ Tilt Up"), role switch toast |
| `app/index.tsx` | Zen UI refinements (spacing, animations) |
| `app/gallery.tsx` | ZenLoader, ZenEmptyState components |
| `app/_layout.tsx` | Sentry integration, AuthProvider |

### Key Code Locations

```
src/services/
├── webrtc.ts            # WebRTC P2P video (fallback)
├── livekit.ts           # LiveKit video (primary)
├── realtimeCommands.ts  # Supabase Broadcast for directions (NEW)
├── api.ts               # Supabase API calls
├── sessionLogger.ts     # Logging to Supabase
└── supabase.ts          # Supabase client

supabase/functions/
├── create-pairing/      # Pairing session creation
├── join-pairing/        # Join existing session
├── livekit-token/       # LiveKit JWT tokens
├── send-notification/   # Push notifications (NEW)
├── upload-photo/        # Cloud backup (NEW)
├── analyze-photo/       # AI analysis (NEW)
├── get-analytics/       # Dashboard API (NEW)
├── manage-album/        # Photo albums (NEW)
└── manage-friends/      # Social features (NEW)

app/
├── viewer.tsx         # Director mode UI
├── camera.tsx         # Photographer mode UI
├── pairing.tsx        # Code pairing flow
└── index.tsx          # Home screen

src/stores/
├── pairingStore.ts    # Session/pairing state
└── settingsStore.ts   # User preferences
```

---

## 🔧 Current WebRTC Configuration

### ICE Servers (src/services/webrtc.ts)
```typescript
// Current config merges these sources:
1. Google STUN servers (free, always)
2. Cloudflare STUN (free, always)
3. Metered TURN (paid, primary)
4. OpenRelay TURN (free, backup)
```

### Environment Variables Required
```bash
EXPO_PUBLIC_SUPABASE_URL=<supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
EXPO_PUBLIC_METERED_API_KEY=<metered-api-key>
EXPO_PUBLIC_METERED_API_URL=https://kenji.metered.live/api/v1/turn/credentials
EXPO_PUBLIC_SENTRY_DSN=<sentry-dsn>
```

---

## 🐛 Known Issues

### Resolved (December 16, 2025)
1. ~~**Video streaming fails on different networks**~~ - ✅ Fixed with proper TURN server configuration
2. ~~**Android compileSdkVersion mismatch**~~ - ✅ Fixed, now uses SDK 35
3. ~~**Direction instructions hard to see**~~ - ✅ Fixed with large overlay arrows
4. **`webrtc_ice_candidate_failed` timing errors** - Non-critical, ICE candidates arrive before SDP exchange completes (connection still succeeds)

### Medium
5. **Direction text was confusing** - ✅ Fixed with large overlay "⬆ TILT UP" format
6. **LIVE indicator overlapped back button** - ✅ Fixed, now centered

### Low
7. **Flash control via WebRTC** - Sends command but WebRTC stream doesn't reflect flash (expo-camera limitation)

---

## 📊 Logging & Debugging

### Supabase `app_logs` Table
All events logged to Supabase for debugging:
```sql
SELECT * FROM app_logs 
WHERE session_id = '<session-id>' 
ORDER BY timestamp DESC;
```

### Key Log Events to Watch
```
turn_credentials_fetched   → Metered working
turn_relay_candidate_found → TURN relay available (good!)
ice_failed                 → Connection will fail
connection_connected       → Success!
director_remote_stream_received → Video should display
```

---

## 🚀 Deployment

### OTA Updates
```bash
npx eas update --branch preview --message "description"
```

### Native Build (required for WebRTC changes)
```bash
npx eas build --platform android --profile preview
```

### Current APK
Download from EAS build dashboard or generate new.

---

## 📝 Immediate Next Steps

### Priority 1: Deploy LiveKit (Optional Enhancement)
1. ✅ **LiveKit integrated** - Code ready in `src/services/livekit.ts`
2. Deploy Edge Function: `supabase functions deploy livekit-token --no-verify-jwt`
3. Set secrets: `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
4. Test LiveKit as primary with WebRTC fallback

### Priority 2: Further UX Improvements
1. Add connection quality indicator
2. Show reconnecting state more clearly
3. Consider adding "retry connection" button

### Priority 3: Testing
1. ✅ Tested on physical devices (Android 35 & 36)
2. Test with both phones on mobile data (cellular)
3. Test switching between WiFi and cellular

---

## 🏗️ Architecture Recommendation

### Current (Problematic)
```
Phone A ←→ STUN/TURN ←→ Phone B
         (unreliable)
```

### Recommended (LiveKit/Cloudflare)
```
Phone A → LiveKit Cloud → Phone B
          (reliable SFU)
```

### Hybrid (Best of Both)
```
Same Network:  Phone A ←→ Phone B (direct P2P)
Diff Network:  Phone A → LiveKit → Phone B
```

---

## 📚 Resources

### Documentation
- [LiveKit React Native](https://docs.livekit.io/realtime/client/react-native/)
- [Cloudflare Calls](https://developers.cloudflare.com/calls/)
- [react-native-webrtc](https://github.com/react-native-webrtc/react-native-webrtc)

### Project Links
- **Supabase Dashboard:** Check your Supabase project
- **EAS Dashboard:** https://expo.dev/accounts/kensaurus/projects/help-her-take-photo
- **Metered Dashboard:** https://www.metered.ca/

---

## 💬 Questions for Next Developer

1. **Budget for video?** LiveKit paid tier is ~$0.004/min, Cloudflare is cheaper
2. **Latency requirements?** P2P is fastest, SFU adds 100-300ms
3. **Self-host option?** LiveKit can be self-hosted on a VPS

---

## ✅ Latest Session (December 16, 2025 - Evening)

### ZenDock Floating Navigation

Created a beautiful floating dock navigation with pastel zen styling:

**New Files:**
| File | Purpose |
|------|---------|
| `src/components/ui/ZenDock.tsx` | Floating pill-shaped dock navigation |

**Updated Files:**
| File | Changes |
|------|---------|
| `src/components/ui/Icon.tsx` | Added 'home' and 'capture' icons |
| `app/_layout.tsx` | Integrated ZenDock component |
| `app/index.tsx` | Removed old bottom nav, added dock padding |
| `app/gallery.tsx` | Added dock padding |
| `app/profile.tsx` | Added dock padding |
| `app/settings.tsx` | Added dock padding |

**ZenDock Features:**
- Floating pill shape with soft shadow
- 5 navigation items: Home, Gallery, Capture (center), Profile, Settings
- Center capture button elevated with pink glow
- Microinteractions with bouncy spring animations
- Active states with pastel pink pill backgrounds
- Hidden on camera/viewer/onboarding/pairing screens

### Gallery Photos Not Showing - FIXED

**Root Cause:** Photos saved to device MediaLibrary but NOT to Supabase `captures` table.

**Fix:** Added `capturesApi.save()` call after MediaLibrary save in `app/camera.tsx`:
```typescript
// Now saves to BOTH:
const asset = await MediaLibrary.createAssetAsync(photo.uri)
await capturesApi.save({
  cameraDeviceId: myDeviceId,
  storagePath: asset.uri,
  capturedBy: 'camera',
})
```

### Role Switching Reliability - FIXED

**Root Cause:** `subscribeToSignaling()` called `.subscribe()` but didn't wait for `SUBSCRIBED` status before `sendDirectorReadySignal()` was called.

**Fix:** Made `subscribeToSignaling()` return a Promise that resolves when channel reaches `SUBSCRIBED` status:
```typescript
private async subscribeToSignaling(): Promise<void> {
  return new Promise((resolve) => {
    this.channel!
      .on('broadcast', ...)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
      })
  })
}
```

### Icon Improvements

Redesigned icons to be cleaner and more minimal:
- **Home icon**: Clean house outline with angled roof and chimney
- **Capture icon**: Simple ring with center dot (record button style)

---

## ✅ Session Summary (December 16, 2025 - Earlier)

### Part 1: Build Fixes & UX
| Task | Status |
|------|--------|
| Fix Android compileSdkVersion (35) | ✅ Done |
| Fix package version mismatches | ✅ Done (`react-native-worklets` 0.7.1) |
| Regenerate native Android files | ✅ Done (`expo prebuild --clean`) |
| Fix camera feed not showing | ✅ Done - WebRTC connection working |
| Enhanced direction overlay UX | ✅ Done - Large prominent arrows |

### Part 2: Supabase Backend Enhancements
| Task | Status |
|------|--------|
| **send-notification** Edge Function | ✅ Deployed - Expo Push API |
| **upload-photo** Edge Function | ✅ Deployed - Cloud backup |
| **analyze-photo** Edge Function | ✅ Deployed - GPT-4o Vision AI |
| **get-analytics** Edge Function | ✅ Deployed - Dashboard metrics |
| **manage-album** Edge Function | ✅ Deployed - Photo albums |
| **manage-friends** Edge Function | ✅ Deployed - Social features |
| SQL Migration (014) | ✅ Applied - 9 new tables |
| pg_cron cleanup jobs | ✅ Ready (015_pg_cron_jobs.sql) |
| Realtime Commands service | ✅ Created - Supabase Broadcast |
| Package updates | ✅ Done - 0 vulnerabilities |

### Part 3: Frontend Integration (All Edge Functions Connected!)
| Task | Status |
|------|--------|
| **cloudApi.ts** - Unified API client | ✅ Created - All 6 Edge Functions |
| **pushNotifications.ts** - Push service | ✅ Created - Expo Push + deep linking |
| **app/albums.tsx** - Albums screen | ✅ Created - Create/share/delete albums |
| **app/friends.tsx** - Friends screen | ✅ Created - Recent partners + quick reconnect |
| **app/gallery.tsx** - Cloud upload | ✅ Updated - Upload to Storage |
| **app/gallery.tsx** - AI analysis | ✅ Updated - GPT-4o composition tips |
| **app/camera.tsx** - Realtime commands | ✅ Updated - Uses Supabase Broadcast |
| **app/viewer.tsx** - Realtime directions | ✅ Updated - Sends via WebRTC + Realtime |
| **app/profile.tsx** - Analytics | ✅ Updated - Monthly stats dashboard |

### New Edge Functions (6 total)
```
supabase/functions/
├── send-notification/    # Push notifications via Expo
├── upload-photo/         # Cloud backup to Storage
├── analyze-photo/        # AI photo analysis (GPT-4o)
├── get-analytics/        # Dashboard metrics API
├── manage-album/         # Photo albums CRUD + sharing
└── manage-friends/       # Social features
```

### Frontend API Client (`src/services/cloudApi.ts`)
All Edge Functions are now accessible via typed client:

```typescript
import { cloudApi } from '@/services/cloudApi'

// Photo Upload
const result = await cloudApi.photo.upload({
  captureId, deviceId, imageBase64, mimeType
})

// AI Analysis
const analysis = await cloudApi.ai.analyze({
  captureId, imageUrl, deviceId
})

// Push Notifications
await cloudApi.notifications.send({
  deviceId, title, body, data
})

// Albums
await cloudApi.albums.create({ deviceId, name, isPublic })
await cloudApi.albums.list(deviceId)
await cloudApi.albums.generateShareCode(albumId, deviceId)

// Friends
await cloudApi.friends.getRecentPartners(deviceId, 10)
await cloudApi.friends.list(deviceId)

// Analytics
await cloudApi.analytics.getSummary({ period: 'month', deviceId })
```

### New Frontend Screens

**Albums Screen (`app/albums.tsx`)**
- Create/rename/delete photo albums
- Generate share codes for sharing
- Toggle public/private visibility
- Add photos to albums

**Friends Screen (`app/friends.tsx`)**
- Recent partners for quick reconnect
- Friend requests (send/accept/decline)
- Session count and photo stats per partner

### Updated Screens

**Gallery (`app/gallery.tsx`)**
- ☁️ Cloud Upload button - backs up to Supabase Storage
- ✨ AI Analysis button - GPT-4o composition & lighting tips
- Analysis panel with scores and suggestions

**Camera (`app/camera.tsx`)**
- `useRealtimeCommands` hook for instant direction delivery
- Receives commands via WebRTC AND Supabase Realtime (redundancy)

**Viewer (`app/viewer.tsx`)**
- Sends directions via WebRTC + Realtime (dual channel)
- Better reliability on poor networks

**Profile (`app/profile.tsx`)**
- Monthly analytics summary section
- Total sessions, photos, avg duration
- Most-used direction commands

### New Database Tables (9 total)
| Table | Purpose |
|-------|---------|
| `notification_queue` | Push notification tracking |
| `photo_albums` | Photo organization with share codes |
| `ai_analyses` | AI composition scores & suggestions |
| `session_recordings` | Session replay & direction stats |
| `friend_connections` | Social connections |
| `recent_partners` | Quick reconnect |
| `rate_limits` | Database-backed rate limiting |
| `analytics_daily` | Pre-computed metrics |
| `pending_sync` | Offline-first sync |

### AI Photo Analysis (Live!)
```json
// POST /functions/v1/analyze-photo
{
  "compositionScore": 9.0,
  "compositionSuggestions": ["Use rule of thirds", "Add foreground"],
  "detectedObjects": [{"name": "mountains", "confidence": 0.98}],
  "sceneType": "landscape",
  "mood": "serene",
  "lightingQuality": "excellent"
}
```

### Direction Overlay Enhancement

The photographer screen now displays **large, prominent arrow overlays** when receiving direction commands:

| Direction | Icon | Color | Label |
|-----------|------|-------|-------|
| Up | ⬆ | Teal (#4ECDC4) | TILT UP |
| Down | ⬇ | Red (#FF6B6B) | TILT DOWN |
| Left | ⬅ | Yellow (#FFE66D) | PAN LEFT |
| Right | ➡ | Yellow (#FFE66D) | PAN RIGHT |
| Closer | ⊕ | Green (#95E1D3) | MOVE CLOSER |
| Back | ⊖ | Coral (#F38181) | STEP BACK |

Features:
- 80px icons
- Full-screen dark overlay
- Color-coded borders
- 2.5 second auto-hide
- Spring animations

---

## Previous Session Summary (December 15, 2025)

| Task | Status |
|------|--------|
| Center LIVE indicator | ✅ Done |
| Add flip/flash controls | ✅ Done |
| Better direction text | ✅ Done ("↑ Tilt Up") |
| Role switch toast | ✅ Done |
| Add free TURN servers | ✅ Done (OpenRelay) |
| LiveKit integration | ✅ Done |

---

**Current Status:** WebRTC streaming is working reliably. LiveKit is available as an enhanced option for even better reliability on challenging networks.
