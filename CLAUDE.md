# DragonFlow

Personal/family task management app. Keep it simple — no enterprise patterns or over-engineering.

## Tech Stack

- **Expo SDK 54** with Expo Router (file-based routing in `app/`)
- **React Native** (React 19) + TypeScript (strict mode)
- **Zustand** + AsyncStorage for state/persistence (single store, local-first)
- **Android-focused** with native FloatingBubble overlay module
- **EAS Build** for distribution (`com.plgsw.dragonflow`)

## Project Structure

```
app/                    # Expo Router pages
  (tabs)/               # Bottom tab navigator (tasks, pomodoro, progress, settings)
src/
  components/           # UI components (modals, cards, filters)
  store/appStore.ts     # Zustand store — single source of truth for all app state
  types.ts              # Task, Category, SubTask, RecurrenceConfig interfaces
  styles/theme.ts       # Colors, priority palette, spacing
  modules/              # Native module bridges (FloatingBubble)
  services/cloudBackup/ # Google Drive backup (native Google Sign-In, Drive API, backup store)
  utils/                # Notifications, recurrence, analytics, import/export
docs/design/            # Architecture, features, decisions
```

## Where Things Live

Quick lookup so changes start at the right file. The store hook is `useTaskStore` (exported from `appStore.ts`).

| Need to touch… | Go to |
| --- | --- |
| All app state, task CRUD, categories, filters, prefs, Pomodoro state | `src/store/appStore.ts` (`useTaskStore`) |
| Filtering + sorting of the task list | `useSortedFilteredTasks()` in `src/store/appStore.ts` |
| Archived/done task list | `useArchivedTasks()` in `src/store/appStore.ts` |
| Bubble urgency scoring | `isUrgent()` / `computeBubbleScore()` in `src/store/appStore.ts` |
| Type definitions (Task, Category, SubTask, RecurrenceConfig) | `src/types.ts` |
| Colors, priority palette, spacing | `src/styles/theme.ts` (`COLORS`, `PRESET_PALETTE`); theme-aware hook in `src/styles/useColors.ts` |
| Recurrence math | `src/utils/recurrence.ts` |
| Notifications & channels | `src/utils/notifications.ts` |
| Daily/weekly stats & summaries | `src/utils/summaryLogic.ts` |
| Category color/name lookup | `src/utils/categories.ts` |
| Import/export, backup serialization | `src/utils/dataTransfer.ts` |
| Due-time helpers / IDs | `src/utils/dueTime.ts`, `src/utils/id.ts` |
| Pomodoro UI + controller | `src/components/PomodoroTimer.tsx`, `PomodoroMiniBar.tsx`, `src/hooks/usePomodoroController.ts`, `src/components/pomodoroModes.ts` |
| Audio / alarm sounds | `src/services/audioService.ts` |
| Google Drive backup (auth, drive API, orchestration, state) | `src/services/cloudBackup/` (`googleAuth.ts`, `googleDrive.ts`, `backupService.ts`, `backupStore.ts`) |
| Native floating bubble (JS bridge) | `src/modules/FloatingBubble.ts`; Kotlin source in `modules/dragonflow-native/` |
| Add/Edit task & category modals, filters | `src/components/AddTaskModal.tsx`, `EditTaskModal.tsx`, `AddCategoryModal.tsx`, `EditCategoryModal.tsx`, `FilterModal.tsx`, `StatusFilter.tsx` |
| Tab screens | `app/(tabs)/{tasks,pomodoro,progress,settings}.tsx` |
| Tests | co-located `__tests__/` dirs under `store/`, `utils/`, `services/` |

> **Keep this table current.** This file is loaded into context every session and is the primary code map. When you move, rename, split, or add a file/symbol referenced above (or add a new area worth indexing), update the matching row in the same change — treat a stale pointer as a bug. Verify the path/symbol resolves before committing.

## Key Patterns

