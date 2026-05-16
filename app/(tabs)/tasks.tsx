import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, Image, ListRenderItem, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddTaskModal from '@/src/components/AddTaskModal';
import ArchivedTaskCard from '@/src/components/ArchivedTaskCard';
import DoneStatsModal from '@/src/components/DoneStatsModal';
import EditTaskModal from '@/src/components/EditTaskModal';
import FilterBar from '@/src/components/FilterBar';
import FilterModal from '@/src/components/FilterModal';
import FilterTypeSelector from '@/src/components/FilterTypeSelector';
import PomodoroTimer, { POMODORO_MODES, PomodoroModeIdx } from '@/src/components/PomodoroTimer';
import TaskCard from '@/src/components/TaskCard';
import { COLORS, PriorityLevel } from '@/src/styles/theme';
import { computeBubbleScore, useArchivedTasks, useTaskStore, useSortedFilteredTasks } from '@/src/store/appStore';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { cancelPomodoroNotification, playAppSound, schedulePomodoroEnd } from '@/src/utils/notifications';
import { Task, TaskStatus } from '@/src/types';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');

export default function TasksScreen() {
    const { addTask, updateTask, deleteTask, archiveTask, restoreTask, setStatus, hasHydrated } = useTaskStore();
    const tasks = useSortedFilteredTasks();
    const archivedTasks = useArchivedTasks();
    const themeColorSecondary = useTaskStore((s) => s.themeColorSecondary);
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [editTask, setEditTask] = useState<Task | null>(null);
    const [statsTask, setStatsTask] = useState<Task | null>(null);
    const [pomodoroVisible, setPomodoroVisible] = useState(false);
    const [showArchive, setShowArchive] = useState(false);
    const [filterModalOpen, setFilterModalOpen] = useState(false);
    const [filterTypeSelectorOpen, setFilterTypeSelectorOpen] = useState(false);
    const [filterBarVisible, setFilterBarVisible] = useState(true);
    const [selectedFilterType, setSelectedFilterType] = useState<FilterType | null>(null);

    const statusFilters = useTaskStore((s) => s.statusFilters);
    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const priorityFilters = useTaskStore((s) => s.priorityFilters);
    const dueDateFilters = useTaskStore((s) => s.dueDateFilters);
    const focusMode = useTaskStore((s) => s.focusMode);
    const setFocusMode = useTaskStore((s) => s.setFocusMode);
    const customTimerSeconds = useTaskStore((s) => s.customTimerSeconds);
    const totalFilterCount = statusFilters.size + categoryFilters.size + priorityFilters.size + dueDateFilters.size;
    const hasActiveFilters = totalFilterCount > 0;

    // Timer state lives here so it survives modal close/open
    const [modeIdx, setModeIdx] = useState<PomodoroModeIdx>(0);
    const [secondsLeft, setSecondsLeft] = useState(POMODORO_MODES[0].minutes * 60);
    const [running, setRunning] = useState(false);
    const pomodoroPausedSecondsLeft = useTaskStore((s) => s.pomodoroPausedSecondsLeft);
    const isPaused = pomodoroPausedSecondsLeft !== null;
    const notifIdRef = useRef<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const completedRef = useRef(false);
    // Refs to avoid stale closures in callbacks and event listeners
    const endTimeRef = useRef<number | null>(null);
    const modeIdxRef = useRef<PomodoroModeIdx>(0);
    const runningRef = useRef(false);
    useEffect(() => { modeIdxRef.current = modeIdx; }, [modeIdx]);
    useEffect(() => { runningRef.current = running; }, [running]);

    const { setPomodoroTimer, pausePomodoroTimer, clearPomodoroTimer, setCustomTimerSeconds } = useTaskStore();

    const getModeSeconds = (idx: PomodoroModeIdx, customSecs: number): number => {
        if (idx === 3) return customSecs;
        return POMODORO_MODES[idx as 0 | 1 | 2].minutes * 60;
    };

    const getModeLabel = (idx: PomodoroModeIdx): string => {
        if (idx === 3) return 'Custom';
        return POMODORO_MODES[idx as 0 | 1 | 2].label;
    };

    // Returns current task score + message for bubble fallback
    const getFallbackBubble = useCallback(() => {
        const { tasks } = useTaskStore.getState();
        const pad = (n: number) => String(n).padStart(2, '0');
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const tom = new Date(now); tom.setDate(tom.getDate() + 1);
        const tomorrowStr = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
        const score = computeBubbleScore(tasks, todayStr, tomorrowStr);
        return { score, message: score > 0 ? `${score} Urgent ${score === 1 ? 'Task' : 'Tasks'}` : '' };
    }, []);

    // isPause=true saves remaining seconds; default clears the timer entirely
    const stopTimer = useCallback(async (isPause = false) => {
        const didComplete = completedRef.current;
        console.log('[Pomodoro:stopTimer] called — isPause=', isPause, ' didComplete=', didComplete, ' endTimeRef=', endTimeRef.current);
        completedRef.current = false;

        if (isPause && endTimeRef.current) {
            const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            console.log('[Pomodoro:stopTimer] pausing, remaining=', remaining);
            pausePomodoroTimer(remaining, modeIdxRef.current);
        } else {
            console.log('[Pomodoro:stopTimer] clearing store + cancelling notif');
            clearPomodoroTimer();
            if (notifIdRef.current) { cancelPomodoroNotification(notifIdRef.current); notifIdRef.current = null; }
        }

        endTimeRef.current = null;
        setRunning(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

        // Stop native bubble countdown, revert bubble to task score (or hide)
        const { score, message } = getFallbackBubble();
        FloatingBubble.stopPomodoroTimer(score, message);

        if (didComplete) {
            const { pomodoroSoundType } = useTaskStore.getState();
            console.log('[Pomodoro:stopTimer] didComplete=true, soundType=', pomodoroSoundType, ' — playing sound if AppSound');
            if (pomodoroSoundType === 'AppSound') await playAppSound('bell', 1.0);
        }
    }, [pausePomodoroTimer, clearPomodoroTimer, getFallbackBubble]);

    // Wall-clock based interval — correct even after backgrounding
    useEffect(() => {
        console.log('[Pomodoro:interval-effect] running=', running);
        if (!running) return;
        intervalRef.current = setInterval(() => {
            if (!endTimeRef.current) return;
            const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            if (remaining <= 1) {
                console.log('[Pomodoro:interval] remaining<=1 — COMPLETING (completedRef=true → stopTimer)');
                completedRef.current = true;
                stopTimer();
                setSecondsLeft(0);
                return;
            }
            setSecondsLeft(remaining);
        }, 1000);
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [running, stopTimer]);

    // Rehydrate timer from persisted store on mount (no sound playback at rehydration)
    useEffect(() => {
        const { pomodoroEndTime, pomodoroModeIdx, pomodoroPausedSecondsLeft, pomodoroNotifId } = useTaskStore.getState();
        console.log('[Pomodoro:rehydrate] state:', {
            pomodoroEndTime,
            pomodoroModeIdx,
            pomodoroPausedSecondsLeft,
            pomodoroNotifId,
            now: Date.now(),
        });
        if (pomodoroEndTime !== null && pomodoroModeIdx !== null) {
            const remaining = Math.round((pomodoroEndTime - Date.now()) / 1000);
            console.log('[Pomodoro:rehydrate] remaining=', remaining, 's');
            setModeIdx(pomodoroModeIdx as PomodoroModeIdx);
            if (remaining > 0) {
                // Timer still running — restore and resume
                console.log('[Pomodoro:rehydrate] branch=RUNNING — restoring timer, setRunning(true)');
                endTimeRef.current = pomodoroEndTime;
                notifIdRef.current = pomodoroNotifId;
                setSecondsLeft(remaining);
                setRunning(true);
            } else {
                // Timer expired while app was away — native service already played sound
                // Only clear store, don't set any state that would trigger effects
                console.log('[Pomodoro:rehydrate] branch=EXPIRED — clearing store only (no sound)');
                clearPomodoroTimer();
            }
        } else if (pomodoroPausedSecondsLeft !== null && pomodoroModeIdx !== null) {
            // Restore paused timer state
            console.log('[Pomodoro:rehydrate] branch=PAUSED — restoring paused state, secondsLeft=', pomodoroPausedSecondsLeft);
            setModeIdx(pomodoroModeIdx as PomodoroModeIdx);
            setSecondsLeft(pomodoroPausedSecondsLeft);
        } else {
            console.log('[Pomodoro:rehydrate] branch=NONE — no persisted timer');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Register hardware back button listener
    useEffect(() => {
        if (!showArchive) return; // Only active when viewing archive

        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            setShowArchive(false);
            return true; // Prevent default behavior
        });

        return () => backHandler.remove(); // Cleanup on unmount or showArchive change
    }, [showArchive]);

    // Show bubble countdown when app goes to background; stop it when app returns
    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState: string) => {
            console.log('[Pomodoro:AppState]', nextState, ' running=', runningRef.current, ' endTimeRef=', endTimeRef.current, ' now=', Date.now());
            if (nextState === 'background' && runningRef.current && endTimeRef.current) {
                const { score, message } = getFallbackBubble();
                const { pomodoroSoundType, pomodoroVolume } = useTaskStore.getState();
                console.log('[Pomodoro:AppState→background] starting native bubble timer, endTime=', endTimeRef.current, ' soundType=', pomodoroSoundType);
                FloatingBubble.startPomodoroTimer(
                    endTimeRef.current,
                    getModeLabel(modeIdxRef.current as PomodoroModeIdx),
                    score,
                    message,
                    pomodoroSoundType,
                    pomodoroVolume,
                );
            } else if (nextState === 'active' && runningRef.current && endTimeRef.current) {
                if (endTimeRef.current > Date.now()) {
                    const { score, message } = getFallbackBubble();
                    console.log('[Pomodoro:AppState→active] timer still running, stopping native bubble countdown');
                    FloatingBubble.stopPomodoroTimer(score, message);
                } else {
                    // Timer already expired in background — native bubble played sound
                    // Suppress JS-side completion path to avoid duplicate sound
                    console.log('[Pomodoro:AppState→active] timer EXPIRED in background — clearing without sound');
                    completedRef.current = false;
                    endTimeRef.current = null;
                    clearPomodoroTimer();
                    setRunning(false);
                    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
                }
            }
        });
        return () => sub.remove();
    }, [getFallbackBubble, clearPomodoroTimer]);

    const handleSelectMode = useCallback((idx: PomodoroModeIdx) => {
        stopTimer();
        setModeIdx(idx);
        if (idx === 3) {
            setCustomTimerSeconds(0);
            setSecondsLeft(0);
        } else {
            setSecondsLeft(getModeSeconds(idx, customTimerSeconds));
        }
    }, [stopTimer, customTimerSeconds, setCustomTimerSeconds]);

    const handleStart = useCallback(async () => {
        const durationSecs = isPaused ? secondsLeft : getModeSeconds(modeIdx, customTimerSeconds);
        const durationMs = durationSecs * 1000;
        const endTime = Date.now() + durationMs;
        endTimeRef.current = endTime;
        console.log('[Pomodoro:handleStart] modeIdx=', modeIdx, ' durationSecs=', durationSecs, ' endTime=', endTime, ' isPaused=', isPaused);

        const durationMinutes = Math.ceil(durationMs / 60000);
        const id = await schedulePomodoroEnd(durationMinutes);
        notifIdRef.current = id;
        console.log('[Pomodoro:handleStart] notifId=', id, ' — setting store + running=true');

        setPomodoroTimer(endTime, modeIdx, id);
        setRunning(true);
    }, [modeIdx, isPaused, secondsLeft, customTimerSeconds, setPomodoroTimer]);

    const handleReset = useCallback(() => {
        stopTimer();
        setSecondsLeft(getModeSeconds(modeIdx, customTimerSeconds));
    }, [stopTimer, modeIdx, customTimerSeconds]);

    const renderTask: ListRenderItem<Task> = useCallback(({ item }) => (
        <TaskCard
            task={item}
            onStatusChange={setStatus}
            onEdit={setEditTask}
            onArchive={archiveTask}
            onOpenStats={setStatsTask}
        />
    ), [setStatus, archiveTask]);

    const renderArchivedTask: ListRenderItem<Task> = useCallback(({ item }) => (
        <ArchivedTaskCard task={item} onRestore={restoreTask} onDelete={deleteTask} onEdit={setEditTask} />
    ), [restoreTask, deleteTask]);

    const timerActive = running && !pomodoroVisible;
    const timerHours = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
    const timerMins = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
    const timerSecs = String(secondsLeft % 60).padStart(2, '0');

    function handleFilterToggle() {
        if (hasActiveFilters) {
            setFilterBarVisible(!filterBarVisible);
        } else {
            setFilterTypeSelectorOpen(true);
        }
    }

    function handleFilterPress(filterType: FilterType) {
        setSelectedFilterType(filterType);
        setFilterModalOpen(true);
    }

    function handleFilterModalClose() {
        setFilterModalOpen(false);
        setSelectedFilterType(null);
    }

    function handleEditSave(id: string, updates: Partial<Task>) {
        updateTask(id, updates);
        setEditTask(null);
    }

    const handleFilterSave = (filterType: FilterType, selectedSet: Set<string>) => {
        const setFilters = useTaskStore.getState();
        if (filterType === 'status') setFilters.setStatusFilters(selectedSet as Set<TaskStatus>);
        if (filterType === 'category') setFilters.setCategoryFilters(selectedSet);
        if (filterType === 'priority') setFilters.setPriorityFilters(selectedSet as Set<PriorityLevel>);
        if (filterType === 'dueDate') setFilters.setDueDateFilters(selectedSet as Set<'overdue' | 'today' | 'upcoming'>);
    };

    if (!hasHydrated) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Image source={appIcon} style={styles.headerIcon} />
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>{showArchive ? 'Archive' : 'DragonFlow'}</Text>
                </View>
                <View style={styles.headerActions}>
                    {!showArchive && (
                        <TouchableOpacity
                            style={focusMode ? styles.focusBtnActive : styles.focusBtn}
                            onPress={() => setFocusMode(!focusMode)}
                        >
                            <Ionicons
                                name={focusMode ? 'flash' : 'flash-outline'}
                                size={20}
                                color={focusMode ? COLORS.primary : COLORS.white}
                            />
                        </TouchableOpacity>
                    )}
                    {!showArchive && (
                        <TouchableOpacity style={styles.filterBtn} onPress={handleFilterToggle}>
                            <Ionicons
                                name={hasActiveFilters && filterBarVisible ? "funnel" : "funnel-outline"}
                                size={20}
                                color={COLORS.white}
                            />
                            {totalFilterCount > 1 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{totalFilterCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={showArchive ? styles.archiveBtnActive : styles.archiveBtn}
                        onPress={() => setShowArchive((v) => !v)}
                    >
                        <Ionicons
                            name={showArchive ? 'chevron-back' : 'archive-outline'}
                            size={20}
                            color={showArchive ? COLORS.primary : COLORS.white}
                        />
                    </TouchableOpacity>
                    {!showArchive && (
                        <TouchableOpacity style={styles.pomodoroBtn} onPress={() => setPomodoroVisible(true)}>
                            {timerActive ? (
                                <Text style={styles.pomodoroBtnTimer}>{parseInt(timerHours) > 0 ? `${timerHours}:${timerMins}:${timerSecs}` : `${timerMins}:${timerSecs}`}</Text>
                            ) : (
                                <Ionicons name="hourglass" size={20} color={COLORS.white} />
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {showArchive ? (
                <FlatList
                    data={archivedTasks}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={archivedTasks.length === 0 ? styles.emptyContainer : styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyEmoji}>📦</Text>
                            <Text style={styles.emptyText}>Archive is empty</Text>
                            <Text style={styles.emptySubtext}>Archived tasks will appear here</Text>
                        </View>
                    }
                    renderItem={renderArchivedTask}
                />
            ) : (
                <>
                    {hasActiveFilters && filterBarVisible && (
                        <FilterBar
                            onFilterPress={handleFilterPress}
                            onAddFilter={() => setFilterTypeSelectorOpen(true)}
                        />
                    )}
                    <FlatList
                        data={tasks}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyEmoji}>🐉</Text>
                                <Text style={styles.emptyText}>No tasks</Text>
                                <Text style={styles.emptySubtext}>Tap + to add your first task</Text>
                            </View>
                        }
                        renderItem={renderTask}
                    />
                    <TouchableOpacity style={[styles.fab, { backgroundColor: themeColorSecondary }]} onPress={() => setAddModalVisible(true)}>
                        <Text style={styles.fabText}>+</Text>
                    </TouchableOpacity>
                </>
            )}

            <FilterTypeSelector
                isOpen={filterTypeSelectorOpen}
                onClose={() => setFilterTypeSelectorOpen(false)}
                onSelect={handleFilterPress}
            />

            <FilterModal
                isOpen={filterModalOpen}
                filterType={selectedFilterType}
                onClose={handleFilterModalClose}
                onSave={handleFilterSave}
            />

            <PomodoroTimer
                isVisible={pomodoroVisible}
                onClose={() => setPomodoroVisible(false)}
                modeIdx={modeIdx}
                secondsLeft={secondsLeft}
                running={running}
                isPaused={isPaused}
                customTimerSeconds={customTimerSeconds}
                onSelectMode={handleSelectMode}
                onSetCustomTimerSeconds={setCustomTimerSeconds}
                onStart={handleStart}
                onPause={() => stopTimer(true)}
                onReset={handleReset}
            />

            <AddTaskModal
                isVisible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                onAdd={addTask}
            />

            <EditTaskModal
                isVisible={editTask !== null}
                task={editTask}
                onClose={() => setEditTask(null)}
                onSave={handleEditSave}
            />

            <DoneStatsModal
                task={statsTask}
                onClose={() => setStatsTask(null)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    containerCentered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: COLORS.primary, paddingHorizontal: 16, height: HEADER_HEIGHT,
        flexDirection: 'row', alignItems: 'center',
    },
    headerIcon: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
    headerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: 'bold' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    filterBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.overlay.whiteSoft, alignItems: 'center', justifyContent: 'center',
    },
    filterBadge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: COLORS.accent.warning, borderRadius: 8, minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    },
    filterBadgeText: { color: COLORS.white, fontSize: 9, fontWeight: '700' },
    archiveBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.overlay.whiteSoft, alignItems: 'center', justifyContent: 'center',
    },
    archiveBtnActive: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    },
    focusBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.overlay.whiteSoft, alignItems: 'center', justifyContent: 'center',
    },
    focusBtnActive: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: COLORS.white, alignItems: 'center', justifyContent: 'center',
    },
    pomodoroBtn: { minWidth: 38, height: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    pomodoroBtnTimer: { fontSize: 13, fontWeight: '700', color: COLORS.white },
    listContent: { paddingBottom: 100 },
    emptyContainer: { flex: 1 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyText: { fontSize: 20, fontWeight: '600', color: COLORS.text.body, marginBottom: 6 },
    emptySubtext: { fontSize: 14, color: COLORS.text.placeholder },
    fab: {
        position: 'absolute', right: 20, bottom: 30,
        backgroundColor: COLORS.primary, width: 60, height: 60,
        borderRadius: 30, justifyContent: 'center', alignItems: 'center',
        shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
        elevation: 6,
        borderWidth: 2, borderColor: COLORS.primary,
    },
    fabText: { color: COLORS.white, fontSize: 30, lineHeight: 34 },
});
