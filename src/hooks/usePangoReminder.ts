import { useCallback, useEffect, useState } from 'react';
import PangoWatcher from '../modules/PangoWatcher';
import { useTaskStore } from '../store/appStore';
import { nextLocalMidnight } from '../utils/parking';

const NOT_PARKING_COOLDOWN_MS = 30 * 60_000;

/**
 * Bridges the native Pango watcher to the UI. While the feature is enabled (and
 * no session is active), it asks the native FloatingBubbleService to poll
 * UsageStats; when Pango is backgrounded it surfaces the arm prompt — subject to
 * the JS guardrails (suppress while a session is active or within a cooldown /
 * "stop asking today" window). See docs/design/features/pango-reminder/design.md.
 */
export function usePangoReminder() {
    const enabled = useTaskStore((s) => s.pangoReminderEnabled);
    const parkingSession = useTaskStore((s) => s.parkingSession);
    const [promptVisible, setPromptVisible] = useState(false);

    const handleBackgrounded = useCallback(() => {
        const s = useTaskStore.getState();
        // AC9 — never prompt while a session is already active.
        if (s.parkingSession) return;
        // AC10 / AC11 — respect the cooldown / "stop asking today" window. The
        // native poll self-stops after each catch, so re-arm it for later.
        if (s.pangoSuppressedUntil !== null && Date.now() < s.pangoSuppressedUntil) {
            PangoWatcher.startMonitoring();
            return;
        }
        setPromptVisible(true);
    }, []);

    useEffect(() => {
        // Monitor only when enabled and no session is active (AC12 / AC22).
        if (!enabled || parkingSession) {
            PangoWatcher.stopMonitoring();
            return;
        }
        let active = true;
        const unsubscribe = PangoWatcher.onPangoBackgrounded(handleBackgrounded);
        // Re-check the (revocable) Usage-access grant before each start (AC15).
        PangoWatcher.hasUsageAccess().then((granted) => {
            if (active && granted) PangoWatcher.startMonitoring();
        });
        return () => {
            active = false;
            unsubscribe();
            PangoWatcher.stopMonitoring();
        };
    }, [enabled, parkingSession, handleBackgrounded]);

    const arm = useCallback((durationMin: number) => {
        useTaskStore.getState().startParkingSession(durationMin);
        setPromptVisible(false);
    }, []);

    const dismiss = useCallback((kind: 'not-parking' | 'today') => {
        const now = Date.now();
        const until = kind === 'today' ? nextLocalMidnight(now) : now + NOT_PARKING_COOLDOWN_MS;
        useTaskStore.getState().setPangoSuppressedUntil(until);
        setPromptVisible(false);
        // Keep watching for the next genuine parking; prompts stay gated by the window.
        PangoWatcher.startMonitoring();
    }, []);

    return { promptVisible, arm, dismiss };
}
