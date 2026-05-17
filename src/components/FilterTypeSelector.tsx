import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (filterType: FilterType) => void;
}

const FILTER_TYPES: { type: FilterType; label: string; icon: string; description: string }[] = [
    { type: 'status', label: 'Status', icon: 'radio-button-on', description: 'Ready, In Progress, Done' },
    { type: 'category', label: 'Category', icon: 'folder', description: 'Friends, Personal, etc.' },
    { type: 'priority', label: 'Priority', icon: 'alert-circle', description: 'Critical, High, Medium, Low' },
    { type: 'dueDate', label: 'Due Date', icon: 'calendar', description: 'Overdue, Today, Upcoming' },
];

export default function FilterTypeSelector({ isOpen, onClose, onSelect }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const statusCount = useTaskStore((s) => s.statusFilters.size);
    const categoryCount = useTaskStore((s) => s.categoryFilters.size);
    const priorityCount = useTaskStore((s) => s.priorityFilters.size);
    const dueDateCount = useTaskStore((s) => s.dueDateFilters.size);
    const clearAllFilters = useTaskStore((s) => s.clearAllFilters);

    const counts: Record<FilterType, number> = {
        status: statusCount,
        category: categoryCount,
        priority: priorityCount,
        dueDate: dueDateCount,
    };
    const totalCount = statusCount + categoryCount + priorityCount + dueDateCount;

    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modal} onPress={() => {}}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Filter</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text.secondary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {FILTER_TYPES.map((item) => {
                            const count = counts[item.type];
                            return (
                                <TouchableOpacity
                                    key={item.type}
                                    style={styles.option}
                                    onPress={() => {
                                        onSelect(item.type);
                                        onClose();
                                    }}
                                >
                                    <Ionicons name={item.icon as any} size={24} color={colors.primary} />
                                    <View style={styles.optionText}>
                                        <Text style={styles.optionLabel}>{item.label}</Text>
                                        <Text style={styles.optionDesc}>{item.description}</Text>
                                    </View>
                                    {count > 0 && (
                                        <View style={styles.countBadge}>
                                            <Text style={styles.countBadgeText}>{count}</Text>
                                        </View>
                                    )}
                                    <Ionicons name="chevron-forward" size={20} color={colors.text.disabled} />
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <TouchableOpacity
                        style={[styles.clearAllBtn, totalCount === 0 && styles.clearAllBtnDisabled]}
                        onPress={() => { clearAllFilters(); onClose(); }}
                        disabled={totalCount === 0}
                    >
                        <Ionicons name="close-circle-outline" size={18} color={totalCount === 0 ? colors.text.disabled : colors.text.errorStrong} />
                        <Text style={[styles.clearAllText, totalCount === 0 && styles.clearAllTextDisabled]}>Clear all filters</Text>
                    </TouchableOpacity>
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
        backgroundColor: c.surface,
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
        paddingVertical: 16,
        borderRadius: 8,
        marginVertical: 4,
        backgroundColor: c.surfaceAlt.light,
    },
    optionText: { flex: 1, marginLeft: 12 },
    optionLabel: { fontSize: 15, fontWeight: '600', color: c.text.secondary, marginBottom: 2 },
    optionDesc: { fontSize: 12, color: c.text.placeholder },
    countBadge: {
        backgroundColor: c.accent.warning, borderRadius: 10, minWidth: 20, height: 20,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, marginRight: 8,
    },
    countBadgeText: { color: c.white, fontSize: 11, fontWeight: '700' },
    clearAllBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 14, borderTopWidth: 1, borderTopColor: c.border.light,
    },
    clearAllBtnDisabled: { opacity: 0.4 },
    clearAllText: { fontSize: 14, fontWeight: '600', color: c.text.errorStrong },
    clearAllTextDisabled: { color: c.text.disabled },
});
