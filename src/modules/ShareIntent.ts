import { NativeModules, Platform, NativeEventEmitter } from 'react-native';

const { ShareIntent: NativeShareIntent } = NativeModules;

/** Raw share as delivered by the native module — unparsed. */
export interface RawShare {
    text: string;
    subject?: string;
}

/**
 * Typed JS bridge for the native ShareIntent module (Android-only).
 * Cold start: pull the pending share once via getInitialShareText().
 * Warm start: subscribe via onShareText().
 * Parsing lives in src/utils/shareText.ts — this layer only shuttles raw strings.
 */
const ShareIntent = {
    async getInitialShareText(): Promise<RawShare | null> {
        if (Platform.OS !== 'android' || !NativeShareIntent) return null;
        try {
            const raw = await NativeShareIntent.getInitialShareText();
            if (raw && typeof raw.text === 'string') return raw as RawShare;
            return null;
        } catch {
            return null;
        }
    },

    onShareText(callback: (raw: RawShare) => void): () => void {
        if (Platform.OS !== 'android' || !NativeShareIntent) return () => {};
        try {
            const emitter = new NativeEventEmitter(NativeShareIntent);
            const listener = emitter.addListener('shareTextReceived', (raw: RawShare) => {
                if (raw && typeof raw.text === 'string') callback(raw);
            });
            return () => listener.remove();
        } catch {
            return () => {};
        }
    },
};

export default ShareIntent;
