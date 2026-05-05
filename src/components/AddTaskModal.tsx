import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, PriorityLevel } from '../styles/theme';
import { getCategoryColor, useTaskStore } from '../store/taskStore';
import DatePickerField from './DatePickerField';
import TimePickerField from './TimePickerField';
import AddCategoryModal from './AddCategoryModal';

interface AddTaskInput {
    title: string;
    description: string;
    priority: PriorityLevel;
    category: string;
    dueDate: string;
    dueTime: string;
}

interface Props {
    isVisible: boolean;
    onClose: () => void;
    onAdd: (input: AddTaskInput) => void;
}

export default function AddTaskModal({ isVisible, onClose, onAdd }: Props) {
    const categories = useTaskStore((s) => s.categories);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<PriorityLevel>('Medium');
    const [category, setCategory] = useState('Personal');
    const [dueDate, setDueDate] = useState(new Date());
    const [dueTime, setDueTime] = useState('08:00');
    const [addCatVisible, setAddCatVisible] = useState(false);

    const handleSubmit = () => {
        if (!title.trim()) return;
        const yyyy = dueDate.getFullYear();
        const mm = String(dueDate.getMonth() + 1).padStart(2, '0');
        const dd = String(dueDate.getDate()).padStart(2, '0');
        onAdd({ title: title.trim(), description, priority, category, dueDate: `${yyyy}-${mm}-${dd}`, dueTime });
        setTitle('');
        setDescription('');
        setPriority('Medium');
        setCategory('Personal');
        setDueDate(new Date());
        setDueTime('08:00');
        onClose();
    };

    const priorities: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

    return (
        <>
            <Modal visible={isVisible} animationType="slide" transparent>
                <View style={styles.overlay}>
                    <View style={styles.content}>
                        <Text style={styles.modalTitle}>New Task</Text>

                        <TextInput
                            placeholder="What needs to be done?"
                            style={styles.input}
                            value={title}
                            onChangeText={setTitle}
                            autoFocus
                        />

                        <TextInput
                            placeholder="Description (optional)"
                            style={[styles.input, styles.textArea]}
                            multiline
                            value={description}
                            onChangeText={setDescription}
                        />

                        <Text style={styles.label}>Due Date &amp; Time</Text>
                        <View style={styles.dateTimeRow}>
                            <View style={styles.dateTimeDate}>
                                <DatePickerField value={dueDate} onChange={setDueDate} />
                            </View>
                            <View style={styles.dateTimeTime}>
                                <TimePickerField value={dueTime} onChange={setDueTime} />
                            </View>
                        </View>

                        <Text style={styles.label}>Priority</Text>
                        <View style={styles.row}>
                            {priorities.map((p) => (
                                <TouchableOpacity
                                    key={p}
                                    onPress={() => setPriority(p)}
                                    style={[styles.chip, priority === p && { backgroundColor: COLORS.priority[p] }]}
                                >
                                    <Text style={[styles.chipText, priority === p && { color: 'white' }]}>{p}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
                            {categories.map((c) => {
                                const color = getCategoryColor(categories, c.name);
                                return (
                                    <TouchableOpacity
                                        key={c.name}
                                        onPress={() => setCategory(c.name)}
                                        style={[styles.chip, category === c.name && { backgroundColor: color }]}
                                    >
                                        <Text style={[styles.chipText, category === c.name && { color: 'white' }]}>{c.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                            <TouchableOpacity style={styles.addCatChip} onPress={() => setAddCatVisible(true)}>
                                <Ionicons name="add" size={14} color={COLORS.primary} />
                            </TouchableOpacity>
                        </ScrollView>

                        <View style={styles.buttonRow}>
                            <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSubmit} style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}>
                                <Text style={styles.saveText}>Save Task</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    content: { backgroundColor: 'white', padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
    modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
    input: { borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 10, marginBottom: 15, fontSize: 16 },
    textArea: { height: 60 },
    label: { fontSize: 14, fontWeight: 'bold', color: '#666', marginTop: 10, marginBottom: 8 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 15 },
    categoryRow: { flexDirection: 'row', marginBottom: 20 },
    dateTimeRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
    dateTimeDate: { flex: 2 },
    dateTimeTime: { flex: 1 },
    chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f0f0', marginRight: 6 },
    chipText: { fontSize: 12, fontWeight: '600' },
    addCatChip: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    },
    buttonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15 },
    cancelBtn: { padding: 12 },
    cancelText: { color: '#999', fontWeight: 'bold' },
    saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
    saveBtnDisabled: { opacity: 0.5 },
    saveText: { color: 'white', fontWeight: 'bold' },
});
