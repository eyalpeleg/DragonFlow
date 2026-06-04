import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';
import { SubTask } from '../types';

interface Props {
    taskId: string;
    subTasks: SubTask[];
    taskStatus: string;
    onAllDone: () => void;
    onRequestAddSubTask?: () => void;
}

export default function TaskChecklist({ taskId, subTasks, taskStatus, onAllDone, onRequestAddSubTask }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const { toggleSubTask, removeSubTask, renameSubTask } = useTaskStore();
    const [expanded, setExpanded] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState('');

    const total = subTasks.length;
    const done = subTasks.filter((s) => s.completed).length;
    const pct = total > 0 ? done / total : 0;

    function handleToggle(sub: SubTask) {
        toggleSubTask(taskId, sub.id);
        // Check if this toggle will complete all sub-tasks
        const willBeCompleted = !sub.completed;
        const othersDone = subTasks.filter((s) => s.id !== sub.id && s.completed).length;
        if (willBeCompleted && othersDone === total - 1 && taskStatus !== 'Done') {
            setTimeout(() => onAllDone(), 150);
        }
    }

    function handleRemove(sub: SubTask) {
        Alert.alert('Remove sub-task', `Remove "${sub.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => removeSubTask(taskId, sub.id) },
        ]);
    }

    function startEdit(sub: SubTask) {
        if (taskStatus === 'Done') return;
        setEditingId(sub.id);
        setEditingTitle(sub.title);
    }

    function cancelEdit() {
        setEditingId(null);
        setEditingTitle('');
    }

    function commitEdit() {
        if (!editingId) return;
        const trimmed = editingTitle.trim();
        if (trimmed) renameSubTask(taskId, editingId, trimmed);
        cancelEdit();
    }

    if (total === 0 && taskStatus === 'Done') return null;

    return (
        <View style={styles.container}>
            {/* Progress bar + header */}
            <Pressable
                style={({ pressed }) => [styles.header, pressed && { opacity: 0.7 }]}
                onPress={() => setExpanded((v) => !v)}
            >
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{done}/{total}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.text.light} style={{ marginLeft: 4 }} />
            </Pressable>

            {expanded && (
                <View style={styles.list}>
                    {subTasks.map((sub) => (
                        <View key={sub.id} style={styles.row}>
                            <Pressable
                                onPress={() => handleToggle(sub)}
                                style={({ pressed }) => [styles.check, pressed && { opacity: 0.7 }]}
                            >
                                <Ionicons
                                    name={sub.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={sub.completed ? colors.status['Done'] : colors.text.disabled}
                                />
                            </Pressable>
                            {editingId === sub.id ? (
                                <TextInput
                                    style={[styles.subTitle, styles.editInput, sub.completed && styles.subTitleDone]}
                                    value={editingTitle}
                                    onChangeText={setEditingTitle}
                                    autoFocus
                                    selectTextOnFocus
                                    onSubmitEditing={commitEdit}
                                    returnKeyType="done"
                                />
                            ) : (
                                <Pressable
                                    style={({ pressed }) => [styles.subTitleTouch, pressed && { opacity: 0.6 }]}
                                    onPress={() => startEdit(sub)}
                                    disabled={taskStatus === 'Done'}
                                >
                                    <Text style={[styles.subTitle, sub.completed && styles.subTitleDone]} numberOfLines={2}>
                                        {sub.title}
                                    </Text>
                                </Pressable>
                            )}
                            {taskStatus !== 'Done' && (
                                editingId === sub.id ? (
                                    <Pressable
                                        onPress={cancelEdit}
                                        style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                                    >
                                        <Ionicons name="close" size={14} color={colors.text.disabled} />
                                    </Pressable>
                                ) : (
                                    <Pressable
                                        onPress={() => handleRemove(sub)}
                                        style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.7 }]}
                                    >
                                        <Ionicons name="close" size={14} color={colors.text.disabled} />
                                    </Pressable>
                                )
                            )}
                        </View>
                    ))}

                    {taskStatus !== 'Done' && onRequestAddSubTask && (
                        <Pressable
                            style={({ pressed }) => [styles.addTrigger, pressed && { opacity: 0.7 }]}
                            onPress={onRequestAddSubTask}
                        >
                            <Ionicons name="add" size={14} color={colors.primary} />
                            <Text style={styles.addTriggerText}>Add sub-task</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: { marginTop: 8, borderTopWidth: 1, borderTopColor: c.border.subtle, paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.border.light, overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: c.primary },
    progressLabel: { fontSize: 11, color: c.text.placeholder, minWidth: 28, textAlign: 'right' },
    list: { marginTop: 8, gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    check: { padding: 2 },
    subTitle: { flex: 1, fontSize: 13, color: c.text.body },
    subTitleTouch: { flex: 1 },
    subTitleDone: { textDecorationLine: 'line-through', color: c.text.veryLight },
    editInput: { borderBottomWidth: 1, borderBottomColor: c.border.medium, paddingVertical: 2 },
    removeBtn: { padding: 4 },
    addTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
    addTriggerText: { fontSize: 12, color: c.primary },
});
