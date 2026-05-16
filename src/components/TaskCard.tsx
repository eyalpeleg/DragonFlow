import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import { getCategoryColor, getCategoryName, useTaskStore } from '../store/appStore';
import { Task, TaskStatus } from '../types';
import TaskChecklist from './TaskChecklist';

interface Props {
    task: Task;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onEdit: (task: Task) => void;
    onArchive: (id: string) => void;
    onOpenStats: (task: Task) => void;
}

const STATUS_BAR_COLORS: Record<TaskStatus, string> = COLORS.statusSoft;

export default function TaskCard({ task, onStatusChange, onEdit, onArchive, onOpenStats }: Props) {
    const categories = useTaskStore((s) => s.categories);
    const { id, title, description, priority, categoryId, dueDate, status, recurrence, subTasks = [] } = task;
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
            <View style={[styles.card, { borderLeftColor: STATUS_BAR_COLORS[status] }, status === 'Done' && styles.cardDone]}>
                <View style={styles.topRow}>
                    <Text style={[styles.title, status === 'Done' && styles.titleDone]} numberOfLines={2}>{title}</Text>
                    <View style={styles.actions}>
                        {status === 'Done' && (
                            <TouchableOpacity onPress={() => onOpenStats(task)} style={styles.actionBtn}>
                                <Ionicons name="stats-chart" size={15} color={COLORS.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => onEdit(task)} style={styles.actionBtn}>
                            <Ionicons name="pencil-sharp" size={15} color={COLORS.text.subtle} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => onArchive(id)} style={styles.actionBtn}>
                            <Ionicons
                                name={status === 'Done' ? 'archive' : 'trash'}
                                size={15}
                                color={status === 'Done' ? COLORS.text.light : COLORS.text.error}
                            />
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
                                    <Ionicons name="repeat" size={12} color={COLORS.text.light} style={styles.recurIcon} />
                                )}
                            </View>
                        )}
                        {!displayDate && isRecurring && (
                            <Ionicons name="repeat" size={12} color={COLORS.text.light} />
                        )}
                    </View>
                    {status === 'Ready' && (
                        <TouchableOpacity
                            style={[styles.statusIconBtn, { backgroundColor: COLORS.secondary }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Ionicons name="play" size={14} color={COLORS.white} />
                        </TouchableOpacity>
                    )}
                    {status === 'In Progress' && (
                        <View style={styles.statusBtnGroup}>
                            <TouchableOpacity
                                style={[styles.statusIconBtn, styles.statusIconBtnMuted]}
                                onPress={() => onStatusChange(id, 'Paused')}
                            >
                                <Ionicons name="pause" size={14} color={COLORS.text.subtle} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.statusIconBtn, { backgroundColor: COLORS.action }]}
                                onPress={() => onStatusChange(id, 'Done')}
                            >
                                <Ionicons name="checkmark" size={16} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                    )}
                    {status === 'Paused' && (
                        <TouchableOpacity
                            style={[styles.statusIconBtn, { backgroundColor: COLORS.secondary }]}
                            onPress={() => onStatusChange(id, 'In Progress')}
                        >
                            <Ionicons name="play" size={14} color={COLORS.white} />
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
        backgroundColor: COLORS.surface, padding: 14, marginVertical: 5, marginHorizontal: 12,
        borderRadius: 12, borderLeftWidth: 4, elevation: 1,
        shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    },
    cardDone: { opacity: 0.6 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: { padding: 4 },
    title: { fontSize: 16, fontWeight: '600', color: COLORS.text.primary, flex: 1, marginRight: 8 },
    titleDone: { textDecorationLine: 'line-through', color: COLORS.text.placeholder },
    desc: { fontSize: 13, color: COLORS.text.weak, marginBottom: 8 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    catDot: { width: 7, height: 7, borderRadius: 4 },
    meta: { fontSize: 12, color: COLORS.text.weak },
    metaUrgent: { color: COLORS.text.errorStrong, fontWeight: '600' },
    metaAlertBold: { color: COLORS.text.errorStrong, fontWeight: '700' },
    metaSoon: { color: COLORS.accent.warning, fontWeight: '600' },
    overdueBadge: { backgroundColor: COLORS.text.error, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
    overdueBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
    recurIcon: { marginLeft: 2 },
    statusBtnGroup: { flexDirection: 'row', gap: 6 },
    statusIconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    statusIconBtnPrimary: { backgroundColor: COLORS.primary },
    statusIconBtnMuted: { backgroundColor: COLORS.surfaceAlt.soft },
    reopenBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primary },
    reopenBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: '600' },
    tapHint: { fontSize: 10, color: COLORS.text.light, marginTop: 6, textAlign: 'right' },
});
