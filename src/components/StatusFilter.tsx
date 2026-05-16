import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { TaskStatus } from '../types';

interface Props {
    active: TaskStatus | null;
    onChange: (status: TaskStatus | null) => void;
}

const CHIPS: { label: string; value: TaskStatus | null }[] = [
    { label: 'All',         value: null },
    { label: 'Ready',       value: 'Ready' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Paused',      value: 'Paused' },
    { label: 'Done',        value: 'Done' },
];

export default function StatusFilter({ active, onChange }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const statusColors = useMemo<Record<string, string>>(() => ({
        Ready:        colors.status['Ready'],
        'In Progress': colors.status['In Progress'],
        Paused:       colors.status['Paused'],
        Done:         colors.status['Done'],
    }), [colors]);

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            {CHIPS.map((chip) => {
                const isActive = active === chip.value;
                const color = chip.value ? statusColors[chip.value] : colors.primary;
                return (
                    <TouchableOpacity
                        key={String(chip.value)}
                        style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
                        onPress={() => onChange(chip.value)}
                    >
                        <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                            {chip.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: { maxHeight: 44, backgroundColor: c.surfaceAlt.light, borderBottomWidth: 1, borderBottomColor: c.border.light },
    content: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
    chip: {
        paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16,
        backgroundColor: c.surfaceAlt.soft, borderWidth: 1, borderColor: c.border.muted,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: c.text.subtle },
    chipTextActive: { color: c.white },
});
