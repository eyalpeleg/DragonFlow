import { suggestDueTime } from '../dueTime';

function at(year: number, month: number, day: number, hours = 0, minutes = 0): Date {
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

describe('suggestDueTime', () => {
    it('today, now earlier than default → returns default', () => {
        const today = at(2026, 5, 15);
        const now = at(2026, 5, 15, 7, 0);
        expect(suggestDueTime(today, '08:00', now)).toBe('08:00');
    });

    it('today, now later than default → returns now (HH:MM)', () => {
        const today = at(2026, 5, 15);
        const now = at(2026, 5, 15, 14, 30);
        expect(suggestDueTime(today, '08:00', now)).toBe('14:30');
    });

    it('today, same hour but later minutes → returns now', () => {
        const today = at(2026, 5, 15);
        const now = at(2026, 5, 15, 8, 30);
        expect(suggestDueTime(today, '08:00', now)).toBe('08:30');
    });

    it('today, unpadded default ("8:00") with now 09:00 → returns 09:00 (lex-safe)', () => {
        const today = at(2026, 5, 15);
        const now = at(2026, 5, 15, 9, 0);
        expect(suggestDueTime(today, '8:00', now)).toBe('09:00');
    });

    it('tomorrow → returns default (normalized) regardless of now', () => {
        const tomorrow = at(2026, 5, 16);
        const now = at(2026, 5, 15, 23, 59);
        expect(suggestDueTime(tomorrow, '08:00', now)).toBe('08:00');
    });
});
