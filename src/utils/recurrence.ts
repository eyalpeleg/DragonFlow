import { Task } from '../types';
import { makeId } from './id';

function addDays(date: Date, n: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function addMonths(date: Date, n: number): Date {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + n);
    // Clamp to last day of month if needed
    if (d.getDate() !== day) d.setDate(0);
    return d;
}

function toYMD(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

export function computeNextDueDate(task: Task): string {
    if (!task.recurrence) return task.dueDate;
    const { frequency, interval } = task.recurrence;
    const base = task.dueDate ? new Date(task.dueDate + 'T00:00:00') : new Date();
    switch (frequency) {
        case 'daily':   return toYMD(addDays(base, interval));
        case 'weekly':  return toYMD(addDays(base, 7 * interval));
        case 'monthly': return toYMD(addMonths(base, interval));
    }
}

export function buildNextOccurrence(completed: Task): Task {
    const id = makeId();
    return {
        ...completed,
        id,
        status: 'Ready',
        createdAt: Date.now(),
        startTime: undefined,
        completedTime: undefined,
        completionComment: undefined,
        dueDate: computeNextDueDate(completed),
        parentRecurringId: completed.parentRecurringId ?? completed.id,
        subTasks: (completed.subTasks ?? []).map((s) => ({ ...s, completed: false })),
    };
}

