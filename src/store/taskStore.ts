import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COLORS, PriorityLevel } from '../styles/theme';
import { Category, RecurrenceConfig, SubTask, Task, TaskStatus, StatusOrderConfig, SoundType } from '../types';
import { cancelTaskReminders, scheduleTaskReminders } from '../utils/notifications';
import { getCategoryColor, getCategoryName } from '../utils/categories';
import { buildNextOccurrence } from '../utils/recurrence';
import { AppState } from 'react-native';
import FloatingBubble from '../modules/FloatingBubble';

// Re-export for backward compatibility
export { getCategoryColor, getCategoryName };

export const DEFAULT_CATEGORY_ID = 'default';

const BUILTIN_CATEGORIES: Category[] = [
    { id: 'default',  name: 'Default',  color: '#607D8B' },
    { id: 'friends',  name: 'Friends',  color: '#4A90E2' },
    { id: 'personal', name: 'Personal', color: 'rgba(155, 39, 176, 0.75)' },
    { id: 'fitness',  name: 'Fitness',  color: 'rgba(239, 119, 13, 0.95)' },
    { id: 'study',    name: 'Study',    color: 'rgba(34, 218, 166, 0.69)' },
];

export function computeBubbleScore(tasks: Task[], todayStr: string, tomorrowStr: string): number {
    return tasks.filter((t) => {
        if (t.archivedAt) return false;
        if (t.status === 'Done') return false;
        if (t.dueDate < todayStr) return true;
        if (t.dueDate === todayStr) return true;
        if (t.dueDate === tomorrowStr && (t.priority === 'Critical' || t.priority === 'High')) return true;
        return false;
    }).length;
}

function syncNotifications(tasks: Task[], showBubbleInBackground: boolean, pomodoroEndTime: number | null) {
    // While a pomodoro is active the native service owns the bubble — don't interfere
    if (pomodoroEndTime !== null && pomodoroEndTime > Date.now()) return;

    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;

    const score = computeBubbleScore(tasks, todayStr, tomorrowStr);

    if (score === 0 || AppState.currentState === 'active' || !showBubbleInBackground) {
        FloatingBubble.hide();
    } else {
        FloatingBubble.show(score, `${score} Urgent ${score === 1 ? 'Task' : 'Tasks'}`);
    }
}

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface AddTaskInput {
    title: string;
    description: string;
    priority: PriorityLevel;
    categoryId: string;
    dueDate: string;
    dueTime: string;
    subTasks?: SubTask[];
    recurrence?: RecurrenceConfig;
}

interface TaskStore {
    tasks: Task[];
    categories: Category[];
    hasHydrated: boolean;
    dismissedFloatingBubble: boolean;
    showBubbleInBackground: boolean;
    defaultTaskTime: string;
    firstDayOfWeek: 'sunday' | 'monday';
    statusOrderConfig: StatusOrderConfig;
    notificationSoundEnabled: boolean;
    pomodoroSoundType: SoundType;
    tasksSoundType: SoundType;
    pomodoroVolume: number;
    tasksVolume: number;
    pomodoroEndTime: number | null;
    pomodoroModeIdx: number | null;
    pomodoroPausedSecondsLeft: number | null;
    pomodoroNotifId: string | null;
    statusFilters: Set<TaskStatus>;
    categoryFilters: Set<string>;
    priorityFilters: Set<PriorityLevel>;
    dueDateFilters: Set<'overdue' | 'today' | 'upcoming'>;

    addTask: (input: AddTaskInput) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    archiveTask: (id: string) => void;
    restoreTask: (id: string) => void;
    setStatus: (id: string, status: TaskStatus) => void;
    setHydrated: (value: boolean) => void;
    addCategory: (name: string, color: string) => void;
    deleteCategory: (id: string) => void;
    updateCategory: (id: string, updates: { name?: string; color?: string }) => boolean;
    toggleSubTask: (taskId: string, subTaskId: string) => void;
    addSubTask: (taskId: string, title: string) => void;
    removeSubTask: (taskId: string, subTaskId: string) => void;
    renameSubTask: (taskId: string, subTaskId: string, title: string) => void;
    updateCompletionComment: (taskId: string, comment: string) => void;
    setFloatingBubbleDismissed: (dismissed: boolean) => void;
    setShowBubbleInBackground: (show: boolean) => void;
    setDefaultTaskTime: (time: string) => void;
    setFirstDayOfWeek: (day: 'sunday' | 'monday') => void;
    setNotificationSoundEnabled: (enabled: boolean) => void;
    setPomodoroSoundType: (type: SoundType) => void;
    setTasksSoundType: (type: SoundType) => void;
    setPomodoroVolume: (volume: number) => void;
    setTasksVolume: (volume: number) => void;
    setStatusFilters: (filters: Set<TaskStatus>) => void;
    setCategoryFilters: (filters: Set<string>) => void;
    setPriorityFilters: (filters: Set<PriorityLevel>) => void;
    setDueDateFilters: (filters: Set<'overdue' | 'today' | 'upcoming'>) => void;
    setStatusOrderConfig: (config: StatusOrderConfig) => void;
    setPomodoroTimer: (endTime: number, modeIdx: number, notifId: string) => void;
    pausePomodoroTimer: (secondsLeft: number, modeIdx: number) => void;
    clearPomodoroTimer: () => void;
    exportData: () => object;
    importData: (data: { tasks: Task[]; categories: Category[]; settings?: { defaultTaskTime?: string; showBubbleInBackground?: boolean; notificationSoundEnabled?: boolean; pomodoroSoundType?: SoundType; tasksSoundType?: SoundType } }) => { tasksImported: number };
}

