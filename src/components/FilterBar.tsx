import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import { useTaskStore, getCategoryName } from '../store/appStore';
import { TaskStatus } from '../types';
import { PriorityLevel } from '../styles/theme';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

interface Props {
    onFilterPress: (filterType: FilterType) => void;
    onAddFilter: () => void;
}

const FILTER_CONFIG: Record<FilterType, { icon: string; label: string; color: string }> = {
    status: { icon: 'radio-button-on', label: 'Status', color: COLORS.primary },
    category: { icon: 'folder', label: 'Category', color: COLORS.primary },
    priority: { icon: 'alert-circle', label: 'Priority', color: '#FF9800' },
    dueDate: { icon: 'calendar', label: 'Due', color: '#666' },
};

const PRIORITY_COLORS: Record<PriorityLevel, string> = {
    Critical: '#F44336',
    High: '#FF9800',
    Medium: '#FFC107',
    Low: '#4CAF50',
};

export default function FilterBar({ onFilterPress, onAddFilter }: Props) {
    const statusFilters = useTaskStore((s) => s.statusFilters);
    const categoryFilters = useTaskStore((s) => s.categoryFilters);
    const priorityFilters = useTaskStore((s) => s.priorityFilters);
    const dueDateFilters = useTaskStore((s) => s.dueDateFilters);
    const categories = useTaskStore((s) => s.categories);

    const activeFilters = [statusFilters, categoryFilters, priorityFilters, dueDateFilters];
    const hasActiveFilters = activeFilters.some((f) => f.size > 0);

    if (!hasActiveFilters) return null;

    const renderPill = (
        filterType: FilterType,
        values: Set<string>,
        getDisplayValue: (val: string) => string
    ) => {
        if (values.size === 0) return null;
        const config = FILTER_CONFIG[filterType];
        const displayValues = Array.from(values).map(getDisplayValue).join(', ');

        return (
            <TouchableOpacity
                key={filterType}
                style={styles.pill}
                onPress={() => onFilterPress(filterType)}
            >
                <Ionicons name={config.icon as any} size={14} color={config.color} />
                <Text style={styles.pillText}>
                    {config.label}: {displayValues}
                </Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.content}
            >
                {renderPill(
                    'status',
                    statusFilters as Set<string>,
                    (val) => val
                )}
                {renderPill(
                    'category',
                    categoryFilters,
                    (val) => getCategoryName(categories, val)
                )}
                {renderPill(
                    'priority',
                    priorityFilters as Set<string>,
                    (val) => val
                )}
                {renderPill(
                    'dueDate',
                    dueDateFilters as Set<string>,
                    (val) => {
                        if (val === 'overdue') return 'Overdue';
                        if (val === 'today') return 'Today';
                        if (val === 'upcoming') return 'Upcoming';
                        return val;
                    }
                )}

                {activeFilters.some((f) => f.size > 0) && activeFilters.some((f) => f.size === 0) && (
                    <TouchableOpacity style={styles.addBtn} onPress={onAddFilter}>
                        <Ionicons name="add" size={16} color={COLORS.primary} />
                        <Text style={styles.addBtnText}>Add Filter</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fafafa',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    content: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: 'white',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333',
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: 'white',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    addBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.primary,
    },
});
