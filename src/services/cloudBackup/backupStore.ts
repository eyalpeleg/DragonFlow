import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { BackupStatus } from './types';

interface BackupState {
    isSignedIn: boolean;
    userEmail: string | null;
    userName: string | null;
    lastBackupTime: string | null;
    lastBackupFileId: string | null;
    autoBackupEnabled: boolean;
    backupStatus: BackupStatus;
    lastError: string | null;
    consecutiveFailures: number;

    setSignedIn: (email: string, name?: string) => void;
    setSignedOut: () => void;
    setLastBackup: (time: string, fileId: string) => void;
    setAutoBackup: (enabled: boolean) => void;
    setStatus: (status: BackupStatus, error?: string) => void;
    incrementFailure: () => void;
    resetFailures: () => void;
}

export const useBackupStore = create<BackupState>()(
    persist(
        (set) => ({
            isSignedIn: false,
            userEmail: null,
            userName: null,
            lastBackupTime: null,
            lastBackupFileId: null,
            autoBackupEnabled: true,
            backupStatus: 'idle' as BackupStatus,
            lastError: null,
            consecutiveFailures: 0,

            setSignedIn: (email, name) => set({
                isSignedIn: true,
                userEmail: email,
                userName: name ?? null,
                lastError: null,
                consecutiveFailures: 0,
            }),

            setSignedOut: () => set({
                isSignedIn: false,
                userEmail: null,
                userName: null,
                lastBackupTime: null,
                lastBackupFileId: null,
                backupStatus: 'idle',
                lastError: null,
                consecutiveFailures: 0,
            }),

            setLastBackup: (time, fileId) => set({
                lastBackupTime: time,
                lastBackupFileId: fileId,
            }),

            setAutoBackup: (enabled) => set({ autoBackupEnabled: enabled }),

            setStatus: (status, error) => set({
                backupStatus: status,
                lastError: error ?? null,
            }),

            incrementFailure: () => set((s) => ({
                consecutiveFailures: s.consecutiveFailures + 1,
            })),

            resetFailures: () => set({ consecutiveFailures: 0 }),
        }),
        {
            name: 'dragonflow-backup-state',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                isSignedIn: state.isSignedIn,
                userEmail: state.userEmail,
                userName: state.userName,
                lastBackupTime: state.lastBackupTime,
                lastBackupFileId: state.lastBackupFileId,
                autoBackupEnabled: state.autoBackupEnabled,
            }),
        },
    ),
);
