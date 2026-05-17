import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import FloatingBubble from '../modules/FloatingBubble';
import { makePomodoroModes, PomodoroModeIdx } from '../components/PomodoroTimer';
import { computeBubbleScore, useTaskStore } from '../store/appStore';
import { useColors } from '../styles/useColors';
import { cancelPomodoroNotification, playAppSound, schedulePomodoroEnd } from '../utils/notifications';

export interface PomodoroController {
    modeIdx: PomodoroModeIdx;
    secondsLeft: number;
    running: boolean;
    isPaused: boolean;
    customTimerSeconds: number;
    handleStart: () => Promise<void>;
    handlePause: () => Promise<void>;
    handleReset: () => void;
    handleSelectMode: (idx: PomodoroModeIdx) => void;
    handleSetCustomTimerSeconds: (seconds: number) => void;
}

export function usePomodoroController(): PomodoroController {
    const colors = useColors();
    const pomodoroModes = useMemo(() => makePomodoroModes(colors), [colors]);

    const [modeIdx, setModeIdx] = useState<PomodoroModeIdx>(0);
    const [secondsLeft, setSecondsLeft] = useState(pomodoroModes[0].minutes * 60);
    const [running, setRunning] = useState(false);

    const pomodoroPausedSecondsLeft = useTaskStore((s) => s.pomodoroPausedSecondsLeft);
    const customTimerSeconds = useTaskStore((s) => s.customTimerSeconds);
    const setPomodoroTimer = useTaskStore((s) => s.setPomodoroTimer);
    const pausePomodoroTimer = useTaskStore((s) => s.pausePomodoroTimer);
    const clearPomodoroTimer = useTaskStore((s) => s.clearPomodoroTimer);
    const setCustomTimerSeconds = useTaskStore((s) => s.setCustomTimerSeconds);
    const setPomodoroVisible = useTaskStore((s) => s.setPomodoroVisible);

    const isPaused = pomodoroPausedSecondsLeft !== null;

    const notifIdRef = useRef<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const completedRef = useRef(false);
    const endTimeRef = useRef<number | null>(null);
    const modeIdxRef = useRef<PomodoroModeIdx>(0);
    const runningRef = useRef(false);
    useEffect(() => { modeIdxRef.current = modeIdx; }, [modeIdx]);
    useEffect(() => { runningRef.current = running; }, [running]);

    const getModeSeconds = useCallback((idx: PomodoroModeIdx, customSecs: number): number => {
        if (idx === 3) return customSecs;
        return pomodoroModes[idx as 0 | 1 | 2].minutes * 60;
    }, [pomodoroModes]);

    const getModeLabel = useCallback((idx: PomodoroModeIdx): string => {
        if (idx === 3) return 'Custom';
        return pomodoroModes[idx as 0 | 1 | 2].label;
    }, [pomodoroModes]);

    const getFallbackBubble = useCallback(() => {
        const { tasks } = useTaskStore.getState();
        const pad = (n: number) => String(n).padStart(2, '0');
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
        const tom = new Date(now); tom.setDate(tom.getDate() + 1);
        const tomorrowStr = `${tom.getFullYear()}-${pad(tom.getMonth() + 1)}-${pad(tom.getDate())}`;
        const score = computeBubbleScore(tasks, todayStr, tomorrowStr);
        return { score, message: score > 0 ? `${score} Urgent ${score === 1 ? 'Task' : 'Tasks'}` : '' };
    }, []);

    const stopTimer = useCallback(async (isPauseAction = false) => {
        const didComplete = completedRef.current;
        completedRef.current = false;

        if (isPauseAction && endTimeRef.current) {
            const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            pausePomodoroTimer(remaining, modeIdxRef.current);
        } else {
            clearPomodoroTimer();
            if (notifIdRef.current) { cancelPomodoroNotification(notifIdRef.current); notifIdRef.current = null; }
        }

        endTimeRef.current = null;
        setRunning(false);
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

        const { score, message } = getFallbackBubble();
        FloatingBubble.stopPomodoroTimer(score, message);

        if (didComplete) {
            const { pomodoroSoundType } = useTaskStore.getState();
            if (pomodoroSoundType === 'AppSound') await playAppSound('bell', 1.0);
        }
    }, [pausePomodoroTimer, clearPomodoroTimer, getFallbackBubble]);

    useEffect(() => {
        if (!running) return;
        intervalRef.current = setInterval(() => {
            if (!endTimeRef.current) return;
            const remaining = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            if (remaining <= 1) {
                completedRef.current = true;
                stopTimer();
                setSecondsLeft(0);
                return;
            }
            setSecondsLeft(remaining);
        }, 1000);
        return () => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } };
    }, [running, stopTimer]);

    useEffect(() => {
        const { pomodoroEndTime, pomodoroModeIdx, pomodoroPausedSecondsLeft: pausedLeft, pomodoroNotifId } = useTaskStore.getState();
        if (pomodoroEndTime !== null && pomodoroModeIdx !== null) {
            const remaining = Math.round((pomodoroEndTime - Date.now()) / 1000);
            setModeIdx(pomodoroModeIdx as PomodoroModeIdx);
            if (remaining > 0) {
                endTimeRef.current = pomodoroEndTime;
                notifIdRef.current = pomodoroNotifId;
                setSecondsLeft(remaining);
                setRunning(true);
            } else {
                clearPomodoroTimer();
            }
        } else if (pausedLeft !== null && pomodoroModeIdx !== null) {
            setModeIdx(pomodoroModeIdx as PomodoroModeIdx);
            setSecondsLeft(pausedLeft);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const closeModal = () => setPomodoroVisible(false);
        const unsubscribeOpenFocus = FloatingBubble.onOpenFocus(closeModal);
        const appStateSub = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'active') closeModal();
        });
        return () => {
            unsubscribeOpenFocus();
            appStateSub.remove();
        };
    }, [setPomodoroVisible]);

    useEffect(() => {
        const sub = AppState.addEventListener('change', (nextState: string) => {
            if (nextState === 'background' && runningRef.current && endTimeRef.current) {
                const { score, message } = getFallbackBubble();
                const { pomodoroSoundType, pomodoroVolume } = useTaskStore.getState();
                FloatingBubble.startPomodoroTimer(
                    endTimeRef.current,
                    getModeLabel(modeIdxRef.current),
                    score,
                    message,
                    pomodoroSoundType,
                    pomodoroVolume,
                );
            } else if (nextState === 'active' && runningRef.current && endTimeRef.current) {
                if (endTimeRef.current > Date.now()) {
                    const { score, message } = getFallbackBubble();
                    FloatingBubble.stopPomodoroTimer(score, message);
                } else {
                    completedRef.current = false;
                    endTimeRef.current = null;
                    clearPomodoroTimer();
                    setRunning(false);
                    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
                }
            }
        });
        return () => sub.remove();
    }, [getFallbackBubble, clearPomodoroTimer, getModeLabel]);

    const handleSelectMode = useCallback((idx: PomodoroModeIdx) => {
        stopTimer();
        setModeIdx(idx);
        if (idx === 3) {
            setCustomTimerSeconds(0);
            setSecondsLeft(0);
        } else {
            setSecondsLeft(getModeSeconds(idx, customTimerSeconds));
        }
    }, [stopTimer, customTimerSeconds, setCustomTimerSeconds, getModeSeconds]);

    const handleStart = useCallback(async () => {
        const durationSecs = isPaused ? secondsLeft : getModeSeconds(modeIdx, customTimerSeconds);
        const durationMs = durationSecs * 1000;
        const endTime = Date.now() + durationMs;
        endTimeRef.current = endTime;

        const durationMinutes = Math.ceil(durationMs / 60000);
        const id = await schedulePomodoroEnd(durationMinutes);
        notifIdRef.current = id;

        setPomodoroTimer(endTime, modeIdx, id);
        setRunning(true);
    }, [modeIdx, isPaused, secondsLeft, customTimerSeconds, setPomodoroTimer, getModeSeconds]);

    const handlePause = useCallback(async () => {
        await stopTimer(true);
    }, [stopTimer]);

    const handleReset = useCallback(() => {
        stopTimer();
        setSecondsLeft(getModeSeconds(modeIdx, customTimerSeconds));
    }, [stopTimer, modeIdx, customTimerSeconds, getModeSeconds]);

    const handleSetCustomTimerSeconds = useCallback((seconds: number) => {
        setCustomTimerSeconds(seconds);
        setSecondsLeft(seconds);
    }, [setCustomTimerSeconds]);

    return {
        modeIdx,
        secondsLeft,
        running,
        isPaused,
        customTimerSeconds,
        handleStart,
        handlePause,
        handleReset,
        handleSelectMode,
        handleSetCustomTimerSeconds,
    };
}
