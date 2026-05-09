# Architecture

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Expo (SDK 53) + Expo Router (file-based routing) |
| UI | React Native with React 19, Ionicons |
| Language | TypeScript (strict, with typed routes) |
| State | Zustand with `persist` middleware |
| Storage | AsyncStorage (local-first, no backend) |
| Notifications | expo-notifications (4 Android channels) |
| Native modules | FloatingBubble (Android overlay) |
| Build | EAS Build (Android APK/AAB, iOS archive) |

## File Structure

```
app/                        Expo Router pages
  (tabs)/
    _layout.tsx              Bottom tab navigator (Tasks, Today, Weekly, Settings)
    tasks.tsx                Main task list with filters
    daily.tsx                Daily stats dashboard
    weekly.tsx               Weekly analytics
    settings.tsx             Settings & category management
  _layout.tsx                Root layout (notification setup)
  index.tsx                  Redirect → tasks tab

src/
  components/                15 UI components
    AddTaskModal             Task creation form
    EditTaskModal            Task editing form
    TaskCard                 Task list item
    ArchivedTaskCard         Archived task item
    AddCategoryModal         Category creation
    EditCategoryModal        Category editing
    FilterBar                Active filter chips
    FilterModal              Filter selection sheet
    FilterTypeSelector       Filter type picker
    StatusFilter             Status toggle
    DatePickerField          Date input
    TimePickerField          Time input
    TaskChecklist            Sub-task list
    PomodoroTimer            Focus timer
    DoneStatsModal           Completion stats dialog
  store/
    taskStore.ts             Zustand store (tasks, categories, filters)
  modules/
    FloatingBubble.ts        Android native overlay bridge
  styles/
    theme.ts                 Colors, priority palette, spacing
  types.ts                   TypeScript interfaces
  utils/
    notifications.ts         Push notification helpers
    recurrence.ts            Recurring task generation
    summaryLogic.ts          Analytics calculations
```

## Data Model

### Task
```
id               string         Unique ID (timestamp + random)
title            string
description      string
priority         Critical | High | Medium | Low
categoryId       string         FK → Category.id
dueDate          string         YYYY-MM-DD
dueTime          string         HH:MM (default "08:00")
status           Ready | In Progress | Done
createdAt        number         Unix timestamp
startTime?       number         When moved to In Progress
completedTime?   number         When marked Done
archivedAt?      number         When archived
subTasks?        SubTask[]      Nested checklist items
recurrence?      RecurrenceConfig
parentRecurringId? string       Links to parent recurring task
completionComment? string       Note added when completing
```

### Category
```
id       string
name     string
color    string    CSS color value
```

Built-in categories: Default, Friends, Personal, Fitness, Study.

### SubTask
```
id         string
title      string
completed  boolean
```

### RecurrenceConfig
```
frequency    daily | weekly | monthly
interval     number    Every N units
```

## State Management

Single Zustand store (`taskStore.ts`) with `persist` middleware backed by AsyncStorage. The store holds:
- `tasks` — full task array
- `categories` — category list (built-in + user-created)
- Filter state — `statusFilters`, `categoryFilters`, `priorityFilters`, `dueDateFilters` (all `Set`-based)
- Settings — `showBubbleInBackground`, `defaultTaskTime`

Side effects on task changes:
1. Sync notification summaries (critical + today channels)
2. Update Android floating bubble (show/hide based on critical task count)
3. Schedule/cancel per-task reminders

## Notification System

Four Android notification channels:
| Channel | Purpose | Importance |
|---------|---------|------------|
| `critical-tasks` | Ongoing summary of critical tasks | HIGH |
| `pomodoro` | Pomodoro timer alerts | HIGH |
| `task-reminders` | Per-task due time reminders | HIGH |
| `today-tasks` | Daily summary of today's tasks | DEFAULT |

Notifications gracefully degrade in Expo Go (silently disabled).

## Native Modules

**FloatingBubble** (Android only) — system overlay that shows the count of active critical tasks. Displayed when critical tasks exist, hidden when all are resolved. Controlled from the Zustand store side effects.
