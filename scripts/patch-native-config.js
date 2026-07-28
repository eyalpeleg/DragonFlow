#!/usr/bin/env node

/**
 * Post-prebuild patch script for floating bubble native module
 * Applies necessary modifications to generated Android files that can't be done via plugins
 */

const fs = require('fs');
const path = require('path');

const androidDir = path.join(__dirname, '../android');
const mainAppFile = path.join(androidDir, 'app/src/main/java/com/plgsw/dragonflow/MainApplication.kt');
const manifestFile = path.join(androidDir, 'app/src/main/AndroidManifest.xml');

console.log('[patch-native-config] Patching Android native configuration...');

// 1. Patch MainApplication.kt to register FloatingBubblePackage
if (fs.existsSync(mainAppFile)) {
  let content = fs.readFileSync(mainAppFile, 'utf8');

  if (!content.includes('add(FloatingBubblePackage())')) {
    const original = content;
    content = content.replace(
      /packages\.apply\s*\{\s*\/\/ Packages that cannot be autolinked/,
      'packages.apply {\n              add(FloatingBubblePackage())\n              // Packages that cannot be autolinked'
    );

    if (content !== original) {
      fs.writeFileSync(mainAppFile, content, 'utf8');
      console.log('  ✓ Added FloatingBubblePackage() registration');
    }
  }

  // Register ShareIntentPackage alongside FloatingBubblePackage (same com.plgsw.dragonflow
  // package as MainApplication, so no import needed).
  if (!content.includes('add(ShareIntentPackage())')) {
    const before = content;
    content = content.replace(
      /add\(FloatingBubblePackage\(\)\)/,
      'add(FloatingBubblePackage())\n              add(ShareIntentPackage())'
    );
    if (content !== before) {
      fs.writeFileSync(mainAppFile, content, 'utf8');
      console.log('  ✓ Added ShareIntentPackage() registration');
    }
  }
} else {
  console.warn(`  ⚠ MainApplication.kt not found at ${mainAppFile}`);
}

// 2. Patch AndroidManifest.xml for floating bubble service and receivers
if (fs.existsSync(manifestFile)) {
  let content = fs.readFileSync(manifestFile, 'utf8');
  const original = content;

  // Add required permissions if missing
  const permissionsToAdd = [
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.SCHEDULE_EXACT_ALARM',
  ];

  for (const perm of permissionsToAdd) {
    if (!content.includes(`android:name="${perm}"`)) {
      content = content.replace(
        /(<uses-permission[^>]*WRITE_EXTERNAL_STORAGE[^>]*\/>)/,
        `$1\n  <uses-permission android:name="${perm}"/>`
      );
    }
  }

  // Add the share-target intent-filter to MainActivity so the app appears in the
  // Android share sheet for text/plain (ACTION_SEND). Inserted before MainActivity's
  // closing </activity> tag. See docs/design/features/share-text-target/design.md §1.
  if (!content.includes('android.intent.action.SEND')) {
    content = content.replace(
      /(\n)(\s*)<\/activity>/,
      `$1$2  <intent-filter>\n$2    <action android:name="android.intent.action.SEND"/>\n$2    <category android:name="android.intent.category.DEFAULT"/>\n$2    <data android:mimeType="text/plain"/>\n$2  </intent-filter>\n$2</activity>`
    );
  }

  // Add service and receiver declarations if missing
  if (!content.includes('FloatingBubbleService')) {
    content = content.replace(
      /(<\/activity>\s*\n\s*<\/application>)/,
      `</activity>\n    <service android:name=".FloatingBubbleService" android:foregroundServiceType="specialUse" android:exported="false"/>\n    <receiver android:name=".SoundAlarmReceiver" android:exported="false"/>\n    <receiver android:name=".BootReceiver" android:exported="true">\n      <intent-filter>\n        <action android:name="android.intent.action.BOOT_COMPLETED"/>\n      </intent-filter>\n    </receiver>\n  </application>`
    );
  }

  if (content !== original) {
    fs.writeFileSync(manifestFile, content, 'utf8');
    console.log('  ✓ Updated AndroidManifest.xml with floating bubble declarations');
  }
} else {
  console.warn(`  ⚠ AndroidManifest.xml not found at ${manifestFile}`);
}

console.log('[patch-native-config] Done');
