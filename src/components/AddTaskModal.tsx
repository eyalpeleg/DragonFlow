import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppColors, PriorityLevel } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { DEFAULT_CATEGORY_ID, useTaskStore, AddTaskInput } from '../store/appStore';
import { RecurrenceConfig, RecurrenceFrequency, SubTask } from '../types';
import ScheduleEditor, { ScheduleEditorHandle } from './ScheduleEditor';
import AddCategoryModal from './AddCategoryModal';
import { suggestDueTime } from '../utils/dueTime';

function makeId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

const pressedOpacity = { opacity: 0.7 } as const;
const categoryKeyExtractor = (item: { id: string }) => item.id;
const subTaskKeyExtractor = (item: SubTask) => item.id;

interface Category {
    id: string;
    name: string;
    color: string;
}

interface CategoryRowProps {
    item: Category;
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
    onRemove: (id: string) => void;
    iconColor: string;
    styles: ReturnType<typeof makeStyles>;
}

function SubTaskRow({ item, onRemove, iconColor, styles }: SubTaskRowProps) {
    return (
        <View style={styles.subTaskRow}>
            <Ionicons name="ellipse-outline" size={14} color={iconColor} />
            <Text style={styles.subTaskTitle} numberOfLines={1}>{item.title}</Text>
            <Pressable
                onPress={() => onRemove(item.id)}
                style={({ pressed }) => pressed && pressedOpacity}
            >
                <Ionicons name="close" size={14} color={iconColor} />
            </Pressable>
        </View>
    );
}

interface Props {
    isVisible: boolean;
    onClose: () => void;
    onAdd: (input: AddTaskInput) => void;
}

export default function AddTaskModal({ isVisible, onClose, onAdd }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const recurringTrackColor = { true: colors.primary };
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
    const [interval, setIntervalValue] = useState('1');
    const [subTasks, setSubTasks] = useState<SubTask[]>([]);
    const [subTaskInput, setSubTaskInput] = useState('');
    const [pinned, setPinned] = useState(false);

    const titleInputRef = useRef<TextInput>(null);
    const descriptionInputRef = useRef<TextInput>(null);
    const subTaskInputRef = useRef<TextInput>(null);
    const scrollRef = useRef<ScrollView>(null);
    const scheduleY = useRef(0);
    const priorityY = useRef(0);
    const scheduleEditorRef = useRef<ScheduleEditorHandle>(null);
    const [selectedPulse] = useState(() => new Animated.Value(0));

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
        if (!isVisible) return;
        const t = setTimeout(() => titleInputRef.current?.focus(), 300);
        return () => clearTimeout(t);
    }, [isVisible]);

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
            scheduleEditorRef.current?.openDatePicker();
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
        onClose();
    };

    function handleClose() {
        onClose();
    }

    const priorities: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

    const renderCategory = ({ item }: { item: Category }) => (
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
            onRemove={removeSubTask}
            iconColor={colors.text.disabled}
            styles={styles}
        />
    );

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
                            ref={scheduleEditorRef}
                            dueDate={dueDate}
                            dueTime={dueTime}
                            isRecurring={isRecurring}
                            frequency={frequency}
                            interval={interval}
                            onChangeDueDate={handleDateChange}
                            onChangeDueTime={setDueTime}
                            onChangeIsRecurring={setIsRecurring}
                            onChangeFrequency={setFrequency}
                            onChangeInterval={setIntervalValue}
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
                                        <Pressable
                                            onPress={() => setPriority(p)}
                                            style={({ pressed }) => [...chipStyle, pressed && { opacity: 0.7 }]}
                                        >
                                            <Text style={textStyle}>{p}</Text>
                                        </Pressable>
                                    </Animated.View>
                                );
                            })}
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
                                onPress={handleSubmit}
                                style={({ pressed }) => [styles.saveBtn, !title.trim() && styles.saveBtnDisabled, pressed && { opacity: 0.7 }]}
                            >
                                <Text style={styles.saveText}>Save Task</Text>
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
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    cancelBtn: { padding: 12 },
    cancelText: { color: c.text.placeholder, fontWeight: 'bold' },
    saveBtn: { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: c.white, fontWeight: 'bold' },
});
