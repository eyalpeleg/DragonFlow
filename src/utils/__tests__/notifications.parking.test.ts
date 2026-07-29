import * as Notifications from 'expo-notifications';
import {
    cancelParkingReminder,
    scheduleParkingReminder,
    setupParkingNotificationCategory,
} from '../notifications';

const mockSchedule = Notifications.scheduleNotificationAsync as jest.Mock;
const mockCancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const mockCategory = Notifications.setNotificationCategoryAsync as jest.Mock;

describe('parking notifications (AC4/AC5/AC19)', () => {
    beforeEach(() => {
        mockSchedule.mockClear();
        mockCancel.mockClear();
        mockCategory.mockClear();
    });

    it('schedules an absolute DATE reminder keyed by sessionId', async () => {
        const remindAt = 1_700_000_000_000;
        const returned = await scheduleParkingReminder(remindAt, 'sess-1');
        expect(returned).toBe('sess-1');
        expect(mockSchedule).toHaveBeenCalledTimes(1);
        const arg = mockSchedule.mock.calls[0][0];
        expect(arg.identifier).toBe('sess-1');
        expect(arg.content.data).toEqual({ type: 'parking', sessionId: 'sess-1' });
        expect(arg.content.categoryIdentifier).toBe('parking-reminder');
        expect(arg.trigger.type).toBe('date');
        expect(arg.trigger.date).toEqual(new Date(remindAt));
    });

    it('reuses the same identifier so extend reschedules in place', async () => {
        await scheduleParkingReminder(1_000, 'sess-1');
        await scheduleParkingReminder(2_000, 'sess-1');
        expect(mockSchedule.mock.calls[0][0].identifier).toBe('sess-1');
        expect(mockSchedule.mock.calls[1][0].identifier).toBe('sess-1');
    });

    it('cancels by notification id', async () => {
        await cancelParkingReminder('sess-1');
        expect(mockCancel).toHaveBeenCalledWith('sess-1');
    });

    it('does nothing when cancelling an empty id', async () => {
        await cancelParkingReminder('');
        expect(mockCancel).not.toHaveBeenCalled();
    });

    it('registers Extend / Open Parking App action buttons', async () => {
        await setupParkingNotificationCategory();
        expect(mockCategory).toHaveBeenCalledWith('parking-reminder', [
            { identifier: 'extend-15', buttonTitle: '+15 min' },
            { identifier: 'open-parking', buttonTitle: 'Open Parking App' },
        ]);
    });
});
