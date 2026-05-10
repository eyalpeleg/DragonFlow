import { AppState, AppStateStatus } from 'react-native';
import { useTaskStore } from '../../store/taskStore';
import { useBackupStore } from './backupStore';
import * as googleAuth from './googleAuth';
import * as googleDrive from './googleDrive';
import { AuthError, BackupMetadata } from './types';

const DEBOUNCE_MS = 30_000;
const MAX_CONSECUTIVE_FAILURES = 3;
const MAX_BACKUPS = 5;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let hasPendingChanges = false;

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

        const uploaded = await googleDrive.uploadBackup(token, payload);

        // Cleanup old backups
        const allBackups = await googleDrive.listBackupFiles(token);
        await googleDrive.cleanupOldBackups(token, allBackups, MAX_BACKUPS);

        backupState.setLastBackup(new Date().toISOString(), uploaded.fileId);
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
