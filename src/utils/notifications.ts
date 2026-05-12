import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task } from '../types';
import { getCategoryName } from './categories';
import { useTaskStore } from '../store/taskStore';

const POMODORO_CHANNEL = 'pomodoro';
const REMINDERS_CHANNEL = 'task-reminders';

// Silently no-op in Expo Go (SDK 53+ removed push support; local notifs need a dev build)
let notificationsAvailable = false;

try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
    notificationsAvailable = true;
} catch {
    // running in Expo Go — notifications disabled
}

export async function requestNotificationPermission(): Promise<boolean> {
    if (!notificationsAvailable) return false;
    try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        if (existing === 'granted') return true;
        const { status } = await Notifications.requestPermissionsAsync();
        return status === 'granted';
    } catch {
        return false;
    }
}

export async function setupNotificationChannels(): Promise<void> {
    if (!notificationsAvailable || Platform.OS !== 'android') return;
    try {
        await Notifications.setNotificationChannelAsync(POMODORO_CHANNEL, {
            name: 'Pomodoro Timer',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 500, 200, 500],
            lightColor: '#6200EE',
        });
        await Notifications.setNotificationChannelAsync(REMINDERS_CHANNEL, {
            name: 'Task Reminders',
            importance: Notifications.AndroidImportance.HIGH,
            sound: 'default',
            vibrationPattern: [0, 300, 200, 300],
            lightColor: '#6200EE',
        });
    } catch {
        // ignore — Expo Go
    }
}


export async function schedulePomodoroEnd(minutes: number): Promise<string> {
    if (!notificationsAvailable) return '';
    try {
        const labels: Record<number, string> = { 25: 'Focus session', 5: 'Short break', 15: 'Long break' };
        const label = labels[minutes] ?? `${minutes}min timer`;
        return await Notifications.scheduleNotificationAsync({
            content: {
                title: `⏱ ${label} complete!`,
                body: minutes === 25 ? 'Great work! Take a break.' : 'Break over — time to focus.',
                sound: 'default',
                data: { type: 'pomodoro' },
                ...(Platform.OS === 'android' && { channelId: POMODORO_CHANNEL }),
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
        });
    } catch {
        return '';
    }
}

export async function cancelPomodoroNotification(id: string): Promise<void> {
    if (!notificationsAvailable || !id) return;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

function dayBefore(date: string, hours: number, minutes = 0): number {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    d.setHours(hours, minutes, 0, 0);
    return d.getTime();
}

function sameDay(date: string, hours: number, minutes = 0): number {
    const d = new Date(date + 'T00:00:00');
    d.setHours(hours, minutes, 0, 0);
    return d.getTime();
}

export async function scheduleTaskReminders(task: Task): Promise<void> {
    if (!notificationsAvailable) return;
    if (!task.dueDate || task.status === 'Done') return;

    const time = task.dueTime ?? '08:00';
    const [dueHour, dueMin] = time.split(':').map(Number);
    const dueMs = new Date(`${task.dueDate}T${time}:00`).getTime();
    if (isNaN(dueMs)) return;

    const reminders: { id: string; fireMs: number; label: string }[] = [
        ...(dueHour < 12
            ? [
                { id: `${task.id}-ra`, fireMs: dayBefore(task.dueDate, 8),  label: '⏰ Due Tomorrow' },
                { id: `${task.id}-rb`, fireMs: dayBefore(task.dueDate, 12), label: '⏰ Due Tomorrow' },
                { id: `${task.id}-rc`, fireMs: dayBefore(task.dueDate, 18), label: '⏰ Due Tomorrow' },
            ]
            : [
                { id: `${task.id}-ra`, fireMs: dayBefore(task.dueDate, 8),  label: '⏰ Due Tomorrow' },
                { id: `${task.id}-rb`, fireMs: dayBefore(task.dueDate, 18), label: '⏰ Due Tomorrow' },
                { id: `${task.id}-rc`, fireMs: sameDay(task.dueDate, 8),    label: '⏰ Due Today' },
                { id: `${task.id}-rd`, fireMs: sameDay(task.dueDate, 12),   label: '⏰ Due Today' },
                { id: `${task.id}-re`, fireMs: dueMs - 3600 * 1000,         label: '⏰ Due in 1 hour' },
            ]),
        { id: `${task.id}-r5m`, fireMs: dueMs - 5 * 60 * 1000, label: '🔔 Due in 5 minutes' },
    ];

    const now = Date.now();
    for (const r of reminders) {
        await Notifications.cancelScheduledNotificationAsync(r.id).catch(() => {});
        if (r.fireMs <= now) continue;
        try {
            await Notifications.scheduleNotificationAsync({
                identifier: r.id,
                content: {
                    title: `${r.label}: ${task.title}`,
                    body: `Due at ${time} · ${task.priority} · ${getCategoryName(useTaskStore.getState().categories, task.categoryId)}`,
                    sound: 'default',
                    data: { type: 'reminder', taskId: task.id },
                    ...(Platform.OS === 'android' && { channelId: REMINDERS_CHANNEL }),
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: new Date(r.fireMs),
                },
            });
        } catch {
            // ignore
        }
    }
}

export async function cancelTaskReminders(taskId: string): Promise<void> {
    if (!notificationsAvailable) return;
    for (const suffix of ['-ra', '-rb', '-rc', '-rd', '-re', '-r5m']) {
        await Notifications.cancelScheduledNotificationAsync(taskId + suffix).catch(() => {});
    }
}
