# Features

## Shipped

| Feature | Description | Key files |
|---------|-------------|-----------|
| Task CRUD | Create, edit, delete tasks with title, description, priority, category, due date/time | `AddTaskModal`, `EditTaskModal`, `taskStore.ts` |
| Priority levels | Critical (red), High (light red), Medium (yellow), Low (green) | `theme.ts` |
| Task statuses | Ready → In Progress → Done lifecycle | `TaskCard`, `taskStore.ts` |
| Status sorting | Tasks sorted: In Progress first, then Ready, then Done | `tasks.tsx` |
| Categories | Custom categories with color coding; built-in: Default, Friends, Personal, Fitness, Study | `AddCategoryModal`, `EditCategoryModal`, `settings.tsx` |
| Sub-tasks | Nested checklists within tasks | `TaskChecklist` |
| Recurring tasks | Daily/weekly/monthly recurrence with automatic next-occurrence generation | `recurrence.ts` |
| Filtering | Filter by status, category, priority, due date (overdue/today/upcoming) | `FilterBar`, `FilterModal` |
| Pomodoro timer | Focus timer integrated into the task view | `PomodoroTimer` |
| Daily dashboard | Today's task stats — completion counts, category breakdown with progress bars | `daily.tsx` |
| Weekly dashboard | Week-at-a-glance analytics — time spent, category stats, completed tasks | `weekly.tsx` |
| Notifications | Critical task summary, today's tasks, per-task reminders, pomodoro alerts | `notifications.ts` |
| Floating bubble | Android overlay showing critical task count in background | `FloatingBubble.ts` |
| Archive/restore | Archive completed tasks; restore from archive | `ArchivedTaskCard`, `taskStore.ts` |
| Completion comments | Add a note when marking a task done | `DoneStatsModal` |
| Dark mode | User-toggled light/dark theming via Settings; full palette switch across all screens | `theme.ts` (`lightColors`/`darkColors`), `useColors.ts`, `settings.tsx` |
| Persistent storage | All data persisted locally via AsyncStorage | `taskStore.ts` (Zustand persist) |
| Data export/import | Export/import tasks, categories, and settings as JSON file via share/document picker | `utils/dataTransfer.ts` |
| Cloud sync | Google Drive backup with native Google Sign-In, auto-backup, and restore | `services/cloudBackup/` |

## Planned

| Feature | Status | Notes |
|---------|--------|-------|
| iOS floating bubble | Idea | Equivalent of Android overlay for iOS |
| App Store / Play Store publish | Planned | Bundle ID ready (`com.plgsw.dragonflow`) |
| Widgets | Idea | Home screen widget showing today's tasks |
| Backup sign-in prompt | Idea | On startup, if not signed in to Google Drive backup, alert with a CTA that deep-links to Settings → Backup/Sign-in to prevent data loss on uninstall |
| Share-to-task target | Built · QA pending | Android share target — pre-fills Add Task from shared text. Shipped to `develop` (207b316); on-device QA pending. Docs: `docs/design/features/share-text-target/` |
| Parking app awareness (parking-reminder) | Built · QA pending | Notice when the parking app is used (UsageStatsManager polled in FloatingBubbleService); on app→background, prompt to arm a "stop parking" reminder for a chosen duration (human confirm, since these apps are multi-purpose parking+transit). Lightweight session record, reuse bubble+notifications. P0: privacy (exclude from Drive backup) + prompt-fatigue guardrails. Config package id is the one intentional vendor reference; multi-vendor support is a follow-up. Docs: `docs/design/features/parking-reminder/` |
| Activity log | Idea | Record user activity so it can be shared with the developer to understand how the app is used |
| Fix Google auth expiration | Verified | Bugfix — handle expired Google auth token so Drive backup keeps working without re-sign-in. Docs: `docs/design/features/fix-google-auth-expiration/` |
| Fix false "Backup Complete" alert | Idea | Bugfix — `handleCloudBackup()` in `app/(tabs)/settings.tsx` always shows "Backup Complete" because `performBackup()` swallows errors (NetworkError/auth) and never throws. A failed/offline "Back Up Now" misleadingly reports success. Surface real success vs failure (return status from `performBackup`, or check `backupStatus`/`lastError`). Found during on-device QA of Fix-Google-auth-expiration. |
| Fix "Last backup: Never" after re-sign-in | Idea | Bugfix — after a sign-out→sign-in cycle, Settings shows "Last backup: Never" even though backups exist in Drive. `backupStore.setSignedOut()` wipes `lastBackupTime`/`lastBackupFileId` to null and `setSignedIn()` never restores them (sign-in doesn't query Drive for the newest backup). Found during on-device QA of Fix-Google-auth-expiration. Fix direction: on sign-in, hydrate `lastBackupTime` from the newest `listBackupFiles()` entry, or stop wiping it on sign-out. Files: `src/services/cloudBackup/backupStore.ts`, `backupService.ts`. |
| Upgrade Expo SDK 54 → 57 | Verified | Enabler (spawned by Share-text analysis) — unlocks `expo-share-intent` + iOS share target; newer RN & security patches. Landed **Expo SDK 57 / RN 0.86.2 / React 19.2** via 3 incremental hops on `develop` (cb6430a 54→55, ab43fbd 55→56, 59e9a6c 56→57). All ACs met: automated green (147 tests, doctor 20/20, native reconciliation + idempotency) + on-device QA passed (2026-08-26). Awaiting release → Shipped. Docs: `docs/design/features/upgrade-expo-sdk-57/` |
| expo-share-intent migration | Building | Spawned by SDK-57 upgrade. Replace custom `ShareIntentModule.kt` + JS bridge with `expo-share-intent` (v6+). **Android-only** this pass (iOS share target deferred to its own story). Keep `shareText.ts` parser + `useShareIntent() {prefill,clearPrefill}` interface + all 16 Share-text criteria. Docs: `docs/design/features/expo-share-intent-migration/` |
| iOS share target (expo-share-intent) | Idea | Deferred from the expo-share-intent migration (which did Android-only). Add iOS share extension via the same lib's iOS activation rules. Needs Apple Dev account + iOS build setup + a share-extension target + iOS device/sim QA. Do when iOS becomes a real build target. |
| EAS manifest parity / config-plugin consolidation | Idea | Spawned by SDK-57 upgrade analysis. `eas-build-post-install.sh` runs only `copy-native-files.js`, not `patch-native-config.js`, so EAS artifacts miss FloatingBubbleService/BootReceiver/SoundAlarmReceiver/ACTION_SEND/`<queries>`. Consolidate manifest edits into a real config plugin so local + EAS builds agree. |
| | | |

> Add new ideas to the Planned table as they come up.
>
> **Status ladder** (advanced by the SDLC pipeline skills): `Idea` → `Brainstormed` → `Analyzed` → `Spec'd` → `Designed` → `Building` → `Built` → `Verified`. Once verified **and** released, move the row up to the **Shipped** table (with its key files). `Planned` marks committed-but-not-yet-started work.
