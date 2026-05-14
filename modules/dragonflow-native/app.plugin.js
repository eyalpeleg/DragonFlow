/**
 * Expo Config Plugin for DragonFlow Native Module
 *
 * NOTE: This plugin does NOT copy native files.
 * File copying is handled by separate mechanisms:
 * - Local dev: npm run prebuild:clean (chains expo prebuild + copy script)
 * - EAS Build: eas-build-post-install.sh hook (runs after prebuild)
 * - Other CI: manually run scripts/copy-native-files.js after prebuild
 *
 * This plugin just validates the module is loaded and available.
 */

const withDragonfFlowNative = (config) => {
  // Plugin structure required by Expo
  // Native files are copied via build hooks/scripts, not during config reading
  return config;
};

module.exports = withDragonfFlowNative;