const priorityOrder: Record<PriorityLevel, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
};

const statusOrder: Record<TaskStatus, number> = {
    'In Progress': 0,
    'Paused': 1,
    'Ready': 1,
    'Done': 3,
};

export const useTaskStore = create<TaskStore>()(
    persist(
        (set, get) => ({
            tasks: [],
            categories: BUILTIN_CATEGORIES,
            hasHydrated: false,
            dismissedFloatingBubble: false,
            showBubbleInBackground: true,
            defaultTaskTime: '08:00',
            firstDayOfWeek: 'sunday',
            notificationSoundEnabled: true,
            pomodoroSoundType: 'AppSound',
            tasksSoundType: 'AppSound',
            pomodoroVolume: 1.0,
            tasksVolume: 1.0,
            pomodoroEndTime: null,
            pomodoroModeIdx: null,
            pomodoroPausedSecondsLeft: null,
            pomodoroNotifId: null,
            statusOrderConfig: {
                'In Progress': 0,
                'Paused': 1,
                'Ready': 1,
                'Done': 3,
            },
            statusFilters: new Set(),
            categoryFilters: new Set(),
            priorityFilters: new Set(),
            dueDateFilters: new Set(),

            addTask: (input) => set((s) => {
                const task: Task = {
                    id: makeId(),
                    title: input.title,
                    description: input.description,
                    priority: input.priority,
                    categoryId: input.categoryId,
                    dueDate: input.dueDate,
                    dueTime: input.dueTime,
                    status: 'Ready',
                    createdAt: Date.now(),
                    subTasks: input.subTasks ?? [],
                    recurrence: input.recurrence,
                };
                const tasks = [task, ...s.tasks];
                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);
                scheduleTaskReminders(task).catch(() => {});
                return { tasks };
            }),

            updateTask: (id, updates) => set((s) => {
                const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);
                const updated = tasks.find((t) => t.id === id);
                if (updated) {
                    cancelTaskReminders(id).catch(() => {});
                    scheduleTaskReminders(updated).catch(() => {});
                }
                return { tasks };
            }),

            deleteTask: (id) => set((s) => {
                cancelTaskReminders(id).catch(() => {});
                const tasks = s.tasks.filter((t) => t.id !== id);
                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);
                return { tasks };
            }),

            archiveTask: (id) => set((s) => {
                cancelTaskReminders(id).catch(() => {});
                const tasks = s.tasks.map((t) => t.id === id ? { ...t, archivedAt: Date.now() } : t);
                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);
                return { tasks };
            }),

            restoreTask: (id) => set((s) => {
                const tasks = s.tasks.map((t) => {
                    if (t.id !== id) return t;
                    const { archivedAt: _, ...rest } = t;
                    return rest as Task;
                });
                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);
                return { tasks };
            }),

            setStatus: (id, status) => set((s) => {
                let tasks = s.tasks.map((t) => {
                    if (t.id !== id) return t;
                    return {
                        ...t,
                        status,
                        startTime: status === 'In Progress' ? (t.startTime ?? Date.now()) : t.startTime,
                        completedTime: status === 'Done' ? Date.now() : status === 'In Progress' ? undefined : t.completedTime,
                    };
                });

                const completed = tasks.find((t) => t.id === id);
                if (status === 'Done' && completed?.recurrence) {
                    const next = buildNextOccurrence(completed);
                    tasks = [...tasks, next];
                    scheduleTaskReminders(next).catch(() => {});
                }

                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);
                if (status === 'Done') {
                    cancelTaskReminders(id).catch(() => {});
                } else if (status === 'In Progress') {
                    const reopened = tasks.find((t) => t.id === id);
                    if (reopened) scheduleTaskReminders(reopened).catch(() => {});
                }
                return { tasks };
            }),

            setHydrated: (value) => set({ hasHydrated: value }),

            addCategory: (name, color) => set((s) => {
                if (s.categories.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) return {};
                return { categories: [...s.categories, { id: makeId(), name: name.trim(), color }] };
            }),

            deleteCategory: (id) => {
                if (id === DEFAULT_CATEGORY_ID) return;
                const s = get();
                const tasks = s.tasks.map((t) =>
                    t.categoryId === id ? { ...t, categoryId: DEFAULT_CATEGORY_ID } : t
                );
                const categories = s.categories.filter((c) => c.id !== id);
                const categoryFilters = new Set(s.categoryFilters);
                categoryFilters.delete(id);
                set({ tasks, categories, categoryFilters });
            },

            updateCategory: (id, updates) => {
                const s = get();
                const cat = s.categories.find((c) => c.id === id);
                if (!cat) return false;
                if (updates.name !== undefined) {
                    const trimmed = updates.name.trim();
                    if (trimmed.length === 0) return false;
                    const conflict = s.categories.some(
                        (c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase()
                    );
                    if (conflict) return false;
                }
                set({
                    categories: s.categories.map((c) => {
                        if (c.id !== id) return c;
                        return {
                            ...c,
                            ...(updates.name !== undefined && { name: updates.name.trim() }),
                            ...(updates.color !== undefined && { color: updates.color }),
                        };
                    }),
                });
                return true;
            },

            toggleSubTask: (taskId, subTaskId) => set((s) => ({
                tasks: s.tasks.map((t) => {
                    if (t.id !== taskId) return t;
                    return {
                        ...t,
                        subTasks: (t.subTasks ?? []).map((st) =>
                            st.id === subTaskId ? { ...st, completed: !st.completed } : st
                        ),
                    };
                }),
            })),

            addSubTask: (taskId, title) => set((s) => ({
                tasks: s.tasks.map((t) => {
                    if (t.id !== taskId) return t;
                    const newSub: SubTask = { id: makeId(), title, completed: false };
                    return { ...t, subTasks: [...(t.subTasks ?? []), newSub] };
                }),
            })),

            removeSubTask: (taskId, subTaskId) => set((s) => ({
                tasks: s.tasks.map((t) => {
                    if (t.id !== taskId) return t;
                    return { ...t, subTasks: (t.subTasks ?? []).filter((st) => st.id !== subTaskId) };
                }),
            })),

            renameSubTask: (taskId, subTaskId, title) => {
                const trimmed = title.trim();
                if (!trimmed) return;
                set((s) => ({
                    tasks: s.tasks.map((t) => {
                        if (t.id !== taskId) return t;
                        return {
                            ...t,
                            subTasks: (t.subTasks ?? []).map((st) =>
                                st.id === subTaskId ? { ...st, title: trimmed } : st
                            ),
                        };
                    }),
                }));
            },

            updateCompletionComment: (taskId, comment) => set((s) => ({
                tasks: s.tasks.map((t) => t.id === taskId ? { ...t, completionComment: comment } : t),
            })),

            setFloatingBubbleDismissed: (dismissed) => set({ dismissedFloatingBubble: dismissed }),

            setShowBubbleInBackground: (show) => set({ showBubbleInBackground: show }),

            setDefaultTaskTime: (time) => set({ defaultTaskTime: time }),

            setFirstDayOfWeek: (day) => set({ firstDayOfWeek: day }),

            setNotificationSoundEnabled: (enabled) => set({ notificationSoundEnabled: enabled }),

            setPomodoroSoundType: (type) => set({ pomodoroSoundType: type }),

            setTasksSoundType: (type) => set({ tasksSoundType: type }),

            setPomodoroVolume: (volume) => set({ pomodoroVolume: volume }),

            setTasksVolume: (volume) => set({ tasksVolume: volume }),

            setStatusFilters: (filters) => set({ statusFilters: filters }),

            setCategoryFilters: (filters) => set({ categoryFilters: filters }),

            setPriorityFilters: (filters) => set({ priorityFilters: filters }),

            setDueDateFilters: (filters) => set({ dueDateFilters: filters }),

            setStatusOrderConfig: (config) => set({ statusOrderConfig: config }),

            setPomodoroTimer: (endTime, modeIdx, notifId) => set({
                pomodoroEndTime: endTime,
                pomodoroModeIdx: modeIdx,
                pomodoroPausedSecondsLeft: null,
                pomodoroNotifId: notifId,
            }),

            pausePomodoroTimer: (secondsLeft, modeIdx) => set({
                pomodoroEndTime: null,
                pomodoroModeIdx: modeIdx,
                pomodoroPausedSecondsLeft: secondsLeft,
                pomodoroNotifId: null,
            }),

            clearPomodoroTimer: () => set({
                pomodoroEndTime: null,
                pomodoroModeIdx: null,
                pomodoroPausedSecondsLeft: null,
                pomodoroNotifId: null,
            }),

            exportData: () => {
                const s = get();
                return {
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    tasks: s.tasks,
                    categories: s.categories,
                    settings: {
                        defaultTaskTime: s.defaultTaskTime,
                        showBubbleInBackground: s.showBubbleInBackground,
                        notificationSoundEnabled: s.notificationSoundEnabled,
                        pomodoroSoundType: s.pomodoroSoundType,
                        tasksSoundType: s.tasksSoundType,
                    },
                };
            },

            importData: (data) => {
                const s = get();
                const builtinIds = new Set(BUILTIN_CATEGORIES.map((c) => c.id));
                const existingNames = new Set(s.categories.map((c) => c.name.toLowerCase()));

                const newUserCategories = (data.categories ?? []).filter(
                    (c) => !builtinIds.has(c.id) && !existingNames.has(c.name.toLowerCase())
                );
                const categories = [...s.categories, ...newUserCategories];

                const tasks = data.tasks ?? [];
                syncNotifications(tasks, s.showBubbleInBackground, s.pomodoroEndTime);

                set({
                    tasks,
                    categories,
                    ...(data.settings?.defaultTaskTime && { defaultTaskTime: data.settings.defaultTaskTime }),
                    ...(data.settings?.showBubbleInBackground !== undefined && { showBubbleInBackground: data.settings.showBubbleInBackground }),
                    ...(data.settings?.notificationSoundEnabled !== undefined && { notificationSoundEnabled: data.settings.notificationSoundEnabled }),
                    ...(data.settings?.pomodoroSoundType && { pomodoroSoundType: data.settings.pomodoroSoundType }),
                    ...(data.settings?.tasksSoundType && { tasksSoundType: data.settings.tasksSoundType }),
                });

                return { tasksImported: tasks.length };
            },
        }),
        {
            name: 'dragonflow-tasks',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: TaskStore) => ({
                tasks: state.tasks,
                categories: state.categories,
                defaultTaskTime: state.defaultTaskTime,
                showBubbleInBackground: state.showBubbleInBackground,
                firstDayOfWeek: state.firstDayOfWeek,
                notificationSoundEnabled: state.notificationSoundEnabled,
                pomodoroSoundType: state.pomodoroSoundType,
                tasksSoundType: state.tasksSoundType,
                pomodoroVolume: state.pomodoroVolume,
                tasksVolume: state.tasksVolume,
                pomodoroEndTime: state.pomodoroEndTime,
                pomodoroModeIdx: state.pomodoroModeIdx,
                pomodoroPausedSecondsLeft: state.pomodoroPausedSecondsLeft,
                pomodoroNotifId: state.pomodoroNotifId,
                _schemaVersion: 1,
                statusFilters: Array.from(state.statusFilters),
                categoryFilters: Array.from(state.categoryFilters),
                priorityFilters: Array.from(state.priorityFilters),
                dueDateFilters: Array.from(state.dueDateFilters),
            }),
            merge: (persisted: unknown, current: TaskStore) => {
                if (!persisted) return current;
                const p = persisted as any;
                const schemaVersion = p._schemaVersion ?? 0;

                let categories: Category[] = p.categories ?? [];
                let tasks: Task[] = p.tasks ?? [];

                if (schemaVersion < 1) {
                    // Migrate: add IDs to categories, convert task.category → task.categoryId
                    const builtInNameToId: Record<string, string> = {
                        'Default': 'default', 'Friends': 'friends', 'Personal': 'personal',
                        'Fitness': 'fitness', 'Study': 'study',
                    };
                    const nameToId: Record<string, string> = {};
                    categories = categories.map((c: any) => {
                        const id = builtInNameToId[c.name] ?? makeId();
                        nameToId[c.name] = id;
                        return { id, name: c.name, color: c.color };
                    });
                    if (!categories.find((c) => c.id === 'default')) {
                        categories.unshift({ id: 'default', name: 'Default', color: '#607D8B' });
                    }
                    tasks = tasks.map((t: any) => {
                        if (t.categoryId) return t;
                        const categoryId = nameToId[t.category] ?? DEFAULT_CATEGORY_ID;
                        const { category: _, ...rest } = t;
                        return { ...rest, categoryId };
                    });
                }

                // Coerce removed SoundType values ('SystemSound', 'Custom') → 'AppSound'
                if (p.pomodoroSoundType !== 'AppSound' && p.pomodoroSoundType !== 'Disabled') p.pomodoroSoundType = 'AppSound';
                if (p.tasksSoundType !== 'AppSound' && p.tasksSoundType !== 'Disabled') p.tasksSoundType = 'AppSound';

                // Ensure all built-in categories exist
                const existingIds = new Set(categories.map((c) => c.id));
                for (const bc of BUILTIN_CATEGORIES) {
                    if (!existingIds.has(bc.id)) categories.push({ ...bc });
                }

                const persistedFiltered = Object.fromEntries(
                    Object.entries(p).filter(([key]) => !['activeCategory', '_schemaVersion'].includes(key))
                );

                return {
                    ...current,
                    ...persistedFiltered,
                    _schemaVersion: 1,
                    tasks,
                    categories,
                    firstDayOfWeek: p.firstDayOfWeek ?? 'sunday',
                    statusFilters: new Set(p.statusFilters ?? []),
                    categoryFilters: new Set<string>(),
                    priorityFilters: new Set(p.priorityFilters ?? []),
                    dueDateFilters: new Set(p.dueDateFilters ?? []),
                } as TaskStore;
            },
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.dismissedFloatingBubble = false;
                    if (!(state.statusFilters instanceof Set)) {
                        state.statusFilters = new Set();
                    }
                    if (!(state.categoryFilters instanceof Set)) {
                        state.categoryFilters = new Set();
                    }
                    if (!(state.priorityFilters instanceof Set)) {
                        state.priorityFilters = new Set();
                    }
                    if (!(state.dueDateFilters instanceof Set)) {
                        state.dueDateFilters = new Set();
                    }
                    state.tasks
                        .filter((t) => t.status !== 'Done' && !t.archivedAt)
                        .forEach((t) => scheduleTaskReminders(t).catch(() => {}));
                }
                state?.setHydrated(true);
            },
        }
    )
);

