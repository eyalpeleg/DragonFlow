import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppColors, PRESET_PALETTE } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';
import { Category } from '../types';

interface Props {
    visible: boolean;
    category: Category | null;
    onClose: () => void;
}

export default function EditCategoryModal({ visible, category, onClose }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { categories, updateCategory } = useTaskStore();
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(PRESET_PALETTE[0]);

    useEffect(() => {
        if (category) {
            setName(category.name);
            setSelectedColor(category.color);
        }
    }, [category]);

    const trimmed = name.trim();
    const nameConflict = categories.some(
        (c) => c.id !== category?.id && c.name.toLowerCase() === trimmed.toLowerCase()
    );
    const canSave = trimmed.length > 0 && !nameConflict;

    function handleSave() {
        if (!canSave || !category) return;
        updateCategory(category.id, { name: trimmed, color: selectedColor });
        onClose();
    }

    function handleClose() {
        onClose();
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>Edit Category</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Category name"
                        placeholderTextColor={colors.text.light}
                        value={name}
                        onChangeText={setName}
                        maxLength={20}
                        autoFocus
                    />
                    {nameConflict && trimmed.length > 0 && (
                        <Text style={styles.error}>A category with that name already exists</Text>
                    )}

                    <Text style={styles.label}>Color</Text>
                    <View style={styles.palette}>
                        {PRESET_PALETTE.map((color) => (
                            <TouchableOpacity
                                key={color}
                                style={[styles.swatch, { backgroundColor: color }, selectedColor === color && styles.swatchSelected]}
                                onPress={() => setSelectedColor(color)}
                            >
                                {selectedColor === color && (
                                    <Ionicons name="checkmark" size={14} color={colors.white} />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.buttons}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                            onPress={handleSave}
                            disabled={!canSave}
                        >
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay.scrimDeep, justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: c.surface, borderRadius: 16, padding: 20, width: '85%' },
    title: { fontSize: 18, fontWeight: '700', color: c.text.primary, marginBottom: 14 },
    input: {
        borderWidth: 1, borderColor: c.border.medium, borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: c.text.primary,
    },
    error: { color: c.text.error, fontSize: 12, marginTop: 4 },
    label: { fontSize: 13, fontWeight: '600', color: c.text.muted, marginTop: 16, marginBottom: 8 },
    palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatch: {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'transparent',
    },
    swatchSelected: { borderColor: c.text.primary },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    cancelText: { color: c.text.weak, fontSize: 14 },
    saveBtn: { backgroundColor: c.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    saveBtnDisabled: { opacity: 0.4 },
    saveText: { color: c.surface, fontWeight: '700', fontSize: 14 },
});
