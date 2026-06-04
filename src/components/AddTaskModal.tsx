import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Keyboard, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors, PriorityLevel } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { DEFAULT_CATEGORY_ID, useTaskStore, AddTaskInput } from '../store/appStore';
import { RecurrenceConfig, RecurrenceFrequency, SubTask } from '../types';
import ScheduleEditor from './ScheduleEditor';
import AddCategoryModal from './AddCategoryModal';
import { suggestDueTime } from '../utils/dueTime';

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

interface Props {
    isVisible: boolean;
    onClose: () => void;
    onAdd: (input: AddTaskInput) => void;
}

export default function AddTaskModal({ isVisible, onClose, onAdd }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const recurringTrackColor = useMemo(() => ({ true: colors.primary }), [colors]);
    const insets = useSafeAreaInsets();
    const categories = useTaskStore((s) => s.categories);
    const defaultTaskTime = useTaskStore((s) => s.defaultTaskTime);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<PriorityLevel>('Medium');
    const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORY_ID);
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [dueTime, setDueTime] = useState(defaultTaskTime);
    const [addCatVisible, setAddCatVisible] = useState(false);
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<RecurrenceFrequency>('weekly');
    const [interval, setInterval] = useState('1');
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [subTaskInput, setSubTaskInput] = useState('');
    const [pinned, setPinned] = useState(false);

    const titleInputRef = useRef<TextInput>(null);
    const descriptionInputRef = useRef<TextInput>(null);
    const subTaskInputRef = useRef<TextInput>(null);
    const scrollRef = useRef<ScrollView>(null);
    const scheduleY = useRef(0);
    const priorityY = useRef(0);
    const [openDateToken, setOpenDateToken] = useState(0);
    const selectedPulse = useRef(new Animated.Value(0)).current;

    function blinkSelected() {
        selectedPulse.setValue(0);
        Animated.sequence([
            Animated.timing(selectedPulse, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(selectedPulse, { toValue: 0, duration: 220, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
            Animated.timing(selectedPulse, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(selectedPulse, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
        ]).start();
    }

    function handleTimeSelected() {
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, priorityY.current - 12), animated: true });
            blinkSelected();
        });
    }

    const selectedScale = selectedPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] });

    function scrollSubTasksIntoView() {
        requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    }

    useEffect(() => {

        if (isVisible) {
            setDueTime(defaultTaskTime);
            setTimeout(() => titleInputRef.current?.focus(), 300);
        }

    }, [isVisible, defaultTaskTime]);

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

    function handleTitleSubmit() {
        descriptionInputRef.current?.focus();
    }

    function handleDescriptionSubmit() {
        Keyboard.dismiss();
        requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: Math.max(0, scheduleY.current - 12), animated: true });
            setOpenDateToken((n) => n + 1);
        });
    }

    function handleDateChange(date: Date | null) {
        setDueDate(date);
        if (date) {
            setDueTime(suggestDueTime(date, defaultTaskTime));
        }
    }

    const handleSubmit = () => {
        if (!title.trim()) return;
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
        onAdd({
            title: title.trim(), description, priority, categoryId,
            dueDate: dueDateStr, dueTime,
            subTasks, recurrence, pinned,
        });
        reset();
        onClose();
    };

    function reset() {
        setTitle(''); setDescription(''); setPriority('Medium'); setCategoryId(DEFAULT_CATEGORY_ID);
        setDueDate(null); setDueTime(defaultTaskTime);
        setIsRecurring(false); setFrequency('weekly'); setInterval('1');
        setSubTasks([]); setSubTaskInput('');
        setPinned(false);
    }

    function handleClose() {
        reset();
        onClose();
    }

    const priorities: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

    return (
        <>
            <Modal visible={isVisible} animationType="slide" transparent onRequestClose={handleClose}>
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
                        <Text style={styles.modalTitle}>{title.trim() || 'New Task'}</Text>

                        <TextInput
                            ref={titleInputRef}
                            placeholder="Task title"
                            placeholderTextColor={colors.text.placeholder}
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            returnKeyType="next"
                            blurOnSubmit={false}
                            onSubmitEditing={handleTitleSubmit}
                        />

                        <TextInput
                            ref={descriptionInputRef}
                            placeholder="Add details"
                            placeholderTextColor={colors.text.placeholder}
                            style={[styles.input, styles.textArea]}
                            multiline
                            value={description}
                            onChangeText={setDescription}
                            returnKeyType="next"
                            submitBehavior="blurAndSubmit"
                            onSubmitEditing={handleDescriptionSubmit}
                        />

                        <Text
                            style={styles.label}
                            onLayout={(e) => { scheduleY.current = e.nativeEvent.layout.y; }}
                        >Schedule</Text>
                        <ScheduleEditor
                            dueDate={dueDate}
                            dueTime={dueTime}
                            isRecurring={isRecurring}
                            frequency={frequency}
                            interval={interval}
                            onChangeDueDate={handleDateChange}
                            onChangeDueTime={setDueTime}
                            onChangeIsRecurring={setIsRecurring}
                            onChangeFrequency={setFrequency}
                            onChangeInterval={setInterval}
                            openDateToken={openDateToken}
                            onTimeSelected={handleTimeSelected}
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

                        <Text
                            style={styles.label}
                            onLayout={(e) => { priorityY.current = e.nativeEvent.layout.y; }}
                        >Priority</Text>
                        <View style={styles.row}>
                            {priorities.map((p) => {
                                const selected = priority === p;
                                const chipStyle = [styles.chip, selected && { backgroundColor: colors.priority[p] }];
                                const textStyle = [styles.chipText, selected && { color: colors.white }];
                                return (
                                    <Animated.View
                                        key={p}
                                        style={selected ? { transform: [{ scale: selectedScale }] } : undefined}
                                    >
                                        <TouchableOpacity onPress={() => setPriority(p)} style={chipStyle}>
                                            <Text style={textStyle}>{p}</Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                );
                            })}
                        </View>

                        <Text style={styles.label}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                            {categories.map((c) => (
                                <TouchableOpacity key={c.id} onPress={() => setCategoryId(c.id)}
                                    style={[styles.chip, categoryId === c.id && { backgroundColor: c.color }]}>
                                    <Text style={[styles.chipText, categoryId === c.id && { color: colors.white }]}>{c.name}</Text>
                                </TouchableOpacity>
                            ))}
                            <TouchableOpacity style={styles.addCatChip} onPress={() => setAddCatVisible(true)}>
                                <Ionicons name="add" size={14} color={colors.primary} />
                            </TouchableOpacity>
                        </ScrollView>

                        <Text style={styles.label}>Sub-tasks</Text>
                        {subTasks.map((s) => (
                            <View key={s.id} style={styles.subTaskRow}>
                                <Ionicons name="ellipse-outline" size={14} color={colors.text.disabled} />
                                <Text style={styles.subTaskTitle} numberOfLines={1}>{s.title}</Text>
                                <TouchableOpacity onPress={() => removeSubTask(s.id)}>
                                    <Ionicons name="close" size={14} color={colors.text.disabled} />
                                </TouchableOpacity>
                            </View>
                        ))}
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
                            <TouchableOpacity onPress={() => { reset(); onClose(); }} style={styles.cancelBtn}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}>
                                <Text style={styles.saveText}>Save Task</Text>
                            </TouchableOpacity>
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
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    cancelBtn: { padding: 12 },
    cancelText: { color: c.text.placeholder, fontWeight: 'bold' },
    saveBtn: { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: c.white, fontWeight: 'bold' },
});
