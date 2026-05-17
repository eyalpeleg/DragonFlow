import React, { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View, KeyboardAvoidingView, Platform } from 'react-native';
import { useTaskStore } from '../store/appStore';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';

export type PomodoroMode = { label: string; minutes: number; color: string };

export function makePomodoroModes(c: AppColors): readonly PomodoroMode[] {
    return [
        { label: 'Focus', minutes: 25, color: c.secondary },
        { label: 'Short Break', minutes: 5, color: c.secondary },
        { label: 'Long Break', minutes: 15, color: c.secondary },
    ] as const;
}

export type PomodoroModeIdx = 0 | 1 | 2 | 3;

interface Props {
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
    modeIdx, secondsLeft, running, isPaused, customTimerSeconds,
    onSelectMode, onSetCustomTimerSeconds, onStart, onPause, onReset,
}: Props) {
    const isVisible = useTaskStore((s) => s.pomodoroVisible);
    const setPomodoroVisible = useTaskStore((s) => s.setPomodoroVisible);
    const debugMode = useTaskStore((s) => s.debugModeEnabled);
    const onClose = () => setPomodoroVisible(false);
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors, debugMode), [colors, debugMode]);
    const pomodoroModes = useMemo(() => makePomodoroModes(colors), [colors]);
    const customModeColor = colors.secondary;

    const [customTimeInput, setCustomTimeInput] = useState('00:00:00');
    const [customTimeError, setCustomTimeError] = useState<string | null>(null);
    const [customTimeSubmitted, setCustomTimeSubmitted] = useState(false);

    const isCustomMode = modeIdx === 3;
    const mode = isCustomMode ? null : pomodoroModes[modeIdx as 0 | 1 | 2];
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
                        {pomodoroModes.map((m, i) => (
                            <TouchableOpacity
                                key={m.label}
                                style={[styles.modeChip, modeIdx === i && { backgroundColor: m.color }, running && modeIdx !== i && { opacity: 0.5 }]}
                                onPress={() => !running && onSelectMode(i as PomodoroModeIdx)}
                                disabled={running && modeIdx !== i}
                            >
                                <Text style={[styles.modeChipText, modeIdx === i && { color: colors.white }]}>
                                    {m.minutes}m
                                </Text>
                                <Text style={[styles.modeChipSub, modeIdx === i && { color: colors.overlay.whiteSubtle }]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity
                            style={[styles.modeChip, isCustomMode && { backgroundColor: customModeColor }, running && !isCustomMode && { opacity: 0.5 }]}
                            onPress={() => !running && handleSelectCustom()}
                            disabled={running && !isCustomMode}
                        >
                            <Text style={[styles.modeChipText, isCustomMode && { color: colors.white }]}>
                                Custom
                            </Text>
                            <Text style={[styles.modeChipSub, isCustomMode && { color: colors.overlay.whiteSubtle }]}>
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
                                    placeholderTextColor={colors.text.disabled}
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
                            <View style={[styles.ringOuter, { borderColor: colors.border.light }]}>
                                <View style={[styles.ringInner, { borderColor: isCustomMode ? customModeColor : mode?.color, opacity: progress }]} />
                                <View style={styles.clockFace}>
                                    <Text style={[styles.clockTime, { color: isCustomMode ? customModeColor : mode?.color }]}>
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
                            <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.text.placeholder }]} onPress={onPause}>
                                <Text style={styles.startBtnText}>⏸ Pause</Text>
                            </TouchableOpacity>
                        ) : isPaused ? (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: isStartDisabled ? colors.text.disabled : colors.secondary }, !isStartDisabled && { borderWidth: 2, borderColor: colors.primary }]}
                                onPress={() => { onStart(); onClose(); }}
                                disabled={isStartDisabled}
                            >
                                <Text style={styles.startBtnText}>▶ Resume</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.startBtn, { backgroundColor: isStartDisabled ? colors.text.disabled : colors.secondary }, !isStartDisabled && { borderWidth: 2, borderColor: colors.primary }]}
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

const makeStyles = (c: AppColors, debug: boolean) => StyleSheet.create({
    overlay: { flex: 1, backgroundColor: debug ? c.overlay.debug.pomodoro : c.overlay.scrimStrong, justifyContent: 'flex-start', paddingTop: 80 },
    sheet: { backgroundColor: c.surface, borderRadius: 12, padding: 20, marginHorizontal: 16, alignItems: 'center', maxHeight: '75%' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: c.border.medium, marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: c.text.primary, marginBottom: 16 },
    modeRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    modeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: c.surfaceAlt.soft },
    modeChipText: { fontSize: 14, fontWeight: '700', color: c.text.muted },
    modeChipSub: { fontSize: 9, color: c.text.weak, marginTop: 2 },
    clockContainer: { marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
    customTimerContainer: { alignItems: 'center', gap: 12 },
    customTimeInput: { fontSize: 48, fontWeight: '700', color: c.secondary, textAlign: 'center', borderBottomWidth: 2, borderColor: c.secondary, paddingVertical: 12, minWidth: 200 },
    customTimeError: { fontSize: 12, color: c.text.errorStrong, textAlign: 'center' },
    submitBtn: { paddingHorizontal: 32, paddingVertical: 10, borderRadius: 20, backgroundColor: c.secondary, marginTop: 8, borderWidth: 2, borderColor: c.secondary },
    submitBtnText: { fontSize: 14, fontWeight: '700', color: c.white },
    ringOuter: { width: 140, height: 140, borderRadius: 70, borderWidth: 8, alignItems: 'center', justifyContent: 'center' },
    ringInner: { position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 8 },
    clockFace: { alignItems: 'center' },
    clockTime: { fontSize: 28, fontWeight: '700' },
    clockLabel: { fontSize: 12, color: c.text.weak, marginTop: 2 },
    controls: { flexDirection: 'row', gap: 16, marginBottom: 16 },
    resetBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, backgroundColor: c.surfaceAlt.soft },
    resetBtnText: { fontSize: 15, fontWeight: '600', color: c.text.muted },
    startBtn: { paddingHorizontal: 36, paddingVertical: 12, borderRadius: 20 },
    startBtnText: { fontSize: 15, fontWeight: '700', color: c.white },
    notifNote: { fontSize: 11, color: c.text.light, textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
    closeBtn: { padding: 8 },
    closeBtnText: { color: c.text.placeholder, fontWeight: '600' },
});
