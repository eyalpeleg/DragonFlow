import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { PangoWatcher: NativePangoWatcher } = NativeModules;

// JS bridge to the native Pango usage watcher (Android only). Mirrors the
// FloatingBubble bridge: every call is guarded so it silently no-ops on iOS /
// Expo Go / when the native module is absent.
const PangoWatcher = {
    // Ask the native FloatingBubbleService to begin/stop polling UsageStats for
    // Pango foreground→background transitions.
    startMonitoring() {
        if (Platform.OS === 'android' && NativePangoWatcher) {
            try { NativePangoWatcher.startMonitoring(); } catch {}
        }
    },
    stopMonitoring() {
        if (Platform.OS === 'android' && NativePangoWatcher) {
            try { NativePangoWatcher.stopMonitoring(); } catch {}
        }
    },
    // Whether the user has granted the "Usage access" special permission.
    async hasUsageAccess(): Promise<boolean> {
        if (Platform.OS !== 'android' || !NativePangoWatcher) return false;
        try {
            return await NativePangoWatcher.hasUsageAccess();
        } catch {
            return false;
        }
    },
    // Deep-link to Settings → Usage access so the user can grant it.
    requestUsageAccess() {
        if (Platform.OS === 'android' && NativePangoWatcher) {
            try { NativePangoWatcher.requestUsageAccess(); } catch {}
        }
    },
    // Launch Pango. Resolves false if Pango isn't installed (AC6).
    async openPango(): Promise<boolean> {
        if (Platform.OS !== 'android' || !NativePangoWatcher) return false;
        try {
            return await NativePangoWatcher.openPango();
        } catch {
            return false;
        }
    },
    // Fires when the native watcher observes a (debounced) Pango background event.
    onPangoBackgrounded(callback: () => void) {
        if (Platform.OS !== 'android' || !NativePangoWatcher) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativePangoWatcher);
            const listener = emitter.addListener('pangoBackgrounded', callback);
            return () => listener.remove();
        } catch {
            return () => {};
        }
    },
};

export default PangoWatcher;
