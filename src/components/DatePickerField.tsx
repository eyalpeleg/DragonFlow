import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';

function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

interface Props {
    value: Date | null;
    onChange: (date: Date) => void;
    onClear: () => void;
    expanded?: boolean;
}

export default function DatePickerField({ value, onChange, onClear, expanded }: Props) {
    const [showChips, setShowChips] = useState(false);
    const chipsVisible = showChips || (expanded && !value);
    const [showPicker, setShowPicker] = useState(false);

    const formatted = value?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    function handleQuickPick(date: Date) {
        setShowChips(false);
        onChange(date);
    }

    function handlePickerChange(date: Date | undefined) {
        setShowPicker(false);
        if (date) {
            setShowChips(false);
            onChange(date);
        }
    }

    function handleClear() {
        setShowChips(false);
        setShowPicker(false);
        onClear();
    }

    function renderChips() {
        const today = new Date();
        return (
            <View style={styles.chipsRow}>
                <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickPick(today)}>
                    <Text style={styles.quickChipText}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickPick(addDays(today, 1))}>
                    <Text style={styles.quickChipText}>Tomorrow</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.quickChip} onPress={() => handleQuickPick(addDays(today, 7))}>
                    <Text style={styles.quickChipText}>Next Week</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickChip, styles.otherChip]} onPress={() => setShowPicker(true)}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.primary} />
                    <Text style={[styles.quickChipText, { color: COLORS.primary }]}>Other...</Text>
                </TouchableOpacity>
            </View>
        );
    }

    function renderNativePicker() {
        if (Platform.OS === 'ios') {
            return (
                <View style={styles.iosPickerWrap}>
                    <DateTimePicker
                        value={value ?? new Date()}
                        mode="date"
                        display="inline"
                        minimumDate={new Date()}
                        onChange={(_, date) => handlePickerChange(date)}
                        themeVariant="light"
                        accentColor={COLORS.primary}
                    />
                </View>
            );
        }
        return (
            <DateTimePicker
                value={value ?? new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_, date) => handlePickerChange(date)}
            />
        );
    }

    // Selected state: show date pill with clear button
    if (value) {
        return (
            <View>
                <View style={styles.selectedRow}>
                    <TouchableOpacity style={styles.selectedPill} onPress={() => setShowChips(!showChips)}>
                        <Ionicons name="calendar" size={14} color="white" style={{ marginRight: 6 }} />
                        <Text style={styles.selectedText}>{formatted}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleClear} style={styles.clearBtn}>
                        <Ionicons name="close-circle" size={20} color="#bbb" />
                    </TouchableOpacity>
                </View>
                {showChips && renderChips()}
                {showPicker && renderNativePicker()}
            </View>
        );
    }

    // Empty state: show "Add due date" or chips
    if (chipsVisible) {
        return (
            <View>
                {renderChips()}
                {showPicker && renderNativePicker()}
            </View>
        );
    }

    return (
        <TouchableOpacity style={styles.emptyButton} onPress={() => setShowChips(true)}>
            <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
            <Text style={styles.emptyText}>Add due date</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1.5,
        borderColor: '#ddd',
        borderStyle: 'dashed',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    emptyText: {
        fontSize: 14,
        color: '#999',
        fontWeight: '500',
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 4,
    },
    quickChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
    },
    quickChipText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#444',
    },
    otherChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(79,55,139,0.08)',
    },
    selectedRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    selectedText: {
        fontSize: 13,
        fontWeight: '600',
        color: 'white',
    },
    clearBtn: {
        marginLeft: 6,
        padding: 2,
    },
    iosPickerWrap: {
        marginTop: 8,
    },
});
