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
| Parking app awareness | Idea | Detect active parking sessions and remind the user to close/stop parking when finished |
| Activity log | Idea | Record user activity so it can be shared with the developer to understand how the app is used |
| Fix Google auth expiration | Idea | Bugfix — handle expired Google auth token so Drive backup keeps working without re-sign-in |
| Upgrade Expo SDK 54 → 57 | Idea | Enabler (spawned by Share-text analysis) — unlocks `expo-share-intent` (replaces custom-native share code) + iOS share target; also newer RN & security patches. High blast radius; schedule as its own effort |
| | | |

> Add new ideas to the Planned table as they come up.
>
> **Status ladder** (advanced by the SDLC pipeline skills): `Idea` → `Brainstormed` → `Analyzed` → `Spec'd` → `Designed` → `Building` → `Built` → `Verified`. Once verified **and** released, move the row up to the **Shipped** table (with its key files). `Planned` marks committed-but-not-yet-started work.
