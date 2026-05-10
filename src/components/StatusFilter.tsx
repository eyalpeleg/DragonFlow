import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../styles/theme';
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

const STATUS_COLORS: Record<string, string> = {
    Ready:        COLORS.status['Ready'],
    'In Progress': COLORS.status['In Progress'],
    Paused:       COLORS.status['Paused'],
    Done:         COLORS.status['Done'],
};

export default function StatusFilter({ active, onChange }: Props) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.container}
            contentContainerStyle={styles.content}
        >
            {CHIPS.map((chip) => {
                const isActive = active === chip.value;
                const color = chip.value ? STATUS_COLORS[chip.value] : COLORS.primary;
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

const styles = StyleSheet.create({
    container: { maxHeight: 44, backgroundColor: '#fafafa', borderBottomWidth: 1, borderBottomColor: '#eee' },
    content: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
    chip: {
        paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16,
        backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0',
    },
    chipText: { fontSize: 12, fontWeight: '600', color: '#666' },
    chipTextActive: { color: 'white' },
});
