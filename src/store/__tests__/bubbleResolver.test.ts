/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('../../utils/notifications', () => ({
    scheduleTaskReminders: jest.fn(), cancelTaskReminders: jest.fn(),
    scheduleParkingReminder: jest.fn(), cancelParkingReminder: jest.fn(),
}));
jest.mock('../../modules/FloatingBubble', () => ({
    __esModule: true,
    default: {
        show: jest.fn(), hide: jest.fn(), scheduleSound: jest.fn(), cancelSound: jest.fn(),
        canDrawOverlays: jest.fn(), requestOverlayPermission: jest.fn(),
        onDismissed: jest.fn(() => () => {}), onOpenFocus: jest.fn(() => () => {}),
        startPomodoroTimer: jest.fn(), stopPomodoroTimer: jest.fn(),
        startParkingTimer: jest.fn(), stopParkingTimer: jest.fn(), onParkingTap: jest.fn(() => () => {}),
    },
}));

import { resolveBubbleOwner } from '../appStore';

// AC7a — precedence: parking > pomodoro > tasks > none, across every combo.
describe('resolveBubbleOwner precedence', () => {
    const cases: [{ parkingActive: boolean; pomodoroActive: boolean; taskScore: number }, string][] = [
        [{ parkingActive: true, pomodoroActive: true, taskScore: 3 }, 'parking'],
        [{ parkingActive: true, pomodoroActive: false, taskScore: 0 }, 'parking'],
        [{ parkingActive: true, pomodoroActive: true, taskScore: 0 }, 'parking'],
        [{ parkingActive: false, pomodoroActive: true, taskScore: 5 }, 'pomodoro'],
        [{ parkingActive: false, pomodoroActive: true, taskScore: 0 }, 'pomodoro'],
        [{ parkingActive: false, pomodoroActive: false, taskScore: 2 }, 'tasks'],
        [{ parkingActive: false, pomodoroActive: false, taskScore: 0 }, 'none'],
    ];
    it.each(cases)('resolves %o → %s', (input, expected) => {
        expect(resolveBubbleOwner(input)).toBe(expected);
    });
});
