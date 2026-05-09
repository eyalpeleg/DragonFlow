import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { FloatingBubble: NativeFloatingBubble } = NativeModules;

let eventListener: any = null;

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
    onDismissed(callback: () => void) {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeFloatingBubble);
            eventListener = emitter.addListener('floatingBubbleDismissed', callback);
            return () => eventListener?.remove();
        } catch {
            return () => {};
        }
    },
};

export default FloatingBubble;
