import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, PriorityLevel } from '../styles/theme';
import { DEFAULT_CATEGORY_ID, useTaskStore } from '../store/appStore';
import { RecurrenceConfig, RecurrenceFrequency, SubTask, Task } from '../types';
import DatePickerField from './DatePickerField';
import TimePickerField from './TimePickerField';
import AddCategoryModal from './AddCategoryModal';

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly'];

interface Props {
    isVisible: boolean;
    task: Task | null;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Task>) => void;
}

export default function EditTaskModal({ isVisible, task, onClose, onSave }: Props) {
    const insets = useSafeAreaInsets();
    const categories = useTaskStore((s) => s.categories);
    const defaultTaskTime = useTaskStore((s) => s.defaultTaskTime);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<PriorityLevel>('Medium');
    const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
    const [dueDate, setDueDate] = useState<Date | null>(new Date());
    const [dueTime, setDueTime] = useState(defaultTaskTime);
    const [addCatVisible, setAddCatVisible] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
    const [interval, setInterval] = useState('1');
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [subTaskInput, setSubTaskInput] = useState('');
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [editingSubTitle, setEditingSubTitle] = useState('');

    useEffect(() => {
        if (task) {
            setTitle(task.title);
            setDescription(task.description);
            setPriority(task.priority);
            setCategoryId(task.categoryId);
            if (task.dueDate) {
                const parsed = new Date(task.dueDate + 'T00:00:00');
                setDueDate(isNaN(parsed.getTime()) ? null : parsed);
            } else {
                setDueDate(null);
            }
            setDueTime(task.dueTime ?? '08:00');
            setIsRecurring(!!task.recurrence);
            setFrequency(task.recurrence?.frequency ?? 'weekly');
            setInterval(String(task.recurrence?.interval ?? 1));
            setSubTasks(task.subTasks ?? []);
            setSubTaskInput('');
            setEditingSubId(null);
            setEditingSubTitle('');
        }
    }, [task]);

    function addSubTask() {
        const t = subTaskInput.trim();
        if (!t) return;
        setSubTasks((prev) => [...prev, { id: makeId(), title: t, completed: false }]);
        setSubTaskInput('');
    }

    function removeSubTask(id: string) {
        setSubTasks((prev) => prev.filter((s) => s.id !== id));
    }

    function startEditSub(sub: SubTask) {
        setEditingSubId(sub.id);
        setEditingSubTitle(sub.title);
    }

    function cancelEditSub() {
        setEditingSubId(null);
        setEditingSubTitle('');
    }

    function commitEditSub() {
        if (!editingSubId) return;
        const trimmed = editingSubTitle.trim();
        if (trimmed) {
            setSubTasks((prev) => prev.map((s) => (s.id === editingSubId ? { ...s, title: trimmed } : s)));
        }
        cancelEditSub();
    }

    const handleSave = () => {
        if (!task || !title.trim()) return;
        let dueDateStr = '';
        if (dueDate) {
            const yyyy = dueDate.getFullYear();
            const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
            const dd = String(dueDate.getDate()).padStart(2, '0');
            dueDateStr = `${yyyy}-${mm}-${dd}`;
        }
        const recurrence: RecurrenceConfig | undefined = isRecurring
            ? { frequency, interval: Math.max(1, parseInt(interval, 10) || 1) }
            : undefined;
        onSave(task.id, {
            title: title.trim(), description, priority, categoryId,
            dueDate: dueDateStr, dueTime,
            subTasks, recurrence,
        });
    };

    const priorities: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

    return (
        <>
            <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
                <View style={styles.overlay}>
                    <ScrollView
                        style={styles.content}
                        contentContainerStyle={[styles.contentInner, { paddingBottom: Math.max(20, insets.bottom) }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.modalTitle}>Edit Task</Text>

                        <TextInput
                            placeholder="Task title"
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                        />

                        <TextInput
                            placeholder="Description (optional)"
                            style={[styles.input, styles.textArea]}
                            multiline
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Due Date{dueDate ? ' & Time' : ''}</Text>
                        <View style={styles.dateTimeRow}>
                            <View style={dueDate ? styles.dateTimeDate : { flex: 1 }}>
                                <DatePickerField value={dueDate} onChange={setDueDate} onClear={() => setDueDate(null)} />
                            </View>
                            {dueDate && (
                                <View style={styles.dateTimeTime}>
                                    <TimePickerField value={dueTime} onChange={setDueTime} />
                                </View>
                            )}
                        </View>

                        <Text style={styles.label}>Priority</Text>
                        <View style={styles.row}>
                            {priorities.map((p) => (
                                <TouchableOpacity key={p} onPress={() => setPriority(p)}
                                    style={[styles.chip, priority === p && { backgroundColor: COLORS.priority[p] }]}>
                                    <Text style={[styles.chipText, priority === p && { color: COLORS.white }]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                            {categories.map((c) => (
                                <TouchableOpacity key={c.id} onPress={() => setCategoryId(c.id)}
                                    style={[styles.chip, categoryId === c.id && { backgroundColor: c.color }]}>
                                    <Text style={[styles.chipText, categoryId === c.id && { color: COLORS.white }]}>{c.name}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.addCatChip} onPress={() => setAddCatVisible(true)}>
                                <Ionicons name="add" size={14} color={COLORS.primary} />
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.switchRow}>
                            <View>
                                <Text style={styles.label}>Recurring task</Text>
                                {isRecurring && <Text style={styles.switchSub}>Spawns next occurrence on completion</Text>}
                            </View>
                            <Switch
                                value={isRecurring}
                                onValueChange={setIsRecurring}
                                trackColor={{ true: COLORS.primary }}
                            />
                        </View>
                        {isRecurring && (
                            <View style={styles.recurrenceBlock}>
                                <Text style={styles.sublabel}>Frequency</Text>
                                <View style={styles.row}>
                                    {FREQUENCIES.map((f) => (
                                        <TouchableOpacity key={f} onPress={() => setFrequency(f)}
                                            style={[styles.chip, frequency === f && { backgroundColor: COLORS.primary }]}>
                                            <Text style={[styles.chipText, frequency === f && { color: COLORS.white }]}>
                                                {f.charAt(0).toUpperCase() + f.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.sublabel}>Every N {frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : 'months'}</Text>
                                <TextInput
                                    style={[styles.input, { width: 60 }]}
                                    value={interval}
                                    onChangeText={setInterval}
                                    keyboardType="number-pad"
                                />
                            </View>
                        )}

                        <Text style={styles.label}>Sub-tasks</Text>
                        <View style={styles.subTaskInputRow}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                                value={subTaskInput}
                                onChangeText={setSubTaskInput}
                                placeholder="Add a sub-task"
                                onSubmitEditing={addSubTask}
                                returnKeyType="done"
                            />
                            <TouchableOpacity style={styles.addSubBtn} onPress={addSubTask}>
                                <Ionicons name="add" size={18} color={COLORS.white} />
                            </TouchableOpacity>
                        </View>
                        {subTasks.map((s) => (
                            <View key={s.id} style={styles.subTaskRow}>
                                <Ionicons
                                    name={s.completed ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={14}
                                    color={s.completed ? COLORS.status['Done'] : COLORS.text.disabled}
                                />
                                {editingSubId === s.id ? (
                                    <TextInput
                                        style={[styles.subTaskTitle, styles.subTaskEditInput, s.completed && styles.subTaskDone]}
                                        value={editingSubTitle}
                                        onChangeText={setEditingSubTitle}
                                        autoFocus
                                        selectTextOnFocus
                                        onSubmitEditing={commitEditSub}
                                        returnKeyType="done"
                                    />
                                ) : (
                                    <TouchableOpacity style={{ flex: 1 }} onPress={() => startEditSub(s)} activeOpacity={0.6}>
                                        <Text style={[styles.subTaskTitle, s.completed && styles.subTaskDone]} numberOfLines={1}>
                                            {s.title}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => (editingSubId === s.id ? cancelEditSub() : removeSubTask(s.id))}>
                                    <Ionicons name="close" size={14} color={COLORS.text.disabled} />
                                </TouchableOpacity>
                            </View>
                        ))}

                        <View style={[styles.buttonRow, { marginTop: 20 }]}>
                            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}>
                                <Text style={styles.saveText}>Save Changes</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </Modal>
            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: COLORS.overlay.scrimStrong, justifyContent: 'flex-end' },
    content: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
    contentInner: { padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    input: { borderBottomWidth: 1, borderBottomColor: COLORS.border.light, paddingVertical: 10, marginBottom: 15, fontSize: 16 },
    textArea: { height: 60 },
    label: { fontSize: 14, fontWeight: 'bold', color: COLORS.text.subtle, marginTop: 10, marginBottom: 8 },
    sublabel: { fontSize: 12, fontWeight: '600', color: COLORS.text.weak, marginBottom: 6 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    categoryRow: { flexDirection: 'row', marginBottom: 8 },
    dateTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    dateTimeDate: { flex: 2 },
    dateTimeTime: { flex: 1 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: COLORS.surfaceAlt.soft, marginRight: 6 },
    chipText: { fontSize: 12, fontWeight: '600' },
    addCatChip: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: COLORS.surfaceAlt.soft, borderWidth: 1, borderColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
    switchSub: { fontSize: 11, color: COLORS.text.light, marginTop: 2 },
    recurrenceBlock: { backgroundColor: COLORS.surfaceAlt.offWhite, borderRadius: 10, padding: 12, marginBottom: 8 },
    subTaskInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
    addSubBtn: { backgroundColor: COLORS.primary, borderRadius: 8, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    subTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    subTaskTitle: { flex: 1, fontSize: 13, color: COLORS.text.muted },
    subTaskEditInput: { borderBottomWidth: 1, borderBottomColor: COLORS.border.medium, paddingVertical: 2 },
    subTaskDone: { textDecorationLine: 'line-through', color: COLORS.text.veryLight },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    cancelBtn: { padding: 12 },
    cancelText: { color: COLORS.text.placeholder, fontWeight: 'bold' },
    saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: COLORS.white, fontWeight: 'bold' },
});
