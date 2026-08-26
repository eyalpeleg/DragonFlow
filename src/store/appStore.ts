import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PriorityLevel } from '../styles/theme';
import { Category, ParkingSession, RecurrenceConfig, SubTask, Task, TaskStatus, SoundType } from '../types';
import { cancelParkingReminder, cancelTaskReminders, scheduleParkingReminder, scheduleTaskReminders } from '../utils/notifications';
import { computeExtend, computeRemindAt, ExtendDelta, isValidDuration, MIN_DURATION_MIN, MIN_DURATION_MIN_DEBUG } from '../utils/parking';
import { getCategoryColor, getCategoryName } from '../utils/categories';
import { buildNextOccurrence } from '../utils/recurrence';
import { AppState } from 'react-native';
import FloatingBubble from '../modules/FloatingBubble';
import { makeId } from '../utils/id';

// Re-export for backward compatibility
export { getCategoryColor, getCategoryName };

export const DEFAULT_CATEGORY_ID = 'default';

// A parking session overdue by more than this on rehydrate is auto-cleared: it was
// forgotten, and while any session is active parking-app detection stays suppressed.
const PARKING_STALE_MS = 6 * 60 * 60 * 1000;

const STATUS_RANK: Record<TaskStatus, number> = {
    'In Progress': 0,
    'Ready': 1,
    'Paused': 1,
    'Done': 2,
};

const BUILTIN_CATEGORIES: Category[] = [
    { id: 'default',  name: 'Default',  color: '#607D8B' },
    { id: 'friends',  name: 'Friends',  color: '#4A90E2' },
    { id: 'personal', name: 'Personal', color: 'rgba(155, 39, 176, 0.75)' },
    { id: 'fitness',  name: 'Fitness',  color: 'rgba(239, 119, 13, 0.95)' },
    { id: 'study',    name: 'Study',    color: 'rgba(34, 218, 166, 0.69)' },
];

export function isUrgent(t: Task, todayStr: string, tomorrowStr: string): boolean {
    if (t.status === 'Done') return false;
    if (t.pinned) return true;
    if (t.dueDate < todayStr) return true;
    if (t.dueDate === todayStr) return true;
    if (t.dueDate === tomorrowStr && (t.priority === 'Critical' || t.priority === 'High')) return true;
    return false;
}

export function computeBubbleScore(tasks: Task[], todayStr: string, tomorrowStr: string): number {
    return tasks.filter((t) => isUrgent(t, todayStr, tomorrowStr)).length;
}

export function getTodayTomorrowStrs(): { todayStr: string; tomorrowStr: string } {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomorrowStr = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
    return { todayStr, tomorrowStr };
}

/** The bubble label/notification text for an urgent-task count (empty when zero). */
export function urgentBubbleMessage(score: number): string {
    return score > 0 ? `${score} Urgent ${score === 1 ? 'Task' : 'Tasks'}` : '';
}

export type BubbleOwner = 'parking' | 'pomodoro' | 'tasks' | 'none';

// The floating bubble is a single glanceable surface with three possible owners.
// Precedence: parking-timer > pomodoro > task-count (AC7a). Pure so it can be
// unit-tested exhaustively (see bubbleResolver.test.ts).
export function resolveBubbleOwner(o: {
    parkingActive: boolean;
    pomodoroActive: boolean;
    taskScore: number;
}): BubbleOwner {
    if (o.parkingActive) return 'parking';
    if (o.pomodoroActive) return 'pomodoro';
    if (o.taskScore > 0) return 'tasks';
    return 'none';
}

