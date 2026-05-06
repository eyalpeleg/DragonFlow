import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { COLORS, PriorityLevel } from '../styles/theme';
import { Category, RecurrenceConfig, SubTask, Task, TaskStatus } from '../types';
import { cancelTaskReminders, scheduleTaskReminders, updateCriticalTasksNotification, updateTodayTasksNotification } from '../utils/notifications';
import { buildNextOccurrence } from '../utils/recurrence';
import FloatingBubble from '../modules/FloatingBubble';

const BUILTIN_CATEGORIES: Category[] = [
    { name: 'Friends',  color: '#4A90E2',                    builtIn: true },
    { name: 'Personal', color: 'rgba(155, 39, 176, 0.75)',   builtIn: true },
    { name: 'Fitness',  color: 'rgba(239, 119, 13, 0.95)',   builtIn: true },
    { name: 'Study',    color: 'rgba(34, 218, 166, 0.69)',   builtIn: true },
];

export function getCategoryColor(categories: Category[], name: string): string {
    return categories.find((c) => c.name === name)?.color ?? COLORS.primary;
}

function syncNotifications(tasks: Task[]) {
    const active = tasks.filter((t) => !t.archivedAt);
    updateCriticalTasksNotification(active).catch(() => {});
    updateTodayTasksNotification(active).catch(() => {});
    const critical = active.filter((t) => t.priority === 'Critical' && t.status !== 'Done');
    if (critical.length === 0) {
        FloatingBubble.hide();
    } else {
        FloatingBubble.show(critical.length, `${critical.length} Critical ${critical.length === 1 ? 'Task' : 'Tasks'}`);
    }
}

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface AddTaskInput {
    title: string;
    description: string;
    priority: PriorityLevel;
    category: string;
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
    // New filter state
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
    deleteCategory: (name: string) => boolean;
    // Sub-task actions
    toggleSubTask: (taskId: string, subTaskId: string) => void;
    addSubTask: (taskId: string, title: string) => void;
    removeSubTask: (taskId: string, subTaskId: string) => void;
    // Done stats
    updateCompletionComment: (taskId: string, comment: string) => void;
    // Floating bubble
    setFloatingBubbleDismissed: (dismissed: boolean) => void;
    setShowBubbleInBackground: (show: boolean) => void;
    setDefaultTaskTime: (time: string) => void;
    // Filter actions
    setStatusFilters: (filters: Set<TaskStatus>) => void;
    setCategoryFilters: (filters: Set<string>) => void;
    setPriorityFilters: (filters: Set<PriorityLevel>) => void;
    setDueDateFilters: (filters: Set<'overdue' | 'today' | 'upcoming'>) => void;
}

const priorityOrder: Record<PriorityLevel, number> = {
    Critical: 0,
    High: 1,
    Medium: 2,
    Low: 3,
};

