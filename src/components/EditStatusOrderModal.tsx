import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { COLORS } from '../styles/theme';
import { useTaskStore } from '../store/appStore';
import { TaskStatus, StatusOrderConfig } from '../types';

interface Props {
    visible: boolean;
    onClose: () => void;
}

const STATUS_TYPES: TaskStatus[] = ['Ready', 'In Progress', 'Paused', 'Done'];

export default function EditStatusOrderModal({ visible, onClose }: Props) {
    const statusOrderConfig = useTaskStore((s) => s.statusOrderConfig);
    const setStatusOrderConfig = useTaskStore((s) => s.setStatusOrderConfig);

    const [orders, setOrders] = useState<StatusOrderConfig>(statusOrderConfig);

    const handleOrderChange = (status: TaskStatus, value: string) => {
        const num = value === '' ? 0 : parseFloat(value);
        if (!isNaN(num) && num >= 0) {
            setOrders((prev) => ({ ...prev, [status]: num }));
        }
    };

    const handleSave = () => {
        setStatusOrderConfig(orders);
        onClose();
    };

    const handleClose = () => {
        setOrders(statusOrderConfig);
        onClose();
    };

    const getSortedStatuses = () => {
        return [...STATUS_TYPES].sort((a, b) => orders[a] - orders[b]);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <Text style={styles.title}>Status Order</Text>
                    <Text style={styles.subtitle}>
                        Tasks are sorted by status order first, then by due date/time, then by name.
                    </Text>

                    <ScrollView style={styles.content} scrollEnabled={false}>
                        <Text style={styles.label}>Current Order:</Text>
                        <View style={styles.orderPreview}>
                            {getSortedStatuses().map((status, idx) => (
                                <Text key={status} style={styles.orderItem}>
                                    {idx + 1}. {status}
                                </Text>
                            ))}
                        </View>

                        <Text style={[styles.label, styles.labelTop]}>Edit Order Values:</Text>
                        {STATUS_TYPES.map((status) => (
                            <View key={status} style={styles.statusRow}>
                                <Text style={styles.statusLabel}>{status}</Text>
                                <TextInput
                                    style={styles.orderInput}
                                    placeholder="0"
                                    placeholderTextColor={COLORS.text.light}
                                    value={String(orders[status])}
                                    onChangeText={(value) => handleOrderChange(status, value)}
                                    keyboardType="decimal-pad"
                                    maxLength={5}
                                />
                            </View>
                        ))}
                    </ScrollView>

                    <View style={styles.buttons}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                            <Text style={styles.saveText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: COLORS.overlay.scrimDeep, justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 20, width: '88%', maxHeight: '80%' },
    title: { fontSize: 18, fontWeight: '700', color: COLORS.text.primary, marginBottom: 4 },
    subtitle: { fontSize: 12, color: COLORS.text.subtle, marginBottom: 16, lineHeight: 16 },
    content: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: COLORS.text.muted, marginBottom: 8 },
    labelTop: { marginTop: 12 },
    orderPreview: { backgroundColor: COLORS.surfaceAlt.muted, borderRadius: 8, padding: 12, marginBottom: 12 },
    orderItem: { fontSize: 13, color: COLORS.text.secondary, lineHeight: 20 },
    statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' },
    statusLabel: { fontSize: 14, color: COLORS.text.secondary, fontWeight: '500', flex: 1 },
    orderInput: {
        borderWidth: 1, borderColor: COLORS.border.medium, borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, color: COLORS.text.primary, width: 70, textAlign: 'center',
    },
    buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
    cancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
    cancelText: { color: COLORS.text.weak, fontSize: 14 },
    saveBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
    saveText: { color: COLORS.surface, fontWeight: '700', fontSize: 14 },
});
