import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { FloatingBubble: NativeFloatingBubble } = NativeModules;

const FloatingBubble = {
    show(count: number, message: string) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.show(count, message); } catch {}
        }
    },
    hide() {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.hide(); } catch {}
        }
    },
    requestOverlayPermission() {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.requestOverlayPermission(); } catch {}
        }
    },
    async canDrawOverlays(): Promise<boolean> {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return false;
        try {
            return await NativeFloatingBubble.canDrawOverlays();
        } catch {
            return false;
        }
    },
    scheduleSound(alarmId: string, triggerAtMs: number, soundType: string, soundFile: 'ding' | 'bell', volume: number) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.scheduleSound(alarmId, triggerAtMs, soundType, soundFile, volume); } catch {}
        }
    },
    cancelSound(alarmId: string) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.cancelSound(alarmId); } catch {}
        }
    },
    startPomodoroTimer(endTimeMs: number, label: string, fallbackCount: number, fallbackMessage: string, soundType: string, volume: number) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.startPomodoroTimer(endTimeMs, label, fallbackCount, fallbackMessage, soundType, volume); } catch {}
        }
    },
    stopPomodoroTimer(fallbackCount: number, fallbackMessage: string) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.stopPomodoroTimer(fallbackCount, fallbackMessage); } catch {}
        }
    },
    // Parking countdown: native ticks a live countdown to remindAtMs and flips to
    // overdue past it. remindAtMs is JS's single source of truth; extend = re-push.
    startParkingTimer(remindAtMs: number, fallbackCount: number, fallbackMessage: string) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.startParkingTimer(remindAtMs, fallbackCount, fallbackMessage); } catch {}
        }
    },
    stopParkingTimer(fallbackCount: number, fallbackMessage: string) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            try { NativeFloatingBubble.stopParkingTimer(fallbackCount, fallbackMessage); } catch {}
        }
    },
    onParkingTap(callback: () => void) {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeFloatingBubble);
            const listener = emitter.addListener('floatingBubbleParkingTap', callback);
            return () => listener.remove();
        } catch {
            return () => {};
        }
    },
    onDismissed(callback: () => void) {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeFloatingBubble);
            const listener = emitter.addListener('floatingBubbleDismissed', callback);
            return () => listener.remove();
        } catch {
            return () => {};
        }
    },
    onOpenFocus(callback: () => void) {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeFloatingBubble);
            const listener = emitter.addListener('floatingBubbleOpenFocus', callback);
            return () => listener.remove();
        } catch {
            return () => {};
        }
    },
};

export default FloatingBubble;
