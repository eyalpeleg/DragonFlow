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
    activeCategory: string | null;
    dismissedFloatingBubble: boolean;
    showBubbleInBackground: boolean;
    defaultTaskTime: string;

    addTask: (input: AddTaskInput) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    archiveTask: (id: string) => void;
    restoreTask: (id: string) => void;
    setStatus: (id: string, status: TaskStatus) => void;
    setCategory: (category: string | null) => void;
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
            activeCategory: null,
            dismissedFloatingBubble: false,
            showBubbleInBackground: true,
            defaultTaskTime: '08:00',

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

            setCategory: (category) => set({ activeCategory: category }),

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
        }),
        {
            name: 'dragonflow-tasks',
            storage: createJSONStorage(() => AsyncStorage),
            merge: (persisted: unknown, current: TaskStore) => {
                const p = persisted as Partial<TaskStore>;
                const stored = p.categories ?? [];
                const builtInNames = new Set(BUILTIN_CATEGORIES.map((c) => c.name));
                const custom = stored.filter((c) => !builtInNames.has(c.name));
                return {
                    ...current,
                    ...p,
                    categories: [...BUILTIN_CATEGORIES, ...custom],
                };
            },
            onRehydrateStorage: () => (state) => {
                state?.setHydrated(true);
                // Always reset dismissed bubble on app restart
                if (state) {
                    state.dismissedFloatingBubble = false;
                    state.tasks
                        .filter((t) => t.status !== 'Done' && !t.archivedAt)
                        .forEach((t) => scheduleTaskReminders(t).catch(() => {}));
                }
            },
        }
    )
);

export function useSortedFilteredTasks(activeStatus: TaskStatus | null = null): Task[] {
    const tasks = useTaskStore((s) => s.tasks);
    const activeCategory = useTaskStore((s) => s.activeCategory);
    return useMemo(() => {
        const active = tasks.filter((t) => !t.archivedAt);
        const filtered = active
            .filter((t) => !activeCategory || t.category === activeCategory)
            .filter((t) => !activeStatus || t.status === activeStatus);
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
    }, [tasks, activeCategory, activeStatus]);
}

export function useArchivedTasks(): Task[] {
    const tasks = useTaskStore((s) => s.tasks);
    return useMemo(
        () => tasks.filter((t) => !!t.archivedAt).sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0)),
        [tasks]
    );
}
