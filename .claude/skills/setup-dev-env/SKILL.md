---
name: setup-dev-env
description: Set up (or repair) a local development environment for DragonFlow on a fresh macOS machine or new checkout — installs JS deps, the Android toolchain (JDK + SDK), persists shell env, generates the native project, verifies the build, and gets the app onto a physical Android device. Trigger when the user says "set up my dev environment", "new machine setup", "get the project running again", "fresh checkout", "setup env", or after cloning the repo somewhere new. Every step is idempotent: check-then-act, so re-running is fast and safe.
---

# DragonFlow — Dev Environment Setup

Goal: take a fresh macOS checkout to "can build and run on a device" as fast as possible. This skill is **idempotent** — each step checks whether it's already done and skips the expensive part. Re-run it anytime to repair a broken env.

Target machine profile: **macOS, Apple Silicon (arm64), Homebrew installed.** If Homebrew is missing, stop and ask the user to install it (https://brew.sh) — that install needs their password.

## Ground rules (respect these)

- **npm, not yarn.** The repo has `package-lock.json`; the `packageManager: yarn` field in `package.json` is misleading. Always use `npm ci` / `npm install`.
- **Avoid password-gated installs.** Use the `openjdk@17` Homebrew *formula* (installs to `/opt/homebrew`, no sudo), NOT the `temurin` cask (installs to `/Library`, needs a password). If any step genuinely needs sudo, you cannot enter the password — stop and give the user the exact command to run.
- **Do not autostart the dev server or build-run.** `npx expo start` and `npm run android` start a Metro server — the user controls server startup. Install/verify steps are fine to run yourself; hand the *run-on-device* commands to the user.
- Prefer running long installs in the background and polling, so the session stays responsive.

## Canonical values (this machine)

| Thing | Value |
| --- | --- |
| Project root | `/Users/eyalpeleg/Development/DragonFlow` (alias `dragonflow`) |
| JDK | `openjdk@17` → `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home` |
| Android SDK | `android-commandlinetools` cask → `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` |
| SDK packages | `platform-tools`, `platforms;android-35`, `platforms;android-36`, `build-tools;35.0.0`, `build-tools;36.0.0` |
| App id | `com.plgsw.dragonflow` |
| Run model | **development build** (`expo-dev-client`) — NOT Expo Go |

`.env` is **not needed at runtime** (`GOOGLE_ANDROID_CLIENT_ID` is reference-only; native Google Sign-In identifies the app by package name + SHA-1).

---

## Step 1 — Preconditions

```bash
cd /Users/eyalpeleg/Development/DragonFlow
echo "node: $(node --version 2>&1)  npm: $(npm --version 2>&1)"
echo "branch: $(git branch --show-current)"
which brew >/dev/null && echo "brew: $(brew --version | head -1)  arch: $(uname -m)" || echo "NO HOMEBREW — stop, ask user to install it"
```

Expect Node 22.x, npm 10.x, arm64. If Homebrew is missing, stop here.

## Step 2 — JS dependencies (idempotent)

```bash
cd /Users/eyalpeleg/Development/DragonFlow
[ -d node_modules/expo ] && echo "deps present — skip" || npm ci
```

`npm ci` is clean and matches the lockfile. Runs a few minutes on a fresh checkout — background it if you like.

## Step 3 — JDK 17 (idempotent, no password)

```bash
[ -d /opt/homebrew/opt/openjdk@17 ] && echo "openjdk@17 present — skip" || brew install openjdk@17
```

## Step 4 — Android SDK (idempotent)

Homebrew holds a global lock — don't run this concurrently with Step 3.

```bash
[ -d /opt/homebrew/share/android-commandlinetools/cmdline-tools/latest ] \
  && echo "cmdline-tools present — skip cask" \
  || HOMEBREW_NO_AUTO_UPDATE=1 brew install --cask android-commandlinetools
```

Then accept licenses and install the SDK packages (a few hundred MB the first time — background it and poll):

```bash
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
yes | sdkmanager --licenses >/dev/null 2>&1 && echo "licenses accepted"
yes | sdkmanager "platform-tools" "platforms;android-36" "platforms;android-35" "build-tools;36.0.0" "build-tools;35.0.0"
```

## Step 5 — Persist shell env to ~/.zshrc (idempotent)

Only append if the marker block isn't already there:

```bash
grep -q "Android/Java dev env (added for DragonFlow)" ~/.zshrc && echo "env already in ~/.zshrc — skip" || cat >> ~/.zshrc <<'EOF'

# --- Android/Java dev env (added for DragonFlow) ---
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$PATH"
# --- end Android/Java dev env ---
EOF
```

Verify in a **fresh login shell** (this is what new terminals will see):

```bash
zsh -lic 'echo "JAVA_HOME=$JAVA_HOME"; echo "ANDROID_HOME=$ANDROID_HOME"; java -version 2>&1 | head -1; adb --version | head -1'
```

> **Critical gotcha:** env vars only reach *new* shells. Any terminal (or `expo start` / Metro) opened **before** this step won't have them — that's what causes `spawn adb ENOENT` and "Failed to resolve the Android SDK path / ~/Library/Android/sdk not found". Fix = restart the server from a new terminal (or `source ~/.zshrc` first).

## Step 6 — Generate the native project (idempotent-ish)

`android/` is a build output. Regenerate it with the npm script (never call `expo prebuild` directly — it skips `copy-native-files` + `patch-native-config`, which copy in the FloatingBubble Kotlin module, sounds, and manifest patches):

```bash
cd /Users/eyalpeleg/Development/DragonFlow
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
npm run prebuild:clean
```

Sanity-check the native files landed:

```bash
ls android/app/src/main/java/com/plgsw/dragonflow/*.kt | xargs -n1 basename
ls android/app/src/main/res/raw/
```

Expect the `FloatingBubble*`/`SoundAlarmReceiver`/`BootReceiver` Kotlin files and the `.mp3` sounds.

## Step 7 — Verify the environment

```bash
cd /Users/eyalpeleg/Development/DragonFlow
npm run typecheck && npm run lint && npm test -- --passWithNoTests
```

Optional deeper proof that the native toolchain wires up (first run downloads the Gradle distribution, ~2 min):

```bash
cd /Users/eyalpeleg/Development/DragonFlow/android
export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="/opt/homebrew/share/android-commandlinetools"
export PATH="$JAVA_HOME/bin:$PATH"
./gradlew :app:help
```

`BUILD SUCCESSFUL` means JDK + SDK + licenses + native module all resolve.

## Step 8 — Run on a physical Android device

DragonFlow uses a **development build**, so pressing `a` in Metro fails with *"No development build (com.plgsw.dragonflow) is installed"* until the dev-client APK is built and installed once.

1. Plug in the phone (USB debugging on) and confirm adb sees it as **authorized**:

   ```bash
   adb devices -l
   ```

   - `unauthorized` → accept the "Allow USB debugging?" prompt on the phone (tick "Always allow"), re-run.
   - not listed → check the cable / that USB debugging is enabled in Developer Options.

2. **Hand this to the user** (it builds AND starts a server — user controls startup). From a **new** terminal at the project root:

   ```bash
   npm run android
   ```

   This prebuilds → compiles with Gradle → installs the APK on the device → launches it connected to Metro. First build takes several minutes; keep the phone unlocked. This is a **one-time** step — afterward, JS/TS changes hot-reload and only *native* changes need a rebuild.

## Troubleshooting quick table

| Symptom | Cause | Fix |
| --- | --- | --- |
| `spawn adb ENOENT` / SDK path `~/Library/Android/sdk` not found | Server started in a shell without the env | Restart `expo start` from a new terminal (or `source ~/.zshrc`) |
| `This computer is not authorized for developing on Device …` | adb RSA key not yet accepted | Tap "Allow USB debugging" on the phone; `adb devices` should read `device` |
| `No development build (com.plgsw.dragonflow) is installed` | Dev-client APK not on device | `npm run android` (Step 8) once |
| `sdkmanager: command not found` | New terminal but env not sourced, or Step 4/5 skipped | Open a new terminal; confirm Step 5 marker in `~/.zshrc` |
| Emulator wanted but none exists | Only command-line SDK installed; no AVD | `sdkmanager "system-images;android-35;google_apis;arm64-v8a" "emulator" && avdmanager create avd -n Pixel_API35 -k "system-images;android-35;google_apis;arm64-v8a" -d pixel_7` |
| Gradle can't find a specific build-tools/platform | Version not installed | `sdkmanager "build-tools;<ver>"` / `sdkmanager "platforms;android-<n>"` |

## Done criteria

- `npm run typecheck && npm run lint && npm test` all green
- `zsh -lic 'adb --version'` works in a fresh shell
- `android/` regenerated with the Kotlin native module present
- Device shows as `device` in `adb devices`, and `npm run android` installs + launches the app
