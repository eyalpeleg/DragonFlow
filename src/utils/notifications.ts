import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Task, SoundType } from '../types';
import { getCategoryName } from './categories';
import FloatingBubble from '../modules/FloatingBubble';
import { audioService } from '../services/audioService';
import { COLORS } from '../styles/theme';

const POMODORO_CHANNEL = 'pomodoro-3';
const REMINDERS_CHANNEL = 'reminders-3';
const PANGO_CHANNEL = 'pango-3';

const PANGO_CATEGORY = 'pango-reminder';

// Silently no-op in Expo Go (SDK 53+ removed push support; local notifs need a dev build)
let notificationsAvailable = false;

try {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldPlaySound: false,
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

const CHANNEL_DEFS = [
    { id: POMODORO_CHANNEL,  name: 'Pomodoro Timer',  vibe: [0, 500, 200, 500] },
    { id: REMINDERS_CHANNEL, name: 'Task Reminders',  vibe: [0, 300, 200, 300] },
    { id: PANGO_CHANNEL,     name: 'Parking Reminder', vibe: [0, 300, 200, 300] },
];

export async function setupNotificationChannels(): Promise<void> {
    if (!notificationsAvailable || Platform.OS !== 'android') return;
    try {
        await Promise.all(
            CHANNEL_DEFS.map((ch) =>
                Notifications.setNotificationChannelAsync(ch.id, {
                    name: ch.name,
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: ch.vibe as unknown as number[],
                    lightColor: COLORS.notification,
                }),
            ),
        );
    } catch {
        // ignore — Expo Go
    }
}


export async function schedulePomodoroEnd(minutes: number): Promise<string> {
    if (!notificationsAvailable) return '';
    try {
        const labels: Record<number, string> = { 25: 'Focus session', 5: 'Short break', 15: 'Long break' };
        const label = labels[minutes] ?? `${minutes}min timer`;
        const notifId = await Notifications.scheduleNotificationAsync({
            content: {
                title: `⏱ ${label} complete!`,
                body: minutes === 25 ? 'Great work! Take a break.' : 'Break over — time to focus.',
                sound: undefined,
                data: { type: 'pomodoro' },
                ...(Platform.OS === 'android' && { channelId: POMODORO_CHANNEL }),
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: minutes * 60 },
        });
        return notifId;
    } catch {
        return '';
    }
}

export async function cancelPomodoroNotification(id: string): Promise<void> {
    if (!notificationsAvailable || !id) return;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}

// --- Pango parking reminder (AC4/AC5/AC19) ---------------------------------
// Registers the notification action buttons once (idempotent). Called at boot
// beside setupNotificationChannels.
export async function setupPangoNotificationCategory(): Promise<void> {
    if (!notificationsAvailable) return;
    try {
        await Notifications.setNotificationCategoryAsync(PANGO_CATEGORY, [
            { identifier: 'extend-15', buttonTitle: '+15 min' },
            { identifier: 'open-pango', buttonTitle: 'Open Pango' },
        ]);
    } catch {
        // ignore — Expo Go
    }
}

// Schedules the "stop parking" reminder at an absolute time (DATE trigger, so it
// survives drift/process death). Uses sessionId as the notification identifier
// so extend can reschedule under the same id.
export async function scheduleParkingReminder(remindAt: number, sessionId: string): Promise<string> {
    if (!notificationsAvailable) return '';
    try {
        await Notifications.scheduleNotificationAsync({
            identifier: sessionId,
            content: {
                title: '🅿️ Stop your Pango parking',
                body: 'Your parking time is up — tap to open Pango and stop the session.',
                sound: undefined,
                data: { type: 'pango', sessionId },
                categoryIdentifier: PANGO_CATEGORY,
                ...(Platform.OS === 'android' && { channelId: PANGO_CHANNEL }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: new Date(remindAt),
            },
        });
        return sessionId;
    } catch {
        return '';
    }
}

export async function cancelParkingReminder(notifId: string): Promise<void> {
    if (!notificationsAvailable || !notifId) return;
    await Notifications.cancelScheduledNotificationAsync(notifId).catch(() => {});
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
    const [dueHour] = time.split(':').map(Number);
    const dueMs = new Date(`${task.dueDate}T${time}:00`).getTime();
    if (isNaN(dueMs)) return;

    const { useTaskStore } = await import('../store/appStore');
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

    const volume = useTaskStore.getState().tasksVolume;
    const now = Date.now();
    await Promise.all(
        reminders.map(async (r) => {
            await Notifications.cancelScheduledNotificationAsync(r.id).catch(() => {});
            FloatingBubble.cancelSound(r.id);
            if (r.fireMs <= now) return;
            try {
                await Notifications.scheduleNotificationAsync({
                    identifier: r.id,
                    content: {
                        title: `${r.label}: ${task.title}`,
                        body: `Due at ${time} · ${task.priority} · ${getCategoryName(useTaskStore.getState().categories, task.categoryId)}`,
                        sound: undefined,
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
            if (r.isLastWarning && soundType !== 'Disabled') {
                FloatingBubble.scheduleSound(r.id, r.fireMs, soundType, 'ding', volume);
            }
        }),
    );
}

export async function cancelTaskReminders(taskId: string): Promise<void> {
    if (!notificationsAvailable) return;
    const suffixes = ['-ra', '-rb', '-rc', '-rd', '-re', '-r5m', '-rdt'];
    await Promise.all(
        suffixes.map(async (suffix) => {
            await Notifications.cancelScheduledNotificationAsync(taskId + suffix).catch(() => {});
            FloatingBubble.cancelSound(taskId + suffix);
        }),
    );
}

export async function playAppSound(soundFile: 'ding' | 'bell', volume: number = 1.0): Promise<void> {
    await audioService.play(soundFile, volume);
}

export async function playPreviewSound(soundType: 'ding' | 'bell', preference: SoundType, volume: number = 1.0): Promise<void> {
    if (preference === 'Disabled') return;
    if (preference === 'AppSound') {
        await playAppSound(soundType, volume);
    }
}