// Drives the bubble from the current state, honouring the precedence above and
// the foreground/background + user-pref gating. Replaces the old task-only
// syncNotifications.
function syncBubble(
    tasks: Task[],
    showBubbleInBackground: boolean,
    pomodoroEndTime: number | null,
    parkingSession: ParkingSession | null,
) {
    const { todayStr, tomorrowStr } = getTodayTomorrowStrs();
    const score = computeBubbleScore(tasks, todayStr, tomorrowStr);
    const owner = resolveBubbleOwner({
        parkingActive: parkingSession !== null,
        pomodoroActive: pomodoroEndTime !== null && pomodoroEndTime > Date.now(),
        taskScore: score,
    });

    // Lower-precedence content the bubble reverts to when parking clears.
    const fallbackMessage = urgentBubbleMessage(score);
    const suppressed = AppState.currentState === 'active' || !showBubbleInBackground;

    if (owner === 'parking') {
        // In the foreground the in-app chip takes over — hide the overlay.
        if (suppressed) FloatingBubble.hide();
        else FloatingBubble.startParkingTimer(parkingSession!.remindAt, score, fallbackMessage);
        return;
    }
    // While a pomodoro is active the native service owns the bubble — don't interfere.
    if (owner === 'pomodoro') return;

    if (owner === 'tasks' && !suppressed) {
        FloatingBubble.show(score, fallbackMessage);
    } else {
        FloatingBubble.hide();
    }
}

export interface DoneUndoInfo {
    taskId: string;
    priorStatus: TaskStatus;
    priorCompletedTime?: number;
    generatedOccurrenceId?: string;
    at: number;
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
    pinned?: boolean;
}

interface TaskStore {
    tasks: Task[];
    categories: Category[];
    deletedBuiltinCategoryIds: string[];
    hasHydrated: boolean;
    dismissedFloatingBubble: boolean;
    showBubbleInBackground: boolean;
    defaultTaskTime: string;
    firstDayOfWeek: 'sunday' | 'monday';
    notificationSoundEnabled: boolean;
    pomodoroSoundType: SoundType;
    tasksSoundType: SoundType;
    pomodoroVolume: number;
    tasksVolume: number;
    pomodoroEndTime: number | null;
    pomodoroModeIdx: number | null;
    pomodoroPausedSecondsLeft: number | null;
    pomodoroNotifId: string | null;
    pomodoroVisible: boolean;
    parkingSession: ParkingSession | null;
    parkingReminderEnabled: boolean;
    parkingSuppressedUntil: number | null;
    parkingArmPromptVisible: boolean; // transient — drives the in-app arm modal
    parkingDisclosureSeen: boolean; // gates the one-time auto-shown first-launch disclosure
    statusFilters: Set<TaskStatus>;
    categoryFilters: Set<string>;
    priorityFilters: Set<PriorityLevel>;
    dueDateFilters: Set<'overdue' | 'today' | 'upcoming'>;
    focusMode: boolean;
    customTimerSeconds: number;
    debugModeEnabled: boolean;
    darkMode: boolean;
    reflectOnDone: boolean;
    lastDoneUndo: DoneUndoInfo | null;

    addTask: (input: AddTaskInput) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    setStatus: (id: string, status: TaskStatus) => void;
    undoLastDone: () => void;
    clearLastDoneUndo: () => void;
    setReflectOnDone: (enabled: boolean) => void;
    togglePin: (id: string) => void;
    setHydrated: (value: boolean) => void;
    addCategory: (name: string, color: string) => void;
    deleteCategory: (id: string) => void;
    updateCategory: (id: string, updates: { name?: string; color?: string }) => boolean;
    toggleSubTask: (taskId: string, subTaskId: string) => void;
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
    clearAllFilters: () => void;
    setFocusMode: (enabled: boolean) => void;
    setPomodoroTimer: (endTime: number, modeIdx: number, notifId: string) => void;
    pausePomodoroTimer: (secondsLeft: number, modeIdx: number) => void;
    clearPomodoroTimer: () => void;
    startParkingSession: (durationMin: number) => ParkingSession | null;
    extendParkingSession: (delta: ExtendDelta) => boolean;
    clearParkingSession: () => void;
    setParkingReminderEnabled: (enabled: boolean) => void;
    setParkingSuppressedUntil: (until: number | null) => void;
    setParkingArmPromptVisible: (visible: boolean) => void;
    setParkingDisclosureSeen: (seen: boolean) => void;
    setPomodoroVisible: (visible: boolean) => void;
    setCustomTimerSeconds: (seconds: number) => void;
    setDebugModeEnabled: (enabled: boolean) => void;
    setDarkMode: (enabled: boolean) => void;
    exportData: () => object;
    importData: (data: { tasks: Task[]; categories: Category[]; settings?: { defaultTaskTime?: string; showBubbleInBackground?: boolean; notificationSoundEnabled?: boolean; pomodoroSoundType?: SoundType; tasksSoundType?: SoundType; darkMode?: boolean } }) => { tasksImported: number };
}

