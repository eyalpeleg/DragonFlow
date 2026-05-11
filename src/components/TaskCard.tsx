import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import { getCategoryColor, getCategoryName, useTaskStore } from '../store/taskStore';
import { Task, TaskStatus } from '../types';
import TaskChecklist from './TaskChecklist';

interface Props {
    task: Task;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onEdit: (task: Task) => void;
    onArchive: (id: string) => void;
    onOpenStats: (task: Task) => void;
}

export default function TaskCard({ task, onStatusChange, onEdit, onArchive, onOpenStats }: Props) {
    const categories = useTaskStore((s) => s.categories);
    const { id, title, description, priority, categoryId, dueDate, status, recurrence, subTasks = [] } = task;
    const categoryColor = getCategoryColor(categories, categoryId);
    const categoryName = getCategoryName(categories, categoryId);
    const isRecurring = !!recurrence;

    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = status !== 'Done' && dueDate && dueDate < today;
    const isDueToday = status !== 'Done' && dueDate === today;

    const displayDate = dueDate
        ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

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

    return (
        <TouchableOpacity
            activeOpacity={status === 'Done' ? 0.7 : 1}
            onPress={status === 'Done' ? () => onOpenStats(task) : undefined}
        >
            <View style={[
                styles.card,
                { borderLeftColor: categoryColor },
                isRecurring && styles.cardRecurring,
                status === 'Done' && styles.cardDone,
                isDueToday && styles.cardDueToday,
            ]}>
                <View style={styles.topRow}>
                    <Text style={[styles.title, status === 'Done' && styles.titleDone]} numberOfLines={2}>{title}</Text>
                    <View style={styles.actions}>
                        {status === 'Done' && (
                            <TouchableOpacity onPress={() => onOpenStats(task)} style={styles.actionBtn}>
                                <Ionicons name="stats-chart" size={15} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => onEdit(task)} style={styles.actionBtn}>
                            <Ionicons name="pencil-sharp" size={15} color="#000" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onArchive(id)} style={styles.actionBtn}>
                            <Ionicons name={status === 'Done' ? 'archive' : 'trash'} size={15} color="#F44336" />
                        </TouchableOpacity>
                    </View>
                </View>
                {!!description && <Text style={styles.desc} numberOfLines={2}>{description}</Text>}

                <View style={styles.footer}>
                    <View style={styles.footerLeft}>
                        <View style={[styles.badge, { backgroundColor: COLORS.status[status] }]}>
                            <Text style={styles.badgeText}>{status}</Text>
                        </View>
                        <Text style={[styles.priority, { color: COLORS.priority[priority] }]}>{priority}</Text>
                        <View style={[styles.catChip, { backgroundColor: categoryColor }]}>
                            <Text style={styles.catChipText}>{categoryName}</Text>
                        </View>
                        {displayDate && (
                            <View style={styles.dueDateRow}>
                                <Text style={[styles.dueDate, isOverdue && styles.dueDateOverdue, isDueToday && styles.dueDateToday]}>
                                    {isOverdue ? '⚠ ' : ''}{isDueToday ? 'Today' : displayDate}
                                </Text>
                                {isRecurring && (
                                    <Ionicons name="repeat" size={12} color={COLORS.primary} />
                                )}
                            </View>
                        )}
                        {!displayDate && isRecurring && (
                            <Ionicons name="repeat" size={12} color={COLORS.primary} />
                        )}
                    </View>
                    {status === 'Ready' && (
                        <TouchableOpacity
                            style={[styles.statusIconBtn, { backgroundColor: COLORS.status['In Progress'] }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Ionicons name="play" size={14} color="white" />
                        </TouchableOpacity>
                    )}
                    {status === 'In Progress' && (
                        <View style={styles.statusBtnGroup}>
                            <TouchableOpacity
                                style={[styles.statusIconBtn, { backgroundColor: COLORS.status['Paused'] }]}
                                onPress={() => onStatusChange(id, 'Paused')}
                            >
                                <Ionicons name="pause" size={14} color="white" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.statusIconBtn, { backgroundColor: COLORS.status['Done'] }]}
                                onPress={() => onStatusChange(id, 'Done')}
                            >
                                <Ionicons name="checkmark" size={16} color="white" />
                            </TouchableOpacity>
                        </View>
                    )}
                    {status === 'Paused' && (
                        <TouchableOpacity
                            style={[styles.statusIconBtn, { backgroundColor: COLORS.status['In Progress'] }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Ionicons name="play" size={14} color="white" />
                        </TouchableOpacity>
                    )}
                    {status === 'Done' && (
                        <TouchableOpacity
                            style={[styles.statusBtn, { backgroundColor: COLORS.status['In Progress'] }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Text style={styles.statusBtnText}>↩ Reopen</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {subTasks.length > 0 && (
                    <TaskChecklist
                        taskId={id}
                        subTasks={subTasks}
                        taskStatus={status}
                        onAllDone={handleAllSubTasksDone}
                    />
                )}

                {status === 'Done' && (
                    <Text style={styles.tapHint}>Tap card for stats →</Text>
                )}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff', padding: 14, marginVertical: 5, marginHorizontal: 12,
        borderRadius: 12, borderLeftWidth: 5, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
    },
    cardRecurring: {
        borderLeftWidth: 5,
        borderTopWidth: 1,
        borderTopColor: COLORS.primary + '44',
    },
    cardDone: { opacity: 0.65 },
    cardDueToday: {
        borderTopWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
        borderTopColor: '#E53935', borderRightColor: '#E53935', borderBottomColor: '#E53935',
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: { padding: 4 },
    title: { fontSize: 16, fontWeight: '600', color: '#222', flex: 1, marginRight: 8 },
    titleDone: { textDecorationLine: 'line-through', color: '#999' },
    desc: { fontSize: 13, color: '#777', marginBottom: 8 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
    priority: { fontSize: 11, fontWeight: '700' },
    catChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    catChipText: { fontSize: 10, color: 'white', fontWeight: '600' },
    dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dueDate: { fontSize: 11, color: '#888' },
    dueDateOverdue: { color: '#F44336', fontWeight: '600' },
    dueDateToday: { color: '#E53935', fontWeight: '700' },
    statusBtnGroup: { flexDirection: 'row', gap: 6 },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
    statusIconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    statusBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
    tapHint: { fontSize: 10, color: COLORS.primary, marginTop: 6, opacity: 0.7, textAlign: 'right' },
});
