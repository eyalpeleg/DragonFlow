import { Ionicons } from '@expo/vector-icons';
import React, { useRef } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { getCategoryColor, getCategoryName, useTaskStore } from '../store/appStore';
import { Task } from '../types';

const DOUBLE_TAP_MS = 280;

interface Props {
    task: Task;
    onRestore: (id: string) => void;
    onDelete: (id: string) => void;
    onEdit: (task: Task) => void;
    onOpenStats: (task: Task) => void;
}

export default function TaskReflectionCard({ task, onRestore, onDelete, onEdit, onOpenStats }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const categories = useTaskStore((s) => s.categories);
    const { id, title, priority, categoryId, dueDate, completedTime } = task;
    const categoryColor = getCategoryColor(categories, categoryId);
    const categoryName = getCategoryName(categories, categoryId);

    const completedDate = completedTime
        ? new Date(completedTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';

    const lastTapRef = useRef<number>(0);

    function handleCardPress() {
        const now = Date.now();
        if (now - lastTapRef.current < DOUBLE_TAP_MS) {
            lastTapRef.current = 0;
            onOpenStats(task);
            return;
        }
        lastTapRef.current = now;
    }

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
        <Pressable
            onPress={handleCardPress}
            style={({ pressed }) => pressed && { opacity: 0.85 }}
            accessibilityLabel="Open task retrospective"
            accessibilityHint="Double-tap to view stats and reflection"
        >
        <View style={[styles.card, { borderLeftColor: categoryColor }]}>
            <View style={styles.topRow}>
                <Text style={styles.title} numberOfLines={1}>{title}</Text>
                <View style={styles.actions}>
                    <Pressable
                        style={({ pressed }) => [styles.editBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => onEdit(task)}
                    >
                        <Ionicons name="pencil-sharp" size={13} color={colors.white} />
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.restoreBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => onRestore(id)}
                    >
                        <Ionicons name="arrow-undo-outline" size={13} color={colors.white} />
                        <Text style={styles.restoreText}>Reopen</Text>
                    </Pressable>
                    <Pressable
                        style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}
                        onPress={handleDelete}
                    >
                        <Ionicons name="trash" size={15} color={colors.white} />
                        <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                </View>
            </View>
            <View style={styles.meta}>
                <Text style={[styles.priority, { color: colors.priority[priority] }]}>{priority}</Text>
                <View style={[styles.catChip, { backgroundColor: categoryColor }]}>
                    <Text style={styles.catChipText}>{categoryName}</Text>
                </View>
                {dueDate && (
                    <Text style={styles.metaText}>
                        Due {new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </Text>
                )}
                {completedDate && <Text style={styles.archivedText}>Completed {completedDate}</Text>}
            </View>
        </View>
        </Pressable>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    card: {
        backgroundColor: c.surfaceAlt.offWhite, padding: 12, marginVertical: 4, marginHorizontal: 12,
        borderRadius: 10, borderLeftWidth: 4,
        boxShadow: '0px 1px 2px rgba(0,0,0,0.05)',
    },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    title: { fontSize: 14, fontWeight: '600', color: c.text.muted, flex: 1, marginRight: 8 },
    actions: { flexDirection: 'row', gap: 6 },
    editBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: c.text.weak, alignItems: 'center', justifyContent: 'center',
    },
    restoreBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: c.status['In Progress'], paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    restoreText: { color: c.white, fontSize: 11, fontWeight: '700' },
    deleteBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: c.text.error, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    },
    deleteText: { color: c.white, fontSize: 11, fontWeight: '700' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    priority: { fontSize: 11, fontWeight: '700' },
    catChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    catChipText: { fontSize: 10, color: c.white, fontWeight: '600' },
    metaText: { fontSize: 11, color: c.text.placeholder },
    archivedText: { fontSize: 11, color: c.text.veryLight, fontStyle: 'italic' },
});
