import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, PRESET_PALETTE } from '../styles/theme';
import { useTaskStore } from '../store/appStore';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export default function AddCategoryModal({ visible, onClose }: Props) {
    const { categories, addCategory } = useTaskStore();
    const [name, setName] = useState('');
    const [selectedColor, setSelectedColor] = useState(PRESET_PALETTE[0]);

    const trimmed = name.trim();
    const alreadyExists = categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase());
    const canAdd = trimmed.length > 0 && !alreadyExists;

    function handleAdd() {
        if (!canAdd) return;
        addCategory(trimmed, selectedColor);
        setName('');
        setSelectedColor(PRESET_PALETTE[0]);
        onClose();
    }

    function handleClose() {
        setName('');
        setSelectedColor(PRESET_PALETTE[0]);
        onClose();
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>New Category</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Category name"
                        placeholderTextColor="#aaa"
                        value={name}
                        onChangeText={setName}
                        maxLength={20}
                        autoFocus
                    />
                    {alreadyExists && trimmed.length > 0 && (
                        <Text style={styles.error}>That category already exists</Text>
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
                                    <Ionicons name="checkmark" size={14} color="white" />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.buttons}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
                            onPress={handleAdd}
                            disabled={!canAdd}
                        >
                            <Text style={styles.addText}>Add</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: '#fff', borderRadius: 16, padding: 20, width: '85%' },
    title: { fontSize: 18, fontWeight: '700', color: '#222', marginBottom: 14 },
    input: {
        borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#222',
    },
    error: { color: '#E53935', fontSize: 12, marginTop: 4 },
    label: { fontSize: 13, fontWeight: '600', color: '#555', marginTop: 16, marginBottom: 8 },
    palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    swatch: {
        width: 34, height: 34, borderRadius: 17,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'transparent',
    },
    swatchSelected: { borderColor: '#222' },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    cancelText: { color: '#888', fontSize: 14 },
    addBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    addBtnDisabled: { opacity: 0.4 },
    addText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
