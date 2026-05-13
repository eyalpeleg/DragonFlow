import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { Task, SoundType } from '../types';
import { getCategoryName } from './categories';
import { useTaskStore } from '../store/taskStore';

function getNotificationSound(soundType: 'ding' | 'tada', preference: SoundType): string | undefined {
    if (preference === 'Disabled') return undefined;
    if (preference === 'AppSound') {
        return soundType === 'ding' ? 'ding.mp3' : 'tada.mp3';
    }
    if (preference === 'SystemSound') return 'default';
    if (preference === 'Custom') {
        // TODO: Return custom sound path when available
        return 'default';
    }
    return undefined;
}

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
        const soundType = useTaskStore.getState().pomodoroSoundType;
        const labels: Record<number, string> = { 25: 'Focus session', 5: 'Short break', 15: 'Long break' };
        const label = labels[minutes] ?? `${minutes}min timer`;
        return await Notifications.scheduleNotificationAsync({
            content: {
                title: `⏱ ${label} complete!`,
                body: minutes === 25 ? 'Great work! Take a break.' : 'Break over — time to focus.',
                sound: getNotificationSound('tada', soundType) ?? 'default',
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

    const soundType = useTaskStore.getState().tasksSoundType;

    const reminders: { id: string; fireMs: number; label: string; isLastWarning?: boolean }[] = [
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
                { id: `${task.id}-re`, fireMs: dueMs - 3600 * 1000,         label: '⏰ Due in 1 hour', isLastWarning: true },
            ]),
        { id: `${task.id}-r5m`, fireMs: dueMs - 5 * 60 * 1000, label: '🔔 Due in 5 minutes', isLastWarning: true },
        { id: `${task.id}-rdt`, fireMs: dueMs, label: '🔔 Due now', isLastWarning: true },
    ];

    const now = Date.now();
    for (const r of reminders) {
        await Notifications.cancelScheduledNotificationAsync(r.id).catch(() => {});
        if (r.fireMs <= now) continue;
        const sound = r.isLastWarning ? (getNotificationSound('ding', soundType) ?? 'default') : 'default';
        try {
            await Notifications.scheduleNotificationAsync({
                identifier: r.id,
                content: {
                    title: `${r.label}: ${task.title}`,
                    body: `Due at ${time} · ${task.priority} · ${getCategoryName(useTaskStore.getState().categories, task.categoryId)}`,
                    sound,
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
    for (const suffix of ['-ra', '-rb', '-rc', '-rd', '-re', '-r5m', '-rdt']) {
        await Notifications.cancelScheduledNotificationAsync(taskId + suffix).catch(() => {});
    }
}

export async function playPreviewSound(soundType: 'ding' | 'tada', preference: SoundType): Promise<void> {
    if (preference === 'Disabled') {
        Alert.alert('Sound Disabled', 'No sound will play for notifications.');
        return;
    }

    const soundName = soundType === 'ding' ? 'Ding' : 'Ta-da';
    const typeLabel = preference === 'AppSound' ? 'App Sound' : preference === 'SystemSound' ? 'System Sound' : 'Custom Sound';
    Alert.alert('Sound Preview', `${soundName} (${typeLabel}) will play with notifications.`);
}