export function useSortedFilteredTasks(): Task[] {
    const tasks = useTaskStore((s) => s.tasks);
    const statusOrderConfig = useTaskStore((s) => s.statusOrderConfig);
    const statusFilters = useTaskStore((s) => s.statusFilters);
    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const priorityFilters = useTaskStore((s) => s.priorityFilters);
    const dueDateFilters = useTaskStore((s) => s.dueDateFilters);

    return useMemo(() => {
        const active = tasks.filter((t) => !t.archivedAt);

        const filtered = active.filter((t) => {
            if (statusFilters.size > 0 && !statusFilters.has(t.status)) return false;
            if (categoryFilters.size > 0 && !categoryFilters.has(t.categoryId)) return false;
            if (priorityFilters.size > 0 && !priorityFilters.has(t.priority)) return false;
            if (dueDateFilters.size > 0) {
                if (!t.dueDate) return false;
                const today = new Date().toISOString().slice(0, 10);
                const dueDate = t.dueDate;
                const matchesDueDateFilter = Array.from(dueDateFilters).some((filter) => {
                    if (filter === 'overdue') return t.status !== 'Done' && dueDate < today;
                    if (filter === 'today') return t.status !== 'Done' && dueDate === today;
                    if (filter === 'upcoming') return t.status !== 'Done' && dueDate > today;
                    return false;
                });
                if (!matchesDueDateFilter) return false;
            }
            return true;
        });

        return [...filtered].sort((a, b) => {
            const statusDiff = statusOrderConfig[a.status] - statusOrderConfig[b.status];
            if (statusDiff !== 0) return statusDiff;

            const dateA = a.dueDate || '9999-12-31';
            const dateB = b.dueDate || '9999-12-31';
            const timeA = a.dueTime || '23:59';
            const timeB = b.dueTime || '23:59';
            const dateTimeA = `${dateA}T${timeA}`;
            const dateTimeB = `${dateB}T${timeB}`;
            if (dateTimeA !== dateTimeB) return dateTimeA < dateTimeB ? -1 : 1;

            const nameCompare = a.title.localeCompare(b.title);
            if (nameCompare !== 0) return nameCompare;

            return a.createdAt - b.createdAt;
        });
    }, [tasks, statusOrderConfig, statusFilters, categoryFilters, priorityFilters, dueDateFilters]);
}

export function useArchivedTasks(): Task[] {
    const tasks = useTaskStore((s) => s.tasks);
    return useMemo(
        () => tasks.filter((t) => !!t.archivedAt).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
        [tasks]
    );
}
