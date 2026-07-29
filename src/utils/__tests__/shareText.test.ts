import { parseSharedText, TEXT_MAX, TITLE_MAX, TRIMMED_MARKER } from '../shareText';

describe('parseSharedText', () => {
    // Criterion 10 — blank → no task
    it('returns null for empty text', () => {
        expect(parseSharedText({ text: '' })).toBeNull();
    });
    it('returns null for whitespace-only text', () => {
        expect(parseSharedText({ text: '   \n\t ' })).toBeNull();
    });
    it('returns null for null/undefined text', () => {
        expect(parseSharedText({ text: null })).toBeNull();
        expect(parseSharedText({})).toBeNull();
    });

    // Criterion 5 — subject present
    it('uses the subject as the title and the body as the description', () => {
        const r = parseSharedText({ text: 'Read this great write-up', subject: 'My Article Title' })!;
        expect(r.title).toBe('My Article Title');
        expect(r.description).toBe('Read this great write-up');
        expect(r.trimmed).toBe(false);
    });

    // Criterion 6 — multi-line, no subject
    it('splits first line → title, rest → description', () => {
        const r = parseSharedText({ text: 'Buy milk\nand eggs\nand bread' })!;
        expect(r.title).toBe('Buy milk');
        expect(r.description).toBe('and eggs\nand bread');
    });
    it('skips leading blank lines when choosing the title', () => {
        const r = parseSharedText({ text: '\n\nFirst real line\nsecond' })!;
        expect(r.title).toBe('First real line');
        expect(r.description).toBe('second');
    });

    // Criterion 7 / 15 — bare URL (never fetched — pure string handling)
    it('maps a bare URL to hostname title + full URL description', () => {
        const r = parseSharedText({ text: 'https://example.com/path/to/article?x=1' })!;
        expect(r.title).toBe('example.com');
        expect(r.description).toBe('https://example.com/path/to/article?x=1');
    });
    it('treats text containing a URL among words as normal text, not a bare URL', () => {
        const r = parseSharedText({ text: 'see https://example.com now' })!;
        expect(r.title).toBe('see https://example.com now');
        expect(r.description).toBe('');
    });

    // Criterion 8 — short single line
    it('short single line → title with empty description', () => {
        const r = parseSharedText({ text: 'Call the dentist' })!;
        expect(r.title).toBe('Call the dentist');
        expect(r.description).toBe('');
        expect(r.trimmed).toBe(false);
    });

    // Criterion 11 — title too long, no data loss
    it('shortens an over-long title but keeps the full body in the description', () => {
        const longLine = 'x'.repeat(TITLE_MAX + 50);
        const r = parseSharedText({ text: longLine })!;
        expect(r.title.length).toBe(TITLE_MAX);
        expect(r.description).toBe(longLine); // full text preserved
        expect(r.trimmed).toBe(false);
    });

    // Criterion 11a — text exceeds size limit, data loss made visible
    it('truncates oversized text and appends the [TRIMMED] marker', () => {
        const huge = 'a'.repeat(TEXT_MAX + 500);
        const r = parseSharedText({ text: huge })!;
        expect(r.trimmed).toBe(true);
        expect(r.description.endsWith(TRIMMED_MARKER)).toBe(true);
        // body content kept is capped to TEXT_MAX (marker excluded)
        const withoutMarker = r.description.slice(0, r.description.length - TRIMMED_MARKER.length).trimEnd();
        expect(withoutMarker.length).toBeLessThanOrEqual(TEXT_MAX);
    });
    it('does not mark normal-sized text as trimmed', () => {
        const r = parseSharedText({ text: 'a'.repeat(TEXT_MAX) })!;
        expect(r.trimmed).toBe(false);
        expect(r.description.includes(TRIMMED_MARKER)).toBe(false);
    });
});
