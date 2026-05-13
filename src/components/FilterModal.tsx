import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { useTaskStore, getCategoryColor, getCategoryName } from '../store/taskStore';
import { TaskStatus } from '../types';
import { PriorityLevel } from '../styles/theme';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

interface Props {
    isOpen: boolean;
    filterType: FilterType | null;
    onClose: () => void;
    onSave: (filterType: FilterType, selectedSet: Set<string>) => void;
}

const STATUS_OPTIONS: TaskStatus[] = ['Ready', 'In Progress', 'Paused', 'Done'];
const PRIORITY_OPTIONS: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
const PRIORITY_COLORS: Record<PriorityLevel, string> = {
    Critical: '#F44336',
    High: '#FF9800',
    Medium: '#FFC107',
    Low: '#4CAF50',
};
const DUE_DATE_OPTIONS: Array<'overdue' | 'today' | 'upcoming'> = ['overdue', 'today', 'upcoming'];
const DUE_DATE_LABELS = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming' };

export default function FilterModal({ isOpen, filterType, onClose, onSave }: Props) {
    const insets = useSafeAreaInsets();
    const categories = useTaskStore((s) => s.categories);
    const statusFilters = useTaskStore((s) => s.statusFilters);
    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const priorityFilters = useTaskStore((s) => s.priorityFilters);
    const dueDateFilters = useTaskStore((s) => s.dueDateFilters);

    const currentFilters = useMemo(() => {
        if (!filterType) return new Set<string>();
        if (filterType === 'status') return statusFilters as Set<string>;
        if (filterType === 'category') return categoryFilters;
        if (filterType === 'priority') return priorityFilters as Set<string>;
        if (filterType === 'dueDate') return dueDateFilters as Set<string>;
        return new Set<string>();
    }, [filterType, statusFilters, categoryFilters, priorityFilters, dueDateFilters]);

    const [selected, setSelected] = useState<Set<string>>(() => new Set(currentFilters));

    useEffect(() => {
        setSelected(new Set(Array.from(currentFilters)));
    }, [currentFilters]);

    const getOptions = (): string[] => {
        if (filterType === 'status') return STATUS_OPTIONS;
        if (filterType === 'category') return categories.map((c) => c.id);
        if (filterType === 'priority') return PRIORITY_OPTIONS;
        if (filterType === 'dueDate') return DUE_DATE_OPTIONS;
        return [];
    };

    const getLabel = (value: string): string => {
        if (filterType === 'dueDate') return DUE_DATE_LABELS[value as keyof typeof DUE_DATE_LABELS] || value;
        if (filterType === 'category') return getCategoryName(categories, value);
        return value;
    };

    const getColor = (value: string): string => {
        if (filterType === 'priority') return PRIORITY_COLORS[value as PriorityLevel];
        if (filterType === 'category') return getCategoryColor(categories, value);
        return COLORS.primary;
    };

    const handleToggle = (value: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(value)) {
            newSelected.delete(value);
        } else {
            newSelected.add(value);
        }
        setSelected(newSelected);
    };

    const handleClearAll = () => setSelected(new Set());

    const handleSave = () => {
        if (filterType) {
            onSave(filterType, selected);
            onClose();
        }
    };

    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modal} onPress={() => {}}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Filter by {filterType?.charAt(0).toUpperCase()}{filterType?.slice(1)}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {getOptions().map((option) => {
                            const isSelected = selected.has(option);
                            const color = getColor(option);
                            const label = getLabel(option);

                            return (
                                <TouchableOpacity
                                    key={option}
                                    style={[styles.option, isSelected && { backgroundColor: color + '15' }]}
                                    onPress={() => handleToggle(option)}
                                >
                                    {isSelected && (
                                        <Ionicons name="checkmark" size={20} color={color} style={{ marginRight: 10 }} />
                                    )}
                                    {!isSelected && <View style={styles.placeholder} />}
                                    {filterType === 'priority' && (
                                        <View
                                            style={[
                                                styles.priorityDot,
                                                { backgroundColor: color },
                                            ]}
                                        />
                                    )}
                                    {filterType === 'category' && (
                                        <View
                                            style={[
                                                styles.categoryDot,
                                                { backgroundColor: color },
                                            ]}
                                        />
                                    )}
                                    <Text
                                        style={[
                                            styles.optionText,
                                            isSelected && { color, fontWeight: '700' },
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
                        <TouchableOpacity
                            style={styles.clearBtn}
                            onPress={handleClearAll}
                        >
                            <Text style={styles.clearBtnText}>Clear All</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.doneBtn}
                            onPress={handleSave}
                        >
                            <Text style={styles.doneBtnText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: { fontSize: 16, fontWeight: '700', color: '#333' },
    content: { paddingHorizontal: 12, paddingVertical: 8 },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 8,
        marginVertical: 4,
    },
    placeholder: { width: 20, marginRight: 10 },
    priorityDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    optionText: { fontSize: 14, color: '#555', fontWeight: '500' },
    footer: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    clearBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    clearBtnText: { fontSize: 14, fontWeight: '600', color: '#666' },
    doneBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
    },
    doneBtnText: { fontSize: 14, fontWeight: '600', color: 'white' },
});
