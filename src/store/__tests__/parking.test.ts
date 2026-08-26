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
    scheduleParkingReminder: jest.fn().mockResolvedValue('id'),
    cancelParkingReminder: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../modules/FloatingBubble', () => ({
    __esModule: true,
    default: {
        show: jest.fn(), hide: jest.fn(), scheduleSound: jest.fn(), cancelSound: jest.fn(),
        canDrawOverlays: jest.fn().mockResolvedValue(true), requestOverlayPermission: jest.fn(),
        onDismissed: jest.fn(() => () => {}), onOpenFocus: jest.fn(() => () => {}),
        startPomodoroTimer: jest.fn(), stopPomodoroTimer: jest.fn(),
        startParkingTimer: jest.fn(), stopParkingTimer: jest.fn(), onParkingTap: jest.fn(() => () => {}),
    },
}));

import { useTaskStore } from '../appStore';
import { scheduleParkingReminder, cancelParkingReminder } from '../../utils/notifications';
import { MAX_DURATION_MIN, MIN_DURATION_MIN } from '../../utils/parking';

const MIN = 60_000;
const mockSchedule = scheduleParkingReminder as jest.Mock;
const mockCancel = cancelParkingReminder as jest.Mock;

describe('parking store actions', () => {
    beforeEach(() => {
        mockSchedule.mockClear();
        mockCancel.mockClear();
        useTaskStore.setState({ parkingSession: null, parkingReminderEnabled: false, parkingSuppressedUntil: null });
    });

    // AC12 — default on. beforeEach forces the flag to false for isolation, so the
    // real factory default has to be read from a freshly required store instance.
    it('parkingReminderEnabled defaults to true', () => {
        let freshDefault: boolean | undefined;
        jest.isolateModules(() => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs a fresh require, not the hoisted static import
            const { useTaskStore: freshStore } = require('../appStore');
            freshDefault = freshStore.getState().parkingReminderEnabled;
        });
        expect(freshDefault).toBe(true);
    });

    // AC2 — arm creates a session and schedules a reminder
    it('startParkingSession creates a session with remindAt = start + duration and schedules', () => {
        const session = useTaskStore.getState().startParkingSession(60);
        expect(session).not.toBeNull();
        expect(session!.durationMin).toBe(60);
        expect(session!.remindAt - session!.startedAt).toBe(60 * MIN);
        expect(session!.notifId).toBe(session!.id);
        expect(useTaskStore.getState().parkingSession).toEqual(session);
        expect(mockSchedule).toHaveBeenCalledWith(session!.remindAt, session!.id);
    });

    // AC3 — out-of-bounds duration → no session
    it('startParkingSession rejects an out-of-bounds duration', () => {
        expect(useTaskStore.getState().startParkingSession(MIN_DURATION_MIN - 1)).toBeNull();
        expect(useTaskStore.getState().startParkingSession(MAX_DURATION_MIN + 1)).toBeNull();
        expect(useTaskStore.getState().parkingSession).toBeNull();
        expect(mockSchedule).not.toHaveBeenCalled();
    });

    // AC5 — extend pushes remindAt and reschedules under the same id
    it('extendParkingSession extends and reschedules', () => {
        const session = useTaskStore.getState().startParkingSession(60)!;
        mockSchedule.mockClear();
        const ok = useTaskStore.getState().extendParkingSession(15);
        expect(ok).toBe(true);
        const updated = useTaskStore.getState().parkingSession!;
        expect(updated.id).toBe(session.id);
        expect(updated.remindAt).toBe(session.remindAt + 15 * MIN);
        expect(mockCancel).toHaveBeenCalledWith(session.id);
        expect(mockSchedule).toHaveBeenCalledWith(updated.remindAt, session.id);
    });

    // AC5a — extend beyond the 24h cap is rejected
    it('extendParkingSession rejects an extend past the 24h cap', () => {
        const session = useTaskStore.getState().startParkingSession(MAX_DURATION_MIN)!;
        const before = session.remindAt;
        const ok = useTaskStore.getState().extendParkingSession(60);
        expect(ok).toBe(false);
        expect(useTaskStore.getState().parkingSession!.remindAt).toBe(before);
    });

    it('extendParkingSession returns false with no active session', () => {
        expect(useTaskStore.getState().extendParkingSession(15)).toBe(false);
    });

    // AC7 — clear cancels the reminder and nulls the session
    it('clearParkingSession cancels and clears', () => {
        const session = useTaskStore.getState().startParkingSession(60)!;
        useTaskStore.getState().clearParkingSession();
        expect(mockCancel).toHaveBeenCalledWith(session.id);
        expect(useTaskStore.getState().parkingSession).toBeNull();
    });

    // AC10 / AC11 — suppression setters
    it('setParkingSuppressedUntil stores the epoch', () => {
        useTaskStore.getState().setParkingSuppressedUntil(123456);
        expect(useTaskStore.getState().parkingSuppressedUntil).toBe(123456);
        useTaskStore.getState().setParkingSuppressedUntil(null);
        expect(useTaskStore.getState().parkingSuppressedUntil).toBeNull();
    });

    it('setParkingReminderEnabled toggles the flag', () => {
        useTaskStore.getState().setParkingReminderEnabled(true);
        expect(useTaskStore.getState().parkingReminderEnabled).toBe(true);
    });

    // AC13a — first-launch disclosure gate
    it('setParkingDisclosureSeen toggles the flag', () => {
        useTaskStore.setState({ parkingDisclosureSeen: false });
        useTaskStore.getState().setParkingDisclosureSeen(true);
        expect(useTaskStore.getState().parkingDisclosureSeen).toBe(true);
    });
});
