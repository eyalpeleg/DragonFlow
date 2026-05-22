import { AntDesign, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { RecurrenceFrequency } from '../types';
import TimePickerField from './TimePickerField';

type EditorSection = 'date' | 'time' | 'recurrence' | null;

interface Props {
    dueDate: Date | null;
    dueTime: string;
    isRecurring: boolean;
    frequency: RecurrenceFrequency;
    interval: string;
    onChangeDueDate: (d: Date | null) => void;
    onChangeDueTime: (t: string) => void;
    onChangeIsRecurring: (v: boolean) => void;
    onChangeFrequency: (f: RecurrenceFrequency) => void;
    onChangeInterval: (i: string) => void;
}

const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly'];
const INTERVAL_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10

function addDays(d: Date, n: number): Date {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
}

function intervalUnitLabel(f: RecurrenceFrequency, n: number): string {
    const plural = n !== 1;
    if (f === 'daily') return plural ? 'days' : 'day';
    if (f === 'weekly') return plural ? 'weeks' : 'week';
    return plural ? 'months' : 'month';
}

export default function ScheduleEditor({
    dueDate, dueTime, isRecurring, frequency, interval,
    onChangeDueDate, onChangeDueTime, onChangeIsRecurring, onChangeFrequency, onChangeInterval,
}: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [editor, setEditor] = useState<EditorSection>(null);
    const [showNativeDatePicker, setShowNativeDatePicker] = useState(false);
    const [intervalPickerOpen, setIntervalPickerOpen] = useState(false);

    function toggleEditor(next: EditorSection) {
        setEditor((cur) => (cur === next ? null : next));
        if (next !== 'date') setShowNativeDatePicker(false);
    }

    function handleQuickPick(d: Date) {
        onChangeDueDate(d);
        setShowNativeDatePicker(false);
        setEditor(null);
    }

    function handleClearDate() {
        onChangeDueDate(null);
        onChangeIsRecurring(false);
        setEditor(null);
    }

    function handleNativePickerChange(d?: Date) {
        setShowNativeDatePicker(false);
        if (d) {
            onChangeDueDate(d);
            setEditor(null);
        }
    }

    const dateLabel = dueDate
        ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Pick date';
    const recurringLabel = isRecurring
        ? `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} · ${interval || 1}`
        : 'Off';
    const selectedInterval = String(parseInt(interval, 10) || 1);

    return (
        <View>
            <View style={styles.pillRow}>
                <TouchableOpacity
                    onPress={() => toggleEditor('date')}
                    style={[styles.pill, editor === 'date' && styles.pillActive, !dueDate && styles.pillDim]}
                    accessibilityRole="button"
                    accessibilityLabel="Due date"
                >
                    <Ionicons
                        name="calendar"
                        size={14}
                        color={editor === 'date' ? colors.white : (dueDate ? colors.primary : colors.text.disabled)}
                    />
                    <Text style={[styles.pillText, editor === 'date' && styles.pillTextActive, !dueDate && styles.pillTextDim]}>
                        {dateLabel}
                    </Text>
                </TouchableOpacity>

                {dueDate && (
                    <>
                        <TouchableOpacity
                            onPress={() => toggleEditor('time')}
                            style={[styles.pill, editor === 'time' && styles.pillActive]}
                            accessibilityRole="button"
                            accessibilityLabel="Due time"
                        >
                            <Ionicons
                                name="time"
                                size={14}
                                color={editor === 'time' ? colors.white : colors.primary}
                            />
                            <Text style={[styles.pillText, editor === 'time' && styles.pillTextActive]}>{dueTime}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => toggleEditor('recurrence')}
                            style={[styles.pill, editor === 'recurrence' && styles.pillActive, !isRecurring && styles.pillDim]}
                            accessibilityRole="button"
                            accessibilityLabel="Recurrence"
                            accessibilityState={{ selected: isRecurring }}
                        >
                            <AntDesign
                                name="sync"
                                size={14}
                                color={editor === 'recurrence' ? colors.white : (isRecurring ? colors.primary : colors.text.disabled)}
                            />
                            <Text style={[
                                styles.pillText,
                                editor === 'recurrence' && styles.pillTextActive,
                                !isRecurring && styles.pillTextDim,
                            ]}>
                                {recurringLabel}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleClearDate} style={styles.clearBtn} accessibilityLabel="Clear due date">
                            <Ionicons name="close-circle" size={20} color={colors.text.veryLight} />
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {editor === 'date' && (
                <View style={styles.editorPanel}>
                    <View style={styles.chipsRow}>
                        <TouchableOpacity style={styles.chip} onPress={() => handleQuickPick(new Date())}>
                            <Text style={styles.chipText}>Today</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chip} onPress={() => handleQuickPick(addDays(new Date(), 1))}>
                            <Text style={styles.chipText}>Tomorrow</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.chip} onPress={() => handleQuickPick(addDays(new Date(), 7))}>
                            <Text style={styles.chipText}>Next Week</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.chip, styles.otherChip]} onPress={() => setShowNativeDatePicker(true)}>
                            <Ionicons name="calendar-outline" size={14} color={colors.primary} />
                            <Text style={[styles.chipText, { color: colors.primary }]}>Other…</Text>
                        </TouchableOpacity>
                    </View>
                    {showNativeDatePicker && (Platform.OS === 'ios' ? (
                        <View style={{ marginTop: 8 }}>
                            <DateTimePicker
                                value={dueDate ?? new Date()}
                                mode="date"
                                display="inline"
                                minimumDate={new Date()}
                                onChange={(_, d) => handleNativePickerChange(d)}
                                themeVariant="light"
                                accentColor={colors.primary}
                            />
                        </View>
                    ) : (
                        <DateTimePicker
                            value={dueDate ?? new Date()}
                            mode="date"
                            display="default"
                            minimumDate={new Date()}
                            onChange={(_, d) => handleNativePickerChange(d)}
                        />
                    ))}
                </View>
            )}

            {editor === 'time' && dueDate && (
                <View style={styles.editorPanel}>
                    <TimePickerField value={dueTime} onChange={onChangeDueTime} />
                </View>
            )}

            {editor === 'recurrence' && dueDate && (
                <View style={styles.editorPanel}>
                    <Text style={styles.sublabel}>Repeats</Text>
                    <View style={styles.chipsRow}>
                        <TouchableOpacity
                            onPress={() => onChangeIsRecurring(false)}
                            style={[styles.chip, !isRecurring && styles.chipActive]}
                        >
                            <Text style={[styles.chipText, !isRecurring && styles.chipTextActive]}>Off</Text>
                        </TouchableOpacity>
                        {FREQUENCIES.map((f) => {
                            const active = isRecurring && frequency === f;
                            return (
                                <TouchableOpacity
                                    key={f}
                                    onPress={() => {
                                        onChangeIsRecurring(true);
                                        onChangeFrequency(f);
                                    }}
                                    style={[styles.chip, active && styles.chipActive]}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    {isRecurring && (
                        <View style={styles.intervalSentence}>
                            <Text style={styles.intervalText}>Every</Text>
                            <TouchableOpacity
                                onPress={() => setIntervalPickerOpen(true)}
                                style={styles.intervalDropdown}
                                accessibilityRole="button"
                                accessibilityLabel={`Every ${selectedInterval} ${intervalUnitLabel(frequency, parseInt(selectedInterval, 10))}`}
                            >
                                <Text style={styles.intervalDropdownText}>{selectedInterval}</Text>
                                <Ionicons name="chevron-down" size={14} color={colors.primary} />
                            </TouchableOpacity>
                            <Text style={styles.intervalText}>{intervalUnitLabel(frequency, parseInt(selectedInterval, 10))}</Text>
                        </View>
                    )}
                </View>
            )}

            <Modal
                visible={intervalPickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setIntervalPickerOpen(false)}
            >
                <TouchableOpacity
                    style={styles.dropdownBackdrop}
                    activeOpacity={1}
                    onPress={() => setIntervalPickerOpen(false)}
                >
                    <View style={styles.dropdownCard}>
                        <ScrollView style={styles.dropdownList} showsVerticalScrollIndicator={false}>
                            {INTERVAL_OPTIONS.map((n) => {
                                const selected = String(n) === selectedInterval;
                                return (
                                    <TouchableOpacity
                                        key={n}
                                        style={[styles.dropdownItem, selected && styles.dropdownItemSelected]}
                                        onPress={() => {
                                            onChangeInterval(String(n));
                                            setIntervalPickerOpen(false);
                                        }}
                                    >
                                        <Text style={[styles.dropdownItemText, selected && styles.dropdownItemTextSelected]}>
                                            {n}
                                        </Text>
                                        {selected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    pillRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    pill: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
        backgroundColor: c.surfaceAlt.soft,
    },
    pillActive: { backgroundColor: c.primary },
    pillDim: { backgroundColor: c.surfaceAlt.soft },
    pillText: { fontSize: 13, fontWeight: '600', color: c.text.body },
    pillTextActive: { color: c.white },
    pillTextDim: { color: c.text.placeholder },
    clearBtn: { padding: 2 },
    editorPanel: {
        backgroundColor: c.surfaceAlt.offWhite,
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
    },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        backgroundColor: c.surfaceAlt.soft,
        flexDirection: 'row', alignItems: 'center', gap: 4,
    },
    chipActive: { backgroundColor: c.primary },
    chipText: { fontSize: 12, fontWeight: '600', color: c.text.body },
    chipTextActive: { color: c.white },
    otherChip: { backgroundColor: c.overlay.accentMedium },
    sublabel: { fontSize: 12, fontWeight: '600', color: c.text.weak, marginTop: 10, marginBottom: 6 },
    intervalSentence: {
        flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
    },
    intervalText: { fontSize: 13, color: c.text.body },
    intervalDropdown: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14,
        backgroundColor: c.overlay.accentMedium,
    },
    intervalDropdownText: { fontSize: 13, fontWeight: '700', color: c.primary, minWidth: 14, textAlign: 'center' },
    dropdownBackdrop: {
        flex: 1, backgroundColor: c.overlay.scrim, alignItems: 'center', justifyContent: 'center',
    },
    dropdownCard: {
        backgroundColor: c.surface, borderRadius: 12, paddingVertical: 6,
        minWidth: 120, maxHeight: 320,
        shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
        elevation: 8,
    },
    dropdownList: { paddingHorizontal: 4 },
    dropdownItem: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    },
    dropdownItemSelected: { backgroundColor: c.surfaceAlt.soft },
    dropdownItemText: { fontSize: 15, color: c.text.body },
    dropdownItemTextSelected: { color: c.primary, fontWeight: '700' },
});
