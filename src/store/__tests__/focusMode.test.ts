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

import { computeBubbleScore, isUrgent } from '../appStore';
import type { Task, TaskStatus } from '../../types';
import type { PriorityLevel } from '../../styles/theme';

const TODAY = '2026-05-16';
const TOMORROW = '2026-05-17';

function makeTask(overrides: Partial<Task> & { id: string }): Task {
    return {
        title: `Task ${overrides.id}`,
        description: '',
        priority: 'Medium' as PriorityLevel,
        categoryId: 'default',
        dueDate: '',
        dueTime: '08:00',
        status: 'Ready' as TaskStatus,
        createdAt: Date.now(),
        subTasks: [],
        ...overrides,
    };
}

describe('isUrgent / computeBubbleScore parity', () => {
    const fixture: Task[] = [
        makeTask({ id: 'overdue',                dueDate: '2026-05-10', priority: 'Low' }),
        makeTask({ id: 'today-low',              dueDate: TODAY,        priority: 'Low' }),
        makeTask({ id: 'today-critical',         dueDate: TODAY,        priority: 'Critical' }),
        makeTask({ id: 'tomorrow-critical',      dueDate: TOMORROW,     priority: 'Critical' }),
        makeTask({ id: 'tomorrow-high',          dueDate: TOMORROW,     priority: 'High' }),
        makeTask({ id: 'tomorrow-medium',        dueDate: TOMORROW,     priority: 'Medium' }),
        makeTask({ id: 'tomorrow-low',           dueDate: TOMORROW,     priority: 'Low' }),
        makeTask({ id: 'later-critical',         dueDate: '2026-05-20', priority: 'Critical' }),
        makeTask({ id: 'done-overdue',           dueDate: '2026-05-10', priority: 'High', status: 'Done' }),
        makeTask({ id: 'archived-today',         dueDate: TODAY,        priority: 'Critical', archivedAt: 1 }),
        makeTask({ id: 'no-due-date',            dueDate: '',           priority: 'Critical' }),
        makeTask({ id: 'pinned-later',           dueDate: '2026-05-25', priority: 'Low',  pinned: true }),
        makeTask({ id: 'pinned-no-date',         dueDate: '',           priority: 'Low',  pinned: true }),
        makeTask({ id: 'pinned-done',            dueDate: '2026-05-25', priority: 'Low',  pinned: true, status: 'Done' }),
        makeTask({ id: 'pinned-archived',        dueDate: '2026-05-25', priority: 'Low',  pinned: true, archivedAt: 1 }),
    ];

    // 'no-due-date' is treated as urgent because '' < todayStr is true.
    // Pre-existing bubble behavior — out of scope to change here; the test
    // pins it so the bubble count and the focus list stay identical.
    const expectedUrgentIds = [
        'overdue',
        'today-low',
        'today-critical',
        'tomorrow-critical',
        'tomorrow-high',
        'no-due-date',
        'pinned-later',
        'pinned-no-date',
    ];

    it('bubble count equals the size of the urgent list (count must match)', () => {
        const count = computeBubbleScore(fixture, TODAY, TOMORROW);
        const focusList = fixture.filter((t) => isUrgent(t, TODAY, TOMORROW));
        expect(focusList).toHaveLength(count);
    });

    it('urgent list matches the expected set of ids', () => {
        const focusList = fixture.filter((t) => isUrgent(t, TODAY, TOMORROW));
        expect(focusList.map((t) => t.id).sort()).toEqual([...expectedUrgentIds].sort());
    });

    it('Done and archived tasks are never urgent', () => {
        expect(isUrgent(fixture.find((t) => t.id === 'done-overdue')!, TODAY, TOMORROW)).toBe(false);
        expect(isUrgent(fixture.find((t) => t.id === 'archived-today')!, TODAY, TOMORROW)).toBe(false);
    });

    it('tomorrow + Medium/Low is not urgent; tomorrow + Critical/High is urgent', () => {
        expect(isUrgent(fixture.find((t) => t.id === 'tomorrow-medium')!, TODAY, TOMORROW)).toBe(false);
        expect(isUrgent(fixture.find((t) => t.id === 'tomorrow-low')!, TODAY, TOMORROW)).toBe(false);
        expect(isUrgent(fixture.find((t) => t.id === 'tomorrow-critical')!, TODAY, TOMORROW)).toBe(true);
        expect(isUrgent(fixture.find((t) => t.id === 'tomorrow-high')!, TODAY, TOMORROW)).toBe(true);
    });

    it('pinned tasks are urgent regardless of due date or priority', () => {
        expect(isUrgent(fixture.find((t) => t.id === 'pinned-later')!, TODAY, TOMORROW)).toBe(true);
        expect(isUrgent(fixture.find((t) => t.id === 'pinned-no-date')!, TODAY, TOMORROW)).toBe(true);
    });

    it('pinned + Done or pinned + archived is never urgent', () => {
        expect(isUrgent(fixture.find((t) => t.id === 'pinned-done')!, TODAY, TOMORROW)).toBe(false);
        expect(isUrgent(fixture.find((t) => t.id === 'pinned-archived')!, TODAY, TOMORROW)).toBe(false);
    });
});
