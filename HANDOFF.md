# Project Handoff: Help Her Take Photo

**Date:** December 14, 2025  
**Last OTA Update:** `03af5cdc-cd89-4113-89bb-e48978d08403`  
**Branch:** `main`

---

## 🎯 Project Overview

**Help Her Take Photo** is a React Native (Expo) app that enables couples to take photos together remotely. One person acts as the "Photographer" (holds the camera) and the other as the "Director" (sees the live feed and gives directions).

### Tech Stack
- **Framework:** React Native with Expo SDK 52
- **Router:** Expo Router (file-based routing)
- **Backend:** Supabase (auth, database, realtime)
- **WebRTC:** `react-native-webrtc` for peer-to-peer video streaming
- **State:** Zustand (global state), nuqs (URL params)
- **UI:** Custom components, Reanimated for animations

### Key Files
| File | Purpose |
|------|---------|
| `app/camera.tsx` | Photographer's view - streams camera via WebRTC |
| `app/viewer.tsx` | Director's view - receives WebRTC stream, sends commands |
| `src/services/webrtc.ts` | WebRTC service singleton - handles P2P connection |
| `src/services/api.ts` | Supabase API including presence tracking |
| `src/stores/pairingStore.ts` | Pairing state, session ID, partner info |

---

## 🔴 Current Issue Being Debugged

### Problem: Photographer mode camera screen crashes/shows error

**Symptom:** When user clicks "Photographer" button, the camera screen opens briefly then crashes or shows an error screen.

**Latest logs show:**
```
12:00:57.285 - camera_screen_opened
12:00:57.304 - webrtc_init_called, webrtc_fetching_turn_credentials
12:00:57.382 - camera_screen_closed (only ~80ms later!)
```

### Root Causes Identified & Fixed (in this session)

#### 1. ✅ WebRTC Race Condition (FIXED)
**Problem:** When switching from Director→Photographer, `destroy()` from viewer.tsx was still running when `init()` was called from camera.tsx.

**Fix:** Added mutex/lock in `src/services/webrtc.ts`:
```typescript
private cleanupPromise: Promise<void> | null = null

async init(...) {
  // Wait for any pending destroy() to complete
  if (this.cleanupPromise) {
    await this.cleanupPromise
  }
  // ... rest of init
}
```

#### 2. ✅ Camera Conflict (FIXED - NEEDS TESTING)
**Problem:** `CameraView` (expo-camera) and WebRTC's `getUserMedia()` both trying to access camera simultaneously.

**Fix:** Added placeholder state in `app/camera.tsx`:
```typescript
const webrtcIsInitializing = isPaired && webrtcAvailable && !localStream && (isSharing || webrtcInitialized)

// In render:
{webrtcIsInitializing ? (
  <View style={styles.initializingContainer}>
    <Text>📷</Text>
    <Text>Connecting camera...</Text>
  </View>
) : (
  <CameraView ... />
)}
```

---

## 📋 Testing Checklist

After the user updates to latest OTA, verify:

- [ ] Photographer screen opens without crashing
- [ ] "Connecting camera..." placeholder shows briefly
- [ ] Live camera feed appears after WebRTC connects
- [ ] Director can see the stream on their device
- [ ] Taking photos works while streaming
- [ ] Switching between Director/Photographer modes works

---

## 🔍 How to Debug

### 1. Check App Logs in Supabase
```sql
SELECT * FROM app_logs 
WHERE timestamp > NOW() - INTERVAL '10 minutes' 
ORDER BY timestamp DESC;
```

### 2. Key Log Events to Look For
| Event | Meaning |
|-------|---------|
| `camera_screen_opened` | Screen mounted |
| `webrtc_init_called` | WebRTC init started |
| `webrtc_init_waiting_for_cleanup` | Waiting for previous destroy() |
| `webrtc_fetching_turn_credentials` | Getting TURN servers |
| `webrtc_turn_credentials_fetched` | TURN servers received |
| `webrtc_creating_peer_connection` | Creating RTCPeerConnection |
| `webrtc_local_stream_started` | Camera stream acquired |
| `photographer_local_stream_ready` | Stream set in React state |
| `camera_screen_closed` | Screen unmounted |
| `global_js_error` | Uncaught JavaScript error |

