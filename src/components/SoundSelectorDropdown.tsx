import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { useTaskStore } from '../store/appStore';
import { SoundType } from '../types';

interface Props {
    visible: boolean;
    options: SoundType[];
    selectedValue: SoundType;
    onSelect: (value: SoundType) => void;
    onClose: () => void;
}

export default function SoundSelectorDropdown({ visible, options, selectedValue, onSelect, onClose }: Props) {
    const colors = useColors();
    const debugMode = useTaskStore((s) => s.debugModeEnabled);
    const styles = useMemo(() => makeStyles(colors, debugMode), [colors, debugMode]);
    const handleSelect = (option: SoundType) => {
        onSelect(option);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.dropdown}>
                    <Text style={styles.title}>Select Sound Type</Text>
                    {options.map((option) => (
                        <TouchableOpacity
                            key={option}
                            style={[
                                styles.optionRow,
                                selectedValue === option && styles.optionRowSelected,
                            ]}
                            onPress={() => handleSelect(option)}
                        >
                            <Text
                                style={[
                                    styles.optionText,
                                    selectedValue === option && styles.optionTextSelected,
                                ]}
                            >
                                {option}
                            </Text>
                            {selectedValue === option && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={20}
                                    color={colors.primary}
                                    style={styles.checkmark}
                                />
                            )}
                        </TouchableOpacity>
                    ))}
                    <View style={styles.buttonContainer}>
                        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors, debug: boolean) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: debug ? c.overlay.debug.soundSelector : c.overlay.scrimSoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdown: {
        backgroundColor: c.surface,
        borderRadius: 16,
        padding: 20,
        width: '85%',
        maxWidth: 400,
        shadowColor: c.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: c.text.primary,
        marginBottom: 16,
        textAlign: 'center',
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 14,
        borderRadius: 8,
        marginBottom: 8,
    },
    optionRowSelected: {
        backgroundColor: c.overlay.accentStrong,
    },
    optionText: {
        flex: 1,
        fontSize: 15,
        color: c.text.secondary,
        fontWeight: '500',
    },
    optionTextSelected: {
        color: c.primary,
        fontWeight: '700',
    },
    checkmark: {
        marginLeft: 8,
    },
    buttonContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: c.border.subtle,
    },
    closeBtn: {
        padding: 12,
        alignItems: 'center',
    },
    closeBtnText: {
        color: c.text.weak,
        fontWeight: '600',
        fontSize: 15,
    },
});
