import React, { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, PriorityLevel } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore, getCategoryColor, getCategoryName } from '../store/appStore';
import { TaskStatus } from '../types';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

interface Props {
    isOpen: boolean;
    filterType: FilterType | null;
    onClose: () => void;
    onSave: (filterType: FilterType, selectedSet: Set<string>) => void;
}

const STATUS_OPTIONS: TaskStatus[] = ['Ready', 'In Progress', 'Paused'];
const PRIORITY_OPTIONS: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];
const DUE_DATE_OPTIONS: ('overdue' | 'today' | 'upcoming')[] = ['overdue', 'today', 'upcoming'];
const DUE_DATE_LABELS = { overdue: 'Overdue', today: 'Today', upcoming: 'Upcoming' };

const pressedOpacity = { opacity: 0.7 } as const;
const checkmarkStyle = { marginRight: 10 } as const;
const optionKeyExtractor = (item: string) => item;

interface FilterRowProps {
    option: string;
    isSelected: boolean;
    color: string;
    label: string;
    filterType: FilterType | null;
    onToggle: (value: string) => void;
    primaryColor: string;
    styles: ReturnType<typeof makeStyles>;
}

function FilterRow({ option, isSelected, color, label, filterType, onToggle, primaryColor, styles }: FilterRowProps) {
    return (
        <Pressable
            style={({ pressed }) => [styles.option, isSelected && styles.optionSelected, pressed && pressedOpacity]}
            onPress={() => onToggle(option)}
        >
            {isSelected && (
                <Ionicons name="checkmark" size={20} color={primaryColor} style={checkmarkStyle} />
            )}
            {!isSelected && <View style={styles.placeholder} />}
            {filterType === 'priority' && (
                <View style={[styles.priorityDot, { backgroundColor: color }]} />
            )}
            {filterType === 'category' && (
                <View style={[styles.categoryDot, { backgroundColor: color }]} />
            )}
            <Text
                style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                ]}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export default function FilterModal({ isOpen, filterType, onClose, onSave }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const priorityColors: Record<PriorityLevel, string> = colors.priority;
    const insets = useSafeAreaInsets();
    const categories = useTaskStore((s) => s.categories);
    const statusFilters = useTaskStore((s) => s.statusFilters);
    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const priorityFilters = useTaskStore((s) => s.priorityFilters);
    const dueDateFilters = useTaskStore((s) => s.dueDateFilters);

    const currentFilters = (() => {
        if (!filterType) return new Set<string>();
        if (filterType === 'status') return statusFilters as Set<string>;
        if (filterType === 'category') return categoryFilters;
        if (filterType === 'priority') return priorityFilters as Set<string>;
        if (filterType === 'dueDate') return dueDateFilters as Set<string>;
        return new Set<string>();
    })();

    const [selected, setSelected] = useState<Set<string>>(() => new Set(currentFilters));

    const categoryIds: string[] = [];
    for (const c of categories) categoryIds.push(c.id);

    let options: string[] = [];
    if (filterType === 'status') options = STATUS_OPTIONS;
    else if (filterType === 'category') options = categoryIds;
    else if (filterType === 'priority') options = PRIORITY_OPTIONS;
    else if (filterType === 'dueDate') options = DUE_DATE_OPTIONS;

    const getLabel = (value: string): string => {
        if (filterType === 'dueDate') return DUE_DATE_LABELS[value as keyof typeof DUE_DATE_LABELS] || value;
        if (filterType === 'category') return getCategoryName(categories, value);
        return value;
    };

    const getColor = (value: string): string => {
        if (filterType === 'priority') return priorityColors[value as PriorityLevel];
        if (filterType === 'category') return getCategoryColor(categories, value);
        return colors.primary;
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

    const renderOption = ({ item: option }: { item: string }) => (
        <FilterRow
            option={option}
            isSelected={selected.has(option)}
            color={getColor(option)}
            label={getLabel(option)}
            filterType={filterType}
            onToggle={handleToggle}
            primaryColor={colors.primary}
            styles={styles}
        />
    );

    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modal} onPress={() => {}}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Filter by {filterType?.charAt(0).toUpperCase()}{filterType?.slice(1)}</Text>
                        <Pressable
                            onPress={onClose}
                            style={({ pressed }) => pressed && { opacity: 0.7 }}
                        >
                            <Ionicons name="close" size={24} color={colors.text.secondary} />
                        </Pressable>
                    </View>

                    <FlatList
                        contentContainerStyle={styles.content}
                        data={options}
                        keyExtractor={optionKeyExtractor}
                        renderItem={renderOption}
                    />

                    <View style={[styles.footer, { paddingBottom: Math.max(12, insets.bottom) }]}>
                        <Pressable
                            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleClearAll}
                        >
                            <Text style={styles.clearBtnText}>Clear All</Text>
                        </Pressable>
                        <Pressable
                            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.7 }]}
                            onPress={handleSave}
                        >
                            <Text style={styles.doneBtnText}>Done</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: c.overlay.scrim,
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: c.surfaceElevated,
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
        borderBottomColor: c.border.light,
    },
    title: { fontSize: 16, fontWeight: '700', color: c.text.secondary },
    content: { paddingHorizontal: 12, paddingVertical: 8 },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 8,
        marginVertical: 4,
    },
    optionSelected: { backgroundColor: c.overlay.accentStrong },
    placeholder: { width: 20, marginRight: 10 },
    priorityDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    categoryDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
    optionText: { fontSize: 14, color: c.text.muted, fontWeight: '500' },
    optionTextSelected: { color: c.text.primary, fontWeight: '700' },
    footer: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: c.border.light,
    },
    clearBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.text.disabled,
        alignItems: 'center',
    },
    clearBtnText: { fontSize: 14, fontWeight: '600', color: c.text.subtle },
    doneBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: c.primary,
        alignItems: 'center',
    },
    doneBtnText: { fontSize: 14, fontWeight: '600', color: c.white },
});
