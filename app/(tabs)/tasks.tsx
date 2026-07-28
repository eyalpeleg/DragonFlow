import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, FlatList, ListRenderItem, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import AddTaskModal from '@/src/components/AddTaskModal';
import TaskReflectionCard from '@/src/components/TaskReflectionCard';
import DoneStatsModal from '@/src/components/DoneStatsModal';
import EditTaskModal, { EditFocus } from '@/src/components/EditTaskModal';
import FilterModal from '@/src/components/FilterModal';
import TaskCard from '@/src/components/TaskCard';
import { AppColors } from '@/src/styles/theme';
import { useColors } from '@/src/styles/useColors';
import { useArchivedTasks, useTaskStore, useSortedFilteredTasks } from '@/src/store/appStore';
import FloatingBubble from '@/src/modules/FloatingBubble';
import { useShareIntent } from '@/src/hooks/useShareIntent';
import { Task, TaskStatus } from '@/src/types';


const HEADER_HEIGHT = 56;
const appIcon = require('@/assets/images/dragonflow3.png');

const handleFilterSave = (_filterType: string, selectedSet: Set<string>) => {
    useTaskStore.getState().setCategoryFilters(selectedSet);
};

function getTodayAndTomorrow(): { today: string; tomorrow: string } {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    return { today, tomorrow };
}

