import {
    MAX_DURATION_MIN,
    MIN_DURATION_MIN,
    computeExtend,
    computeRemindAt,
    formatOverdue,
    formatParkingCountdown,
    isExpired,
    isValidDuration,
    nextLocalMidnight,
} from '../parking';
import type { ParkingSession } from '../../types';

const MIN = 60_000;
const session = (over: Partial<ParkingSession> = {}): ParkingSession => ({
    id: 'p1',
    startedAt: 1_000_000,
    durationMin: 60,
    remindAt: 1_000_000 + 60 * MIN,
    ...over,
});

describe('parking pure helpers', () => {
    // AC3 — duration bounds
    describe('isValidDuration', () => {
        it('accepts values within [5, 1440]', () => {
            expect(isValidDuration(MIN_DURATION_MIN)).toBe(true);
            expect(isValidDuration(60)).toBe(true);
            expect(isValidDuration(MAX_DURATION_MIN)).toBe(true);
        });
        it('rejects out-of-bounds and non-integers', () => {
            expect(isValidDuration(4)).toBe(false);
            expect(isValidDuration(1441)).toBe(false);
            expect(isValidDuration(0)).toBe(false);
            expect(isValidDuration(-30)).toBe(false);
            expect(isValidDuration(30.5)).toBe(false);
            expect(isValidDuration(NaN)).toBe(false);
        });
    });

    // AC2 — remindAt math
    it('computeRemindAt adds duration in ms', () => {
        expect(computeRemindAt(1_000_000, 60)).toBe(1_000_000 + 60 * MIN);
    });

    // AC5 / AC5a — extend
    describe('computeExtend', () => {
        it('extends from the existing end when not yet expired', () => {
            const s = session(); // remindAt = start + 60m
            const now = s.startedAt + 10 * MIN; // 10m in
            const r = computeExtend(s, 15, now);
            expect(r.ok).toBe(true);
            if (r.ok) expect(r.remindAt).toBe(s.remindAt + 15 * MIN);
        });
        it('extends from now when already expired', () => {
            const s = session({ durationMin: 30, remindAt: 1_000_000 + 30 * MIN });
            const now = s.remindAt + 5 * MIN; // 5m overdue
            const r = computeExtend(s, 15, now);
            expect(r.ok).toBe(true);
            if (r.ok) expect(r.remindAt).toBe(now + 15 * MIN);
        });
        it('rejects an extend that would exceed 24h from startedAt', () => {
            const s = session({ durationMin: MAX_DURATION_MIN - 10, remindAt: 1_000_000 + (MAX_DURATION_MIN - 10) * MIN });
            const now = s.startedAt + 5 * MIN;
            const r = computeExtend(s, 60, now); // +60 would blow past the cap
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.reason).toBe('exceeds-cap');
        });
        it('allows an extend that lands exactly on the cap', () => {
            const s = session({ durationMin: MAX_DURATION_MIN - 15, remindAt: 1_000_000 + (MAX_DURATION_MIN - 15) * MIN });
            const now = s.startedAt; // extend from the existing end
            const r = computeExtend(s, 15, now);
            expect(r.ok).toBe(true);
        });
    });

    // AC4b — expiry
    describe('isExpired', () => {
        it('is false before remindAt and true at/after it', () => {
            const s = session();
            expect(isExpired(s, s.remindAt - 1)).toBe(false);
            expect(isExpired(s, s.remindAt)).toBe(true);
            expect(isExpired(s, s.remindAt + 1)).toBe(true);
        });
    });

    // AC4a — countdown formatting
    describe('formatParkingCountdown', () => {
        it('uses h:mm at or above one hour', () => {
            expect(formatParkingCountdown(60 * MIN)).toBe('1:00');
            expect(formatParkingCountdown(125 * MIN)).toBe('2:05');
        });
        it('uses mm:ss under one hour', () => {
            expect(formatParkingCountdown(59 * MIN + 30_000)).toBe('59:30');
            expect(formatParkingCountdown(90_000)).toBe('01:30');
        });
        it('never goes negative', () => {
            expect(formatParkingCountdown(-5000)).toBe('00:00');
        });
    });

    // AC4b — overdue formatting
    describe('formatOverdue', () => {
        it('shows +Xm under an hour', () => {
            expect(formatOverdue(7 * MIN)).toBe('+7m');
            expect(formatOverdue(0)).toBe('+0m');
        });
        it('shows +XhYYm beyond an hour', () => {
            expect(formatOverdue(67 * MIN)).toBe('+1h07m');
        });
    });

    // AC11 — stop-asking-today reset point
    describe('nextLocalMidnight', () => {
        it('returns a strictly future local midnight', () => {
            const now = Date.now();
            const mid = nextLocalMidnight(now);
            expect(mid).toBeGreaterThan(now);
            const d = new Date(mid);
            expect(d.getHours()).toBe(0);
            expect(d.getMinutes()).toBe(0);
            expect(d.getSeconds()).toBe(0);
            expect(mid - now).toBeLessThanOrEqual(24 * 60 * MIN);
        });
    });
});
