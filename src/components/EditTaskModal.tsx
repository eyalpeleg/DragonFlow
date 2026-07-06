import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors, PriorityLevel } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { DEFAULT_CATEGORY_ID, useTaskStore } from '../store/appStore';
import { RecurrenceConfig, RecurrenceFrequency, SubTask, Task } from '../types';
import ScheduleEditor from './ScheduleEditor';
import AddCategoryModal from './AddCategoryModal';

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const pressedOpacity = { opacity: 0.7 } as const;
const pressedOpacitySoft = { opacity: 0.6 } as const;
const editFlexStyle = { flex: 1 } as const;
const categoryKeyExtractor = (item: { id: string }) => item.id;
const subTaskKeyExtractor = (item: SubTask) => item.id;

interface CategoryItem {
    id: string;
    name: string;
    color: string;
}

interface CategoryRowProps {
    item: CategoryItem;
    selectedId: string;
    onSelect: (id: string) => void;
    whiteColor: string;
    styles: ReturnType<typeof makeStyles>;
}

function CategoryRow({ item, selectedId, onSelect, whiteColor, styles }: CategoryRowProps) {
    const selected = selectedId === item.id;
    return (
        <Pressable
            onPress={() => onSelect(item.id)}
            style={({ pressed }) => [styles.chip, selected && { backgroundColor: item.color }, pressed && pressedOpacity]}
        >
            <Text style={[styles.chipText, selected && { color: whiteColor }]}>{item.name}</Text>
        </Pressable>
    );
}

interface SubTaskRowProps {
    item: SubTask;
    editingSubId: string | null;
    editingSubTitle: string;
    onStartEdit: (sub: SubTask) => void;
    onCommitEdit: () => void;
    onCancelEdit: () => void;
    onChangeEditTitle: (text: string) => void;
    onRemove: (id: string) => void;
    doneColor: string;
    disabledColor: string;
    styles: ReturnType<typeof makeStyles>;
}

function SubTaskRow({
    item, editingSubId, editingSubTitle, onStartEdit, onCommitEdit, onCancelEdit, onChangeEditTitle, onRemove, doneColor, disabledColor, styles,
}: SubTaskRowProps) {
    const isEditing = editingSubId === item.id;
    return (
        <View style={styles.subTaskRow}>
            <Ionicons
                name={item.completed ? 'checkmark-circle' : 'ellipse-outline'}
                size={14}
                color={item.completed ? doneColor : disabledColor}
            />
            {isEditing ? (
                <TextInput
                    style={[styles.subTaskTitle, styles.subTaskEditInput, item.completed && styles.subTaskDone]}
                    value={editingSubTitle}
                    onChangeText={onChangeEditTitle}
                    autoFocus
                    selectTextOnFocus
                    onSubmitEditing={onCommitEdit}
                    returnKeyType="done"
                />
            ) : (
                <Pressable
                    style={({ pressed }) => [editFlexStyle, pressed && pressedOpacitySoft]}
                    onPress={() => onStartEdit(item)}
                >
                    <Text style={[styles.subTaskTitle, item.completed && styles.subTaskDone]} numberOfLines={1}>
                        {item.title}
                    </Text>
                </Pressable>
            )}
            <Pressable
                onPress={() => (isEditing ? onCancelEdit() : onRemove(item.id))}
                style={({ pressed }) => pressed && pressedOpacity}
            >
                <Ionicons name="close" size={14} color={disabledColor} />
            </Pressable>
        </View>
    );
}

function parseTaskDueDate(dueDate: string | undefined): Date | null {
    if (!dueDate) return null;
    const parsed = new Date(dueDate + 'T00:00:00');
    return isNaN(parsed.getTime()) ? null : parsed;
}

export type EditFocus = 'subTask';

interface Props {
    isVisible: boolean;
    task: Task | null;
    initialFocus?: EditFocus;
    onClose: () => void;
    onSave: (id: string, updates: Partial<Task>) => void;
}

