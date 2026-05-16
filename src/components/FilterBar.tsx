import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore, getCategoryName } from '../store/appStore';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

interface Props {
    onFilterPress: (filterType: FilterType) => void;
    onAddFilter: () => void;
}

export default function FilterBar({ onFilterPress, onAddFilter }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const filterConfig = useMemo<Record<FilterType, { icon: string; label: string; color: string }>>(() => ({
        status: { icon: 'radio-button-on', label: 'Status', color: colors.primary },
        category: { icon: 'folder', label: 'Category', color: colors.primary },
        priority: { icon: 'alert-circle', label: 'Priority', color: colors.accent.warning },
        dueDate: { icon: 'calendar', label: 'Due', color: colors.text.subtle },
    }), [colors]);

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
        const config = filterConfig[filterType];
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
                        <Ionicons name="add" size={16} color={colors.primary} />
                        <Text style={styles.addBtnText}>Add Filter</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: {
        backgroundColor: c.surfaceAlt.light,
        borderBottomWidth: 1,
        borderBottomColor: c.border.light,
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
        backgroundColor: c.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.border.muted,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
        color: c.text.secondary,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: c.white,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: c.primary,
    },
    addBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: c.primary,
    },
});
