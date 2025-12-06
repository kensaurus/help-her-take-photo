#!/bin/bash

echo "Setting up Android credentials..."

# Check if the keystore is available via EAS Secrets
if [ -f "$EAS_SECRETS_ANDROID_KEYSTORE" ]; then
  echo "Found keystore from EAS Secrets"
  cp "$EAS_SECRETS_ANDROID_KEYSTORE" ./android-keystore.jks
  KEYSTORE_PATH="./android-keystore.jks"
else
  echo "Using local keystore"
  KEYSTORE_PATH="./helpher.keystore"
fi

# Create credentials.json using environment variables for passwords
cat > ./credentials.json << EOF
{
  "android": {
    "keystore": {
      "keystorePath": "$KEYSTORE_PATH",
      "keystorePassword": "${ANDROID_KEYSTORE_PASSWORD:-password123}",
      "keyAlias": "${ANDROID_KEY_ALIAS:-helpherkey}",
      "keyPassword": "${ANDROID_KEY_PASSWORD:-password123}"
    }
  }
}
EOF

echo "Android credentials configured successfully!"
cat ./credentials.json
ls -la *.jks *.keystore 2>/dev/null || echo "No keystore files found"

