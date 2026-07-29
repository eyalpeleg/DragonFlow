import type { ParkingSession } from '../types';

// Pango parking-reminder pure logic. Side-effect free so it can be unit-tested
// without the store, notifications, or the native bridge. See
// docs/design/features/pango-reminder/design.md.

export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 24 * 60; // 24h cap, measured from startedAt

/** Minutes a user may add via the Extend control. */
export type ExtendDelta = 5 | 15 | 30 | 60;

const MS_PER_MIN = 60_000;

/** AC3 — a duration is valid iff it's a whole number of minutes within bounds. */
export function isValidDuration(min: number): boolean {
    return Number.isInteger(min) && min >= MIN_DURATION_MIN && min <= MAX_DURATION_MIN;
}

/** Absolute epoch (ms) at which the reminder should fire. */
export function computeRemindAt(startedAt: number, durationMin: number): number {
    return startedAt + durationMin * MS_PER_MIN;
}

/**
 * AC5 / AC5a — extend the parking end.
 * New end = max(now, remindAt) + delta, so extending early adds to the existing
 * end while extending after expiry adds to *now*. Rejected if it would push the
 * end past 24h from startedAt.
 */
export function computeExtend(
    s: ParkingSession,
    delta: ExtendDelta,
    now: number,
): { ok: true; remindAt: number } | { ok: false; reason: 'exceeds-cap' } {
    const remindAt = Math.max(now, s.remindAt) + delta * MS_PER_MIN;
    if (remindAt > s.startedAt + MAX_DURATION_MIN * MS_PER_MIN) {
        return { ok: false, reason: 'exceeds-cap' };
    }
    return { ok: true, remindAt };
}

/** True once the parking end has passed. */
export function isExpired(s: ParkingSession, now: number): boolean {
    return now >= s.remindAt;
}

/** AC4a — countdown label: "h:mm" when ≥1h remains, else "mm:ss". */
export function formatParkingCountdown(msRemaining: number): string {
    const totalSec = Math.max(0, Math.floor(msRemaining / 1000));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (totalSec >= 3600) {
        return `${h}:${String(m).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** AC4b — overdue label: "+7m" under an hour, "+1h07m" beyond. */
export function formatOverdue(msOverdue: number): string {
    const totalMin = Math.max(0, Math.floor(msOverdue / MS_PER_MIN));
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h > 0) {
        return `+${h}h${String(m).padStart(2, '0')}m`;
    }
    return `+${m}m`;
}

/** AC11 — epoch of the next local 00:00 after `now` ("stop asking today"). */
export function nextLocalMidnight(now: number): number {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0); // rolls into the next day at local midnight
    return d.getTime();
}
