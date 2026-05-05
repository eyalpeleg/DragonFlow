import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import { getCategoryColor, useTaskStore } from '../store/taskStore';
import { Task, TaskStatus } from '../types';

interface Props {
    task: Task;
    onStatusChange: (id: string, status: TaskStatus) => void;
    onEdit: (task: Task) => void;
    onArchive: (id: string) => void;
}

function useElapsed(startTime?: number, active?: boolean) {
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!active || !startTime) { setElapsed(0); return; }
        const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 60000));
        tick();
        const id = setInterval(tick, 60000);
        return () => clearInterval(id);
    }, [startTime, active]);
    return elapsed;
}

export default function TaskCard({ task, onStatusChange, onEdit, onArchive }: Props) {
    const categories = useTaskStore((s) => s.categories);
    const { id, title, description, priority, category, dueDate, status, startTime } = task;
    const categoryColor = getCategoryColor(categories, category);
    const isActive = status === 'In Progress';
    const elapsed = useElapsed(startTime, isActive);

    const today = new Date().toISOString().slice(0, 10);
    const isOverdue = status !== 'Done' && dueDate && dueDate < today;
    const isDueToday = status !== 'Done' && dueDate === today;

    const displayDate = dueDate
        ? new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : null;

    return (
        <View style={[styles.card, { borderLeftColor: categoryColor }, status === 'Done' && styles.cardDone, isDueToday && styles.cardDueToday]}>
            <View style={styles.topRow}>
                <View style={[styles.badge, { backgroundColor: COLORS.status[status] }]}>
                    <Text style={styles.badgeText}>{status}</Text>
                </View>
                <View style={styles.actions}>
                    <TouchableOpacity onPress={() => onEdit(task)} style={styles.actionBtn}>
                        <Ionicons name="pencil" size={15} color="#888" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onArchive(id)} style={styles.actionBtn}>
                        <Ionicons name="archive-outline" size={15} color="#ccc" />
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={[styles.title, status === 'Done' && styles.titleDone]} numberOfLines={2}>{title}</Text>
            {!!description && <Text style={styles.desc} numberOfLines={2}>{description}</Text>}

            <View style={styles.footer}>
                <View style={styles.footerLeft}>
                    <Text style={[styles.priority, { color: COLORS.priority[priority] }]}>{priority}</Text>
                    <View style={[styles.catChip, { backgroundColor: categoryColor }]}>
                        <Text style={styles.catChipText}>{category}</Text>
                    </View>
                    {displayDate && (
                        <Text style={[styles.dueDate, isOverdue && styles.dueDateOverdue, isDueToday && styles.dueDateToday]}>
                            {isOverdue ? '⚠ ' : ''}{isDueToday ? 'Today' : displayDate}
                        </Text>
                    )}
                    {isActive && elapsed > 0 && (
                        <Text style={styles.timer}>⏱ {elapsed}m</Text>
                    )}
                </View>
                {status === 'Ready' && (
                    <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: COLORS.status['In Progress'] }]}
                        onPress={() => onStatusChange(id, 'In Progress')}
                    >
                        <Text style={styles.statusBtnText}>Start</Text>
                    </TouchableOpacity>
                )}
                {status === 'In Progress' && (
                    <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: COLORS.status['Done'] }]}
                        onPress={() => onStatusChange(id, 'Done')}
                    >
                        <Text style={styles.statusBtnText}>Done ✓</Text>
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
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff', padding: 14, marginVertical: 5, marginHorizontal: 12,
        borderRadius: 12, borderLeftWidth: 5, elevation: 2,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
    },
    cardDone: { opacity: 0.6 },
    cardDueToday: {
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderTopColor: '#E53935',
        borderRightColor: '#E53935',
        borderBottomColor: '#E53935',
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },
    actions: { flexDirection: 'row', gap: 6 },
    actionBtn: { padding: 4 },
    title: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 4 },
    titleDone: { textDecorationLine: 'line-through', color: '#999' },
    desc: { fontSize: 13, color: '#777', marginBottom: 8 },
    footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
    footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
    priority: { fontSize: 11, fontWeight: '700' },
    catChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    catChipText: { fontSize: 10, color: 'white', fontWeight: '600' },
    dueDate: { fontSize: 11, color: '#888' },
    dueDateOverdue: { color: '#F44336', fontWeight: '600' },
    dueDateToday: { color: '#E53935', fontWeight: '700' },
    timer: { fontSize: 11, color: COLORS.status['In Progress'], fontWeight: '600' },
    statusBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
    statusBtnText: { color: 'white', fontSize: 12, fontWeight: '700' },
});
