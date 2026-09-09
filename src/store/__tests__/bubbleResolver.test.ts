/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../../utils/notifications', () => ({
    scheduleTaskReminders: jest.fn(), cancelTaskReminders: jest.fn(),
}));
jest.mock('../../modules/FloatingBubble', () => ({
    __esModule: true,
    default: {
        show: jest.fn(), hide: jest.fn(), scheduleSound: jest.fn(), cancelSound: jest.fn(),
        canDrawOverlays: jest.fn(), requestOverlayPermission: jest.fn(),
        onDismissed: jest.fn(() => () => {}), onOpenFocus: jest.fn(() => () => {}),
        startPomodoroTimer: jest.fn(), stopPomodoroTimer: jest.fn(),
    },
}));

import { resolveBubbleOwner } from '../appStore';

// AC7a — precedence: pomodoro > tasks > none, across every combo.
describe('resolveBubbleOwner precedence', () => {
    const cases: [{ pomodoroActive: boolean; taskScore: number }, string][] = [
        [{ pomodoroActive: true, taskScore: 5 }, 'pomodoro'],
        [{ pomodoroActive: true, taskScore: 0 }, 'pomodoro'],
        [{ pomodoroActive: false, taskScore: 2 }, 'tasks'],
        [{ pomodoroActive: false, taskScore: 0 }, 'none'],
    ];
    it.each(cases)('resolves %o → %s', (input, expected) => {
        expect(resolveBubbleOwner(input)).toBe(expected);
    });
});