export const useTaskStore = create<TaskStore>()(
    persist(
        (set, get) => ({
            tasks: [],
            categories: BUILTIN_CATEGORIES,
            deletedBuiltinCategoryIds: [],
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
            pomodoroVisible: false,
            parkingSession: null,
            parkingReminderEnabled: true,
            parkingSuppressedUntil: null,
            parkingArmPromptVisible: false,
            parkingDisclosureSeen: false,
            statusFilters: new Set(),
            categoryFilters: new Set(),
            priorityFilters: new Set(),
            dueDateFilters: new Set(),
            focusMode: false,
            customTimerSeconds: 0,
            debugModeEnabled: false,
            darkMode: false,
            reflectOnDone: false,
            lastDoneUndo: null,

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
                    pinned: input.pinned ?? false,
                };
                const tasks = [task, ...s.tasks];
                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
                scheduleTaskReminders(task).catch(() => {});
                return { tasks };
            }),

            updateTask: (id, updates) => set((s) => {
                const tasks = s.tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
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
                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
                return { tasks };
            }),

            setStatus: (id, status) => set((s) => {
                const prior = s.tasks.find((t) => t.id === id);
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
                let generatedOccurrenceId: string | undefined;
                if (status === 'Done' && completed?.recurrence) {
                    const next = buildNextOccurrence(completed);
                    generatedOccurrenceId = next.id;
                    tasks = [...tasks, next];
                    scheduleTaskReminders(next).catch(() => {});
                }

                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
                if (status === 'Done') {
                    cancelTaskReminders(id).catch(() => {});
                } else if (status === 'In Progress') {
                    const reopened = tasks.find((t) => t.id === id);
                    if (reopened) scheduleTaskReminders(reopened).catch(() => {});
                }

                const isFreshDone = status === 'Done' && prior && prior.status !== 'Done';
                const lastDoneUndo: DoneUndoInfo | null = isFreshDone
                    ? {
                        taskId: id,
                        priorStatus: prior!.status,
                        priorCompletedTime: prior!.completedTime,
                        generatedOccurrenceId,
                        at: Date.now(),
                    }
                    : status === 'Done' ? s.lastDoneUndo : null;

                return { tasks, lastDoneUndo };
            }),

            undoLastDone: () => set((s) => {
                const info = s.lastDoneUndo;
                if (!info) return {};
                let tasks = s.tasks.map((t) => {
                    if (t.id !== info.taskId) return t;
                    return {
                        ...t,
                        status: info.priorStatus,
                        completedTime: info.priorCompletedTime,
                    };
                });
                if (info.generatedOccurrenceId) {
                    cancelTaskReminders(info.generatedOccurrenceId).catch(() => {});
                    tasks = tasks.filter((t) => t.id !== info.generatedOccurrenceId);
                }
                const restored = tasks.find((t) => t.id === info.taskId);
                if (restored) scheduleTaskReminders(restored).catch(() => {});
                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
                return { tasks, lastDoneUndo: null };
            }),

            clearLastDoneUndo: () => set({ lastDoneUndo: null }),

            setReflectOnDone: (enabled) => set({ reflectOnDone: enabled }),

            togglePin: (id) => set((s) => {
                const tasks = s.tasks.map((t) => t.id === id ? { ...t, pinned: !t.pinned } : t);
                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
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
                const isBuiltin = BUILTIN_CATEGORIES.some((bc) => bc.id === id);
                const deletedBuiltinCategoryIds = isBuiltin && !s.deletedBuiltinCategoryIds.includes(id)
                    ? [...s.deletedBuiltinCategoryIds, id]
                    : s.deletedBuiltinCategoryIds;
                set({ tasks, categories, categoryFilters, deletedBuiltinCategoryIds });
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

            clearAllFilters: () => set({
                statusFilters: new Set(),
                categoryFilters: new Set(),
                priorityFilters: new Set(),
                dueDateFilters: new Set(),
            }),

            setFocusMode: (enabled) => set({ focusMode: enabled }),

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

            // --- Parking reminder ---
            // notifId is deterministic (= session id) so extend/clear can reschedule
            // or cancel without an async round-trip. Scheduling is fire-and-forget.
            startParkingSession: (durationMin) => {
                const minAllowed = get().debugModeEnabled ? MIN_DURATION_MIN_DEBUG : MIN_DURATION_MIN;
                if (!isValidDuration(durationMin, minAllowed)) return null; // AC3
                // Cancel any prior session's reminder so it can't fire orphaned.
                const prev = get().parkingSession;
                if (prev) cancelParkingReminder(prev.notifId ?? prev.id).catch(() => {});
                const now = Date.now();
                const id = makeId();
                const session: ParkingSession = {
                    id,
                    startedAt: now,
                    durationMin,
                    remindAt: computeRemindAt(now, durationMin),
                    notifId: id,
                };
                set({ parkingSession: session });
                scheduleParkingReminder(session.remindAt, id).catch(() => {});
                const s = get();
                syncBubble(s.tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
                return session;
            },

            extendParkingSession: (delta) => {
                const session = get().parkingSession;
                if (!session) return false;
                const r = computeExtend(session, delta, Date.now()); // AC5 / AC5a
                if (!r.ok) return false;
                const updated: ParkingSession = { ...session, remindAt: r.remindAt };
                set({ parkingSession: updated });
                cancelParkingReminder(session.notifId ?? session.id).catch(() => {});
                scheduleParkingReminder(r.remindAt, session.id).catch(() => {});
                const s = get();
                syncBubble(s.tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
                return true;
            },

            clearParkingSession: () => {
                const before = get();
                const session = before.parkingSession;
                if (session) cancelParkingReminder(session.notifId ?? session.id).catch(() => {});
                // Explicitly stop the native parking countdown so it reverts even when a
                // pomodoro is concurrently active (syncBubble defers to the pomodoro).
                const { todayStr, tomorrowStr } = getTodayTomorrowStrs();
                const score = computeBubbleScore(before.tasks, todayStr, tomorrowStr);
                FloatingBubble.stopParkingTimer(score, urgentBubbleMessage(score));
                set({ parkingSession: null });
                const s = get();
                syncBubble(s.tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);
            },

            // Toggling the feature resets transient suppression + any pending prompt,
            // so turning it off and on again is a clean slate.
            setParkingReminderEnabled: (enabled) => set({
                parkingReminderEnabled: enabled,
                parkingSuppressedUntil: null,
                parkingArmPromptVisible: false,
            }),

            setParkingSuppressedUntil: (until) => set({ parkingSuppressedUntil: until }),

            setParkingArmPromptVisible: (visible) => set({ parkingArmPromptVisible: visible }),

            setParkingDisclosureSeen: (seen) => set({ parkingDisclosureSeen: seen }),

            setPomodoroVisible: (visible) => set({ pomodoroVisible: visible }),

            setCustomTimerSeconds: (seconds) => set({
                customTimerSeconds: seconds,
            }),

            setDebugModeEnabled: (enabled) => set({
                debugModeEnabled: enabled,
            }),

            setDarkMode: (enabled) => set({
                darkMode: enabled,
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
                        darkMode: s.darkMode,
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
                syncBubble(tasks, s.showBubbleInBackground, s.pomodoroEndTime, s.parkingSession);

                set({
                    tasks,
                    categories,
                    ...(data.settings?.defaultTaskTime && { defaultTaskTime: data.settings.defaultTaskTime }),
                    ...(data.settings?.showBubbleInBackground !== undefined && { showBubbleInBackground: data.settings.showBubbleInBackground }),
                    ...(data.settings?.notificationSoundEnabled !== undefined && { notificationSoundEnabled: data.settings.notificationSoundEnabled }),
                    ...(data.settings?.pomodoroSoundType && { pomodoroSoundType: data.settings.pomodoroSoundType }),
                    ...(data.settings?.tasksSoundType && { tasksSoundType: data.settings.tasksSoundType }),
                    ...(data.settings?.darkMode !== undefined && { darkMode: data.settings.darkMode }),
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
                deletedBuiltinCategoryIds: state.deletedBuiltinCategoryIds,
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
                parkingSession: state.parkingSession,
                parkingReminderEnabled: state.parkingReminderEnabled,
                parkingSuppressedUntil: state.parkingSuppressedUntil,
                parkingDisclosureSeen: state.parkingDisclosureSeen,
                customTimerSeconds: state.customTimerSeconds,
                debugModeEnabled: state.debugModeEnabled,
                darkMode: state.darkMode,
                reflectOnDone: state.reflectOnDone,
                _schemaVersion: 4,
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

                if (schemaVersion < 3) {
                    // Done = Archived: drop archivedAt; any task with archivedAt is now Done.
                    tasks = tasks.map((t: any) => {
                        const { archivedAt, ...rest } = t;
                        if (archivedAt !== undefined && archivedAt !== null) {
                            return {
                                ...rest,
                                status: 'Done' as TaskStatus,
                                completedTime: rest.completedTime ?? archivedAt,
                            };
                        }
                        return rest;
                    });
                    // 'Done' is no longer a main-list status filter
                    if (Array.isArray(p.statusFilters)) {
                        p.statusFilters = p.statusFilters.filter((s: string) => s !== 'Done');
                    }
                }

                if (schemaVersion < 4) {
                    // Filter UI is now category-only. Wipe the now-unreachable filter sets
                    // so previously-persisted ones don't silently filter the main list.
                    p.statusFilters = [];
                    p.priorityFilters = [];
                    p.dueDateFilters = [];
                }

                // Always ensure Default exists (orphan-task fallback). For other built-ins,
                // only re-add if the user hasn't explicitly deleted them.
                const deletedBuiltinCategoryIds: string[] = p.deletedBuiltinCategoryIds ?? [];
                const deletedBuiltinCategoryIdSet = new Set(deletedBuiltinCategoryIds);
                const existingIds = new Set(categories.map((c) => c.id));
                for (const bc of BUILTIN_CATEGORIES) {
                    if (existingIds.has(bc.id)) continue;
                    if (bc.id === DEFAULT_CATEGORY_ID || !deletedBuiltinCategoryIdSet.has(bc.id)) {
                        categories.push({ ...bc });
                    }
                }

                const persistedFiltered = Object.fromEntries(
                    Object.entries(p).filter(([key]) => ![
                        'activeCategory', '_schemaVersion',
                        'themeColorPrimary', 'themeColorSecondary', 'themeColorAction',
                    ].includes(key))
                );

                return {
                    ...current,
                    ...persistedFiltered,
                    _schemaVersion: 4,
                    tasks,
                    categories,
                    deletedBuiltinCategoryIds,
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
                    for (const t of state.tasks) {
                        if (t.status === 'Done') continue;
                        scheduleTaskReminders(t).catch(() => {});
                    }
                    // Re-arm an un-expired parking reminder; leave a recently-expired
                    // one in its overdue state (AC20); clear a long-forgotten one so it
                    // stops blocking parking-app detection.
                    const ps = state.parkingSession;
                    if (ps) {
                        const nowMs = Date.now();
                        if (nowMs - ps.remindAt > PARKING_STALE_MS) {
                            cancelParkingReminder(ps.notifId ?? ps.id).catch(() => {});
                            state.parkingSession = null;
                        } else if (nowMs < ps.remindAt) {
                            scheduleParkingReminder(ps.remindAt, ps.notifId ?? ps.id).catch(() => {});
                        }
                    }
                    syncBubble(state.tasks, state.showBubbleInBackground, state.pomodoroEndTime, state.parkingSession);
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
    const focusMode = useTaskStore((s) => s.focusMode);

    const active = tasks.filter((t) => t.status !== 'Done');
    const { todayStr, tomorrowStr } = getTodayTomorrowStrs();

    const filtered = active.filter((t) => {
        if (focusMode && !isUrgent(t, todayStr, tomorrowStr)) return false;
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
        const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
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
}

export function useArchivedTasks(): Task[] {
    const tasks = useTaskStore((s) => s.tasks);
    return tasks.filter((t) => t.status === 'Done').sort((a, b) => (b.completedTime ?? 0) - (a.completedTime ?? 0));
}
