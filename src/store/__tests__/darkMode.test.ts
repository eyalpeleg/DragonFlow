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
        startPomodoroTimer: jest.fn(),
        stopPomodoroTimer: jest.fn(),
    },
}));

import { useTaskStore } from '../appStore';

describe('darkMode store field', () => {
    beforeEach(() => {
        useTaskStore.setState({ darkMode: false });
    });

    it('defaults to false', () => {
        expect(useTaskStore.getState().darkMode).toBe(false);
    });

    it('setDarkMode toggles the value', () => {
        useTaskStore.getState().setDarkMode(true);
        expect(useTaskStore.getState().darkMode).toBe(true);
        useTaskStore.getState().setDarkMode(false);
        expect(useTaskStore.getState().darkMode).toBe(false);
    });

    it('importData restores darkMode from settings', () => {
        useTaskStore.getState().importData({
            tasks: [],
            categories: [],
            settings: { darkMode: true },
        });
        expect(useTaskStore.getState().darkMode).toBe(true);
    });

    it('exportData includes darkMode in settings', () => {
        useTaskStore.getState().setDarkMode(true);
        const exported = useTaskStore.getState().exportData() as {
            settings: { darkMode: boolean };
        };
        expect(exported.settings.darkMode).toBe(true);
    });
});
