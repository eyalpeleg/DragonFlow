import { AntDesign, Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useImperativeHandle, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { RecurrenceFrequency } from '../types';

type EditorSection = 'recurrence' | null;

export interface ScheduleEditorHandle {
    openDatePicker: () => void;
}

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
    onTimeSelected?: () => void; // fires after user commits a time via the picker
}

const FREQUENCIES: RecurrenceFrequency[] = ['daily', 'weekly', 'monthly'];
const INTERVAL_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1); // 1..10

const pressedOpacity = { opacity: 0.7 } as const;
const intervalKeyExtractor = (n: number) => String(n);

interface IntervalRowProps {
    n: number;
    isSelected: boolean;
    onSelect: (n: number) => void;
    primaryColor: string;
    styles: ReturnType<typeof makeStyles>;
}

function IntervalRow({ n, isSelected, onSelect, primaryColor, styles }: IntervalRowProps) {
    return (
        <Pressable
            style={({ pressed }) => [styles.dropdownItem, isSelected && styles.dropdownItemSelected, pressed && pressedOpacity]}
            onPress={() => onSelect(n)}
        >
            <Text style={[styles.dropdownItemText, isSelected && styles.dropdownItemTextSelected]}>
                {n}
            </Text>
            {isSelected && <Ionicons name="checkmark" size={16} color={primaryColor} />}
        </Pressable>
    );
}

function intervalUnitLabel(f: RecurrenceFrequency, n: number): string {
    const plural = n !== 1;
    if (f === 'daily') return plural ? 'days' : 'day';
    if (f === 'weekly') return plural ? 'weeks' : 'week';
    return plural ? 'months' : 'month';
}

function timeToDate(time: string): Date {
    const [h, m] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
}