### 3. If Screen Closes Immediately
Look for:
- Missing logs between `webrtc_init_called` and `camera_screen_closed`
- `global_js_error` events
- `photographer_webrtc_init_failed` errors

---

## 🏗️ Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Photographer  │         │    Director     │
│  (camera.tsx)   │         │  (viewer.tsx)   │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │    WebRTC P2P Stream      │
         │◄─────────────────────────►│
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────┐
│            webrtcService (singleton)         │
│  - Manages RTCPeerConnection                │
│  - Handles ICE candidates                   │
│  - Uses Supabase Realtime for signaling     │
└─────────────────────────────────────────────┘
         │                           │
         ▼                           ▼
┌─────────────────────────────────────────────┐
│             Supabase Realtime               │
│  - Signaling channel (SDP, ICE)             │
│  - Presence channel (online/offline)        │
│  - Commands channel (capture, direction)    │
└─────────────────────────────────────────────┘
```

---

## 🧪 OTA Updates

Push updates with:
```bash
npx eas update --branch main --message "your message" --non-interactive
```

User needs to **force close and reopen** the app to get updates.

---

## ⚠️ Known Issues & Technical Debt

### 1. Expo Go Limitation
WebRTC requires a **development build** - it doesn't work in Expo Go. The app gracefully falls back to expo-camera only mode.

### 2. TURN Server Credentials
Using Metered.ca TURN servers. API key is hardcoded as fallback because `EXPO_PUBLIC_*` env vars require native rebuild (OTA doesn't update them).

```typescript
// src/services/webrtc.ts
const METERED_API_KEY = process.env.EXPO_PUBLIC_METERED_API_KEY || '692e88ad36749006f9f653eb3d40989da0d8'
```

### 3. H.264 Black Screen on Android
Some Android devices have issues with H.264 codec. We prefer VP8:
```typescript
// In createOffer() and handleOffer()
const modifiedSdp = this.preferVP8Codec(offer.sdp)
```

### 4. Presence Grace Period
To prevent "partner disconnected" false alarms during navigation, there's a 10-second grace period in `subscribeToSessionPresence()`.

---

## 📁 Files Modified in This Session

| File | Changes |
|------|---------|
| `src/services/webrtc.ts` | Added cleanup mutex, defensive error handling |
| `app/camera.tsx` | Added placeholder while WebRTC initializes |

---

## 🎯 Next Steps

1. **Verify the camera conflict fix works** - User needs to test after OTA update
2. **If still crashing**, check logs for:
   - `global_js_error` - will show actual JS exception
   - Missing `webrtc_turn_credentials_fetched` - network issue
   - `photographer_webrtc_init_failed` - init error details

3. **Potential remaining issues:**
   - Native crash (not caught by JS error handler)
   - Expo Camera permissions issue
   - WebRTC native module issue

---

## 📞 Resources

- **Supabase Dashboard:** Check `app_logs` table for debugging
- **EAS Dashboard:** https://expo.dev/accounts/kensaurus/projects/help-her-take-photo
- **WebRTC Docs:** https://github.com/react-native-webrtc/react-native-webrtc

---

## 🔄 Session Log Summary

| Time | Action |
|------|--------|
| Start | User reported Photographer mode showing error screen |
| Analysis | Found no `webrtc_init_called` for camera role - race condition |
| Fix 1 | Added mutex to prevent init/destroy race |
| Result | `webrtc_init_called` now appears, but screen closes ~80ms later |
| Analysis | Found camera conflict - CameraView vs getUserMedia() |
| Fix 2 | Added placeholder while WebRTC initializes |
| Status | **AWAITING USER TEST** |

---

*Generated: December 14, 2025*
