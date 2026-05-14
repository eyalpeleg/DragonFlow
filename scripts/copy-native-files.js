#!/usr/bin/env node
/**
 * Copies native DragonFlow files from modules/dragonflow-native to android build directory
 * This script should be run after 'npx expo prebuild' creates the android directory
 */

const fs = require('fs');
const path = require('path');

const projectRoot = __dirname.replace('/scripts', '');
const moduleRoot = path.join(projectRoot, 'modules/dragonflow-native');
const sourceJavaDir = path.join(moduleRoot, 'android/src/main/java/com/plgsw/dragonflow');
const sourceResDir = path.join(moduleRoot, 'android/src/main/res');

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

  console.log('[copy-native-files] Copying native files...');

  kotlinFiles.forEach(file => {
    const src = path.join(sourceJavaDir, file);
    const dest = path.join(destJavaDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`  ✓ ${file}`);
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
        console.log(`  ✓ ${resType}/${file}`);
      });
    }
  });

  console.log('[copy-native-files] Native files copied successfully');
  process.exit(0);
} catch (error) {
  console.error('[copy-native-files] Error:', error.message);
  process.exit(1);
}
