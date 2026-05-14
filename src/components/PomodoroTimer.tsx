import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../styles/theme';

export const POMODORO_MODES = [
    { label: 'Focus', minutes: 25, color: COLORS.primary },
    { label: 'Short Break', minutes: 5, color: COLORS.status['Done'] },
    { label: 'Long Break', minutes: 15, color: COLORS.status['In Progress'] },
] as const;

export const getModeSeconds = (mode: typeof POMODORO_MODES[0]) => mode.minutes * 60;

export type PomodoroModeIdx = 0 | 1 | 2;

interface Props {
    isVisible: boolean;
    onClose: () => void;
    modeIdx: PomodoroModeIdx;
    secondsLeft: number;
    running: boolean;
    isPaused: boolean;
    onSelectMode: (idx: PomodoroModeIdx) => void;
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
}

export default function PomodoroTimer({
    isVisible, onClose,
    modeIdx, secondsLeft, running, isPaused,
    onSelectMode, onStart, onPause, onReset,
}: Props) {
    const mode = POMODORO_MODES[modeIdx];
    const totalSeconds = getModeSeconds(mode);
    const progress = secondsLeft / totalSeconds;

    const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
    const secs = String(secondsLeft % 60).padStart(2, '0');

    return (
        <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity style={styles.sheet} activeOpacity={1} onPress={() => {}}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>Pomodoro Timer</Text>

                    <View style={styles.modeRow}>
                        {POMODORO_MODES.map((m, i) => (
                            <TouchableOpacity
                                key={m.label}
                                style={[styles.modeChip, modeIdx === i && { backgroundColor: m.color }]}
                                onPress={() => onSelectMode(i as PomodoroModeIdx)}
                            >
                                <Text style={[styles.modeChipText, modeIdx === i && { color: 'white' }]}>
                                    {m.minutes}m
                                </Text>
                                <Text style={[styles.modeChipSub, modeIdx === i && { color: 'rgba(255,255,255,0.8)' }]}>
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.clockContainer}>
                        <View style={[styles.ringOuter, { borderColor: '#eee' }]}>
                            <View style={[styles.ringInner, { borderColor: mode.color, opacity: progress }]} />
                            <View style={styles.clockFace}>
                                <Text style={[styles.clockTime, { color: mode.color }]}>{mins}:{secs}</Text>
                                <Text style={styles.clockLabel}>{mode.label}</Text>
                            </View>
                        </View>
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
                            <TouchableOpacity style={[styles.startBtn, { backgroundColor: mode.color }]} onPress={onStart}>
                                <Text style={styles.startBtnText}>▶ Resume</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity style={[styles.startBtn, { backgroundColor: mode.color }]} onPress={onStart}>
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
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, alignItems: 'center' },
    handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#ddd', marginBottom: 16 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#222', marginBottom: 16 },
    modeRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    modeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#f0f0f0' },
    modeChipText: { fontSize: 18, fontWeight: '700', color: '#555' },
    modeChipSub: { fontSize: 10, color: '#888', marginTop: 2 },
    clockContainer: { marginBottom: 24, alignItems: 'center', justifyContent: 'center' },
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
