import { Task } from '../types';

export const getDailySummary = (tasks: Task[]) => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === 'Done').length;
    const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, inProgress, completionRate };
};

export const getWeeklyCategoryStats = (tasks: Task[]) => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return tasks
        .filter((t) => t.status === 'Done' && t.completedTime && t.completedTime >= weekAgo)
        .reduce((acc, task) => {
            acc[task.category] = (acc[task.category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
};

export const getTasksCompletedToday = (tasks: Task[]): Task[] => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return tasks.filter(
        (t) => t.status === 'Done' && t.completedTime && t.completedTime >= startOfDay.getTime()
    );
};

export const getWeeklyTimeSpent = (tasks: Task[]): Record<string, number> => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return tasks
        .filter((t) => t.status === 'Done' && t.completedTime && t.completedTime >= weekAgo && t.startTime)
        .reduce((acc, t) => {
            const ms = (t.completedTime ?? 0) - (t.startTime ?? 0);
            acc[t.category] = (acc[t.category] || 0) + ms;
            return acc;
        }, {} as Record<string, number>);
};

export const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return '<1m';
    if (minutes < 60) return `${minutes}m`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
