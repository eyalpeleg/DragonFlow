import { PriorityLevel } from './styles/theme';

export type TaskStatus = 'Ready' | 'In Progress' | 'Paused' | 'Done';
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';
export type SoundType = 'AppSound' | 'Disabled';

export type StatusOrderConfig = Record<TaskStatus, number>;

export interface Category {
    id: string;
    name: string;
    color: string;
}

export interface SubTask {
    id: string;
    title: string;
    completed: boolean;
}

export interface RecurrenceConfig {
    frequency: RecurrenceFrequency;
    interval: number; // every N units
}

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: PriorityLevel;
    categoryId: string;
    dueDate: string; // YYYY-MM-DD
    dueTime: string; // HH:MM, default "08:00"
    status: TaskStatus;
    createdAt: number;
    startTime?: number;
    completedTime?: number;
    archivedAt?: number;
    // Feature: sub-tasks
    subTasks?: SubTask[];
    // Feature: recurring
    recurrence?: RecurrenceConfig;
    parentRecurringId?: string;
    // Feature: done stats comment
    completionComment?: string;
}
