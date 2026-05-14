#!/bin/bash
# EAS Build Post-Install Hook
# Runs after dependencies are installed, before gradle compilation
# Copies native Android files from modules/dragonflow-native to the build directory

set -e

echo "[EAS Hook] Copying native DragonFlow files after prebuild..."
node ./scripts/copy-native-files.js

if [ $? -eq 0 ]; then
  echo "[EAS Hook] Native files copied successfully for EAS build"
else
  echo "[EAS Hook] ERROR: Failed to copy native files"
  exit 1
fi
