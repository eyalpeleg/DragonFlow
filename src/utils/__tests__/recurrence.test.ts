import { buildNextOccurrence } from '../recurrence';
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

describe('buildNextOccurrence', () => {
    it('resets all subtasks to completed=false on the next occurrence', () => {
        const next = buildNextOccurrence(makeRecurringTaskWithSubs());

        expect(next.subTasks).toHaveLength(3);
        expect(next.subTasks!.every((s) => s.completed === false)).toBe(true);
        // Titles preserved
        expect(next.subTasks!.map((s) => s.title)).toEqual(['Sub one', 'Sub two', 'Sub three']);
    });
});
