import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { FloatingBubble: NativeFloatingBubble } = NativeModules;

let eventListener: any = null;

const FloatingBubble = {
    show(count: number, message: string) {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            NativeFloatingBubble.show(count, message);
        }
    },
    hide() {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            NativeFloatingBubble.hide();
        }
    },
    requestOverlayPermission() {
        if (Platform.OS === 'android' && NativeFloatingBubble) {
            NativeFloatingBubble.requestOverlayPermission();
        }
    },
    async canDrawOverlays(): Promise<boolean> {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return false;
        return NativeFloatingBubble.canDrawOverlays();
    },
    onDismissed(callback: () => void) {
        if (Platform.OS !== 'android' || !NativeFloatingBubble) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeFloatingBubble);
            eventListener = emitter.addListener('floatingBubbleDismissed', callback);
            return () => eventListener?.remove();
        } catch (_) {
            return () => {};
        }
    },
};

export default FloatingBubble;
