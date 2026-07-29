import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { ParkingWatcher: NativeParkingWatcher } = NativeModules;

// JS bridge to the native parking-app usage watcher (Android only). Mirrors the
// FloatingBubble bridge: every call is guarded so it silently no-ops on iOS /
// Expo Go / when the native module is absent.
const ParkingWatcher = {
    // Ask the native FloatingBubbleService to begin/stop polling UsageStats for
    // the parking app's foreground→background transitions.
    startMonitoring() {
        if (Platform.OS === 'android' && NativeParkingWatcher) {
            try { NativeParkingWatcher.startMonitoring(); } catch {}
        }
    },
    stopMonitoring() {
        if (Platform.OS === 'android' && NativeParkingWatcher) {
            try { NativeParkingWatcher.stopMonitoring(); } catch {}
        }
    },
    // Whether the user has granted the "Usage access" special permission.
    async hasUsageAccess(): Promise<boolean> {
        if (Platform.OS !== 'android' || !NativeParkingWatcher) return false;
        try {
            return await NativeParkingWatcher.hasUsageAccess();
        } catch {
            return false;
        }
    },
    // Deep-link to Settings → Usage access so the user can grant it.
    requestUsageAccess() {
        if (Platform.OS === 'android' && NativeParkingWatcher) {
            try { NativeParkingWatcher.requestUsageAccess(); } catch {}
        }
    },
    // Launch the parking app. Resolves false if it isn't installed (AC6).
    async openParkingApp(): Promise<boolean> {
        if (Platform.OS !== 'android' || !NativeParkingWatcher) return false;
        try {
            return await NativeParkingWatcher.openParkingApp();
        } catch {
            return false;
        }
    },
    // Fires when the native watcher observes a (debounced) parking-app background event.
    onParkingBackgrounded(callback: () => void) {
        if (Platform.OS !== 'android' || !NativeParkingWatcher) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeParkingWatcher);
            const listener = emitter.addListener('parkingAppBackgrounded', callback);
            return () => listener.remove();
        } catch {
            return () => {};
        }
    },
};

export default ParkingWatcher;
