import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddTaskModal from '@/src/components/AddTaskModal';
import ArchivedTaskCard from '@/src/components/ArchivedTaskCard';
import EditTaskModal from '@/src/components/EditTaskModal';
import PomodoroTimer, { POMODORO_MODES, PomodoroModeIdx } from '@/src/components/PomodoroTimer';
import TaskCard from '@/src/components/TaskCard';
import TaskFilters from '@/src/components/TaskFilters';
import { COLORS } from '@/src/styles/theme';
import { useArchivedTasks, useTaskStore, useSortedFilteredTasks } from '@/src/store/taskStore';
import { cancelPomodoroNotification, schedulePomodoroEnd } from '@/src/utils/notifications';
import { Task } from '@/src/types';

export default function TasksScreen() {
    const { addTask, updateTask, deleteTask, archiveTask, restoreTask, setStatus, hasHydrated } = useTaskStore();
    const tasks = useSortedFilteredTasks();
    const archivedTasks = useArchivedTasks();
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [editTask, setEditTask] = useState<Task | null>(null);
    const [pomodoroVisible, setPomodoroVisible] = useState(false);
    const [showArchive, setShowArchive] = useState(false);

    // Timer state lives here so it survives modal close/open
    const [modeIdx, setModeIdx] = useState<PomodoroModeIdx>(0);
    const [secondsLeft, setSecondsLeft] = useState(POMODORO_MODES[0].minutes * 60);
    const [running, setRunning] = useState(false);
    const notifIdRef = useRef<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopTimer = useCallback(() => {
        setRunning(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        if (notifIdRef.current) { cancelPomodoroNotification(notifIdRef.current); notifIdRef.current = null; }
    }, []);

    useEffect(() => {
        if (!running) return;
        intervalRef.current = setInterval(() => {
            setSecondsLeft((s) => {
                if (s <= 1) { stopTimer(); return 0; }
                return s - 1;
            });
        }, 1000);
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [running, stopTimer]);

    const handleSelectMode = useCallback((idx: PomodoroModeIdx) => {
        stopTimer();
        setModeIdx(idx);
        setSecondsLeft(POMODORO_MODES[idx].minutes * 60);
    }, [stopTimer]);

    const handleStart = useCallback(async () => {
        const id = await schedulePomodoroEnd(POMODORO_MODES[modeIdx].minutes);
        notifIdRef.current = id;
        setRunning(true);
    }, [modeIdx]);

    const handleReset = useCallback(() => {
        stopTimer();
        setSecondsLeft(POMODORO_MODES[modeIdx].minutes * 60);
    }, [stopTimer, modeIdx]);

    // Show ⏱ badge in header when timer is running but modal is closed
    const timerActive = running && !pomodoroVisible;
    const timerMins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const timerSecs = String(secondsLeft % 60).padStart(2, '0');

    if (!hasHydrated) {
        return (
            <SafeAreaView style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>{showArchive ? 'Archive' : 'DragonFlow'}</Text>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.archiveBtn, showArchive && styles.archiveBtnActive]}
                        onPress={() => setShowArchive((v) => !v)}
                    >
                        <Ionicons name="archive-outline" size={20} color={showArchive ? COLORS.primary : 'white'} />
                        {archivedTasks.length > 0 && (
                            <View style={styles.archiveBadge}>
                                <Text style={styles.archiveBadgeText}>{archivedTasks.length}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {!showArchive && (
                        <TouchableOpacity style={styles.pomodoroBtn} onPress={() => setPomodoroVisible(true)}>
                            {timerActive ? (
                                <Text style={styles.pomodoroBtnTimer}>{timerMins}:{timerSecs}</Text>
                            ) : (
                                <Text style={styles.pomodoroBtnText}>⏱</Text>
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
                    renderItem={({ item }) => (
                        <ArchivedTaskCard
                            task={item}
                            onRestore={restoreTask}
                            onDelete={deleteTask}
                        />
                    )}
                />
            ) : (
                <>
                    <TaskFilters />
                    <FlatList
                        data={tasks}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyState}>
                                <Text style={styles.emptyEmoji}>🐉</Text>
                                <Text style={styles.emptyText}>No tasks yet</Text>
                                <Text style={styles.emptySubtext}>Tap + to add your first task</Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <TaskCard
                                task={item}
                                onStatusChange={setStatus}
                                onEdit={(t) => setEditTask(t)}
                                onArchive={archiveTask}
                            />
                        )}
                    />
                    <TouchableOpacity style={styles.fab} onPress={() => setAddModalVisible(true)}>
                        <Text style={styles.fabText}>+</Text>
                    </TouchableOpacity>
                </>
            )}

            <PomodoroTimer
                isVisible={pomodoroVisible}
                onClose={() => setPomodoroVisible(false)}
                modeIdx={modeIdx}
                secondsLeft={secondsLeft}
                running={running}
                onSelectMode={handleSelectMode}
                onStart={handleStart}
                onPause={stopTimer}
                onReset={handleReset}
            />

            <AddTaskModal
                isVisible={addModalVisible}
                onClose={() => setAddModalVisible(false)}
                onAdd={(input) => addTask(input)}
            />

            <EditTaskModal
                isVisible={editTask !== null}
                task={editTask}
                onClose={() => setEditTask(null)}
                onSave={(id, updates) => {
                    updateTask(id, updates);
                    setEditTask(null);
                }}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.background },
    centered: { justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    archiveBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
    },
    archiveBtnActive: { backgroundColor: 'white' },
    archiveBadge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: '#E53935', borderRadius: 8, minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    },
    archiveBadgeText: { color: 'white', fontSize: 9, fontWeight: '700' },
    pomodoroBtn: { minWidth: 38, height: 38, borderRadius: 19, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    pomodoroBtnText: { fontSize: 20 },
    pomodoroBtnTimer: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
    listContent: { paddingBottom: 100 },
    emptyContainer: { flex: 1 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyText: { fontSize: 20, fontWeight: '600', color: '#444', marginBottom: 6 },
    emptySubtext: { fontSize: 14, color: '#999' },
    fab: {
        position: 'absolute', right: 20, bottom: 30,
        backgroundColor: COLORS.primary, width: 60, height: 60,
        borderRadius: 30, justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
        elevation: 6,
    },
    fabText: { color: 'white', fontSize: 30, lineHeight: 34 },
});
