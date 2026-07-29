import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import FloatingBubble from '../modules/FloatingBubble';
import { makePomodoroModes, PomodoroModeIdx } from '../components/pomodoroModes';
import { computeBubbleScore, getTodayTomorrowStrs, urgentBubbleMessage, useTaskStore } from '../store/appStore';
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
    const pomodoroModes = makePomodoroModes(colors);

    const [modeIdx, setModeIdx] = useState<PomodoroModeIdx>(() => {
        const { pomodoroModeIdx } = useTaskStore.getState();
        return (pomodoroModeIdx ?? 0) as PomodoroModeIdx;
    });
    const [secondsLeft, setSecondsLeft] = useState(() => {
        const { pomodoroEndTime, pomodoroPausedSecondsLeft: pausedLeft } = useTaskStore.getState();
        if (pomodoroEndTime !== null) {
            const remaining = Math.round((pomodoroEndTime - Date.now()) / 1000);
            return remaining > 0 ? remaining : pomodoroModes[0].minutes * 60;
        }
        if (pausedLeft !== null) return pausedLeft;
        return pomodoroModes[0].minutes * 60;
    });
    const [running, setRunning] = useState(() => {
        const { pomodoroEndTime } = useTaskStore.getState();
        return pomodoroEndTime !== null && pomodoroEndTime > Date.now();
    });

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

    const getModeSeconds = (idx: PomodoroModeIdx, customSecs: number): number => {
        if (idx === 3) return customSecs;
        return pomodoroModes[idx as 0 | 1 | 2].minutes * 60;
    };

    const getModeLabel = useCallback((idx: PomodoroModeIdx): string => {
        if (idx === 3) return 'Custom';
        return pomodoroModes[idx as 0 | 1 | 2].label;
    }, [pomodoroModes]);

    const getFallbackBubble = useCallback(() => {
        const { tasks } = useTaskStore.getState();
        const { todayStr, tomorrowStr } = getTodayTomorrowStrs();
        const score = computeBubbleScore(tasks, todayStr, tomorrowStr);
        return { score, message: urgentBubbleMessage(score) };
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
        const { pomodoroEndTime, pomodoroNotifId } = useTaskStore.getState();
        if (pomodoroEndTime !== null) {
            const remaining = Math.round((pomodoroEndTime - Date.now()) / 1000);
            if (remaining > 0) {
                endTimeRef.current = pomodoroEndTime;
                notifIdRef.current = pomodoroNotifId;
            } else {
                clearPomodoroTimer();
            }
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
            // Parking takes the bubble over pomodoro (AC7a); if a session is active,
            // let the parking handler own the overlay and don't drive it here.
            if (nextState === 'background' && runningRef.current && endTimeRef.current
                && !useTaskStore.getState().parkingSession) {
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

    const handleSelectMode = (idx: PomodoroModeIdx) => {
        stopTimer();
        setModeIdx(idx);
        if (idx === 3) {
            setCustomTimerSeconds(0);
            setSecondsLeft(0);
        } else {
            setSecondsLeft(getModeSeconds(idx, customTimerSeconds));
        }
    };

    const handleStart = async () => {
        const durationSecs = isPaused ? secondsLeft : getModeSeconds(modeIdx, customTimerSeconds);
        const durationMs = durationSecs * 1000;
        const endTime = Date.now() + durationMs;
        endTimeRef.current = endTime;

        const durationMinutes = Math.ceil(durationMs / 60000);
        const id = await schedulePomodoroEnd(durationMinutes);
        notifIdRef.current = id;

        setPomodoroTimer(endTime, modeIdx, id);
        setRunning(true);
    };

    const handlePause = async () => {
        await stopTimer(true);
    };

    const handleReset = () => {
        stopTimer();
        setSecondsLeft(getModeSeconds(modeIdx, customTimerSeconds));
    };

    const handleSetCustomTimerSeconds = (seconds: number) => {
        setCustomTimerSeconds(seconds);
        setSecondsLeft(seconds);
    };

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
