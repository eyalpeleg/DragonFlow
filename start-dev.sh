#!/bin/bash
ADB=~/Library/Android/sdk/platform-tools/adb

echo "Waiting for device..."
$ADB wait-for-device

echo "Forwarding Metro port..."
$ADB reverse tcp:8081 tcp:8081

echo "Starting Metro..."
cd "$(dirname "$0")"
npx expo start --dev-client
