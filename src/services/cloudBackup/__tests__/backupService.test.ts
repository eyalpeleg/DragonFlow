/* eslint-disable import/first */
jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: {
        getItem: jest.fn().mockResolvedValue(null),
        setItem: jest.fn().mockResolvedValue(undefined),
        removeItem: jest.fn().mockResolvedValue(undefined),
    },
}));

// The cloud backup service imports useTaskStore for exportData + firstDayOfWeek.
// Mock it so we don't have to bring up the entire task store and its dependencies.
jest.mock('../../../store/appStore', () => ({
    useTaskStore: {
        getState: jest.fn(),
    },
}));

jest.mock('../googleAuth', () => ({
    loadStoredAuth: jest.fn(),
    getValidToken: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
}));

jest.mock('../googleDrive', () => ({
    listBackupFiles: jest.fn(),
    uploadBackup: jest.fn(),
    downloadBackup: jest.fn(),
    cleanupOldBackups: jest.fn(),
}));

import { performBackup } from '../backupService';
import { useBackupStore } from '../backupStore';
import { useTaskStore } from '../../../store/appStore';
import * as googleAuth from '../googleAuth';
import * as googleDrive from '../googleDrive';
import { AuthError, BackupBucket, BackupMetadata } from '../types';

const mockGetValidToken = googleAuth.getValidToken as jest.Mock;
const mockList = googleDrive.listBackupFiles as jest.Mock;
const mockUpload = googleDrive.uploadBackup as jest.Mock;
const mockCleanup = googleDrive.cleanupOldBackups as jest.Mock;
const mockTaskStoreGetState = useTaskStore.getState as jest.Mock;

const FIXED_NOW = new Date(2026, 4, 16, 12, 0, 0); // Sat May 16, 2026 12:00 local

function dailyEntry(at: Date): BackupMetadata {
    return {
        fileId: `d-${at.toISOString()}`,
        name: `dragonflow-backup-daily-${at.toISOString()}.json`,
        modifiedTime: at.toISOString(),
        size: 1,
        bucket: 'daily',
    };
}

function weeklyEntry(at: Date): BackupMetadata {
    return {
        fileId: `w-${at.toISOString()}`,
        name: `dragonflow-backup-weekly-${at.toISOString()}.json`,
        modifiedTime: at.toISOString(),
        size: 1,
        bucket: 'weekly',
    };
}

function uploadedBucketsFromMock(): BackupBucket[] {
    return mockUpload.mock.calls.map((args) => args[2] as BackupBucket);
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(FIXED_NOW);

    useBackupStore.setState({
        isSignedIn: true,
        userEmail: 'me@example.com',
        userName: null,
        lastBackupTime: null,
        lastBackupFileId: null,
        autoBackupEnabled: true,
        backupStatus: 'idle',
        lastError: null,
        consecutiveFailures: 0,
    });

    mockTaskStoreGetState.mockReturnValue({
        firstDayOfWeek: 'sunday',
        exportData: () => ({ version: 1, tasks: [], categories: [] }),
    });

    mockGetValidToken.mockResolvedValue('token-123');
    mockList.mockResolvedValue([]);
    mockUpload.mockImplementation(
        async (_token: string, _payload: object, bucket: BackupBucket): Promise<BackupMetadata> => ({
            fileId: `${bucket}-new-id`,
            name: `dragonflow-backup-${bucket}-${new Date().toISOString()}.json`,
            modifiedTime: new Date().toISOString(),
            size: 1,
            bucket,
        }),
    );
    mockCleanup.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.useRealTimers();
});

