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
    'BootReceiver.kt',
    'ParkingWatcherModule.kt',
    'ParkingWatcherPackage.kt',
    'ServiceLauncher.kt'
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

  // Patch build.gradle to fix autolinking package name mismatch
  const buildGradle = path.join(projectRoot, 'android/app/build.gradle');
  if (fs.existsSync(buildGradle)) {
    let gradle = fs.readFileSync(buildGradle, 'utf8');
    const patch = `
tasks.register('fixPackageNameInAutolinking') {
    doLast {
        def entryPointFile = file("\${layout.buildDirectory.get().asFile}/generated/autolinking/src/main/java/com/facebook/react/ReactNativeApplicationEntryPoint.java")
        if (entryPointFile.exists()) {
            def content = entryPointFile.text
            content = content.replace('com.dragonflow.BuildConfig', 'com.plgsw.dragonflow.BuildConfig')
            entryPointFile.text = content
        }
    }
}

tasks.configureEach { task ->
    if (task.name == 'compileDebugJavaWithJavac' || task.name == 'compileReleaseJavaWithJavac') {
        task.dependsOn(fixPackageNameInAutolinking)
    }
}
`;
    if (!gradle.includes('fixPackageNameInAutolinking')) {
      gradle = gradle.replace(/^dependencies \{/m, patch + '\ndependencies {');
      fs.writeFileSync(buildGradle, gradle);
      console.log('  ✓ build.gradle (autolinking package fix)');
    }

    // Inject release signing config from env vars (DRAGONFLOW_KEYSTORE_*).
    // Falls back to debug signing when env vars are unset (EAS cloud, other devs).
    gradle = fs.readFileSync(buildGradle, 'utf8');
    if (!gradle.includes('DRAGONFLOW_RELEASE_SIGNING')) {
      const releaseSigning = `        // DRAGONFLOW_RELEASE_SIGNING — injected by scripts/copy-native-files.js
        release {
            def ksPath = System.getenv("DRAGONFLOW_KEYSTORE_PATH")
            if (ksPath?.trim()) {
                storeFile file(ksPath)
                storePassword System.getenv("DRAGONFLOW_KEYSTORE_PASSWORD")
                keyAlias System.getenv("DRAGONFLOW_KEY_ALIAS")
                keyPassword System.getenv("DRAGONFLOW_KEY_PASSWORD")
            }
        }
`;
      // Insert release{} inside the existing signingConfigs { debug { ... } } block,
      // immediately before its closing brace.
      gradle = gradle.replace(
        /(signingConfigs \{\s*\n\s*debug \{[\s\S]*?\n\s*\}\n)(\s*\})/,
        `$1${releaseSigning}$2`
      );

      // Point release buildType at signingConfigs.release when env is present.
      // The release block contains a "Caution!" comment that uniquely identifies it.
      gradle = gradle.replace(
        /(\/\/ Caution! In production[^\n]*\n[^\n]*\n\s*)signingConfig signingConfigs\.debug/,
        '$1signingConfig System.getenv("DRAGONFLOW_KEYSTORE_PATH")?.trim() ? signingConfigs.release : signingConfigs.debug'
      );
      fs.writeFileSync(buildGradle, gradle);
      console.log('  ✓ build.gradle (release signing from env)');
    }
  }

  // Patch MainApplication.kt to register FloatingBubblePackage
  const mainAppKt = path.join(projectRoot, 'android/app/src/main/java/com/plgsw/dragonflow/MainApplication.kt');
  if (fs.existsSync(mainAppKt)) {
    let mainApp = fs.readFileSync(mainAppKt, 'utf8');

    // Add imports if not present
    if (!mainApp.includes('import com.plgsw.dragonflow.FloatingBubblePackage')) {
      mainApp = mainApp.replace(
        /import expo\.modules\.ReactNativeHostWrapper/,
        'import com.plgsw.dragonflow.FloatingBubblePackage\nimport expo.modules.ReactNativeHostWrapper'
      );
    }
    if (!mainApp.includes('import com.plgsw.dragonflow.ParkingWatcherPackage')) {
      mainApp = mainApp.replace(
        /import expo\.modules\.ReactNativeHostWrapper/,
        'import com.plgsw.dragonflow.ParkingWatcherPackage\nimport expo.modules.ReactNativeHostWrapper'
      );
    }

    // Add package registration if not present
    if (!mainApp.includes('add(FloatingBubblePackage())')) {
      mainApp = mainApp.replace(
        /PackageList\(this\)\.packages\.apply \{(\s+\/\/ Packages that cannot be autolinked.*?\n.*?)\s*\}/s,
        'PackageList(this).packages.apply {\n              add(FloatingBubblePackage())\n$1\n            }'
      );
    }
    if (!mainApp.includes('add(ParkingWatcherPackage())')) {
      mainApp = mainApp.replace(
        /add\(FloatingBubblePackage\(\)\)/,
        'add(FloatingBubblePackage())\n              add(ParkingWatcherPackage())'
      );
    }

    fs.writeFileSync(mainAppKt, mainApp);
    console.log('  ✓ MainApplication.kt (FloatingBubble + ParkingWatcher registration)');
  }

  // Recreate local.properties (wiped by prebuild:clean) using ANDROID_HOME or known default
  const localProps = path.join(projectRoot, 'android/local.properties');
  if (!fs.existsSync(localProps)) {
    const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || `${process.env.HOME}/Library/Android/sdk`;
    fs.writeFileSync(localProps, `sdk.dir=${sdkDir}\n`);
    console.log(`  ✓ local.properties (sdk.dir=${sdkDir})`);
  }

  console.log('[copy-native-files] Native files copied successfully');
  process.exit(0);
} catch (error) {
  console.error('[copy-native-files] Error:', error.message);
  process.exit(1);
}
