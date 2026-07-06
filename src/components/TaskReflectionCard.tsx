import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

type ActionKey = 'retrospect' | 'edit' | 'reopen' | 'delete';

export default function TaskReflectionCard({ task, onRestore, onDelete, onEdit, onOpenStats }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const categories = useTaskStore((s) => s.categories);
    const { id, title, priority, categoryId, dueDate, completedTime } = task;
    const categoryColor = getCategoryColor(categories, categoryId);
    const categoryName = getCategoryName(categories, categoryId);
    const [menuOpen, setMenuOpen] = useState(false);

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

    function confirmDelete() {
        Alert.alert(
            'Delete Task',
            `Permanently delete "${title}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
            ]
        );
    }

    function handleAction(action: ActionKey) {
        setMenuOpen(false);
        switch (action) {
            case 'retrospect':
                onOpenStats(task);
                break;
            case 'edit':
                onEdit(task);
                break;
            case 'reopen':
                onRestore(id);
                break;
            case 'delete':
                confirmDelete();
                break;
        }
    }

    const actions: { key: ActionKey; label: string; icon: keyof typeof Ionicons.glyphMap; danger?: boolean }[] = [
        { key: 'retrospect', label: 'Retrospect', icon: 'stats-chart' },
        { key: 'edit', label: 'Edit', icon: 'pencil-sharp' },
        { key: 'reopen', label: 'Reopen', icon: 'arrow-undo-outline' },
        { key: 'delete', label: 'Delete', icon: 'trash', danger: true },
    ];

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
                <Pressable
                    style={({ pressed }) => [styles.actionsBtn, pressed && { opacity: 0.7 }]}
                    onPress={() => setMenuOpen(true)}
                    accessibilityLabel="Task actions"
                    hitSlop={8}
                >
                    <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.muted} />
                </Pressable>
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

            <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
                <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
                    <Pressable style={styles.menu} onPress={(e) => e.stopPropagation()}>
                        <Text style={styles.menuTitle} numberOfLines={1}>{title}</Text>
                        {actions.map((a) => (
                            <Pressable
                                key={a.key}
                                style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
                                onPress={() => handleAction(a.key)}
                            >
                                <Ionicons
                                    name={a.icon}
                                    size={18}
                                    color={a.danger ? colors.text.error : colors.text.secondary}
                                />
                                <Text style={[styles.menuItemText, a.danger && { color: colors.text.error }]}>
                                    {a.label}
                                </Text>
                            </Pressable>
                        ))}
                    </Pressable>
                </Pressable>
            </Modal>
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
    actionsBtn: {
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
    },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    priority: { fontSize: 11, fontWeight: '700' },
    catChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
    catChipText: { fontSize: 10, color: c.white, fontWeight: '600' },
    metaText: { fontSize: 11, color: c.text.placeholder },
    archivedText: { fontSize: 11, color: c.text.veryLight, fontStyle: 'italic' },
    overlay: {
        flex: 1,
        backgroundColor: c.overlay.scrimSoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menu: {
        backgroundColor: c.surfaceElevated,
        borderRadius: 12,
        paddingVertical: 8,
        width: '70%',
        maxWidth: 320,
        boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
    },
    menuTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: c.text.muted,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: c.border.subtle,
        marginBottom: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    menuItemText: {
        fontSize: 15,
        color: c.text.secondary,
        fontWeight: '500',
    },
});
