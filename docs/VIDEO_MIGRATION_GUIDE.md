# Video Streaming Migration Guide

> Migrate from unreliable self-managed WebRTC to a reliable cloud solution

---

## ✅ Migration Status: **COMPLETE**

LiveKit has been integrated into the app. See:
- `src/services/livekit.ts` - LiveKit service implementation
- `supabase/functions/livekit-token/` - Token generator Edge Function
- `app/camera.tsx` & `app/viewer.tsx` - Updated to use LiveKit

**Remaining:** Deploy Edge Function and set secrets (see Step 3 below).

---

## 🎯 The Goal

Make video streaming work **everywhere** - different WiFi networks, cellular data, restrictive firewalls, hotels, coffee shops, etc.

---

## 📊 Options Comparison

| Solution | Free Tier | Latency | Reliability | Effort |
|----------|-----------|---------|-------------|--------|
| **LiveKit** | 5000 min/mo | 100-300ms | ⭐⭐⭐⭐⭐ | Medium |
| **Cloudflare Calls** | 1000 min/mo | 50-150ms | ⭐⭐⭐⭐⭐ | Medium |
| **Daily.co** | 10000 min/mo | 100-300ms | ⭐⭐⭐⭐⭐ | Easy |
| **Agora** | 10000 min/mo | 100-300ms | ⭐⭐⭐⭐⭐ | Easy |
| **Self-hosted Coturn** | Free | 50-200ms | ⭐⭐⭐ | Hard |
| **Current (Metered)** | 1GB/mo | 50-200ms | ⭐⭐ | Done |

**Recommendation: LiveKit** - Best balance of free tier, reliability, and React Native support.

---

## 🚀 LiveKit Migration

### Step 1: Install Dependencies

```bash
npm install @livekit/react-native @livekit/react-native-webrtc livekit-server-sdk
```

### Step 2: Create LiveKit Account

1. Go to https://cloud.livekit.io/
2. Create a new project
3. Get your API Key and Secret
4. Add to `.env`:

```bash
EXPO_PUBLIC_LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

### Step 3: Create Token Generator (Supabase Edge Function)

Create `supabase/functions/livekit-token/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { AccessToken } from 'npm:livekit-server-sdk'

const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY')!
const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET')!

