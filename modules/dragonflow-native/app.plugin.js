/**
 * Expo Config Plugin for DragonFlow Native Module
 *
 * Handles Android-specific configuration for the floating bubble native module:
 * 1. Registers FloatingBubblePackage in MainApplication.kt
 * 2. Adds required manifest declarations and permissions
 *
 * File copying is handled by separate mechanisms:
 * - Local dev: npm run prebuild:clean (chains expo prebuild + copy script)
 * - EAS Build: eas-build-post-install.sh hook (runs after prebuild)
 * - Other CI: manually run scripts/copy-native-files.js after prebuild
 */

const fs = require('fs');
const path = require('path');

const withDragonfFlowNative = (config) => {
  // Android-specific configuration
  return withFloatingBubbleAndroid(config);
};

const withFloatingBubbleAndroid = (config) => {
  config.plugins ??= [];

  config.plugins.push([
    'expo-build-properties',
    {
      android: {
        // Ensure required permissions are available
        permissions: [
          'android.permission.RECEIVE_BOOT_COMPLETED',
          'android.permission.FOREGROUND_SERVICE',
          'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
          'android.permission.SCHEDULE_EXACT_ALARM',
          'android.permission.SYSTEM_ALERT_WINDOW',
          'android.permission.VIBRATE',
        ],
      },
    },
  ]);

  return config;
};

module.exports = withDragonfFlowNative;
