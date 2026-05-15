import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';
import { useTaskStore } from '../store/appStore';
import { SubTask } from '../types';

interface Props {
    taskId: string;
    subTasks: SubTask[];
    taskStatus: string;
    onAllDone: () => void;
}

export default function TaskChecklist({ taskId, subTasks, taskStatus, onAllDone }: Props) {
    const { toggleSubTask, addSubTask, removeSubTask, renameSubTask } = useTaskStore();
    const [expanded, setExpanded] = useState(false);
    const [adding, setAdding] = useState(false);
    const [newTitle, setNewTitle] = useState('');
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

    function handleAdd() {
        const trimmed = newTitle.trim();
        if (!trimmed) return;
        addSubTask(taskId, trimmed);
        setNewTitle('');
        setAdding(false);
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
            <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.7}>
                <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.progressLabel}>{done}/{total}</Text>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#aaa" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {expanded && (
                <View style={styles.list}>
                    {subTasks.map((sub) => (
                        <View key={sub.id} style={styles.row}>
                            <TouchableOpacity onPress={() => handleToggle(sub)} style={styles.check}>
                                <Ionicons
                                    name={sub.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={20}
                                    color={sub.completed ? COLORS.status['Done'] : '#ccc'}
                                />
                            </TouchableOpacity>
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
                                <TouchableOpacity
                                    style={styles.subTitleTouch}
                                    onPress={() => startEdit(sub)}
                                    disabled={taskStatus === 'Done'}
                                    activeOpacity={0.6}
                                >
                                    <Text style={[styles.subTitle, sub.completed && styles.subTitleDone]} numberOfLines={2}>
                                        {sub.title}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {taskStatus !== 'Done' && (
                                editingId === sub.id ? (
                                    <TouchableOpacity onPress={cancelEdit} style={styles.removeBtn}>
                                        <Ionicons name="close" size={14} color="#ccc" />
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity onPress={() => handleRemove(sub)} style={styles.removeBtn}>
                                        <Ionicons name="close" size={14} color="#ccc" />
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    ))}

                    {taskStatus !== 'Done' && (
                        adding ? (
                            <View style={styles.addRow}>
                                <TextInput
                                    style={styles.addInput}
                                    value={newTitle}
                                    onChangeText={setNewTitle}
                                    placeholder="Sub-task title"
                                    autoFocus
                                    onSubmitEditing={handleAdd}
                                    returnKeyType="done"
                                />
                                <TouchableOpacity onPress={handleAdd} style={styles.addConfirmBtn}>
                                    <Ionicons name="checkmark" size={16} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setAdding(false); setNewTitle(''); }}>
                                    <Ionicons name="close" size={16} color="#aaa" style={{ padding: 4 }} />
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.addTrigger} onPress={() => setAdding(true)}>
                                <Ionicons name="add" size={14} color={COLORS.primary} />
                                <Text style={styles.addTriggerText}>Add sub-task</Text>
                            </TouchableOpacity>
                        )
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { marginTop: 8, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 8 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    progressTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#eee', overflow: 'hidden' },
    progressFill: { height: 4, borderRadius: 2, backgroundColor: COLORS.primary },
    progressLabel: { fontSize: 11, color: '#999', minWidth: 28, textAlign: 'right' },
    list: { marginTop: 8, gap: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    check: { padding: 2 },
    subTitle: { flex: 1, fontSize: 13, color: '#444' },
    subTitleTouch: { flex: 1 },
    subTitleDone: { textDecorationLine: 'line-through', color: '#bbb' },
    editInput: { borderBottomWidth: 1, borderBottomColor: '#ddd', paddingVertical: 2 },
    removeBtn: { padding: 4 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
    addInput: { flex: 1, borderBottomWidth: 1, borderBottomColor: '#ddd', fontSize: 13, paddingVertical: 4 },
    addConfirmBtn: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 4 },
    addTrigger: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 4 },
    addTriggerText: { fontSize: 12, color: COLORS.primary },
});
