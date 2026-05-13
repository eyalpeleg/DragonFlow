import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { Task, SoundType } from '../types';
import { getCategoryName } from './categories';

function getNotificationSound(soundType: 'ding' | 'tada', preference: SoundType): string | undefined {
    if (preference === 'Disabled') return undefined;
    if (preference === 'AppSound') {
        return soundType === 'ding' ? 'ding.mp3' : 'tada.mp3';
    }
    if (preference === 'SystemSound') return 'default';
    return undefined;
}

const POMODORO_CHANNEL = 'pomodoro';
const REMINDERS_CHANNEL = 'task-reminders';

// Silently no-op in Expo Go (SDK 53+ removed push support; local notifs need a dev build)
let notificationsAvailable = false;

try {
    Notifications.setNotificationHandler({
        handleNotification: async (notification) => {
            const isPreviewSound = notification.request.content.data?.isPreviewSound === true;
            return {
                shouldPlaySound: true,
                shouldSetBadge: false,
                shouldShowBanner: !isPreviewSound,
                shouldShowList: !isPreviewSound,
            };
        },
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
        const { useTaskStore } = await import('../store/taskStore');
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

    const { useTaskStore } = await import('../store/taskStore');
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

export async function playPreviewSound(soundType: 'ding' | 'tada', preference: SoundType, volume: number = 1.0): Promise<void> {
    if (preference === 'Disabled') {
        Alert.alert('Sound Disabled', 'No sound will play for notifications.');
        return;
    }

    if (preference === 'SystemSound') {
        if (!notificationsAvailable) {
            Alert.alert('Unavailable', 'Notifications not available in this environment.');
            return;
        }
        try {
            // Schedule a notification that plays immediately with only sound (no banner)
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: '',
                    body: '',
                    sound: 'default',
                    data: { isPreviewSound: true },
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                    seconds: 0.1, // Fire in 100ms
                },
            });
        } catch (error) {
            console.error('System sound error:', error);
            Alert.alert('Playback Error', 'Could not play system sound.');
        }
        return;
    }

    if (preference === 'AppSound') {
        try {
            const soundFile = soundType === 'ding' ? require('../../assets/audio/ding.mp3') : require('../../assets/audio/tada.mp3');
            const player = createAudioPlayer(soundFile);
            player.volume = Math.max(0, Math.min(1, volume));
            player.play();
        } catch (error) {
            console.error('Audio playback error:', error);
            Alert.alert('Playback Error', 'Could not play preview sound. It will play with notifications.');
        }
    }
}