describe('performBackup — guards', () => {
    it('does nothing when the user is signed out', async () => {
        useBackupStore.setState({ isSignedIn: false });
        await performBackup();
        expect(mockGetValidToken).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it('does nothing once consecutiveFailures reaches the cap (3)', async () => {
        useBackupStore.setState({ consecutiveFailures: 3 });
        await performBackup();
        expect(mockGetValidToken).not.toHaveBeenCalled();
        expect(mockUpload).not.toHaveBeenCalled();
    });

    it('still runs when consecutiveFailures is below the cap', async () => {
        useBackupStore.setState({ consecutiveFailures: 2 });
        await performBackup();
        expect(mockUpload).toHaveBeenCalled();
    });
});

describe('performBackup — bucket scheduling', () => {
    it('on a clean account: uploads ongoing + daily + weekly', async () => {
        await performBackup();
        expect(uploadedBucketsFromMock()).toEqual(['ongoing', 'daily', 'weekly']);
    });

    it('skips daily when a daily already exists for today (local date)', async () => {
        mockList.mockResolvedValue([
            dailyEntry(new Date(2026, 4, 16, 9, 0, 0)), // same local day
        ]);
        await performBackup();
        const buckets = uploadedBucketsFromMock();
        expect(buckets).toContain('ongoing');
        expect(buckets).toContain('weekly');
        expect(buckets).not.toContain('daily');
    });

    it('uploads a fresh daily when the most-recent daily is from yesterday', async () => {
        mockList.mockResolvedValue([
            dailyEntry(new Date(2026, 4, 15, 9, 0, 0)),
        ]);
        await performBackup();
        expect(uploadedBucketsFromMock()).toContain('daily');
    });

    it('compares against the newest daily (not arbitrary ordering)', async () => {
        mockList.mockResolvedValue([
            dailyEntry(new Date(2026, 4, 10, 9, 0, 0)),   // older
            dailyEntry(new Date(2026, 4, 16, 11, 0, 0)),  // today → newest
            dailyEntry(new Date(2026, 4, 13, 9, 0, 0)),   // older
        ]);
        await performBackup();
        expect(uploadedBucketsFromMock()).not.toContain('daily');
    });

    it('skips weekly when one already exists in this week (sunday start)', async () => {
        // May 16 2026 = Saturday → Sunday-start week began Sun May 10.
        mockList.mockResolvedValue([
            weeklyEntry(new Date(2026, 4, 12, 9, 0, 0)), // Tue, same week
        ]);
        await performBackup();
        expect(uploadedBucketsFromMock()).not.toContain('weekly');
    });

    it('uploads weekly when the newest weekly is from a previous week (sunday start)', async () => {
        mockList.mockResolvedValue([
            weeklyEntry(new Date(2026, 4, 5, 9, 0, 0)), // 11 days ago
        ]);
        await performBackup();
        expect(uploadedBucketsFromMock()).toContain('weekly');
    });

    it('honors firstDayOfWeek="monday" for the weekly bucket boundary', async () => {
        mockTaskStoreGetState.mockReturnValue({
            firstDayOfWeek: 'monday',
            exportData: () => ({ version: 1, tasks: [], categories: [] }),
        });

        // With monday-start, the week containing May 16 (Sat) begins Mon May 11.
        // Sunday May 10 is therefore the *previous* week.
        mockList.mockResolvedValue([
            weeklyEntry(new Date(2026, 4, 10, 9, 0, 0)),
        ]);
        await performBackup();
        expect(uploadedBucketsFromMock()).toContain('weekly');
    });
});

describe('performBackup — cleanup', () => {
    it('passes the RETENTION map and existing+uploaded list to cleanupOldBackups', async () => {
        const existing: BackupMetadata[] = [
            {
                fileId: 'old',
                name: 'dragonflow-backup-ongoing-old.json',
                modifiedTime: new Date(2026, 4, 14).toISOString(),
                size: 1,
                bucket: 'ongoing',
            },
        ];
        mockList.mockResolvedValue(existing);

        await performBackup();

        expect(mockCleanup).toHaveBeenCalledTimes(1);
        const [token, list, retention] = mockCleanup.mock.calls[0];
        expect(token).toBe('token-123');
        expect(retention).toEqual({ ongoing: 20, daily: 7, weekly: 4 });
        // existing(1) + ongoing + daily + weekly = 4
        expect(list).toHaveLength(4);
    });
});

describe('performBackup — success bookkeeping', () => {
    it('records lastBackup, resets failures, and lands on idle', async () => {
        useBackupStore.setState({ consecutiveFailures: 2 });
        await performBackup();
        const s = useBackupStore.getState();
        expect(s.lastBackupTime).toBeTruthy();
        expect(s.lastBackupFileId).toBe('ongoing-new-id');
        expect(s.consecutiveFailures).toBe(0);
        expect(s.backupStatus).toBe('idle');
        expect(s.lastError).toBeNull();
    });
});

describe('performBackup — failure handling', () => {
    it('on AuthError: signs the user out and does NOT increment failures', async () => {
        useBackupStore.setState({ consecutiveFailures: 1 });
        mockList.mockRejectedValue(new AuthError('expired'));
        await performBackup();
        const s = useBackupStore.getState();
        expect(s.isSignedIn).toBe(false);
        // setSignedOut wipes consecutiveFailures back to 0.
        expect(s.consecutiveFailures).toBe(0);
    });

    it('on generic error: increments consecutiveFailures and records the message', async () => {
        mockList.mockRejectedValue(new Error('boom'));
        await performBackup();
        const s = useBackupStore.getState();
        expect(s.isSignedIn).toBe(true);
        expect(s.consecutiveFailures).toBe(1);
        expect(s.backupStatus).toBe('error');
        expect(s.lastError).toBe('boom');
    });

    it('on upload failure: still increments failures (regression guard for uncaught uploads)', async () => {
        mockUpload.mockRejectedValueOnce(new Error('drive down'));
        await performBackup();
        const s = useBackupStore.getState();
        expect(s.consecutiveFailures).toBe(1);
        expect(s.backupStatus).toBe('error');
        expect(s.lastError).toBe('drive down');
    });
});
