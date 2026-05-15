import { AppState, AppStateStatus } from 'react-native';
import { useTaskStore } from '../../store/appStore';
import { useBackupStore } from './backupStore';
import * as googleAuth from './googleAuth';
import * as googleDrive from './googleDrive';
import { AuthError, BackupBucket, BackupMetadata } from './types';

const DEBOUNCE_MS = 5 * 60 * 1000;
const MAX_CONSECUTIVE_FAILURES = 3;
const RETENTION: Record<BackupBucket, number> = { ongoing: 20, daily: 7, weekly: 4 };

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hasPendingChanges = false;

function localDateKey(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function startOfWeekKey(d: Date, firstDayOfWeek: 'sunday' | 'monday'): string {
    const firstDay = firstDayOfWeek === 'sunday' ? 0 : 1;
    const day = d.getDay();
    const daysBack = (day - firstDay + 7) % 7;
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack);
    return localDateKey(start);
}

function newestInBucket(backups: BackupMetadata[], bucket: BackupBucket): BackupMetadata | undefined {
    return backups
        .filter((b) => b.bucket === bucket)
        .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())[0];
}

export async function initializeBackup(): Promise<void> {
    const tokens = await googleAuth.loadStoredAuth();
    if (!tokens) {
        useBackupStore.getState().setSignedOut();
        return;
    }

    try {
        await googleAuth.getValidToken();
    } catch {
        useBackupStore.getState().setSignedOut();
    }
}

export async function performBackup(): Promise<void> {
    const backupState = useBackupStore.getState();
    if (!backupState.isSignedIn) return;
    if (backupState.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return;

    backupState.setStatus('backing-up');

    try {
        const token = await googleAuth.getValidToken();
        const payload = useTaskStore.getState().exportData();

        const existing = await googleDrive.listBackupFiles(token);

        const ongoing = await googleDrive.uploadBackup(token, payload, 'ongoing');
        const uploaded: BackupMetadata[] = [ongoing];

        const now = new Date();
        const firstDayOfWeek = useTaskStore.getState().firstDayOfWeek;

        const newestDaily = newestInBucket(existing, 'daily');
        const todayKey = localDateKey(now);
        if (!newestDaily || localDateKey(new Date(newestDaily.modifiedTime)) !== todayKey) {
            uploaded.push(await googleDrive.uploadBackup(token, payload, 'daily'));
        }

        const newestWeekly = newestInBucket(existing, 'weekly');
        const thisWeekKey = startOfWeekKey(now, firstDayOfWeek);
        if (!newestWeekly || startOfWeekKey(new Date(newestWeekly.modifiedTime), firstDayOfWeek) !== thisWeekKey) {
            uploaded.push(await googleDrive.uploadBackup(token, payload, 'weekly'));
        }

        await googleDrive.cleanupOldBackups(token, [...existing, ...uploaded], RETENTION);

        backupState.setLastBackup(new Date().toISOString(), ongoing.fileId);
        backupState.setStatus('idle');
        backupState.resetFailures();
        hasPendingChanges = false;
    } catch (e: any) {
        if (e instanceof AuthError) {
            backupState.setSignedOut();
        } else {
            backupState.incrementFailure();
            backupState.setStatus('error', e.message);
        }
    }
}

export async function listAvailableBackups(): Promise<BackupMetadata[]> {
    const token = await googleAuth.getValidToken();
    const backups = await googleDrive.listBackupFiles(token);

    // Enrich with task counts by downloading metadata from each
    // For performance, we only parse the task count from the first few
    const enriched = await Promise.all(
        backups.map(async (backup) => {
            try {
                const data = await googleDrive.downloadBackup(token, backup.fileId);
                return { ...backup, taskCount: data.tasks?.length ?? 0 };
            } catch {
                return { ...backup, taskCount: undefined };
            }
        }),
    );

    return enriched;
}

export async function performRestore(fileId: string): Promise<{ tasksImported: number }> {
    const backupState = useBackupStore.getState();
    backupState.setStatus('restoring');

    try {
        const token = await googleAuth.getValidToken();
        const data = await googleDrive.downloadBackup(token, fileId);
        const result = useTaskStore.getState().importData(data);

        backupState.setStatus('idle');
        return result;
    } catch (e: any) {
        backupState.setStatus('error', e.message);
        if (e instanceof AuthError) {
            backupState.setSignedOut();
        }
        throw e;
    }
}

export function setupAutoBackup(): () => void {
    const unsubscribe = useTaskStore.subscribe(() => {
        const { isSignedIn, autoBackupEnabled, consecutiveFailures } = useBackupStore.getState();
        if (!isSignedIn || !autoBackupEnabled) return;
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) return;

        hasPendingChanges = true;

        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            performBackup().catch(() => {});
        }, DEBOUNCE_MS);
    });

    return () => {
        unsubscribe();
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
        }
    };
}

export function onAppBackground(): void {
    if (!hasPendingChanges) return;
    const { isSignedIn, autoBackupEnabled } = useBackupStore.getState();
    if (!isSignedIn || !autoBackupEnabled) return;

    if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
    }

    performBackup().catch(() => {});
}

export function setupAppStateListener(): () => void {
    const handler = (nextState: AppStateStatus) => {
        if (nextState === 'background') {
            onAppBackground();
        }
    };

    const subscription = AppState.addEventListener('change', handler);
    return () => subscription.remove();
}
