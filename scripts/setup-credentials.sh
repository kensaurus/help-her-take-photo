#!/bin/bash

echo "Setting up Android credentials..."

# Create credentials.json using environment variables for passwords
cat > ./credentials.json << EOF
{
  "android": {
    "keystore": {
      "keystorePath": "./helpher.keystore",
      "keystorePassword": "${ANDROID_KEYSTORE_PASSWORD:-password123}",
      "keyAlias": "${ANDROID_KEY_ALIAS:-helpherkey}",
      "keyPassword": "${ANDROID_KEY_PASSWORD:-password123}"
    }
  }
}
EOF

echo "Android credentials configured successfully!"
cat ./credentials.json

