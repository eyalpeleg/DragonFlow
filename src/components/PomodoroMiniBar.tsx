import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTaskStore } from '../store/appStore';
import { AppColors } from '../styles/theme';
import { useColors } from '../styles/useColors';
import { formatCountdown } from '../utils/pomodoroFormat';
import { makePomodoroModes, PomodoroModeIdx } from './PomodoroTimer';

interface Props {
    modeIdx: PomodoroModeIdx;
    secondsLeft: number;
    running: boolean;
    isPaused: boolean;
    onTogglePause: () => void;
    onStop: () => void;
}

export default function PomodoroMiniBar({ modeIdx, secondsLeft, running, isPaused, onTogglePause, onStop }: Props) {
    const colors = useColors();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const pomodoroModes = useMemo(() => makePomodoroModes(colors), [colors]);
    const setPomodoroVisible = useTaskStore((s) => s.setPomodoroVisible);

    const isActive = running || isPaused;
    if (!isActive) return null;

    const modeLabel = modeIdx === 3 ? 'Custom' : pomodoroModes[modeIdx as 0 | 1 | 2].label;
    const display = formatCountdown(secondsLeft);

    return (
        <View style={styles.container}>
            <TouchableOpacity style={styles.tappable} activeOpacity={0.7} onPress={() => setPomodoroVisible(true)}>
                <Ionicons name="hourglass" size={18} color={colors.white} style={styles.icon} />
                <Text style={styles.label}>{modeLabel}</Text>
                <Text style={styles.countdown}>{display}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={onTogglePause} accessibilityLabel={running ? 'Pause Pomodoro' : 'Resume Pomodoro'}>
                <Ionicons name={running ? 'pause' : 'play'} size={18} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.controlBtn} onPress={onStop} accessibilityLabel="Stop Pomodoro">
                <Ionicons name="stop" size={16} color={colors.white} />
            </TouchableOpacity>
        </View>
    );
}

const makeStyles = (c: AppColors) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.secondary,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 4,
    },
    tappable: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    icon: { marginRight: 8 },
    label: { color: c.white, fontSize: 13, fontWeight: '600', flex: 1 },
    countdown: { color: c.white, fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'], marginRight: 8 },
    controlBtn: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        backgroundColor: c.overlay.whiteSoft,
    },
});
