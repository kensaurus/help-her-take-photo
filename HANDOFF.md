# Help Her Take Photo - Developer Handoff

> **Last Updated:** December 15, 2025  
> **Session Focus:** WebRTC video streaming, UI/UX improvements, connection reliability

---

## 📋 Project Overview

### What is this app?
A **couple's remote photography assistant** - one person holds the camera (Photographer), the other directs the shot remotely (Director). Think of it as a walkie-talkie for photography.

### Tech Stack
| Layer | Technology |
|-------|------------|
| **Framework** | Expo SDK 53, React Native |
| **Navigation** | Expo Router v4 |
| **State** | Zustand (persisted) |
| **Backend** | Supabase (Auth, Database, Realtime, Edge Functions) |
| **Video** | react-native-webrtc (WebRTC P2P) |
| **Styling** | React Native StyleSheet (dark zen theme) |
| **Animations** | Reanimated 3 |
| **Error Tracking** | Sentry |

### Current Status: **⚠️ Partially Working**
- ✅ Pairing system works
- ✅ Commands (direction, capture) work
- ⚠️ **Video streaming unreliable** - ICE/TURN issues on different networks
- ✅ UI redesigned with minimal zen aesthetic

---

## 🚨 Critical Issue: Video Streaming Reliability

### The Problem
WebRTC peer-to-peer connection **fails frequently** when phones are on different networks or restrictive WiFi. The app relies on TURN relay servers, but:

1. **Metered TURN servers** are configured but connection still fails
2. **Free public TURN (OpenRelay)** added as backup but limited capacity
3. **ICE candidates** often fail to establish connection

### Evidence from Logs
```
ice_failed: "ICE failed - likely need TURN servers for this network"
connectionState: "failed"
```

### Root Cause
Self-managed WebRTC is complex and unreliable for consumer apps. TURN servers need to be:
- Globally distributed (close to users)
- High bandwidth capacity
- Properly configured for mobile networks

---

## 💡 Recommended Solution: Use WebRTC-as-a-Service

### Option 1: **LiveKit** (Recommended)
```
Free tier: 50 participants, 5000 minutes/month
Latency: ~100-300ms
Reliability: Excellent
```

**Why LiveKit:**
- Open source, can self-host later
- Handles all TURN/STUN complexity
- Adaptive bitrate for mobile networks
- React Native SDK available: `@livekit/react-native`

**Implementation:**
```bash
npm install @livekit/react-native @livekit/react-native-webrtc
```

```typescript
// Replace current WebRTC with LiveKit
import { Room, VideoTrack } from '@livekit/react-native'

const room = new Room()
await room.connect(LIVEKIT_URL, token)
await room.localParticipant.setCameraEnabled(true)
```

### Option 2: **Cloudflare Calls**
```
Free tier: 1000 minutes/month
Latency: ~50-150ms (edge network)
Reliability: Excellent
```

### Option 3: **Daily.co**
```
Free tier: 10,000 minutes/month
Latency: ~100-300ms
Reliability: Excellent
```

### Migration Path
1. Keep current WebRTC as fallback for local network
2. Add LiveKit/Cloudflare as primary video transport
3. Auto-detect best method based on network

---

## 📁 Files Changed in This Session

### Modified Files

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
├── webrtc.ts          # WebRTC service - THE PROBLEM AREA
├── api.ts             # Supabase API calls
├── sessionLogger.ts   # Logging to Supabase
└── supabase.ts        # Supabase client

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

### Critical
1. **Video streaming fails on different networks** - ICE connection fails, needs better TURN or WebRTC-as-a-Service
2. **`ontrack` callback unreliable on Android** - Added polling workaround but not ideal

### Medium
3. **Direction text was confusing** - Fixed with "↑ Tilt Up" format
4. **LIVE indicator overlapped back button** - Fixed, now centered

### Low
5. **Flash control via WebRTC** - Sends command but WebRTC stream doesn't reflect flash (expo-camera limitation)

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

### Priority 1: Fix Video Reliability
1. **Evaluate LiveKit** - Sign up, test React Native SDK
2. **Implement fallback** - Try P2P first, fall back to LiveKit
3. **Test on mobile networks** - Both phones on cellular data

### Priority 2: Improve UX
1. Add connection quality indicator
2. Show reconnecting state clearly
3. Add "retry connection" button

### Priority 3: Testing
1. Test on various network conditions
2. Test with both phones on mobile data
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

## ✅ Session Summary

| Task | Status |
|------|--------|
| Fix camera feed not showing | ⚠️ Partial - added polling, but ICE still fails |
| Center LIVE indicator | ✅ Done |
| Add flip/flash controls | ✅ Done |
| Better direction text | ✅ Done ("↑ Tilt Up") |
| Role switch toast | ✅ Done |
| Add free TURN servers | ✅ Done (OpenRelay) |
| Root cause analysis | ✅ Done - need WebRTC-as-a-Service |

---

**Bottom Line:** The current self-managed WebRTC approach is fundamentally unreliable for a consumer app used "everywhere the couple goes." Recommend migrating to **LiveKit** or **Cloudflare Calls** for production reliability.
