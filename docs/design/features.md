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
| | | |

> Add new ideas to the Planned table as they come up.