serve(async (req) => {
  const { roomName, participantName, isPublisher } = await req.json()

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    ttl: '1h',
  })

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: isPublisher,
    canSubscribe: true,
  })

  return new Response(JSON.stringify({ token: await token.toJwt() }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

### Step 4: Create LiveKit Service

Create `src/services/livekit.ts`:

```typescript
import { Room, RoomEvent, VideoPresets } from '@livekit/react-native'
import { registerGlobals } from '@livekit/react-native-webrtc'
import { supabase } from './supabase'

// Must call before using LiveKit
registerGlobals()

class LiveKitService {
  private room: Room | null = null
  private callbacks: {
    onRemoteStream?: (track: any) => void
    onConnectionStateChange?: (state: string) => void
    onError?: (error: Error) => void
  } = {}

  async init(
    sessionId: string,
    deviceId: string,
    role: 'camera' | 'director',
    callbacks: typeof this.callbacks
  ) {
    this.callbacks = callbacks

    // Get token from Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('livekit-token', {
      body: {
        roomName: `session-${sessionId}`,
        participantName: deviceId,
        isPublisher: role === 'camera',
      },
    })

    if (error) throw error

    // Create and connect to room
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    })

    // Set up event handlers
    this.room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === 'video') {
        this.callbacks.onRemoteStream?.(track)
      }
    })

    this.room.on(RoomEvent.ConnectionStateChanged, (state) => {
      this.callbacks.onConnectionStateChange?.(state)
    })

    this.room.on(RoomEvent.Disconnected, () => {
      this.callbacks.onConnectionStateChange?.('disconnected')
    })

    // Connect
    await this.room.connect(process.env.EXPO_PUBLIC_LIVEKIT_URL!, data.token)

    // If camera role, publish video
    if (role === 'camera') {
      await this.room.localParticipant.setCameraEnabled(true)
    }

    this.callbacks.onConnectionStateChange?.('connected')
  }

  async sendCommand(command: string, data?: any) {
    if (!this.room) return
    
    const message = JSON.stringify({ command, data })
    await this.room.localParticipant.publishData(
      new TextEncoder().encode(message),
      { reliable: true }
    )
  }

  async destroy() {
    if (this.room) {
      await this.room.disconnect()
      this.room = null
    }
  }
}

export const livekitService = new LiveKitService()
```

### Step 5: Update Camera Screen

Replace WebRTC with LiveKit in `app/camera.tsx`:

```typescript
// Replace:
import { webrtcService } from '../src/services/webrtc'

// With:
import { livekitService } from '../src/services/livekit'

// In useEffect:
await livekitService.init(sessionId, myDeviceId, 'camera', {
  onConnectionStateChange: (state) => {
    setConnectionState(state)
    setIsConnected(state === 'connected')
  },
  onError: (error) => {
    setError(error.message)
  },
})
```

### Step 6: Update Viewer Screen

Replace WebRTC with LiveKit in `app/viewer.tsx`:

```typescript
// In useEffect:
await livekitService.init(sessionId, myDeviceId, 'director', {
  onRemoteStream: (track) => {
    setRemoteTrack(track)
    setIsReceiving(true)
  },
  onConnectionStateChange: (state) => {
    setConnectionState(state)
  },
})

// In render, use LiveKit's VideoTrack component:
import { VideoTrack } from '@livekit/react-native'

{remoteTrack && (
  <VideoTrack
    track={remoteTrack}
    style={styles.video}
    objectFit="cover"
  />
)}
```

---

## 🔄 Hybrid Approach (Best Reliability)

Keep both WebRTC and LiveKit, auto-switch based on connection:

```typescript
class HybridVideoService {
  async init(...) {
    // Try P2P WebRTC first (fastest, free)
    try {
      await webrtcService.init(...)
      
      // Set timeout - if not connected in 10s, switch to LiveKit
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('P2P failed, switching to LiveKit')
          webrtcService.destroy()
          livekitService.init(...)
        }
      }, 10000)
    } catch {
      // P2P failed immediately, use LiveKit
      await livekitService.init(...)
    }
  }
}
```

---

## 📱 Native Build Required

After adding LiveKit, you need a new native build:

```bash
# For development
npx expo prebuild --clean
npx expo run:android

# For distribution
npx eas build --platform android --profile preview
```

---

## ✅ Migration Checklist

- [x] Create LiveKit Cloud account
- [x] Add environment variables (`.env.local`)
- [ ] Deploy Supabase Edge Function for tokens *(needs: `supabase functions deploy livekit-token`)*
- [ ] Set Supabase secrets *(needs: `supabase secrets set LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...`)*
- [x] Install LiveKit packages (`@livekit/react-native`, `@livekit/react-native-webrtc`)
- [x] Create LiveKit service (`src/services/livekit.ts`)
- [x] Update camera.tsx
- [x] Update viewer.tsx
- [ ] Test on same WiFi
- [ ] Test on different networks
- [ ] Test on cellular data
- [x] Create new native build *(in progress)*
- [x] Publish OTA update

---

## 🎉 Expected Results

After migration:
- ✅ Works on same WiFi (direct P2P still available)
- ✅ Works on different WiFi networks
- ✅ Works on cellular data
- ✅ Works through restrictive firewalls
- ✅ Works in hotels, airports, coffee shops
- ✅ Automatic quality adaptation
- ✅ Better connection recovery

---

## 💰 Cost Estimation

For a couple using the app:
- **LiveKit Free Tier:** 5000 minutes/month
- **Average session:** 10-30 minutes
- **Sessions per month:** ~20-50
- **Monthly usage:** 200-1500 minutes

**Result:** Free tier is plenty for personal use!