- Functional components with hooks, named exports
- Zustand store with `persist` middleware and schema migration
- Store side effects on task changes: sync notifications, update bubble, schedule reminders
- Filters use `Set<string>` with custom serialization
- Modals receive callbacks from parent (`onSubmit`, `onClose`)
- Icons: Ionicons (default) and AntDesign from `@expo/vector-icons`. Browse and search every available glyph at https://icons.expo.fyi/. `react-icons` is web-only and won't run in React Native — if a task asks for a `react-icons/ai` (AntDesign) glyph, map it to AntDesign in `@expo/vector-icons` instead. AntDesign only ships filled variants for some names (e.g. `pushpin` has no outline) — signal toggled state via color.
- Styles: inline `StyleSheet.create()` per component
- Colors/theming via `src/styles/theme.ts` (COLORS, PRESET_PALETTE)

## Data Model

- **Task**: id, title, description, priority (Critical/High/Medium/Low), categoryId, dueDate, dueTime, status (Ready/In Progress/Paused/Done), subTasks[], recurrence, completionComment
- **Category**: id, name, color (5 built-in + user-created)
- Persistence: AsyncStorage with v0->v1 migration (name-based -> ID-based categories)

## Commands

```bash
npx expo start              # Dev server
npx expo run:android        # Run on Android
npx expo run:ios            # Run on iOS
npx tsc --noEmit            # Type check
npm run prebuild:clean      # Regenerate native projects (preferred)
npx expo prebuild --clean   # Direct prebuild (use npm script above instead)
npm run lint                # ESLint
```

## Native Android Module

Custom native code (FloatingBubble overlay, sound playback, boot receiver) is preserved via `modules/dragonflow-native/` to survive `npx expo prebuild --clean`. This structure is general-purpose and supports future native features (camera, sensors, custom Android APIs) without modification.

### Problem

Expo's prebuild clears and regenerates the `android/` directory from templates. Any custom native code in `android/app/src/main/java/` is deleted, making native code unmaintainable. Solution: Store source in `modules/dragonflow-native/` and copy to build directory via hooks/scripts.

### Three-Layer Architecture

Native files are copied via three independent mechanisms so it works regardless of how/where the build runs:

#### Layer 1: Local Development (npm scripts)
Use `npm run prebuild:clean` or `npm run prebuild` instead of calling expo directly.

```bash
npm run prebuild:clean  # expo prebuild --clean --platform android && npm run copy-native-files
npm run prebuild        # expo prebuild --platform android && npm run copy-native-files
```

These scripts automatically chain `expo prebuild` → `npm run copy-native-files` so custom files are copied after the android directory is regenerated. Works with any IDE/terminal as long as you use the npm command.

#### Layer 2: EAS Cloud Build (eas-build-post-install.sh hook)
EAS Build automatically runs `eas-build-post-install.sh` after installing dependencies and before gradle compilation. This hook runs the copy script without any manual configuration needed.

```bash
# EAS automatically runs this when building in the cloud
eas-build-post-install.sh → node ./scripts/copy-native-files.js
```

Deploy with `eas build` and custom native files are copied automatically.

#### Layer 3: Other CI/CD (manual)
For GitHub Actions, GitLab CI, or other build systems, manually run the copy script after prebuild:

```bash
npx expo prebuild --platform android
node ./scripts/copy-native-files.js
```

### Module Structure

```
modules/dragonflow-native/
├── android/src/main/
│   ├── java/com/plgsw/dragonflow/
│   │   ├── FloatingBubbleModule.kt      (JNI bridge to JS)
│   │   ├── FloatingBubblePackage.kt     (module registration)
│   │   ├── FloatingBubbleService.kt     (draggable overlay + dismiss zone)
│   │   ├── SoundAlarmReceiver.kt        (task/Pomodoro completion sounds)
│   │   └── BootReceiver.kt              (restore bubble on device boot)
│   └── res/
│       ├── drawable/bubble_icon.png     (notification icon)
│       └── raw/{ding.mp3, tada.mp3}     (audio files)
├── app.plugin.js                        (plugin registration, no file copying)
├── package.json
└── README.md

scripts/
└── copy-native-files.js                 (runs after prebuild to copy all files)

eas-build-post-install.sh                (EAS hook, runs copy script automatically)
```

### Adding New Native Code

