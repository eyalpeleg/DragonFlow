# First-Time Google Play Submission — DragonFlow

Step-by-step guide for submitting DragonFlow to the Google Play Store for the first time. Future releases reuse the cheat sheet at the bottom.

**Package**: `com.plgsw.dragonflow`
**Current version**: 1.0.3 (versionCode 4)
**Track strategy**: Internal Testing first → promote to Production after verification on real devices.
**Signing**: Local upload keystore + env vars (consumed by [`android/app/build.gradle:108`](../../android/app/build.gradle#L108-L116)). Google handles the final signing key via Play App Signing.

---

## ⚠️ Read these gotchas BEFORE you start

1. **Google Sign-In will break after first install unless you re-register the SHA-1.** Play App Signing re-signs your AAB with Google's own key. The Android OAuth client in Google Cloud Console currently only knows the **debug** SHA-1. Until you complete step 11 below, every Play install fails `GoogleSignin.signIn()` — including your own testing on the internal track.
2. **`FOREGROUND_SERVICE_SPECIAL_USE` requires a written declaration plus a demo video.** Used by the floating bubble (see [`AndroidManifest.xml:8,40`](../../android/app/src/main/AndroidManifest.xml#L8)). Generic justifications get rejected.
3. **`SYSTEM_ALERT_WINDOW`** is high-scrutiny. Justification: floating task bubble that the user explicitly grants.
4. **Data Safety form is mandatory** before any track release goes live, even Internal Testing.
5. **Keystore loss = lost app forever.** Back up the keystore file + all four passwords to a password manager **before** the first build. There is no recovery path — losing it forces a new package name and a new app listing.
6. **Store listing assets don't fully exist yet.** Only the app icon is present in `assets/`. Feature graphic (1024×500) and at least 2 phone screenshots must be created before the listing can go live.

---

## 1. Before you start

Confirm you have:

- [ ] **Google Play Console developer account** — $25 one-time fee, registered to your personal Google identity. https://play.google.com/console
- [ ] **GCP project** for Google Drive backup already exists (the Android OAuth client is configured per [`src/services/cloudBackup/googleAuth.ts`](../../src/services/cloudBackup/googleAuth.ts)). You'll need access to it in step 11.
- [ ] **EAS CLI authenticated**: `eas whoami` returns your account. Project ID `68173e24-937e-4f16-8f9b-36dc2013f9b8` per [`app.json:72`](../../app.json#L72).
- [ ] **Password manager open** to store keystore secrets in step 2.
- [ ] **Java JDK installed** locally (for `keytool`). Comes with Android Studio if installed.

---

## 2. Generate the upload keystore

Run from anywhere outside the repo (e.g. `~/keystores/`). **Do not put the keystore inside the repo** — it must never be committed.

```bash
mkdir -p ~/keystores && cd ~/keystores

keytool -genkeypair \
  -v \
  -keystore dragonflow-upload.keystore \
  -alias dragonflow-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -storetype JKS
```

When prompted:
- **Keystore password** — generate a strong one, save to password manager.
- **Key password** — same as keystore password is fine (simpler).
- **Distinguished name** — your real name, org "PLGSW" (or whatever), country code "IL".

**Back up immediately:**
- [ ] Keystore file (`dragonflow-upload.keystore`) → password manager attachment + a second offline location (USB / encrypted cloud).
- [ ] Keystore password, key alias (`dragonflow-upload`), key password → password manager.
- [ ] Confirm `.gitignore` covers `*.keystore` — current repo ignores it implicitly, but verify with `git check-ignore -v ~/keystores/dragonflow-upload.keystore` (will only work if you symlink into the repo; otherwise just trust the path).

**Wire up the env vars.** Add to your local shell (`~/.zshrc` or session-only) — these are consumed by [`android/app/build.gradle:109-114`](../../android/app/build.gradle#L109):

```bash
export DRAGONFLOW_KEYSTORE_PATH="$HOME/keystores/dragonflow-upload.keystore"
export DRAGONFLOW_KEYSTORE_PASSWORD="<from password manager>"
export DRAGONFLOW_KEY_ALIAS="dragonflow-upload"
export DRAGONFLOW_KEY_PASSWORD="<from password manager>"
```

For EAS cloud builds, these must also be set as **EAS Secrets** (per project) — see step 4.

---

## 3. Pre-flight checks

Run through this checklist before building:

- [ ] [`app.json:5`](../../app.json#L5) `expo.version` matches [`android/app/build.gradle:96`](../../android/app/build.gradle#L96) `versionName` (currently both `1.0.3`).
- [ ] [`app.json:25`](../../app.json#L25) `expo.android.versionCode` matches [`android/app/build.gradle:95`](../../android/app/build.gradle#L95) `versionCode` (currently both `4`). **versionCode is what Play uses to order releases — must be strictly higher than any previously uploaded build.**
- [ ] [`app.json:24`](../../app.json#L24) `package` is `com.plgsw.dragonflow` (cannot change after first publish).
- [ ] Permissions in [`AndroidManifest.xml`](../../android/app/src/main/AndroidManifest.xml) match the list you'll declare in step 8.
- [ ] [`eas.json:16`](../../eas.json#L16) production profile has `distribution: "store"`.
- [ ] `git status` is clean and you're on `develop` (per [CLAUDE.md](../../CLAUDE.md) git flow rules).
- [ ] `npx tsc --noEmit && npm run lint` pass.

---

## 4. Build the production AAB

From the repo root:

```bash
./release.sh --play
```

This runs the full local release flow: clean tree check, version bump in [`app.json`](../../app.json) (patch + versionCode), `tsc` + `eslint` + `jest`, commit `chore(release): bump to v<X> (versionCode <N>)`, prebuild, and `gradlew bundleRelease` signed with the keystore loaded from `~/.dragonflow/keystore.env`.

Output: `distro/DragonFlow-v<X.Y.Z>.aab`.

For an explicit version: `./release.sh --play -v 1.2.3`.

> The script auto-commits the version bump on the current branch (must be `develop` or a feature branch — it refuses `main`). Push when you're ready: `git push origin develop`.

**Alternative (cloud build via EAS)**: `eas build --profile production --platform android`. Requires uploading keystore + passwords as EAS secrets first. The local `--play` flow above is faster and uses the keystore you already have.

---

## 5. Create the Play Console app

Play Console → **Create app**:

| Field | Value |
|---|---|
| App name | DragonFlow |
| Default language | English (United States) — en-US |
| App or game | App |
| Free or paid | Free |
| Declarations | Tick both: Developer Program Policies + US export laws |

Click **Create app**. You're now on the dashboard.

Set the package name during the first AAB upload (step 10) — Play locks it to **`com.plgsw.dragonflow`** permanently from the manifest.

---

## 6. "Set up your app" tasks (all mandatory)

Play shows a checklist on the dashboard. Complete all of these — each one blocks release:

1. **App access** → "All functionality is available without special access". (Drive sign-in is optional, not a gate.)
2. **Ads** → "No, my app does not contain ads".
3. **Content rating** → Fill the questionnaire. DragonFlow has no violence/sex/gambling/etc. → Expect "Everyone".
4. **Target audience and content** → Age groups 13+ (productivity app, not designed for kids).
5. **News app** → No.
6. **Health app** → No.
7. **COVID-19 contact tracing** → No.
8. **Data safety** → see [section 7](#7-data-safety-form-content) below.
9. **Government app** → No.
10. **Financial features** → No.

---

## 7. Data Safety form content

This is the form most likely to trip you up. Exact answers for DragonFlow:

**Data collection and security**
- Does your app collect or share any of the required user data types? → **Yes** (because of Google Drive backup, even though the data goes to the user's own Drive).
- Is all of the user data collected by your app encrypted in transit? → **Yes** (HTTPS to Google Drive API).
- Do you provide a way for users to request that their data is deleted? → **Yes** (Settings → sign out + the user can delete the backup file from their own Drive).

**Data types collected** — declare only what's actually involved in the backup payload:
- **Personal info → Name, Email address** — only the Google account email + display name from Sign-In. Purpose: **App functionality (authentication)**. Required.
- **App activity → App interactions** — only if the analytics in `src/utils/analytics.ts` ship enabled; otherwise declare nothing here. Purpose: **Analytics**. Optional.
- **Files and docs** — *not collected by you*. The backup goes to the user's own Drive `appdata` folder, which is private to the app and never accessed by you. Do **not** declare this as "shared with third parties" — Drive is the user's own storage.

**Data sharing**: leave empty — you don't share data with third parties. Google Drive is the user's storage, not a third-party recipient.

Save and confirm. The form review takes a few minutes; it must show ✅ green before release.

---

## 8. Sensitive permissions declarations

Play Console → **App content** → "Sensitive app permissions" (or the inline prompt when you upload the AAB). Declare each of the following — taken directly from [`AndroidManifest.xml`](../../android/app/src/main/AndroidManifest.xml):

| Permission | Declaration |
|---|---|
| `SYSTEM_ALERT_WINDOW` | "Used for an optional floating task bubble that the user can drag over other apps. The user explicitly grants the OS-level overlay permission inside the app from the Settings screen. The bubble shows the next task and quick actions; it is not used for ads, phishing, or interfering with other apps." |
| `FOREGROUND_SERVICE_SPECIAL_USE` | "Foreground service hosts the floating task bubble (`FloatingBubbleService`) while the user has enabled it. The bubble is the user-facing UI for the persistent task overlay — without the foreground service, Android terminates it within minutes. Special use is the correct category because the bubble is not media, location, sync, or call-related." Attach a short screen-recording link (YouTube unlisted) demonstrating the bubble in use. |
| `SCHEDULE_EXACT_ALARM` | "Used to fire task due-time notifications and Pomodoro completion alerts at the precise minute the user scheduled. Approximate alarms drift by minutes and miss the user-specified deadline." |
| `RECEIVE_BOOT_COMPLETED` | "Used by `BootReceiver` to restore the floating bubble if the user had it enabled before reboot. No background data sync runs on boot." |
| `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` | Usually not required for Android 11+ scoped storage. If Play flags it, remove from manifest if not used; otherwise declare "Used for legacy backup import/export on Android < 11." |

> **Video for `FOREGROUND_SERVICE_SPECIAL_USE`**: record a 20-second screen capture showing the bubble across multiple apps, upload as **Unlisted** to YouTube, paste the URL in the declaration. Without this the special-use declaration is auto-rejected.

---

## 9. Main store listing

Play Console → **Main store listing**:

| Field | Value / Notes |
|---|---|
| App name | DragonFlow |
| Short description | ≤ 80 chars. Example: "A calm task manager for daily, weekly, and recurring goals. Local-first." |
| Full description | ≤ 4000 chars. Cover: what it does, key features (categories, priorities, recurrence, floating bubble, Pomodoro, Drive backup), what it doesn't do (no ads, no tracking, local-first). |
| App icon | 512×512 PNG, 32-bit. Source: derive from [`assets/images/icon.png`](../../assets/images/icon.png) (resize/export to exactly 512×512). |
| Feature graphic | **1024×500 PNG/JPG** — TO CREATE. Hero image shown at the top of the listing. |
| Phone screenshots | **Min 2, max 8**, 16:9 or 9:16, min 320px, max 3840px. TO CREATE — capture from a real device showing the tasks tab, daily view, a task card with subtasks, and the floating bubble. |
| App category | Productivity |
| Tags | task manager, productivity, todo |
| Contact email | Use your support email (e.g. `eyal.peleg@sisense.com` or a dedicated alias). |
| Website | Optional — link to a GitHub Pages page or omit. |
| Privacy policy | **Required URL**. Must exist before release. Simplest path: create `docs/privacy-policy.md` rendered via GitHub Pages, or use a free generator (e.g. https://app-privacy-policy-generator.firebaseapp.com/). Must list: Drive backup, no third-party sharing, no analytics tracking IDs (unless you ship them). |

Save the listing.

---

## 10. Create the Internal Testing release

Play Console → **Testing → Internal testing → Create new release**.

1. **App signing**: when prompted, choose **Use Play App Signing** (default). Play generates the app signing key; you keep using the upload keystore from step 2.
2. **App bundles**: drag-drop the AAB from step 4.
3. **Release name**: `1.0.3 (4)` (auto-suggested from versionCode).
4. **Release notes**: plain text, ≤500 chars per locale. Markdown is **not supported**. Example:
   ```
   First release.
   • Daily, weekly, and recurring tasks
   • Floating task bubble overlay
   • Optional Google Drive backup
   • Pomodoro timer with sounds
   ```
5. **Save** → **Review release** → fix any flagged warnings → **Start rollout to Internal testing**.

Add testers:
- Play Console → **Testing → Internal testing → Testers** tab → create an email list → add yourself + anyone testing.
- Copy the **Opt-in URL** ("How testers join your test") from the same tab.

---

## 11. ⚠️ CRITICAL — Register the Play signing SHA-1 in Google Cloud

**Skip this and Google Sign-In fails on every Play install.** Including your own.

1. Play Console → **Setup → App integrity → App signing** tab.
2. Find the **App signing key certificate** section (not the upload key — the *signing* key Play uses).
3. Copy the **SHA-1 certificate fingerprint** (format: `AA:BB:CC:...:99`).
4. Open https://console.cloud.google.com → select the GCP project that owns the Drive OAuth client → **APIs & Services → Credentials**.
5. Find the **Android OAuth 2.0 Client ID** for package `com.plgsw.dragonflow` (the one referenced by `GoogleSignin.configure` in [`src/services/cloudBackup/googleAuth.ts`](../../src/services/cloudBackup/googleAuth.ts)).
6. Edit → under **SHA-1 certificate fingerprint**, **add** the Play SHA-1 (do not replace — keep the debug SHA-1 too, so dev builds keep working).
7. Save. Changes propagate in minutes, but allow up to a few hours.

While you're there, also copy the **upload key certificate SHA-1** (also under App integrity → App signing) and add it as a third SHA-1 on the same OAuth client — this lets the locally-signed AAB work too if you ever side-load it.

---

## 12. Install on a real device and smoke-test

1. Open the **Opt-in URL** from step 10 on your Android device, signed into the same Google account you added as a tester.
2. Wait ~10–30 minutes for Play to index the release; the link reads "Become a tester" → tap → "Download it on Google Play" → install.
3. Smoke-test the golden path:
   - [ ] App launches, splash screen shows the purple background.
   - [ ] Create a task with category, priority, due time. Confirm it persists across app restart.
   - [ ] Enable floating bubble in Settings → grant overlay permission → confirm bubble appears and survives backgrounding.
   - [ ] Schedule a notification — verify it fires.
   - [ ] **Sign in to Google Drive** from Settings → confirm sign-in succeeds (this is the step that fails if you skipped section 11).
   - [ ] Trigger a manual backup → confirm "Last backup" timestamp updates. The Drive file lives in `appdata` and is not visible in the user's normal Drive UI — the timestamp is the verification.
   - [ ] Reboot the device → confirm the floating bubble auto-restores (if it was enabled).

If anything fails, fix it, bump versionCode (see cheat sheet), rebuild, upload a new release to the same Internal testing track.

---

## 13. Promote to Production

When Internal testing has passed for at least a day (give yourself a buffer):

1. Play Console → **Testing → Internal testing → Releases overview** → find the release → **Promote release → Production**.
2. Write production-grade release notes (not the test ones).
3. **Rollout percentage**: start with **20%** staged rollout for the first production push. Bump to 100% after 24–48 hours if no crash spike.
4. **Review submission**. The **first production submission** is reviewed manually by Google — expect **2–7 days** (sometimes longer). Subsequent production releases typically clear in hours.

You'll get an email when it's live. The Play Store URL is `https://play.google.com/store/apps/details?id=com.plgsw.dragonflow`.

---

## Subsequent releases — cheat sheet

For every release after the first:

1. `./release.sh --play` — bumps `app.json` (version + versionCode), runs tsc/eslint/jest, commits, prebuilds, builds the signed AAB at `distro/DragonFlow-v<X.Y.Z>.aab`. `android/app/build.gradle` picks up the new versionCode automatically via `prebuild:clean`.
2. `git push origin develop` (or your feature branch).
3. Play Console → Internal testing → new release → upload AAB → roll out.
4. Verify on a real device for at least a few hours (smoke test from [§12](#12-install-on-a-real-device-and-smoke-test)).
5. Promote to Production with staged rollout (20% → 100% after 24–48h).

**Optional automation** (not set up yet):
- `eas submit --profile production --platform android` can upload the AAB to Play directly if you configure a Play service account in `eas.json`. Skip until the manual upload flow is comfortable.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `GoogleSignin.signIn()` returns `DEVELOPER_ERROR` on Play-installed build | Skipped [step 11](#11-️-critical--register-the-play-signing-sha-1-in-google-cloud). |
| AAB upload rejected: "versionCode X has already been used" | Bump `versionCode` higher than the last uploaded build, even for failed uploads. |
| `keystore was tampered with, or password was incorrect` during `eas build` | One of the four `DRAGONFLOW_*` EAS secrets is wrong, or the file secret path doesn't match `DRAGONFLOW_KEYSTORE_PATH`. Run `eas secret:list`. |
| Special-use foreground service declaration rejected | Demo video is missing or unclear. Re-record showing the bubble visible over a different app, upload Unlisted to YouTube, paste link in the form. |
| First production review stuck > 7 days | Check Play Console → Inbox for policy emails. Usually a Data Safety or permissions declaration needs fixing. |
| Bubble crashes on Android 14+ at install time | `FOREGROUND_SERVICE_SPECIAL_USE` declaration missing in manifest or special-use attribute on `<service>` tag — current manifest already declares both ([line 8](../../android/app/src/main/AndroidManifest.xml#L8) and [line 40](../../android/app/src/main/AndroidManifest.xml#L40)). |
