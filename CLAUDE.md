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
  (tabs)/               # Bottom tab navigator (tasks, daily, weekly, settings)
src/
  components/           # UI components (modals, cards, filters)
  store/taskStore.ts    # Zustand store — single source of truth
  types.ts              # Task, Category, SubTask, RecurrenceConfig interfaces
  styles/theme.ts       # Colors, priority palette, spacing
  modules/              # Native module bridges (FloatingBubble)
  services/cloudBackup/ # Google Drive backup (native Google Sign-In, Drive API, backup store)
  utils/                # Notifications, recurrence, analytics, import/export
docs/design/            # Architecture, features, decisions
```

## Key Patterns

- Functional components with hooks, named exports
- Zustand store with `persist` middleware and schema migration
- Store side effects on task changes: sync notifications, update bubble, schedule reminders
- Filters use `Set<string>` with custom serialization
- Modals receive callbacks from parent (`onSubmit`, `onClose`)
- Icons: Ionicons from `@expo/vector-icons`
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
npx expo prebuild --clean   # Regenerate native projects
npm run lint                # ESLint
```

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

### Typical session flow

```bash
git fetch origin
git checkout develop          # or checkout an existing feature branch
git pull origin develop       # make sure it's up to date
# ... make changes ...
git push -u origin develop    # or push to feature branch then merge to develop
```

## Adding Features

- New task property: update `src/types.ts` -> `src/store/taskStore.ts` -> components
- New filter type: add Set to store -> add setter -> update `useSortedFilteredTasks()` -> add UI in FilterModal
- New notification: add channel in `src/utils/notifications.ts` -> create schedule/cancel helpers
- Styling: `src/styles/theme.ts` for colors, `StyleSheet.create()` in components
