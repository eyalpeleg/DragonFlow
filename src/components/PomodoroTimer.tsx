import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { COLORS } from '../styles/theme';

export const POMODORO_MODES = [
    { label: 'Focus', minutes: 25, color: COLORS.primary },
    { label: 'Short Break', minutes: 5, color: COLORS.status['Done'] },
    { label: 'Long Break', minutes: 15, color: COLORS.status['In Progress'] },
] as const;

export type PomodoroModeIdx = 0 | 1 | 2 | 3;

interface Props {
    isVisible: boolean;
    onClose: () => void;
    modeIdx: PomodoroModeIdx;
    secondsLeft: number;
    running: boolean;
    isPaused: boolean;
    customTimerSeconds: number;
    onSelectMode: (idx: PomodoroModeIdx) => void;
    onSetCustomTimerSeconds: (seconds: number) => void;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
}

export default function PomodoroTimer({
    isVisible, onClose,
    modeIdx, secondsLeft, running, isPaused, customTimerSeconds,
    onSelectMode, onSetCustomTimerSeconds, onStart, onPause, onReset,
}: Props) {
    const [customTimeInput, setCustomTimeInput] = useState('00:00:00');
    const [customTimeError, setCustomTimeError] = useState<string | null>(null);

    const isCustomMode = modeIdx === 3;
    const mode = isCustomMode ? null : POMODORO_MODES[modeIdx as 0 | 1 | 2];
    const modeSeconds = isCustomMode ? customTimerSeconds : (mode ? mode.minutes * 60 : 0);
    const totalSeconds = modeSeconds;
    const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;

    const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');

    const validateAndParseTime = (input: string): { hours: number; minutes: number; seconds: number } | null => {
        const match = input.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
        if (!match) return null;
        const h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const s = parseInt(match[3], 10);
        if (m > 59 || s > 59) return null;
        return { hours: h, minutes: m, seconds: s };
    };

    const handleCustomTimeChange = (text: string) => {
        setCustomTimeInput(text);
        const parsed = validateAndParseTime(text);
        if (parsed === null && text.length > 0) {
            setCustomTimeError('Invalid format (hh:mm:ss, max 59:59)');
        } else {
            setCustomTimeError(null);
            if (parsed) {
                const totalSecs = parsed.hours * 3600 + parsed.minutes * 60 + parsed.seconds;
                onSetCustomTimerSeconds(totalSecs);
            }
        }
    };

    const handleSelectCustom = () => {
        onSelectMode(3);
        setCustomTimeInput('00:00:00');
        setCustomTimeError(null);
        onSetCustomTimerSeconds(0);
    };

    const isStartDisabled = isCustomMode && (customTimerSeconds === 0 || customTimeError !== null);

    return (
        <Modal visible={isVisible} animationType="fade" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                    <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>Pomodoro Timer</Text>

                    <View style={styles.modeRow}>
                        {POMODORO_MODES.map((m, i) => (
                            <TouchableOpacity
                                key={m.label}
                                style={[styles.modeChip, modeIdx === i && { backgroundColor: m.color }, running && modeIdx !== i && { opacity: 0.5 }]}
                                onPress={() => !running && onSelectMode(i as PomodoroModeIdx)}
                                disabled={running && modeIdx !== i}
                            >
                                <Text style={[styles.modeChipText, modeIdx === i && { color: 'white' }]}>
                                    {m.minutes}m
                                </Text>
                                <Text style={[styles.modeChipSub, modeIdx === i && { color: 'rgba(255,255,255,0.8)' }]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.modeChip, isCustomMode && { backgroundColor: COLORS.primary }, running && !isCustomMode && { opacity: 0.5 }]}
                            onPress={() => !running && handleSelectCustom()}
                            disabled={running && !isCustomMode}
                        >
                            <Text style={[styles.modeChipText, isCustomMode && { color: 'white' }]}>
                                Custom
                            </Text>
                            <Text style={[styles.modeChipSub, isCustomMode && { color: 'rgba(255,255,255,0.8)' }]}>
                                Set time
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.clockContainer}>
                        {isCustomMode ? (
                            <View style={styles.customTimerContainer}>
                                <TextInput
                                    style={styles.customTimeInput}
                                    value={customTimeInput}
                                    onChangeText={handleCustomTimeChange}
                                    placeholder="00:00:00"
                                    placeholderTextColor="#ccc"
                                    maxLength={8}
                                />
                                {customTimeError && (
                                    <Text style={styles.customTimeError}>{customTimeError}</Text>
                                )}
                            </View>
                        ) : (
                            <View style={[styles.ringOuter, { borderColor: '#eee' }]}>
                                <View style={[styles.ringInner, { borderColor: mode?.color, opacity: progress }]} />
                                <View style={styles.clockFace}>
                                    <Text style={[styles.clockTime, { color: mode?.color }]}>{mins}:{secs}</Text>
                                    <Text style={styles.clockLabel}>{mode?.label}</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.controls}>
                        <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
                            <Text style={styles.resetBtnText}>↺ Reset</Text>
                        </TouchableOpacity>
                        {running ? (
                            <TouchableOpacity style={[styles.startBtn, { backgroundColor: '#999' }]} onPress={onPause}>
                                <Text style={styles.startBtnText}>⏸ Pause</Text>
                            </TouchableOpacity>
                        ) : isPaused ? (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: isStartDisabled ? '#ccc' : (mode?.color ?? COLORS.primary) }]}
                                onPress={() => { onStart(); onClose(); }}
                                disabled={isStartDisabled}
                            >
                                <Text style={styles.startBtnText}>▶ Resume</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: isStartDisabled ? '#ccc' : (mode?.color ?? COLORS.primary) }]}
                                onPress={() => { onStart(); onClose(); }}
                                disabled={isStartDisabled}
                            >
                                <Text style={styles.startBtnText}>▶ Start</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.notifNote}>
                        Timer keeps running when you close this panel.
                    </Text>

                    <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                        <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                    </TouchableOpacity>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', paddingTop: 80 },
    sheet: { backgroundColor: 'white', borderRadius: 12, padding: 20, marginHorizontal: 16, alignItems: 'center', maxHeight: '75%' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 16 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    modeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#f0f0f0' },
    modeChipText: { fontSize: 14, fontWeight: '700', color: '#555' },
    modeChipSub: { fontSize: 9, color: '#888', marginTop: 2 },
    clockContainer: { marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
    customTimerContainer: { alignItems: 'center', gap: 12 },
    customTimeInput: { fontSize: 48, fontWeight: '700', color: COLORS.primary, textAlign: 'center', borderBottomWidth: 2, borderColor: COLORS.primary, paddingVertical: 12, minWidth: 200 },
    customTimeError: { fontSize: 12, color: '#d32f2f', textAlign: 'center' },
    ringOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
    ringInner: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 8 },
    clockFace: { alignItems: 'center' },
    clockTime: { fontSize: 36, fontWeight: '700' },
    clockLabel: { fontSize: 12, color: '#888', marginTop: 2 },
    controls: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    resetBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: '#f0f0f0' },
    resetBtnText: { fontSize: 15, fontWeight: '600', color: '#555' },
    startBtn: { paddingHorizontal: 36, paddingVertical: 12, borderRadius: 20 },
    startBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },
    notifNote: { fontSize: 11, color: '#aaa', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
    closeBtn: { padding: 8 },
    closeBtnText: { color: '#999', fontWeight: '600' },
});