export default function EditTaskModal({ isVisible, task, initialFocus, onClose, onSave }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const recurringTrackColor = { true: colors.primary };
    const insets = useSafeAreaInsets();
    const categories = useTaskStore((s) => s.categories);
    const defaultTaskTime = useTaskStore((s) => s.defaultTaskTime);
    const [title, setTitle] = useState(task?.title ?? '');
    const [description, setDescription] = useState(task?.description ?? '');
    const [priority, setPriority] = useState<PriorityLevel>(task?.priority ?? 'Medium');
    const [categoryId, setCategoryId] = useState(task?.categoryId ?? DEFAULT_CATEGORY_ID);
    const [dueDate, setDueDate] = useState<Date | null>(() => parseTaskDueDate(task?.dueDate));
    const [dueTime, setDueTime] = useState(task?.dueTime ?? defaultTaskTime);
    const [addCatVisible, setAddCatVisible] = useState(false);
    const [isRecurring, setIsRecurring] = useState(!!task?.recurrence);
    const [frequency, setFrequency] = useState<RecurrenceFrequency>(task?.recurrence?.frequency ?? 'weekly');
    const [interval, setIntervalValue] = useState(String(task?.recurrence?.interval ?? 1));
    const [subTasks, setSubTasks] = useState<SubTask[]>(task?.subTasks ?? []);
    const [subTaskInput, setSubTaskInput] = useState('');
    const [editingSubId, setEditingSubId] = useState<string | null>(null);
    const [editingSubTitle, setEditingSubTitle] = useState('');
    const [pinned, setPinned] = useState(!!task?.pinned);

    const subTaskInputRef = useRef<TextInput>(null);
    const scrollRef = useRef<ScrollView>(null);

    function scrollSubTasksIntoView() {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }

    useEffect(() => {
        if (!isVisible || initialFocus !== 'subTask') return;
        const t = setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: false });
            subTaskInputRef.current?.focus();
        }, 350);
        return () => clearTimeout(t);
    }, [isVisible, initialFocus]);

    function addSubTask() {
        const t = subTaskInput.trim();
        if (!t) {
            Keyboard.dismiss();
            return;
        }
        setSubTasks((prev) => [...prev, { id: makeId(), title: t, completed: false }]);
        setSubTaskInput('');
        subTaskInputRef.current?.focus();
        scrollSubTasksIntoView();
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
            subTasks, recurrence, pinned,
        });
    };

    const priorities: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

    const renderCategory = ({ item }: { item: CategoryItem }) => (
        <CategoryRow
            item={item}
            selectedId={categoryId}
            onSelect={setCategoryId}
            whiteColor={colors.white}
            styles={styles}
        />
    );

    const renderSubTask = ({ item }: { item: SubTask }) => (
        <SubTaskRow
            item={item}
            editingSubId={editingSubId}
            editingSubTitle={editingSubTitle}
            onStartEdit={startEditSub}
            onCommitEdit={commitEditSub}
            onCancelEdit={cancelEditSub}
            onChangeEditTitle={setEditingSubTitle}
            onRemove={removeSubTask}
            doneColor={colors.status['Done']}
            disabledColor={colors.text.disabled}
            styles={styles}
        />
    );

    return (
        <>
            <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
                <KeyboardAvoidingView
                    style={styles.overlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
                >
                    <ScrollView
                        ref={scrollRef}
                        style={styles.content}
                        contentContainerStyle={[styles.contentInner, { paddingBottom: Math.max(20, insets.bottom) }]}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <Text style={styles.modalTitle}>Edit Task</Text>

                        <TextInput
                            placeholder="Task title"
                            placeholderTextColor={colors.text.placeholder}
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                        />

                        <TextInput
                            placeholder="Details (optional)"
                            placeholderTextColor={colors.text.placeholder}
                            style={[styles.input, styles.textArea]}
                            multiline
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Schedule</Text>
                        <ScheduleEditor
                            dueDate={dueDate}
                            dueTime={dueTime}
                            isRecurring={isRecurring}
                            frequency={frequency}
                            interval={interval}
                            onChangeDueDate={setDueDate}
                            onChangeDueTime={setDueTime}
                            onChangeIsRecurring={setIsRecurring}
                            onChangeFrequency={setFrequency}
                            onChangeInterval={setIntervalValue}
                        />

                        <Text style={styles.label}>Priority</Text>
                        <View style={styles.row}>
                            {priorities.map((p) => (
                                <Pressable
                                    key={p}
                                    onPress={() => setPriority(p)}
                                    style={({ pressed }) => [styles.chip, priority === p && { backgroundColor: colors.priority[p] }, pressed && { opacity: 0.7 }]}
                                >
                                    <Text style={[styles.chipText, priority === p && { color: colors.white }]}>{p}</Text>
                                </Pressable>
                            ))}
                        </View>

                        <Text style={styles.label}>Category</Text>
                        <FlatList
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.categoryRow}
                            data={categories}
                            keyExtractor={categoryKeyExtractor}
                            renderItem={renderCategory}
                            ListFooterComponent={
                                <Pressable
                                    style={({ pressed }) => [styles.addCatChip, pressed && pressedOpacity]}
                                    onPress={() => setAddCatVisible(true)}
                                >
                                    <Ionicons name="add" size={14} color={colors.primary} />
                                </Pressable>
                            }
                        />

                        <View style={styles.switchRow}>
                            <View>
                                <Text style={styles.label}>Pin to focus</Text>
                                {pinned && <Text style={styles.switchSub}>Always shows in focus mode</Text>}
                            </View>
                            <Switch
                                value={pinned}
                                onValueChange={setPinned}
                                trackColor={recurringTrackColor}
                            />
                        </View>

                        <Text style={styles.label}>Sub-tasks</Text>
                        <FlatList
                            data={subTasks}
                            keyExtractor={subTaskKeyExtractor}
                            scrollEnabled={false}
                            renderItem={renderSubTask}
                        />
                        <View style={styles.subTaskInputRow}>
                            <Ionicons name="add" size={18} color={colors.primary} />
                            <TextInput
                                ref={subTaskInputRef}
                                style={[styles.input, styles.subTaskInput]}
                                value={subTaskInput}
                                onChangeText={setSubTaskInput}
                                placeholder="Add a sub-task"
                                placeholderTextColor={colors.text.placeholder}
                                onSubmitEditing={addSubTask}
                                onFocus={scrollSubTasksIntoView}
                                blurOnSubmit={false}
                                returnKeyType="next"
                            />
                        </View>

                        <View style={[styles.buttonRow, { marginTop: 20 }]}>
                            <Pressable
                                onPress={onClose}
                                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                                onPress={handleSave}
                                style={({ pressed }) => [styles.saveBtn, !title.trim() && styles.saveBtnDisabled, pressed && { opacity: 0.7 }]}
                            >
                                <Text style={styles.saveText}>Save Changes</Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
        </>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay.scrimStrong, justifyContent: 'flex-end' },
    content: { backgroundColor: c.surfaceElevated, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
    contentInner: { padding: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, color: c.text.primary },
    input: { borderBottomWidth: 1, borderBottomColor: c.border.light, paddingVertical: 10, marginBottom: 15, fontSize: 16, color: c.text.primary },
    textArea: { height: 60 },
    label: { fontSize: 14, fontWeight: 'bold', color: c.text.subtle, marginTop: 10, marginBottom: 8 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    categoryRow: { flexDirection: 'row', marginBottom: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: c.surfaceAlt.soft, marginRight: 6 },
    chipText: { fontSize: 12, fontWeight: '600', color: c.text.body },
    addCatChip: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: c.surfaceAlt.soft, borderWidth: 1, borderColor: c.primary,
        alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    },
    switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
    switchSub: { fontSize: 11, color: c.text.light, marginTop: 2 },
    subTaskInputRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
    subTaskInput: { flex: 1, marginBottom: 0, paddingVertical: 8, fontSize: 14 },
    subTaskRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    subTaskTitle: { flex: 1, fontSize: 13, color: c.text.muted },
    subTaskEditInput: { borderBottomWidth: 1, borderBottomColor: c.border.medium, paddingVertical: 2 },
    subTaskDone: { textDecorationLine: 'line-through', color: c.text.veryLight },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    cancelBtn: { padding: 12 },
    cancelText: { color: c.text.placeholder, fontWeight: 'bold' },
    saveBtn: { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: c.white, fontWeight: 'bold' },
});
