import { useCallback, useEffect, useState } from 'react';
import { useShareIntent as useLibShareIntent } from 'expo-share-intent';
import { parseSharedText, TEXT_MAX } from '../utils/shareText';

export interface SharePrefill {
    title: string;
    description: string;
}

/**
 * Bridges the `expo-share-intent` library to the UI, preserving the app's original
 * `{ prefill, clearPrefill }` interface so the Tasks screen is unaffected by the
 * migration off the old custom-native module.
 *
 * The library delivers both the cold-start share (app launched by the share) and
 * warm-start shares (delivered while running) via `hasShareIntent`/`shareIntent`.
 * We map the shared text into the pure `parseSharedText()` and expose the result as
 * `prefill`; `resetShareIntent()` clears the native singleton so a remount can't
 * re-fire the same share (exactly-once).
 *
 * Title is best-effort: Android `EXTRA_TITLE` (`shareIntent.meta.title`) is used as the
 * subject when the sender provides it, otherwise the title is derived from the text by
 * the parser. `expo-share-intent` does not expose `EXTRA_SUBJECT`, so the old
 * subject→title mapping is intentionally degraded (see story.md AC5).
 *
 * The oversized-share log lives here (the boundary), not in the pure parser, and records
 * lengths only — never the payload content (privacy: story.md AC14).
 */
export function useShareIntent() {
    const [prefill, setPrefill] = useState<SharePrefill | null>(null);
    const { hasShareIntent, shareIntent, resetShareIntent } = useLibShareIntent();

    useEffect(() => {
        if (!hasShareIntent) return;
        const text = shareIntent?.text;
        if (text) {
            const parsed = parseSharedText({ text, subject: shareIntent.meta?.title });
            if (parsed) {
                if (parsed.trimmed) {
                    console.warn(
                        `[shareText] oversized share trimmed to ${TEXT_MAX} chars (was ${text.length})`,
                    );
                }
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setPrefill({ title: parsed.title, description: parsed.description });
            }
        }
        // Drain the native singleton whether or not the payload was usable, so a
        // remount / activity recreate never re-delivers it (exactly-once), and a
        // malformed/empty share is discarded gracefully.
        resetShareIntent();
    }, [hasShareIntent, shareIntent, resetShareIntent]);

    const clearPrefill = useCallback(() => setPrefill(null), []);

    return { prefill, clearPrefill };
}
