import { PriorityLevel } from './styles/theme';

export type TaskStatus = 'Ready' | 'In Progress' | 'Done';
export type CategoryType = string;

export interface Category {
    name: string;
    color: string;
    builtIn: boolean;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    priority: PriorityLevel;
    category: CategoryType;
    dueDate: string; // YYYY-MM-DD
    dueTime: string; // HH:MM, default "08:00"
    status: TaskStatus;
    createdAt: number;
    startTime?: number;
    completedTime?: number;
    archivedAt?: number;
}
