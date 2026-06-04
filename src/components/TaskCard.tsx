import { AntDesign, Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { getCategoryColor, getCategoryName, useTaskStore } from '../store/appStore';
import { Task, TaskStatus } from '../types';
import TaskChecklist from './TaskChecklist';
import type { EditFocus } from './EditTaskModal';

const DOUBLE_TAP_MS = 280;

interface Props {
    task: Task;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onEdit: (task: Task, focus?: EditFocus) => void;
    onDelete: (id: string) => void;
    onOpenStats: (task: Task) => void;
}

export default function TaskCard({ task, onStatusChange, onEdit, onDelete, onOpenStats }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const statusBarColors = useMemo<Record<TaskStatus, string>>(() => colors.statusSoft, [colors]);
    const categories = useTaskStore((s) => s.categories);
    const togglePin = useTaskStore((s) => s.togglePin);
    const { id, title, description, priority, categoryId, dueDate, status, recurrence, subTasks = [], pinned } = task;
    const categoryColor = getCategoryColor(categories, categoryId);
    const categoryName = getCategoryName(categories, categoryId);
    const isRecurring = !!recurrence;

    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const isOverdue = status !== 'Done' && dueDate && dueDate < today;
    const isDueToday = status !== 'Done' && dueDate === today;
    const isDueTomorrow = status !== 'Done' && dueDate === tomorrow;
    const isUrgent = priority === 'Critical' || priority === 'High';

    const displayDate = dueDate
        ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    function handleDeletePress() {
        Alert.alert(
            'Delete Task',
            `Delete "${title}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
            ]
        );
    }

    function handleAllSubTasksDone() {
        Alert.alert(
            'All sub-tasks done!',
            'Mark this task as complete?',
            [
                { text: 'Not yet', style: 'cancel' },
                { text: 'Complete', onPress: () => onStatusChange(id, 'Done') },
            ]
        );
    }

    const lastTapRef = useRef<number>(0);
    const pendingSingleTapRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleCardPress() {
        const now = Date.now();
        const isDoubleTap = now - lastTapRef.current < DOUBLE_TAP_MS;
        if (isDoubleTap) {
            lastTapRef.current = 0;
            if (pendingSingleTapRef.current) {
                clearTimeout(pendingSingleTapRef.current);
                pendingSingleTapRef.current = null;
            }
            onEdit(task);
            return;
        }
        lastTapRef.current = now;
        if (status === 'Done') {
            pendingSingleTapRef.current = setTimeout(() => {
                pendingSingleTapRef.current = null;
                onOpenStats(task);
            }, DOUBLE_TAP_MS);
        }
    }

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={handleCardPress}
        >
            <View style={[styles.card, { borderLeftColor: statusBarColors[status] }, status === 'Done' && styles.cardDone]}>
                <View style={styles.topRow}>
                    <Text style={[styles.title, status === 'Done' && styles.titleDone]} numberOfLines={2}>{title}</Text>
                    <View style={styles.actions}>
                        {status === 'Done' && (
                            <TouchableOpacity onPress={() => onOpenStats(task)} style={styles.actionBtn}>
                                <Ionicons name="stats-chart" size={15} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        {status !== 'Done' && (
                            <TouchableOpacity onPress={() => togglePin(id)} style={styles.actionBtn}>
                                <AntDesign
                                    name="pushpin"
                                    size={15}
                                    color={pinned ? colors.primary : colors.text.disabled}
                                />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={handleDeletePress} style={styles.actionBtn}>
                            <Ionicons name="trash" size={15} color={colors.text.error} />
                        </TouchableOpacity>
                    </View>
                </View>
                {!!description && <Text style={styles.desc} numberOfLines={2}>{description}</Text>}

                <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                        <View style={styles.metaItem}>
                            <View style={[styles.catDot, { backgroundColor: categoryColor }]} />
                            <Text style={styles.meta}>{categoryName}</Text>
                        </View>
                        <Text style={[styles.meta, isUrgent && styles.metaUrgent]}>{priority}</Text>
                        {isOverdue && (
                            <View style={styles.overdueBadge}>
                                <Text style={styles.overdueBadgeText}>Overdue</Text>
                            </View>
                        )}
                        {displayDate && (
                            <View style={styles.metaItem}>
                                <Text style={[
                                    styles.meta,
                                    isDueToday && styles.metaAlertBold,
                                    isDueTomorrow && styles.metaSoon,
                                ]}>
                                    {isDueToday ? 'Today' : isDueTomorrow ? 'Tomorrow' : displayDate}
                                </Text>
                                {isRecurring && (
                                    <AntDesign name="sync" size={12} color={colors.text.light} style={styles.recurIcon} />
                                )}
                            </View>
                        )}
                        {!displayDate && isRecurring && (
                            <AntDesign name="sync" size={12} color={colors.text.light} />
                        )}
                    </View>
                    {status === 'Ready' && (
                        <TouchableOpacity
                            style={[styles.statusIconBtn, { backgroundColor: colors.secondary }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Ionicons name="play" size={14} color={colors.white} />
                        </TouchableOpacity>
                    )}
                    {status === 'In Progress' && (
                        <View style={styles.statusBtnGroup}>
                            <TouchableOpacity
                                style={[styles.statusIconBtn, styles.statusIconBtnMuted]}
                                onPress={() => onStatusChange(id, 'Paused')}
                            >
                                <Ionicons name="pause" size={14} color={colors.text.subtle} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.statusIconBtn, { backgroundColor: colors.action }]}
                                onPress={() => onStatusChange(id, 'Done')}
                            >
                                <Ionicons name="checkmark" size={16} color={colors.white} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {status === 'Paused' && (
                        <TouchableOpacity
                            style={[styles.statusIconBtn, { backgroundColor: colors.secondary }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Ionicons name="play" size={14} color={colors.white} />
                        </TouchableOpacity>
                    )}
                    {status === 'Done' && (
                        <TouchableOpacity
                            style={styles.reopenBtn}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Text style={styles.reopenBtnText}>↩ Reopen</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {subTasks.length > 0 && (
                    <TaskChecklist
                        taskId={id}
                        subTasks={subTasks}
                        taskStatus={status}
                        onAllDone={handleAllSubTasksDone}
                        onRequestAddSubTask={() => onEdit(task, 'subTask')}
                    />
                )}

                {status === 'Done' && (
                    <Text style={styles.tapHint}>Tap for stats · double-tap to edit</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    card: {
        backgroundColor: c.surface, padding: 14, marginVertical: 5, marginHorizontal: 12,
        borderRadius: 12, borderLeftWidth: 4, elevation: 1,
        shadowColor: c.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    },
    cardDone: { opacity: 0.6 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: { padding: 4 },
    title: { fontSize: 16, fontWeight: '600', color: c.text.primary, flex: 1, marginRight: 8 },
    titleDone: { textDecorationLine: 'line-through', color: c.text.placeholder },
    desc: { fontSize: 13, color: c.text.weak, marginBottom: 8 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    catDot: { width: 7, height: 7, borderRadius: 4 },
    meta: { fontSize: 12, color: c.text.weak },
    metaUrgent: { color: c.text.errorStrong, fontWeight: '600' },
    metaAlertBold: { color: c.text.errorStrong, fontWeight: '700' },
    metaSoon: { color: c.accent.warning, fontWeight: '600' },
    overdueBadge: { backgroundColor: c.text.error, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    overdueBadgeText: { color: c.white, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    recurIcon: { marginLeft: 2 },
    statusBtnGroup: { flexDirection: 'row', gap: 6 },
    statusIconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    statusIconBtnPrimary: { backgroundColor: c.primary },
    statusIconBtnMuted: { backgroundColor: c.surfaceAlt.soft },
    reopenBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: c.primary },
    reopenBtnText: { color: c.primary, fontSize: 12, fontWeight: '600' },
    tapHint: { fontSize: 10, color: c.text.light, marginTop: 6, textAlign: 'right' },
});
