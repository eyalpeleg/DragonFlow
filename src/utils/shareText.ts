/**
 * Pure parser for text shared into the app via the Android share sheet (ACTION_SEND).
 *
 * Turns raw shared text (+ an optional subject, e.g. a browser tab title) into a
 * { title, description } pair suitable for pre-filling the Add Task modal.
 *
 * This module is intentionally side-effect-free (no logging, no native calls) so it
 * can be unit-tested exhaustively. The `trimmed` flag lets the caller log that an
 * oversized share was cut — the caller logs lengths only, never the content.
 *
 * See docs/design/features/share-text-target/design.md §6.
 */

/** Hard cap on shared text length; anything longer is truncated and marked. */
export const TEXT_MAX = 10_000;
/** Max title length; an over-long title is shortened while the body is kept in full. */
export const TITLE_MAX = 100;
/** Appended to the description when the shared text exceeded TEXT_MAX, so the user knows. */
export const TRIMMED_MARKER = '[TRIMMED]';

export interface ParsedShare {
    title: string;
    description: string;
    /** True when the shared text exceeded TEXT_MAX and content was dropped. */
    trimmed: boolean;
}

/** A single token that looks like an http(s) URL (no embedded whitespace). */
function isBareUrl(s: string): boolean {
    if (/\s/.test(s)) return false;
    return /^https?:\/\/\S+$/i.test(s);
}

/** Extract the hostname from a URL without relying on a URL global (Hermes-safe). */
function hostnameOf(url: string): string {
    const m = /^https?:\/\/([^/?#]+)/i.exec(url);
    return m ? m[1] : url;
}

/**
 * Parse shared text into task fields. Returns null when there is nothing usable
 * (empty/whitespace-only), so the caller can decline to open the modal.
 */
export function parseSharedText(raw: { text?: string | null; subject?: string | null }): ParsedShare | null {
    const fullText = (raw.text ?? '').toString();
    if (!fullText.trim()) return null;

    // Size cap (data loss): truncate the body before deriving fields.
    const trimmed = fullText.length > TEXT_MAX;
    const body = trimmed ? fullText.slice(0, TEXT_MAX) : fullText;

    const subject = (raw.subject ?? '').toString().trim();

    let title: string;
    let description: string;

    if (subject) {
        // A subject (e.g. a shared browser tab's title) becomes the title.
        title = subject;
        description = body;
    } else {
        const bodyTrimmed = body.trim();
        if (isBareUrl(bodyTrimmed)) {
            // Bare URL: show the host, keep the full URL in the description.
            // Note: treated purely as a string — never opened or fetched.
            title = hostnameOf(bodyTrimmed);
            description = bodyTrimmed;
        } else {
            // First non-empty line → title; the rest → description.
            const lines = body.split('\n');
            let idx = lines.findIndex((l) => l.trim().length > 0);
            if (idx === -1) idx = 0;
            title = lines[idx].trim();
            description = lines.slice(idx + 1).join('\n').trim();
        }
    }

    // Title cap (no data loss): shorten the title but guarantee the full body
    // survives in the description.
    if (title.length > TITLE_MAX) {
        description = body.trim();
        title = title.slice(0, TITLE_MAX).trimEnd();
    }

    // Trimmed marker (data loss made visible to the user).
    if (trimmed) {
        description = (description ? description + '\n\n' : '') + TRIMMED_MARKER;
    }

    return { title, description, trimmed };
}
