import { NativeModules, Platform } from 'react-native';

const { FloatingBubble: NativeFloatingBubble } = NativeModules;

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
};

export default FloatingBubble;
