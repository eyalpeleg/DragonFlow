import { formatCountdown } from '../pomodoroFormat';

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
