import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { COLORS } from '../styles/theme';
import { getCategoryColor, useTaskStore } from '../store/taskStore';
import AddCategoryModal from './AddCategoryModal';

export default function TaskFilters() {
    const activeCategory = useTaskStore((s) => s.activeCategory);
    const setCategory = useTaskStore((s) => s.setCategory);
    const categories = useTaskStore((s) => s.categories);
    const deleteCategory = useTaskStore((s) => s.deleteCategory);
    const [addCatVisible, setAddCatVisible] = useState(false);

    function handleLongPress(name: string, builtIn: boolean) {
        if (builtIn) return;
        Alert.alert(
            'Delete Category',
            `Remove "${name}"? This only works if no active tasks use it.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        const ok = deleteCategory(name);
                        if (!ok) {
                            Alert.alert('Cannot delete', `"${name}" is still used by active tasks.`);
                        } else if (activeCategory === name) {
                            setCategory(null);
                        }
                    },
                },
            ]
        );
    }

    return (
        <>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.container}
                contentContainerStyle={styles.content}
            >
                <TouchableOpacity
                    style={[styles.chip, activeCategory === null && styles.chipActive]}
                    onPress={() => setCategory(null)}
                >
                    <Text style={[styles.chipText, activeCategory === null && styles.chipTextActive]}>All</Text>
                </TouchableOpacity>
                {categories.map((cat) => {
                    const isActive = activeCategory === cat.name;
                    const color = cat.color;
                    return (
                        <TouchableOpacity
                            key={cat.name}
                            style={[styles.chip, isActive && { backgroundColor: color, borderColor: color }]}
                            onPress={() => setCategory(cat.name)}
                            onLongPress={() => handleLongPress(cat.name, cat.builtIn)}
                            delayLongPress={500}
                        >
                            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{cat.name}</Text>
                        </TouchableOpacity>
                    );
                })}
                <TouchableOpacity style={styles.addChip} onPress={() => setAddCatVisible(true)}>
                    <Ionicons name="add" size={16} color={COLORS.primary} />
                </TouchableOpacity>
            </ScrollView>
            <AddCategoryModal visible={addCatVisible} onClose={() => setAddCatVisible(false)} />
        </>
    );
}

const styles = StyleSheet.create({
    container: { maxHeight: 48, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#eee' },
    content: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' },
    chip: {
        paddingHorizontal: 14, paddingVertical: 5, borderRadius: 16,
        backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: '#e0e0e0',
    },
    chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: '#555' },
    chipTextActive: { color: 'white' },
    addChip: {
        width: 30, height: 30, borderRadius: 15,
        backgroundColor: '#f0f0f0', borderWidth: 1, borderColor: COLORS.primary,
        alignItems: 'center', justifyContent: 'center',
    },
});
