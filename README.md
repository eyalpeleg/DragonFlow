# DragonFlow

A personal task management app for Android, built for family use with a focus on clarity and flow. Tasks move through a simple lifecycle — Ready → In Progress → Paused → Done — with priority levels, categories, sub-tasks, recurrence, and Pomodoro-style timers.

---

## Goals

- **Stay focused**: Surface today's and this week's work at a glance, not an overwhelming backlog
- **Low friction**: Start, pause, and complete tasks in one tap
- **Always available**: A persistent floating bubble shows in-progress task count even when the app is in the background
- **Private & local-first**: All data lives on device; optional Google Drive backup for personal safety

---

## Screens

| Tab | Purpose |
|-----|---------|
| **Tasks** | Full task list with filtering by status, priority, and category |
| **Pomodoro** | Pomodoro timer for the active task |
| **Progress** | Completion stats and done-task history |
| **Settings** | Google Drive backup/restore, auto-backup toggle |

---

## Key Modules

### `src/store/appStore.ts`
Zustand store (`useTaskStore`) — single source of truth for all app state: tasks, categories, filters, preferences, and Pomodoro timer. Persisted to AsyncStorage with schema migration (v0→v1). Side effects on task changes: schedules notifications, updates the FloatingBubble count, triggers auto-backup.

### `src/types.ts`
Core data model:
- **Task**: id, title, description, priority (`Critical/High/Medium/Low`), categoryId, dueDate, dueTime, status, subTasks, recurrence, completionComment
- **Category**: id, name, color
- **RecurrenceConfig**: frequency (`daily/weekly/monthly`), interval

### `src/modules/FloatingBubble.ts`
Bridge to a custom native Android module. Shows a system-overlay bubble with the in-progress task count while the app is backgrounded. Requires `SYSTEM_ALERT_WINDOW` permission on Android.

### `src/services/cloudBackup/`
Google Drive backup using native Google Sign-In (`@react-native-google-signin/google-signin`).

| File | Role |
|------|------|
| `googleAuth.ts` | Sign-in/sign-out/token management via native SDK |
| `googleDrive.ts` | Drive REST API — upload, download, list, cleanup |
| `backupService.ts` | Orchestration: auto-backup with 30s debounce, restore flow |
| `backupStore.ts` | Zustand state for backup status, user email, last backup time |

Backups are stored in the app's private `appDataFolder` space (not visible in the user's Drive).

### `src/utils/`
- `notifications.ts` — schedules due-date reminders via `expo-notifications`
- `recurrence.ts` — generates next task instances for recurring tasks
- `summaryLogic.ts` — weekly stats aggregation
- `dataTransfer.ts` — import/export JSON schema with validation

---

## Running the App

### Prerequisites
- Node.js 20+
- Android Studio with an emulator or physical Android device
- Java 17 (for Gradle)

```bash
npm install
```

### Development
```bash
npx expo run:android       # Build and run on Android (device or emulator)
npx expo start             # Start Metro bundler only (use with Expo Go or dev build)
```

### Type checking & linting
```bash
npx tsc --noEmit           # TypeScript check
npm run lint               # ESLint
```

### Rebuild native layer
Only needed after adding/removing native packages:
```bash
npx expo prebuild          # Regenerate android/ from config (preserves existing customizations)
```

---

## Google Drive Backup Setup (Android)

Native sign-in requires an Android OAuth client registered in Google Cloud Console:

1. Go to **APIs & Services → Credentials → Create OAuth Client ID → Android**
2. Package name: `com.plgsw.dragonflow`
3. SHA-1: run `cd android && ./gradlew signingReport` and copy the debug SHA-1
4. Enable **Google Drive API** in the same project (APIs & Services → Library)
5. Sign in through the app's Settings tab — the native account picker will appear

No `google-services.json` or Firebase is required.

---

## Project Structure

```
app/
  _layout.tsx              # Root layout, initializes backup and notifications
  (tabs)/
    tasks.tsx              # Task list screen
    pomodoro.tsx           # Pomodoro timer for the active task
    progress.tsx           # Completion stats & done-task history
    settings.tsx           # Backup settings

src/
  components/              # UI: TaskCard, modals (Add/Edit/Filter), PomodoroTimer
  store/appStore.ts        # Zustand store + persistence
  types.ts                 # Task, Category, SubTask, RecurrenceConfig
  styles/theme.ts          # COLORS, PRESET_PALETTE, priority colors
  modules/FloatingBubble.ts
  services/cloudBackup/
  utils/

android/                   # Bare Android project (committed, contains native modules)
```

---

## Architecture Notes

- **Local-first**: no backend, no auth wall — the app works fully offline
- **No Firebase**: Google Sign-In uses the native Play Services SDK directly
- **New Architecture**: `newArchEnabled: true` (React Native Fabric + JSI)
- **Android-only native modules**: FloatingBubble overlay is Android-specific; the JS bridge checks `Platform.OS` before calling