export default function TasksScreen() {
    const colors = useColors();
    const styles = makeStyles(colors);
    const { addTask, updateTask, deleteTask, setStatus, hasHydrated } = useTaskStore();
    const reflectOnDone = useTaskStore((s) => s.reflectOnDone);
    const tasks = useSortedFilteredTasks();
    const archivedTasks = useArchivedTasks();
    const [addModalVisible, setAddModalVisible] = useState(false);
    // Shared-text target: open the Add Task modal pre-filled when text is shared in.
    const { prefill, clearPrefill } = useShareIntent();
    useEffect(() => {
        if (prefill) setAddModalVisible(true);
    }, [prefill]);
    const [editTask, setEditTask] = useState<Task | null>(null);
    const [editFocus, setEditFocus] = useState<EditFocus | undefined>(undefined);
    const [statsTask, setStatsTask] = useState<Task | null>(null);
    const [showArchive, setShowArchive] = useState(false);
    const [filterModalOpen, setFilterModalOpen] = useState(false);

    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const focusMode = useTaskStore((s) => s.focusMode);
    const setFocusMode = useTaskStore((s) => s.setFocusMode);
    const categoryFilterCount = categoryFilters.size;
    const hasCategoryFilter = categoryFilterCount > 0;

    useEffect(() => {
        if (!showArchive) return;
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            setShowArchive(false);
            return true;
        });
        return () => backHandler.remove();
    }, [showArchive]);

    useEffect(() => {
        const closeAllModals = () => {
            setAddModalVisible(false);
            setEditTask(null);
            setEditFocus(undefined);
            setStatsTask(null);
            setFilterModalOpen(false);
        };
        const unsubscribeOpenFocus = FloatingBubble.onOpenFocus(closeAllModals);
        const appStateSub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') closeAllModals();
        });
        return () => {
            unsubscribeOpenFocus();
            appStateSub.remove();
        };
    }, []);

    const openEdit = (task: Task, focus?: EditFocus) => {
        setEditFocus(focus);
        setEditTask(task);
    };

    const handleStatusChange = (id: string, status: TaskStatus) => {
        const prior = useTaskStore.getState().tasks.find((t) => t.id === id);
        setStatus(id, status);
        if (status === 'Done' && prior && prior.status !== 'Done' && reflectOnDone) {
            const updated = useTaskStore.getState().tasks.find((t) => t.id === id);
            if (updated) setStatsTask(updated);
        }
    };

    const { today, tomorrow } = getTodayAndTomorrow();

    const renderTask: ListRenderItem<Task> = ({ item }) => (
        <TaskCard
            task={item}
            today={today}
            tomorrow={tomorrow}
            onStatusChange={handleStatusChange}
            onEdit={openEdit}
            onDelete={deleteTask}
            onOpenStats={setStatsTask}
        />
    );

    const reopenTask = (id: string) => setStatus(id, 'In Progress');

    const renderArchivedTask: ListRenderItem<Task> = ({ item }) => (
        <TaskReflectionCard
            task={item}
            onRestore={reopenTask}
            onDelete={deleteTask}
            onEdit={(t) => openEdit(t)}
            onOpenStats={setStatsTask}
        />
    );

    function handleFilterToggle() {
        setFilterModalOpen(true);
    }

    function handleFilterModalClose() {
        setFilterModalOpen(false);
    }

    function handleEditSave(id: string, updates: Partial<Task>) {
        updateTask(id, updates);
        setEditTask(null);
        setEditFocus(undefined);
    }

    function handleEditClose() {
        setEditTask(null);
        setEditFocus(undefined);
    }

    if (!hasHydrated) {
        return (
            <SafeAreaView style={styles.containerCentered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Image source={appIcon} style={styles.headerIcon} />
                <View style={styles.headerContent}>
                    {showArchive && <Text style={styles.headerTitle}>Archive</Text>}
                </View>
                <View style={styles.headerActions}>
                    {!showArchive && (
                        <Pressable
                            style={({ pressed }) => [focusMode ? styles.focusBtnActive : styles.focusBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => setFocusMode(!focusMode)}
                        >
                            <Ionicons
                                name={focusMode ? 'flash' : 'flash-outline'}
                                size={20}
                                color={focusMode ? colors.primary : colors.white}
                            />
                        </Pressable>
                    )}
                    {!showArchive && (
                        <Pressable
                            style={({ pressed }) => [styles.filterBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleFilterToggle}
                            accessibilityLabel="Filter by category"
                        >
                            <Ionicons
                                name={hasCategoryFilter ? 'folder' : 'folder-outline'}
                                size={20}
                                color={colors.white}
                            />
                            {categoryFilterCount > 0 && (
                                <View style={styles.filterBadge}>
                                    <Text style={styles.filterBadgeText}>{categoryFilterCount}</Text>
                                </View>
                            )}
                        </Pressable>
                    )}
                    <Pressable
                        style={({ pressed }) => [showArchive ? styles.archiveBtnActive : styles.archiveBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => setShowArchive((v) => !v)}
                    >
                        <Ionicons
                            name={showArchive ? 'chevron-back' : 'archive-outline'}
                            size={20}
                            color={showArchive ? colors.primary : colors.white}
                        />
                    </Pressable>
                    {!showArchive && (
                        <Pressable
                            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
                            onPress={() => setAddModalVisible(true)}
                            accessibilityLabel="Add task"
                        >
                            <Ionicons name="add" size={24} color={colors.white} />
                        </Pressable>
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
                        keyboardShouldPersistTaps="handled"
                        automaticallyAdjustKeyboardInsets
                    />
                </>
            )}

            <FilterModal
                key={`filter-${filterModalOpen ? 'open' : 'closed'}`}
                isOpen={filterModalOpen}
                filterType="category"
                onClose={handleFilterModalClose}
                onSave={handleFilterSave}
            />

            <AddTaskModal
                key={`add-${addModalVisible ? 'open' : 'closed'}`}
                isVisible={addModalVisible}
                onClose={() => { setAddModalVisible(false); clearPrefill(); }}
                onAdd={addTask}
                initialTitle={prefill?.title}
                initialDescription={prefill?.description}
            />

            <EditTaskModal
                key={`edit-${editTask?.id ?? 'none'}`}
                isVisible={editTask !== null}
                task={editTask}
                initialFocus={editFocus}
                onClose={handleEditClose}
                onSave={handleEditSave}
            />

            <DoneStatsModal
                key={`stats-${statsTask?.id ?? 'none'}`}
                task={statsTask}
                onClose={() => setStatsTask(null)}
            />
        </SafeAreaView>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    containerCentered: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: c.primary, paddingHorizontal: 16, height: HEADER_HEIGHT,
        flexDirection: 'row', alignItems: 'center',
    },
    headerIcon: { width: 50, height: 50, borderRadius: 6, marginRight: 12 },
    headerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: c.white, fontSize: 20, fontWeight: 'bold' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    filterBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.overlay.whiteSoft, alignItems: 'center', justifyContent: 'center',
    },
    filterBadge: {
        position: 'absolute', top: -2, right: -2,
        backgroundColor: c.accent.warning, borderRadius: 8, minWidth: 16, height: 16,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2,
    },
    filterBadgeText: { color: c.white, fontSize: 9, fontWeight: '700' },
    archiveBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.overlay.whiteSoft, alignItems: 'center', justifyContent: 'center',
    },
    archiveBtnActive: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.white, alignItems: 'center', justifyContent: 'center',
    },
    focusBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.overlay.whiteSoft, alignItems: 'center', justifyContent: 'center',
    },
    focusBtnActive: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.white, alignItems: 'center', justifyContent: 'center',
    },
    listContent: { paddingBottom: 100 },
    emptyContainer: { flex: 1 },
    emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
    emptyEmoji: { fontSize: 60, marginBottom: 16 },
    emptyText: { fontSize: 20, fontWeight: '600', color: c.text.body, marginBottom: 6 },
    emptySubtext: { fontSize: 14, color: c.text.placeholder },
    addBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: c.secondary, alignItems: 'center', justifyContent: 'center',
    },
});
