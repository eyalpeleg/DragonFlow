const fs = require('fs');
const path = require('path');

/**
 * Expo Config Plugin for DragonFlow Native Module
 * Handles copying native Android code and resources during prebuild
 * This runs when Expo reads the app.json config
 */
const copyNativeFiles = () => {
  // Get the project root (where app.json is)
  const projectRoot = path.resolve(__dirname, '../..');

  // Source: modules/dragonflow-native
  const moduleRoot = __dirname;
  const sourceJavaDir = path.join(moduleRoot, 'android/src/main/java/com/plgsw/dragonflow');
  const sourceResDir = path.join(moduleRoot, 'android/src/main/res');

  // Destination: android/app/src/main
  const destJavaDir = path.join(projectRoot, 'android/app/src/main/java/com/plgsw/dragonflow');
  const destResDir = path.join(projectRoot, 'android/app/src/main/res');

  try {
    // Create destination directories if they don't exist
    fs.mkdirSync(destJavaDir, { recursive: true });

    // Copy Kotlin source files
    const kotlinFiles = [
      'FloatingBubbleModule.kt',
      'FloatingBubblePackage.kt',
      'FloatingBubbleService.kt',
      'SoundAlarmReceiver.kt',
      'BootReceiver.kt'
    ];

    kotlinFiles.forEach(file => {
      const src = path.join(sourceJavaDir, file);
      const dest = path.join(destJavaDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`[dragonflow-native] Copied ${file}`);
      }
    });

    // Copy resource files (drawable, raw)
    ['drawable', 'raw'].forEach(resType => {
      const srcRes = path.join(sourceResDir, resType);
      const destRes = path.join(destResDir, resType);

      if (fs.existsSync(srcRes)) {
        fs.mkdirSync(destRes, { recursive: true });
        const files = fs.readdirSync(srcRes);
        files.forEach(file => {
          const src = path.join(srcRes, file);
          const dest = path.join(destRes, file);
          fs.copyFileSync(src, dest);
          console.log(`[dragonflow-native] Copied ${resType}/${file}`);
        });
      }
    });

    console.log('[dragonflow-native] Native files copied successfully');
  } catch (error) {
    console.error('[dragonflow-native] Error copying files:', error.message);
    // Don't throw - let the build continue
  }
};

// Run the copy operation when this plugin is loaded
copyNativeFiles();

const withDragonfFlowNative = (config) => {
  // Plugin structure required by Expo
  return config;
};

module.exports = withDragonfFlowNative;
