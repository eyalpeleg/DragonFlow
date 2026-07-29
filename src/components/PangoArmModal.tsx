import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { isValidDuration, MAX_DURATION_MIN, MIN_DURATION_MIN } from '../utils/parking';

interface Props {
    visible: boolean;
    onArm: (durationMin: number) => void;
    onDismiss: (kind: 'not-parking' | 'today') => void;
}

const PRESETS = [30, 60, 120] as const;
const DEFAULT_PRESET = 60;

// Prompt shown when Pango goes to the background: arm a "stop parking" reminder
// for a chosen duration, or dismiss (not parking / stop asking today). AC1/AC3/AC10/AC11/AC25.
export default function PangoArmModal({ visible, onArm, onDismiss }: Props) {
    const colors = useColors();
    const styles = makeStyles(colors);
    const [preset, setPreset] = useState<number | 'custom'>(DEFAULT_PRESET);
    const [custom, setCustom] = useState('');

    const customMin = parseInt(custom, 10);
    const customValid = preset === 'custom' ? isValidDuration(customMin) : true;
    const selectedMin = preset === 'custom' ? customMin : preset;
    const canArm = customValid && isValidDuration(selectedMin);

    function reset() {
        setPreset(DEFAULT_PRESET);
        setCustom('');
    }

    function handleArm() {
        if (!canArm) return;
        onArm(selectedMin);
        reset();
    }

    function handleDismiss(kind: 'not-parking' | 'today') {
        onDismiss(kind);
        reset();
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={() => handleDismiss('not-parking')}>
            <View style={styles.overlay}>
                <View style={styles.sheet}>
                    <View style={styles.header}>
                        <Ionicons name="car-outline" size={22} color={colors.primary} />
                        <Text style={styles.title}>Start a parking reminder?</Text>
                    </View>
                    <Text style={styles.subtitle}>Remind me to stop my Pango parking in:</Text>

                    <View style={styles.presets}>
                        {PRESETS.map((p) => {
                            const active = preset === p;
                            return (
                                <Pressable
                                    key={`pango-preset-${p}`}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${p} minutes`}
                                    accessibilityState={{ selected: active }}
                                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.7 }]}
                                    onPress={() => setPreset(p)}
                                >
                                    {active && <Ionicons name="checkmark" size={14} color={colors.surface} style={styles.chipCheck} />}
                                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                        {p < 60 ? `${p}m` : `${p / 60}h`}
                                    </Text>
                                </Pressable>
                            );
                        })}
                        <Pressable
                            key="pango-preset-custom"
                            accessibilityRole="button"
                            accessibilityLabel="Custom duration"
                            accessibilityState={{ selected: preset === 'custom' }}
                            style={({ pressed }) => [styles.chip, preset === 'custom' && styles.chipActive, pressed && { opacity: 0.7 }]}
                            onPress={() => setPreset('custom')}
                        >
                            {preset === 'custom' && <Ionicons name="checkmark" size={14} color={colors.surface} style={styles.chipCheck} />}
                            <Text style={[styles.chipText, preset === 'custom' && styles.chipTextActive]}>Custom</Text>
                        </Pressable>
                    </View>

                    {preset === 'custom' && (
                        <>
                            <TextInput
                                style={styles.input}
                                placeholder={`Minutes (${MIN_DURATION_MIN}–${MAX_DURATION_MIN})`}
                                placeholderTextColor={colors.text.light}
                                value={custom}
                                onChangeText={setCustom}
                                keyboardType="number-pad"
                                accessibilityLabel="Custom duration in minutes"
                                autoFocus
                            />
                            {custom.length > 0 && !customValid && (
                                <Text style={styles.error}>Enter {MIN_DURATION_MIN}–{MAX_DURATION_MIN} minutes</Text>
                            )}
                        </>
                    )}

                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Start parking reminder"
                        style={({ pressed }) => [styles.armBtn, !canArm && styles.armBtnDisabled, pressed && { opacity: 0.7 }]}
                        onPress={handleArm}
                        disabled={!canArm}
                    >
                        <Text style={styles.armText}>Remind me</Text>
                    </Pressable>

                    <View style={styles.dismissRow}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Not parking"
                            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}
                            onPress={() => handleDismiss('not-parking')}
                        >
                            <Text style={styles.dismissText}>Not parking</Text>
                        </Pressable>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Stop asking today"
                            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}
                            onPress={() => handleDismiss('today')}
                        >
                            <Text style={styles.dismissText}>Stop asking today</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: c.overlay.scrimDeep, justifyContent: 'center', alignItems: 'center' },
    sheet: { backgroundColor: c.surfaceElevated, borderRadius: 16, padding: 20, width: '85%' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    title: { fontSize: 18, fontWeight: '700', color: c.text.primary },
    subtitle: { fontSize: 14, color: c.text.muted, marginBottom: 14 },
    presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        minHeight: 44, paddingHorizontal: 16, borderRadius: 22,
        borderWidth: 1, borderColor: c.border.medium, justifyContent: 'center',
    },
    chipActive: { backgroundColor: c.primary, borderColor: c.primary },
    chipCheck: { marginRight: 2 },
    chipText: { fontSize: 14, fontWeight: '600', color: c.text.primary },
    chipTextActive: { color: c.surface },
    input: {
        borderWidth: 1, borderColor: c.border.medium, borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: c.text.primary, marginTop: 12,
    },
    error: { color: c.text.error, fontSize: 12, marginTop: 4 },
    armBtn: { backgroundColor: c.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 18 },
    armBtnDisabled: { opacity: 0.4 },
    armText: { color: c.surface, fontWeight: '700', fontSize: 15 },
    dismissRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
    dismissBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
    dismissText: { color: c.text.weak, fontSize: 14 },
});
