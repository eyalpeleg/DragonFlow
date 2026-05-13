import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

type FilterType = 'status' | 'category' | 'priority' | 'dueDate';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (filterType: FilterType) => void;
}

const FILTER_TYPES: Array<{ type: FilterType; label: string; icon: string; description: string }> = [
    { type: 'status', label: 'Status', icon: 'radio-button-on', description: 'Ready, In Progress, Done' },
    { type: 'category', label: 'Category', icon: 'folder', description: 'Friends, Personal, etc.' },
    { type: 'priority', label: 'Priority', icon: 'alert-circle', description: 'Critical, High, Medium, Low' },
    { type: 'dueDate', label: 'Due Date', icon: 'calendar', description: 'Overdue, Today, Upcoming' },
];

export default function FilterTypeSelector({ isOpen, onClose, onSelect }: Props) {
    return (
        <Modal visible={isOpen} transparent animationType="slide" onRequestClose={onClose}>
            <Pressable style={styles.overlay} onPress={onClose}>
                <Pressable style={styles.modal} onPress={() => {}}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Filter</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.content}>
                        {FILTER_TYPES.map((item) => (
                            <TouchableOpacity
                                key={item.type}
                                style={styles.option}
                                onPress={() => {
                                    onSelect(item.type);
                                    onClose();
                                }}
                            >
                                <Ionicons name={item.icon as any} size={24} color={COLORS.primary} />
                                <View style={styles.optionText}>
                                    <Text style={styles.optionLabel}>{item.label}</Text>
                                    <Text style={styles.optionDesc}>{item.description}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color="#ccc" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-end',
    },
    modal: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: { fontSize: 16, fontWeight: '700', color: '#333' },
    content: { paddingHorizontal: 12, paddingVertical: 8 },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 16,
        borderRadius: 8,
        marginVertical: 4,
        backgroundColor: '#fafafa',
    },
    optionText: { flex: 1, marginLeft: 12 },
    optionLabel: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 2 },
    optionDesc: { fontSize: 12, color: '#999' },
});
