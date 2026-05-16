import { buildNextOccurrence, computeNextDueDate } from '../recurrence';
import type { Task } from '../../types';

function makeRecurringTaskWithSubs(): Task {
    return {
        id: 'parent-1',
        title: 'Weekly review',
        description: '',
        priority: 'Medium',
        categoryId: 'default',
        dueDate: '2026-05-15',
        dueTime: '08:00',
        status: 'Done',
        createdAt: Date.now(),
        recurrence: { frequency: 'weekly', interval: 1 },
        subTasks: [
            { id: 's1', title: 'Sub one', completed: true },
            { id: 's2', title: 'Sub two', completed: true },
            { id: 's3', title: 'Sub three', completed: false },
        ],
    };
}

function recurringTask(
    dueDate: string,
    frequency: 'daily' | 'weekly' | 'monthly',
    interval: number,
): Task {
    return {
        id: 't1',
        title: 't',
        description: '',
        priority: 'Medium',
        categoryId: 'default',
        dueDate,
        dueTime: '08:00',
        status: 'Done',
        createdAt: 0,
        subTasks: [],
        recurrence: { frequency, interval },
    };
}

describe('buildNextOccurrence', () => {
    it('resets all subtasks to completed=false on the next occurrence', () => {
        const next = buildNextOccurrence(makeRecurringTaskWithSubs());

        expect(next.subTasks).toHaveLength(3);
        expect(next.subTasks!.every((s) => s.completed === false)).toBe(true);
        // Titles preserved
        expect(next.subTasks!.map((s) => s.title)).toEqual(['Sub one', 'Sub two', 'Sub three']);
    });
});

describe('computeNextDueDate', () => {
    describe('daily', () => {
        it('interval=1 advances one day', () => {
            expect(computeNextDueDate(recurringTask('2026-05-15', 'daily', 1))).toBe('2026-05-16');
        });
        it('interval=3 advances three days', () => {
            expect(computeNextDueDate(recurringTask('2026-05-15', 'daily', 3))).toBe('2026-05-18');
        });
        it('rolls over month boundary (May 31 → Jun 1)', () => {
            expect(computeNextDueDate(recurringTask('2026-05-31', 'daily', 1))).toBe('2026-06-01');
        });
        it('rolls over year boundary (Dec 31 → Jan 1)', () => {
            expect(computeNextDueDate(recurringTask('2026-12-31', 'daily', 1))).toBe('2027-01-01');
        });
    });

    describe('weekly', () => {
        it('interval=1 advances 7 days', () => {
            expect(computeNextDueDate(recurringTask('2026-05-15', 'weekly', 1))).toBe('2026-05-22');
        });
        it('interval=2 advances 14 days', () => {
            expect(computeNextDueDate(recurringTask('2026-05-15', 'weekly', 2))).toBe('2026-05-29');
        });
        it('rolls over month boundary', () => {
            expect(computeNextDueDate(recurringTask('2026-05-29', 'weekly', 1))).toBe('2026-06-05');
        });
    });

    describe('monthly', () => {
        it('interval=1 advances one month', () => {
            expect(computeNextDueDate(recurringTask('2026-05-15', 'monthly', 1))).toBe('2026-06-15');
        });
        it('interval=3 advances three months', () => {
            expect(computeNextDueDate(recurringTask('2026-05-15', 'monthly', 3))).toBe('2026-08-15');
        });
        it('rolls over year boundary', () => {
            expect(computeNextDueDate(recurringTask('2026-12-15', 'monthly', 1))).toBe('2027-01-15');
        });
        it('clamps Jan 31 to Feb 28 in non-leap year (2027)', () => {
            expect(computeNextDueDate(recurringTask('2027-01-31', 'monthly', 1))).toBe('2027-02-28');
        });
        it('clamps Jan 31 to Feb 29 in leap year (2028)', () => {
            expect(computeNextDueDate(recurringTask('2028-01-31', 'monthly', 1))).toBe('2028-02-29');
        });
        it('clamps May 31 to June 30 (30-day month)', () => {
            expect(computeNextDueDate(recurringTask('2026-05-31', 'monthly', 1))).toBe('2026-06-30');
        });
        it('does NOT clamp when target month has the same day (Jan 15 → Feb 15)', () => {
            expect(computeNextDueDate(recurringTask('2026-01-15', 'monthly', 1))).toBe('2026-02-15');
        });
    });

    it('returns the task.dueDate unchanged when no recurrence is set', () => {
        const t = recurringTask('2026-05-15', 'daily', 1);
        delete t.recurrence;
        expect(computeNextDueDate(t)).toBe('2026-05-15');
    });
});
