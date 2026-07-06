import React from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { TaskStatus } from '../types';

interface Props {
    active: TaskStatus | null;
    onChange: (status: TaskStatus | null) => void;
}

type Chip = { label: string; value: TaskStatus | null };

const CHIPS: Chip[] = [
    { label: 'All',         value: null },
    { label: 'Ready',       value: 'Ready' },
    { label: 'In Progress', value: 'In Progress' },
    { label: 'Paused',      value: 'Paused' },
    { label: 'Done',        value: 'Done' },
];

export default function StatusFilter({ active, onChange }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const statusColors: Record<string, string> = {
        Ready:        colors.status['Ready'],
        'In Progress': colors.status['In Progress'],
        Paused:       colors.status['Paused'],
        Done:         colors.status['Done'],
    };

    const renderChip = ({ item: chip }: { item: Chip }) => {
        const isActive = active === chip.value;
        const color = chip.value ? statusColors[chip.value] : colors.primary;
        return (
            <Pressable
                style={({ pressed }) => [styles.chip, isActive && { backgroundColor: color, borderColor: color }, pressed && { opacity: 0.7 }]}
                onPress={() => onChange(chip.value)}
            >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                    {chip.label}
                </Text>
            </Pressable>
        );
    };

    return (
        <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.container}
            contentContainerStyle={styles.content}
            data={CHIPS}
            keyExtractor={(item) => String(item.value)}
            renderItem={renderChip}
        />
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
