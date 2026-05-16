import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useTaskStore } from '../store/appStore';
import { COLORS } from '../styles/theme';

export const POMODORO_MODES = [
    { label: 'Focus', minutes: 25, color: COLORS.pomodoro.focus },
    { label: 'Short Break', minutes: 5, color: COLORS.pomodoro.shortBreak },
    { label: 'Long Break', minutes: 15, color: COLORS.pomodoro.longBreak },
] as const;

const CUSTOM_MODE_COLOR = COLORS.pomodoro.custom;

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
    const themeColorSecondary = useTaskStore((s) => s.themeColorSecondary);
    const [customTimeInput, setCustomTimeInput] = useState('00:00:00');
    const [customTimeError, setCustomTimeError] = useState<string | null>(null);
    const [customTimeSubmitted, setCustomTimeSubmitted] = useState(false);

    const isCustomMode = modeIdx === 3;
    const mode = isCustomMode ? null : POMODORO_MODES[modeIdx as 0 | 1 | 2];
    const modeSeconds = isCustomMode ? customTimerSeconds : (mode ? mode.minutes * 60 : 0);
    const totalSeconds = modeSeconds;
    const progress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;

    const displaySeconds = isCustomMode && customTimeSubmitted && !running ? customTimerSeconds : secondsLeft;
    const hours = String(Math.floor(displaySeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((displaySeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(displaySeconds % 60).padStart(2, '0');

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
        }
    };

    const handleCustomTimeSubmit = () => {
        const parsed = validateAndParseTime(customTimeInput);
        if (parsed && customTimeError === null) {
            const totalSecs = parsed.hours * 3600 + parsed.minutes * 60 + parsed.seconds;
            onSetCustomTimerSeconds(totalSecs);
            setCustomTimeSubmitted(true);
        }
    };

    const handleSelectCustom = () => {
        onSelectMode(3);
        setCustomTimeInput('00:00:00');
        setCustomTimeError(null);
        setCustomTimeSubmitted(false);
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
                                <Text style={[styles.modeChipText, modeIdx === i && { color: COLORS.white }]}>
                                    {m.minutes}m
                                </Text>
                                <Text style={[styles.modeChipSub, modeIdx === i && { color: COLORS.overlay.whiteSubtle }]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.modeChip, isCustomMode && { backgroundColor: CUSTOM_MODE_COLOR }, running && !isCustomMode && { opacity: 0.5 }]}
                            onPress={() => !running && handleSelectCustom()}
                            disabled={running && !isCustomMode}
                        >
                            <Text style={[styles.modeChipText, isCustomMode && { color: COLORS.white }]}>
                                Custom
                            </Text>
                            <Text style={[styles.modeChipSub, isCustomMode && { color: COLORS.overlay.whiteSubtle }]}>
                                Set time
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.clockContainer}>
                        {isCustomMode && !customTimeSubmitted ? (
                            <View style={styles.customTimerContainer}>
                                <TextInput
                                    style={styles.customTimeInput}
                                    value={customTimeInput}
                                    onChangeText={handleCustomTimeChange}
                                    placeholder="00:00:00"
                                    placeholderTextColor={COLORS.text.disabled}
                                    maxLength={8}
                                />
                                {customTimeError && (
                                    <Text style={styles.customTimeError}>{customTimeError}</Text>
                                )}
                                <TouchableOpacity
                                    style={[styles.submitBtn, customTimeError !== null && { opacity: 0.5 }]}
                                    onPress={handleCustomTimeSubmit}
                                    disabled={customTimeError !== null}
                                >
                                    <Text style={styles.submitBtnText}>✓ Set Timer</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={[styles.ringOuter, { borderColor: COLORS.border.light }]}>
                                <View style={[styles.ringInner, { borderColor: isCustomMode ? CUSTOM_MODE_COLOR : mode?.color, opacity: progress }]} />
                                <View style={styles.clockFace}>
                                    <Text style={[styles.clockTime, { color: isCustomMode ? CUSTOM_MODE_COLOR : mode?.color }]}>
                                        {isCustomMode ? `${hours}:${mins}:${secs}` : (parseInt(hours) > 0 ? `${hours}:${mins}:${secs}` : `${mins}:${secs}`)}
                                    </Text>
                                    <Text style={styles.clockLabel}>{isCustomMode ? 'Custom' : mode?.label}</Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <View style={styles.controls}>
                        <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
                            <Text style={styles.resetBtnText}>↺ Reset</Text>
                        </TouchableOpacity>
                        {running ? (
                            <TouchableOpacity style={[styles.startBtn, { backgroundColor: COLORS.text.placeholder }]} onPress={onPause}>
                                <Text style={styles.startBtnText}>⏸ Pause</Text>
                            </TouchableOpacity>
                        ) : isPaused ? (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: isStartDisabled ? COLORS.text.disabled : themeColorSecondary }, !isStartDisabled && { borderWidth: 2, borderColor: COLORS.primary }]}
                                onPress={() => { onStart(); onClose(); }}
                                disabled={isStartDisabled}
                            >
                                <Text style={styles.startBtnText}>▶ Resume</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: isStartDisabled ? COLORS.text.disabled : themeColorSecondary }, !isStartDisabled && { borderWidth: 2, borderColor: COLORS.primary }]}
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
    overlay: { flex: 1, backgroundColor: COLORS.overlay.scrimStrong, justifyContent: 'flex-start', paddingTop: 80 },
    sheet: { backgroundColor: COLORS.white, borderRadius: 12, padding: 20, marginHorizontal: 16, alignItems: 'center', maxHeight: '75%' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border.medium, marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: COLORS.text.primary, marginBottom: 16 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    modeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: COLORS.surfaceAlt.soft },
    modeChipText: { fontSize: 14, fontWeight: '700', color: COLORS.text.muted },
    modeChipSub: { fontSize: 9, color: COLORS.text.weak, marginTop: 2 },
    clockContainer: { marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
    customTimerContainer: { alignItems: 'center', gap: 12 },
    customTimeInput: { fontSize: 48, fontWeight: '700', color: CUSTOM_MODE_COLOR, textAlign: 'center', borderBottomWidth: 2, borderColor: CUSTOM_MODE_COLOR, paddingVertical: 12, minWidth: 200 },
    customTimeError: { fontSize: 12, color: COLORS.text.errorStrong, textAlign: 'center' },
    submitBtn: { paddingHorizontal: 32, paddingVertical: 10, borderRadius: 20, backgroundColor: CUSTOM_MODE_COLOR, marginTop: 8, borderWidth: 2, borderColor: COLORS.pomodoro.focus },
    submitBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
    ringOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
    ringInner: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 8 },
    clockFace: { alignItems: 'center' },
    clockTime: { fontSize: 28, fontWeight: '700' },
    clockLabel: { fontSize: 12, color: COLORS.text.weak, marginTop: 2 },
    controls: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    resetBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: COLORS.surfaceAlt.soft },
    resetBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.text.muted },
    startBtn: { paddingHorizontal: 36, paddingVertical: 12, borderRadius: 20 },
    startBtnText: { fontSize: 15, fontWeight: '700', color: COLORS.white },
    notifNote: { fontSize: 11, color: COLORS.text.light, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
    closeBtn: { padding: 8 },
    closeBtnText: { color: COLORS.text.placeholder, fontWeight: '600' },
});