function ScheduleEditor({
    dueDate, dueTime, isRecurring, frequency, interval,
    onChangeDueDate, onChangeDueTime, onChangeIsRecurring, onChangeFrequency, onChangeInterval,
    onTimeSelected,
    ref,
}: Props & { ref?: React.Ref<ScheduleEditorHandle> }) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const [editor, setEditor] = useState<EditorSection>(null);
    const [showNativeDatePicker, setShowNativeDatePicker] = useState(false);
    const [showNativeTimePicker, setShowNativeTimePicker] = useState(false);
    const [intervalPickerOpen, setIntervalPickerOpen] = useState(false);
    // Captured at the moment the date picker opens, so render is pure
    // (no `new Date()` calls during render).
    const [pickerNow, setPickerNow] = useState<Date | null>(null);

    const openDatePicker = () => {
        setPickerNow(new Date());
        setShowNativeDatePicker(true);
    };

    useImperativeHandle(ref, () => ({
        openDatePicker,
    }));

    function toggleEditor(next: EditorSection) {
        setEditor((cur) => (cur === next ? null : next));
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
            setShowNativeTimePicker(true);
        }
    }

    function handleNativeTimeChange(d?: Date) {
        setShowNativeTimePicker(false);
        if (d) {
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            onChangeDueTime(`${hh}:${mm}`);
            onTimeSelected?.();
        }
    }

    const dateLabel = dueDate
        ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Pick date';
    const recurringLabel = isRecurring
        ? `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} · ${interval || 1}`
        : 'Off';
    const selectedInterval = String(parseInt(interval, 10) || 1);

    const handleIntervalSelect = (n: number) => {
        onChangeInterval(String(n));
        setIntervalPickerOpen(false);
    };

    const renderInterval = ({ item: n }: { item: number }) => (
        <IntervalRow
            n={n}
            isSelected={String(n) === selectedInterval}
            onSelect={handleIntervalSelect}
            primaryColor={colors.primary}
            styles={styles}
        />
    );

    return (
        <View>
            <View style={styles.pillRow}>
                <Pressable
                    onPress={openDatePicker}
                    style={({ pressed }) => [styles.pill, !dueDate && styles.pillDim, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Due date"
                >
                    <Ionicons
                        name="calendar"
                        size={14}
                        color={dueDate ? colors.primary : colors.text.disabled}
                    />
                    <Text style={[styles.pillText, !dueDate && styles.pillTextDim]}>
                        {dateLabel}
                    </Text>
                </Pressable>

                {dueDate && (
                    <>
                        <Pressable
                            onPress={() => setShowNativeTimePicker(true)}
                            style={({ pressed }) => [styles.pill, pressed && { opacity: 0.7 }]}
                            accessibilityRole="button"
                            accessibilityLabel="Due time"
                        >
                            <Ionicons name="time" size={14} color={colors.primary} />
                            <Text style={styles.pillText}>{dueTime}</Text>
                        </Pressable>

                        <Pressable
                            onPress={() => toggleEditor('recurrence')}
                            style={({ pressed }) => [styles.pill, editor === 'recurrence' && styles.pillActive, !isRecurring && styles.pillDim, pressed && { opacity: 0.7 }]}
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
                        </Pressable>

                        <Pressable
                            onPress={handleClearDate}
                            style={({ pressed }) => [styles.clearBtn, pressed && { opacity: 0.7 }]}
                            accessibilityLabel="Clear due date"
                        >
                            <Ionicons name="close-circle" size={20} color={colors.text.veryLight} />
                        </Pressable>
                    </>
                )}
            </View>

            {showNativeDatePicker && pickerNow && (Platform.OS === 'ios' ? (
                <View style={styles.editorPanel}>
                    <DateTimePicker
                        value={dueDate ?? pickerNow}
                        mode="date"
                        display="inline"
                        minimumDate={pickerNow}
                        onChange={(_, d) => handleNativePickerChange(d)}
                        themeVariant="light"
                        accentColor={colors.primary}
                    />
                </View>
            ) : (
                <DateTimePicker
                    value={dueDate ?? pickerNow}
                    mode="date"
                    display="default"
                    minimumDate={pickerNow}
                    onChange={(_, d) => handleNativePickerChange(d)}
                />
            ))}

            {showNativeTimePicker && dueDate && (Platform.OS === 'ios' ? (
                <View style={styles.editorPanel}>
                    <DateTimePicker
                        value={timeToDate(dueTime)}
                        mode="time"
                        display="spinner"
                        onChange={(_, d) => handleNativeTimeChange(d)}
                        themeVariant="light"
                        accentColor={colors.primary}
                    />
                </View>
            ) : (
                <DateTimePicker
                    value={timeToDate(dueTime)}
                    mode="time"
                    display="default"
                    onChange={(_, d) => handleNativeTimeChange(d)}
                />
            ))}

            {editor === 'recurrence' && dueDate && (
                <View style={styles.editorPanel}>
                    <Text style={styles.sublabel}>Repeats</Text>
                    <View style={styles.chipsRow}>
                        <Pressable
                            onPress={() => onChangeIsRecurring(false)}
                            style={({ pressed }) => [styles.chip, !isRecurring && styles.chipActive, pressed && { opacity: 0.7 }]}
                        >
                            <Text style={[styles.chipText, !isRecurring && styles.chipTextActive]}>Off</Text>
                        </Pressable>
                        {FREQUENCIES.map((f) => {
                            const active = isRecurring && frequency === f;
                            return (
                                <Pressable
                                    key={f}
                                    onPress={() => {
                                        onChangeIsRecurring(true);
                                        onChangeFrequency(f);
                                    }}
                                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}
                                >
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    {isRecurring && (
                        <View style={styles.intervalSentence}>
                            <Text style={styles.intervalText}>Every</Text>
                            <Pressable
                                onPress={() => setIntervalPickerOpen(true)}
                                style={({ pressed }) => [styles.intervalDropdown, pressed && { opacity: 0.7 }]}
                                accessibilityRole="button"
                                accessibilityLabel={`Every ${selectedInterval} ${intervalUnitLabel(frequency, parseInt(selectedInterval, 10))}`}
                            >
                                <Text style={styles.intervalDropdownText}>{selectedInterval}</Text>
                                <Ionicons name="chevron-down" size={14} color={colors.primary} />
                            </Pressable>
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
                <Pressable
                    style={styles.dropdownBackdrop}
                    onPress={() => setIntervalPickerOpen(false)}
                >
                    <View style={styles.dropdownCard}>
                        <FlatList
                            style={styles.dropdownList}
                            showsVerticalScrollIndicator={false}
                            data={INTERVAL_OPTIONS}
                            keyExtractor={intervalKeyExtractor}
                            renderItem={renderInterval}
                        />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

export default ScheduleEditor;

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
        backgroundColor: c.surfaceElevated, borderRadius: 12, paddingVertical: 6,
        minWidth: 120, maxHeight: 320,
        boxShadow: '0px 4px 12px rgba(0,0,0,0.2)',
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
