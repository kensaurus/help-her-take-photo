const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials. Ensure EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function publishRelease() {
  try {
    // 1. Read build.ts to get the latest build timestamp
    const buildTsPath = path.join(__dirname, '..', 'src', 'config', 'build.ts');
    if (!fs.existsSync(buildTsPath)) {
      throw new Error('build.ts not found. Run "npm run update-build" first.');
    }
    
    const buildTsContent = fs.readFileSync(buildTsPath, 'utf8');
    const buildNumberMatch = buildTsContent.match(/export const BUILD_NUMBER = '([^']+)'/);
    const appVersionMatch = buildTsContent.match(/export const APP_VERSION = '([^']+)'/);

    if (!buildNumberMatch || !appVersionMatch) {
      throw new Error('Could not parse BUILD_NUMBER or APP_VERSION from build.ts');
    }

    const buildNumber = buildNumberMatch[1];
    const version = appVersionMatch[1];
    
    // Default URL (can be overridden by arg)
    const downloadUrl = process.argv[2] || 'https://expo.dev/artifacts/eas/YOUR_BUILD_ID.apk';
    const changelog = process.argv[3] || `Automated release ${buildNumber}`;

    console.log(`🚀 Publishing Release: v${version} (Build ${buildNumber})`);

    const { data, error } = await supabase
      .from('app_versions')
      .insert({
        version,
        build_number: buildNumber,
        download_url: downloadUrl,
        changelog,
        force_update: false
      })
      .select();

    if (error) throw error;

    console.log('✅ Release published successfully:', data[0]);

  } catch (error) {
    console.error('❌ Failed to publish release:', error.message);
    process.exit(1);
  }
}

publishRelease();
