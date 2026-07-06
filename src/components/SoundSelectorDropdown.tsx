import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
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
    const styles = makeStyles(colors);
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
                        <Pressable
                            key={option}
                            style={({ pressed }) => [
                                styles.optionRow,
                                selectedValue === option && styles.optionRowSelected,
                                pressed && { opacity: 0.7 },
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
                        </Pressable>
                    ))}
                    <View style={styles.buttonContainer}>
                        <Pressable
                            style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
                            onPress={onClose}
                        >
                            <Text style={styles.closeBtnText}>Close</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: c.overlay.scrimSoft,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dropdown: {
        backgroundColor: c.surfaceElevated,
        borderRadius: 16,
        padding: 20,
        width: '85%',
        maxWidth: 400,
        boxShadow: '0px 4px 8px rgba(0,0,0,0.15)',
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
