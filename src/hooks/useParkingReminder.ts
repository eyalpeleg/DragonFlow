import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import ParkingWatcher from '../modules/ParkingWatcher';
import { useTaskStore } from '../store/appStore';
import { dismissParkingArmPrompt, presentParkingArmPrompt } from '../utils/notifications';
import { isExpired, nextLocalMidnight } from '../utils/parking';

const NOT_PARKING_COOLDOWN_MS = 30 * 60_000; // production
const NOT_PARKING_COOLDOWN_MS_DEBUG = 2 * 60_000; // when the app's Debug mode is on

/**
 * Bridges the native parking-app watcher to the UI. While the feature is enabled
 * (and no session is active), it asks the native FloatingBubbleService to poll
 * UsageStats; when the parking app is backgrounded it surfaces the arm prompt — subject to
 * the JS guardrails (suppress while a session is active or within a cooldown /
 * "stop asking today" window). See docs/design/features/parking-reminder/design.md.
 */
export function useParkingReminder() {
    const enabled = useTaskStore((s) => s.parkingReminderEnabled);
    const parkingSession = useTaskStore((s) => s.parkingSession);
    const promptVisible = useTaskStore((s) => s.parkingArmPromptVisible);
    // Bumped to force the monitoring effect to re-evaluate when a session's reminder
    // fires (time-based) or the app returns to the foreground.
    const [reArmTick, setReArmTick] = useState(0);

    const handleBackgrounded = useCallback(() => {
        const s = useTaskStore.getState();
        console.log('[ParkingWatcher] JS received parkingAppBackgrounded event');
        // AC9 — only suppress while a session is still running (not yet fired). An
        // already-expired session must not block a fresh reminder; arming replaces it.
        if (s.parkingSession && !isExpired(s.parkingSession, Date.now())) {
            console.log('[ParkingWatcher] suppressed: an un-expired parking session is active');
            return;
        }
        // AC10 / AC11 — respect the cooldown / "stop asking today" window. The
        // native poll self-stops after each catch, so re-arm it for later.
        if (s.parkingSuppressedUntil !== null && Date.now() < s.parkingSuppressedUntil) {
            console.log(`[ParkingWatcher] suppressed until ${new Date(s.parkingSuppressedUntil).toLocaleString()} → re-arming monitor`);
            ParkingWatcher.startMonitoring();
            return;
        }
        // Mark the modal pending (shows if/when the app is foregrounded), and — when
        // the app is in the background — post the heads-up notification so the user
        // can arm from any screen without opening DragonFlow.
        s.setParkingArmPromptVisible(true);
        if (AppState.currentState === 'active') {
            console.log('[ParkingWatcher] app foreground → showing arm modal');
        } else {
            console.log('[ParkingWatcher] app background → posting arm notification');
            presentParkingArmPrompt();
        }
    }, []);

    useEffect(() => {
        // Monitor while enabled and there's no *un-expired* session. An expired
        // (fired) session no longer blocks detection (AC12 / AC22).
        const now = Date.now();
        const sessionRunning = parkingSession != null && !isExpired(parkingSession, now);
        if (!enabled || sessionRunning) {
            console.log(`[ParkingWatcher] not monitoring (enabled=${enabled}, sessionRunning=${sessionRunning}) → stopMonitoring`);
            ParkingWatcher.stopMonitoring();
            // Resume monitoring right when the reminder fires, so the next parking-app use is
            // caught even if the user never marks the session done.
            if (enabled && sessionRunning) {
                const delay = parkingSession!.remindAt - now + 1000;
                const t = setTimeout(() => setReArmTick((n) => n + 1), delay);
                return () => clearTimeout(t);
            }
            return;
        }
        let active = true;
        const unsubscribe = ParkingWatcher.onParkingBackgrounded(handleBackgrounded);
        // Re-check the (revocable) Usage-access grant before each start (AC15).
        ParkingWatcher.hasUsageAccess().then((granted) => {
            console.log(`[ParkingWatcher] enabled; usageAccess=${granted}; expiredSession=${parkingSession != null} → ${active && granted ? 'startMonitoring' : 'NOT starting (grant Usage access)'}`);
            if (active && granted) ParkingWatcher.startMonitoring();
        });
        return () => {
            active = false;
            unsubscribe();
            ParkingWatcher.stopMonitoring();
        };
    }, [enabled, parkingSession, handleBackgrounded, reArmTick]);

    const arm = useCallback((durationMin: number) => {
        console.log(`[ParkingWatcher] USER: set parking reminder to ${durationMin} min (arm modal)`);
        useTaskStore.getState().startParkingSession(durationMin);
        useTaskStore.getState().setParkingArmPromptVisible(false);
        dismissParkingArmPrompt();
    }, []);

    const dismiss = useCallback((kind: 'not-parking' | 'today') => {
        console.log(`[ParkingWatcher] USER: dismissed arm prompt — ${kind === 'today' ? 'stop asking today' : 'not parking'} (arm modal)`);
        const now = Date.now();
        const cooldownMs = useTaskStore.getState().debugModeEnabled ? NOT_PARKING_COOLDOWN_MS_DEBUG : NOT_PARKING_COOLDOWN_MS;
        const until = kind === 'today' ? nextLocalMidnight(now) : now + cooldownMs;
        useTaskStore.getState().setParkingSuppressedUntil(until);
        useTaskStore.getState().setParkingArmPromptVisible(false);
        dismissParkingArmPrompt();
        // Keep watching for the next genuine parking; prompts stay gated by the window.
        ParkingWatcher.startMonitoring();
    }, []);

    return { promptVisible, arm, dismiss };
}
