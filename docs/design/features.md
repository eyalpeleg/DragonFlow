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
| Dark mode | Automatic UI style switching | `app.json` (`userInterfaceStyle: automatic`) |
| Persistent storage | All data persisted locally via AsyncStorage | `taskStore.ts` (Zustand persist) |

## Planned

| Feature | Status | Notes |
|---------|--------|-------|
| iOS floating bubble | Idea | Equivalent of Android overlay for iOS |
| App Store / Play Store publish | Planned | Bundle ID ready (`com.anonymous.DragonFlow`) |
| Data export/import | Idea | Export tasks as JSON or CSV for backup |
| Cloud sync | Idea | Sync tasks across devices |
| Widgets | Idea | Home screen widget showing today's tasks |
| | | |

> Add new ideas to the Planned table as they come up.
