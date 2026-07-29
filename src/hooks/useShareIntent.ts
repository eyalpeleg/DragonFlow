import { useCallback, useEffect, useState } from 'react';
import ShareIntent, { RawShare } from '../modules/ShareIntent';
import { parseSharedText, TEXT_MAX } from '../utils/shareText';

export interface SharePrefill {
    title: string;
    description: string;
}

/**
 * Bridges the native ShareIntent module to the UI: on mount it pulls any share that
 * cold-started the app, and it subscribes to shares that arrive while running. Shared
 * text is parsed by the pure parseSharedText(); the result is exposed as `prefill` for
 * the Tasks screen to open the Add Task modal pre-filled.
 *
 * The oversized-share log lives here (the boundary), not in the pure parser, and records
 * lengths only — never the payload content (design §8; criteria 11a + 14).
 */
export function useShareIntent() {
    const [prefill, setPrefill] = useState<SharePrefill | null>(null);

    const handleRaw = useCallback((raw: RawShare) => {
        const parsed = parseSharedText(raw);
        if (!parsed) return; // blank/whitespace share → nothing to do
        if (parsed.trimmed) {
            console.warn(
                `[shareText] oversized share trimmed to ${TEXT_MAX} chars (was ${raw.text.length})`,
            );
        }
        setPrefill({ title: parsed.title, description: parsed.description });
    }, []);

    useEffect(() => {
        let active = true;
        // Cold start: pull the share that launched the app (if any).
        ShareIntent.getInitialShareText().then((raw) => {
            if (active && raw) handleRaw(raw);
        });
        // Warm start: shares delivered while the app is already running.
        const unsubscribe = ShareIntent.onShareText(handleRaw);
        return () => {
            active = false;
            unsubscribe();
        };
    }, [handleRaw]);

    const clearPrefill = useCallback(() => setPrefill(null), []);

    return { prefill, clearPrefill };
}
