# Release Workflow

## 1. Automated Versioning
The app now uses a **Timestamp-based Versioning** system (`YYYYMMDD.HHMM`) alongside standard semantic versioning (`1.0.0`).

### How it works:
1. **Build**: When you run `npm run build:preview`, `scripts/update-build.js` updates `src/config/build.ts` with the current timestamp.
2. **Check**: The app compares its compiled `buildTimestamp` with the latest `build_number` in Supabase.
3. **Prompt**: If `Supabase Build Number > App Build Timestamp`, the user sees an update prompt.

## 2. Publishing a Release

### Prerequisites
1. Get your **Service Role Key** from Supabase Dashboard > Project Settings > API.
2. Add it to your `.env` file (do NOT commit this file):
   ```env
   SUPABASE_SERVICE_ROLE_KEY=eyJh...
   EXPO_PUBLIC_SUPABASE_URL=https://...
   ```

### Steps
1. **Build the APK** (via EAS or locally):
   ```bash
   eas build --profile preview --platform android
   ```
   *Copy the APK URL from the EAS output.*

2. **Publish to Supabase**:
   Run the publish script with the new APK URL:
   ```bash
   node scripts/publish-release.js "https://expo.dev/artifacts/..." "Added new feature X"
   ```

   This will:
   - Read the latest build number from `src/config/build.ts`.
   - Insert a new record into the `app_versions` table.
   - Users will instantly be prompted to update.