1. Add Kotlin files to `modules/dragonflow-native/android/src/main/java/com/plgsw/dragonflow/`
2. Add resources to `modules/dragonflow-native/android/src/main/res/{drawable,raw,etc}/`
3. Register in `android/app/src/main/AndroidManifest.xml` or `MainActivity.kt` as needed
4. Update `scripts/copy-native-files.js` if you add new directories or file types
5. Rebuild: `npm run prebuild:clean` (local) or `eas build` (cloud)

### Files Are Copied Regardless Of

- How prebuild is invoked (npm script, IDE, CLI, Expo web dashboard)
- Where build runs (local dev, EAS cloud, GitHub Actions, etc.)
- Who invokes it (developer, CI system, build server)

## Google Sign-In & Cloud Backup

Uses **`@react-native-google-signin/google-signin`** (native, no browser popup) for Android.

- Config: `GoogleSignin.configure({ scopes: ['drive.appdata'] })` in `src/services/cloudBackup/googleAuth.ts`
- Auth entry points: `signIn()`, `signOut()`, `getValidToken()`, `loadStoredAuth()` — all in `googleAuth.ts`
- Drive API calls (upload/download/list/delete): `src/services/cloudBackup/googleDrive.ts`
- Backup orchestration (debounce, auto-backup, restore): `src/services/cloudBackup/backupService.ts`
- State (isSignedIn, userEmail, lastBackup, autoBackupEnabled): `src/services/cloudBackup/backupStore.ts`
- UI: Settings tab (`app/(tabs)/settings.tsx`)

**Android setup requirements:**
- Android OAuth client in Google Cloud Console with package `com.plgsw.dragonflow` + SHA-1 debug cert
- Google Drive API enabled in the same GCP project
- No `google-services.json` or `google-services` Gradle plugin needed
- Client ID is NOT passed in code — the native SDK identifies the app by package name + SHA-1

**Secrets:** `GOOGLE_ANDROID_CLIENT_ID` in `.env` (unused at runtime, kept for reference). Do NOT add the `google-services` Gradle plugin — it requires Firebase and breaks the build without a full Firebase project.

## Git Flow

```
main ← PR from develop only (never push directly, never check out in a worktree)
  └── develop ← all feature branches merge here
        └── feature/*, fix/*, claude/* ← cut from develop, pushed to develop
```

### Rules (enforced for every session)

1. **Branch from develop** — always `git checkout -b <branch> origin/develop` or `git fetch origin develop && git checkout develop` before starting work.
2. **Push to develop** — all commits go to `develop` (or a short-lived feature branch that merges to `develop`). Never push directly to `main`.
3. **main is PR-only** — `main` only receives changes via a pull request from `develop`. Never `git push origin main`, never check out `main` in a worktree.
4. **No worktrees on main** — if the agent isolation mode creates a worktree, it must be based on `develop`, not `main`.
5. **Merge direction** — to sync `main` improvements into `develop`, merge `origin/main` → `develop` (not the other way around until a release PR is ready).
6. **Always run `/precommit` before commit and push** — invoke the precommit skill before every `git commit` and every `git push` to catch type errors, lint issues, and secrets before they enter history. No exceptions, even for tiny changes.

### Typical session flow

```bash
git fetch origin
git checkout develop          # or checkout an existing feature branch
git pull origin develop       # make sure it's up to date
# ... make changes ...
git push -u origin develop    # or push to feature branch then merge to develop
```

## Adding Features

- New task property: update `src/types.ts` -> `src/store/appStore.ts` -> components
- New filter type: add Set to store -> add setter -> update `useSortedFilteredTasks()` -> add UI in FilterModal
- New notification: add channel in `src/utils/notifications.ts` -> create schedule/cancel helpers
- Styling: `src/styles/theme.ts` for colors, `StyleSheet.create()` in components

## Store Design

**appStore.ts** (not `taskStore`) manages all global app state, not just tasks:
- Task CRUD, categories, subcategories
- Filters (status, category, priority, due date)
- Notifications & sounds (Pomodoro, task completion)
- Floating bubble display
- Preferences (first day of week, default task time)
- Pomodoro timer state
- Debug mode

The broader name reflects its role as the single source of truth for the entire app's state.
