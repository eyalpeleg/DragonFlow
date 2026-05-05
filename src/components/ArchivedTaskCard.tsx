import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import { getCategoryColor, useTaskStore } from '../store/taskStore';
import { Task } from '../types';

interface Props {
    task: Task;
    onRestore: (id: string) => void;
    onDelete: (id: string) => void;
}

export default function ArchivedTaskCard({ task, onRestore, onDelete }: Props) {
    const categories = useTaskStore((s) => s.categories);
    const { id, title, priority, category, dueDate, archivedAt } = task;
    const categoryColor = getCategoryColor(categories, category);

    const archivedDate = archivedAt
        ? new Date(archivedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    function handleDelete() {
        Alert.alert(
            'Delete Task',
            `Permanently delete "${title}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
            ]
        );
    }

    return (
        <View style={[styles.card, { borderLeftColor: categoryColor }]}>
            <View style={styles.topRow}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <View style={styles.actions}>
                    <TouchableOpacity style={styles.restoreBtn} onPress={() => onRestore(id)}>
                        <Ionicons name="refresh-outline" size={13} color="white" />
                        <Text style={styles.restoreText}>Restore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                        <Ionicons name="trash-outline" size={13} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
            <View style={styles.meta}>
                <Text style={[styles.priority, { color: COLORS.priority[priority] }]}>{priority}</Text>
                <View style={[styles.catChip, { backgroundColor: categoryColor }]}>
                    <Text style={styles.catChipText}>{category}</Text>
                </View>
                {dueDate && (
                    <Text style={styles.metaText}>
                        Due {new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                )}
                {archivedDate && <Text style={styles.archivedText}>Archived {archivedDate}</Text>}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#f9f9f9', padding: 12, marginVertical: 4, marginHorizontal: 12,
        borderRadius: 10, borderLeftWidth: 4, opacity: 0.85,
        elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 14, fontWeight: '600', color: '#555', flex: 1, marginRight: 8 },
    actions: { flexDirection: 'row', gap: 6 },
    restoreBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: COLORS.status['In Progress'], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    restoreText: { color: 'white', fontSize: 11, fontWeight: '700' },
    deleteBtn: {
        backgroundColor: '#E53935', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center',
    },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    priority: { fontSize: 11, fontWeight: '700' },
    catChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    catChipText: { fontSize: 10, color: 'white', fontWeight: '600' },
    metaText: { fontSize: 11, color: '#999' },
    archivedText: { fontSize: 11, color: '#bbb', fontStyle: 'italic' },
});
