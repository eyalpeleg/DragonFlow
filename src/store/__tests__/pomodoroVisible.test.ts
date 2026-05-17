/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('../../utils/notifications', () => ({
    scheduleTaskReminders: jest.fn().mockResolvedValue(undefined),
    cancelTaskReminders: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../modules/FloatingBubble', () => ({
    __esModule: true,
    default: {
        show: jest.fn(),
        hide: jest.fn(),
        scheduleSound: jest.fn(),
        cancelSound: jest.fn(),
        canDrawOverlays: jest.fn().mockResolvedValue(true),
        requestOverlayPermission: jest.fn(),
        onDismissed: jest.fn(() => () => {}),
        onOpenFocus: jest.fn(() => () => {}),
        startPomodoroTimer: jest.fn(),
        stopPomodoroTimer: jest.fn(),
    },
}));

import { useTaskStore } from '../appStore';

describe('pomodoroVisible store field', () => {
    beforeEach(() => {
        useTaskStore.setState({ pomodoroVisible: false });
    });

    it('defaults to false', () => {
        expect(useTaskStore.getState().pomodoroVisible).toBe(false);
    });

    it('setPomodoroVisible toggles the value', () => {
        useTaskStore.getState().setPomodoroVisible(true);
        expect(useTaskStore.getState().pomodoroVisible).toBe(true);
        useTaskStore.getState().setPomodoroVisible(false);
        expect(useTaskStore.getState().pomodoroVisible).toBe(false);
    });

    it('is not included in exportData (transient UI state)', () => {
        useTaskStore.getState().setPomodoroVisible(true);
        const exported = useTaskStore.getState().exportData() as {
            settings: Record<string, unknown>;
        };
        expect(exported.settings).not.toHaveProperty('pomodoroVisible');
    });
});
