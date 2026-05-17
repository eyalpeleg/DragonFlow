import { formatCountdown, formatTabBadge } from '../pomodoroFormat';

describe('formatCountdown', () => {
    it('renders MM:SS for sub-hour durations', () => {
        expect(formatCountdown(0)).toBe('00:00');
        expect(formatCountdown(5)).toBe('00:05');
        expect(formatCountdown(65)).toBe('01:05');
        expect(formatCountdown(25 * 60)).toBe('25:00');
        expect(formatCountdown(59 * 60 + 59)).toBe('59:59');
    });

    it('switches to HH:MM:SS once the timer crosses an hour', () => {
        expect(formatCountdown(3600)).toBe('01:00:00');
        expect(formatCountdown(3661)).toBe('01:01:01');
        expect(formatCountdown(7325)).toBe('02:02:05');
    });

    it('clamps negative input to zero', () => {
        expect(formatCountdown(-10)).toBe('00:00');
    });
});

describe('formatTabBadge', () => {
    it('shows whole-minute remaining for sub-hour durations', () => {
        expect(formatTabBadge(0)).toBe('0m');
        expect(formatTabBadge(59)).toBe('0m');
        expect(formatTabBadge(60)).toBe('1m');
        expect(formatTabBadge(25 * 60)).toBe('25m');
        expect(formatTabBadge(59 * 60)).toBe('59m');
    });

    it('switches to whole-hour units past an hour', () => {
        expect(formatTabBadge(3600)).toBe('1h');
        expect(formatTabBadge(2 * 3600 + 30 * 60)).toBe('2h');
    });

    it('clamps negative input to 0m', () => {
        expect(formatTabBadge(-5)).toBe('0m');
    });
});