const statusOrder: Record<TaskStatus, number> = {
    'Ready': 0,
    'In Progress': 1,
    'Done': 2,
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
                    category: input.category,
                    dueDate: input.dueDate,
                    dueTime: input.dueTime,
                    status: 'Ready',
                    createdAt: Date.now(),
                    subTasks: input.subTasks ?? [],
                    recurrence: input.recurrence,
                };
                const tasks = [task, ...s.tasks];
                syncNotifications(tasks);
                scheduleTaskReminders(task).catch(() => {});
                return { tasks };
            }),

            updateTask: (id, updates) => set((s) => {
                const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
                syncNotifications(tasks);
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
                syncNotifications(tasks);
                return { tasks };
            }),

            archiveTask: (id) => set((s) => {
                cancelTaskReminders(id).catch(() => {});
                const tasks = s.tasks.map((t) => t.id === id ? { ...t, archivedAt: Date.now() } : t);
                syncNotifications(tasks);
                return { tasks };
            }),

            restoreTask: (id) => set((s) => {
                const tasks = s.tasks.map((t) => {
                    if (t.id !== id) return t;
                    const { archivedAt: _, ...rest } = t;
                    return rest as Task;
                });
                syncNotifications(tasks);
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

                // Spawn next occurrence when a recurring task is marked Done
                const completed = tasks.find((t) => t.id === id);
                if (status === 'Done' && completed?.recurrence) {
                    const next = buildNextOccurrence(completed);
                    tasks = [...tasks, next];
                    scheduleTaskReminders(next).catch(() => {});
                }

                syncNotifications(tasks);
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
                if (s.categories.find((c) => c.name === name)) return {};
                return { categories: [...s.categories, { name, color, builtIn: false }] };
            }),

            deleteCategory: (name) => {
                const s = get();
                const cat = s.categories.find((c) => c.name === name);
                if (!cat || cat.builtIn) return false;
                const inUse = s.tasks.some((t) => !t.archivedAt && t.category === name);
                if (inUse) return false;
                set({ categories: s.categories.filter((c) => c.name !== name) });
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

            updateCompletionComment: (taskId, comment) => set((s) => ({
                tasks: s.tasks.map((t) => t.id === taskId ? { ...t, completionComment: comment } : t),
            })),

            setFloatingBubbleDismissed: (dismissed) => set({ dismissedFloatingBubble: dismissed }),

            setShowBubbleInBackground: (show) => set({ showBubbleInBackground: show }),

            setDefaultTaskTime: (time) => set({ defaultTaskTime: time }),

            setStatusFilters: (filters) => set({ statusFilters: filters }),

            setCategoryFilters: (filters) => set({ categoryFilters: filters }),

            setPriorityFilters: (filters) => set({ priorityFilters: filters }),

            setDueDateFilters: (filters) => set({ dueDateFilters: filters }),
        }),
        {
            name: 'dragonflow-tasks',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state: TaskStore) => ({
                tasks: state.tasks,
                categories: state.categories,
                defaultTaskTime: state.defaultTaskTime,
                showBubbleInBackground: state.showBubbleInBackground,
                statusFilters: Array.from(state.statusFilters),
                categoryFilters: Array.from(state.categoryFilters),
                priorityFilters: Array.from(state.priorityFilters),
                dueDateFilters: Array.from(state.dueDateFilters),
            }),
            merge: (persisted: unknown, current: TaskStore) => {
                if (!persisted) return current;
                const p = persisted as any;
                const stored = p.categories ?? [];
                const builtInNames = new Set(BUILTIN_CATEGORIES.map((c) => c.name));
                const custom = stored.filter((c: Category) => !builtInNames.has(c.name));
                // Filter out old keys like activeCategory that no longer exist
                const persistedFiltered = Object.fromEntries(
                    Object.entries(p).filter(([key]) => !['activeCategory'].includes(key))
                );
                return {
                    ...current,
                    ...persistedFiltered,
                    statusFilters: new Set(p.statusFilters ?? []),
                    categoryFilters: new Set(p.categoryFilters ?? []),
                    priorityFilters: new Set(p.priorityFilters ?? []),
                    dueDateFilters: new Set(p.dueDateFilters ?? []),
                    categories: [...BUILTIN_CATEGORIES, ...custom],
                } as TaskStore;
            },
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.dismissedFloatingBubble = false;
                    // Ensure filter sets exist as Sets
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
    const statusFilters = useTaskStore((s) => s.statusFilters);
    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const priorityFilters = useTaskStore((s) => s.priorityFilters);
    const dueDateFilters = useTaskStore((s) => s.dueDateFilters);

    return useMemo(() => {
        const active = tasks.filter((t) => !t.archivedAt);

        const filtered = active.filter((t) => {
            // Status filter: AND across all statuses (any match passes)
            if (statusFilters.size > 0 && !statusFilters.has(t.status)) return false;

            // Category filter: AND across all categories (any match passes)
            if (categoryFilters.size > 0 && !categoryFilters.has(t.category)) return false;

            // Priority filter: AND across all priorities (any match passes)
            if (priorityFilters.size > 0 && !priorityFilters.has(t.priority)) return false;

            // Due date filter: AND across date ranges
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
            const statusDiff = statusOrder[a.status] - statusOrder[b.status];
            if (statusDiff !== 0) return statusDiff;
            const dateA = a.dueDate || '9999-12-31';
            const dateB = b.dueDate || '9999-12-31';
            if (dateA !== dateB) return dateA < dateB ? -1 : 1;
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0) return priorityDiff;
            return a.createdAt - b.createdAt;
        });
    }, [tasks, statusFilters, categoryFilters, priorityFilters, dueDateFilters]);
}

export function useArchivedTasks(): Task[] {
    const tasks = useTaskStore((s) => s.tasks);
    return useMemo(
        () => tasks.filter((t) => !!t.archivedAt).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
        [tasks]
    );
}
