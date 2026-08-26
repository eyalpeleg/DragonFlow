/* eslint-disable import/first */
// Tests for authorizedFetch's 401 → refresh → retry-once behavior, exercised
// through the public Drive functions ("Fix Google auth expiration" story:
// AC1, AC3, AC4, AC6, AC7, AC8, AC9).

jest.mock('../googleAuth', () => ({
    getFreshToken: jest.fn(),
}));
jest.mock('../../../utils/dataTransfer', () => ({
    validateExportData: () => true,
}));

import { listBackupFiles, downloadBackup, uploadBackup } from '../googleDrive';
import * as googleAuth from '../googleAuth';
import { AuthError, NetworkError, QuotaError } from '../types';

const mockGetFreshToken = googleAuth.getFreshToken as jest.Mock;

interface FakeResponseOpts {
    status?: number;
    body?: unknown;
    headers?: Record<string, string>;
}

function fakeResponse({ status = 200, body = '', headers = {} }: FakeResponseOpts): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: `status-${status}`,
        text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        json: async () => (typeof body === 'string' ? JSON.parse(body || '{}') : body),
        headers: { get: (k: string) => headers[k.toLowerCase()] ?? headers[k] ?? null },
    } as unknown as Response;
}

const mockFetch = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as any).fetch = mockFetch;
});

function authHeaderOf(callIndex: number): string {
    const init = mockFetch.mock.calls[callIndex][1] ?? {};
    return init.headers?.Authorization ?? '';
}

describe('authorizedFetch via listBackupFiles', () => {
    it('401 then success: refreshes once, retries with fresh token, returns data (AC1, AC4)', async () => {
        mockFetch
            .mockResolvedValueOnce(fakeResponse({ status: 401 }))
            .mockResolvedValueOnce(fakeResponse({ status: 200, body: { files: [] } }));
        mockGetFreshToken.mockResolvedValue('fresh-token');

        const result = await listBackupFiles('stale-token');

        expect(result).toEqual([]);
        expect(mockGetFreshToken).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(authHeaderOf(0)).toBe('Bearer stale-token');
        expect(authHeaderOf(1)).toBe('Bearer fresh-token'); // retry uses the refreshed token
    });

    it('double 401: retries exactly once then throws terminal AuthError (AC6, AC9)', async () => {
        mockFetch
            .mockResolvedValueOnce(fakeResponse({ status: 401 }))
            .mockResolvedValueOnce(fakeResponse({ status: 401 }));
        mockGetFreshToken.mockResolvedValue('fresh-token');

        await expect(listBackupFiles('stale-token')).rejects.toBeInstanceOf(AuthError);
        expect(mockFetch).toHaveBeenCalledTimes(2); // no third attempt
        expect(mockGetFreshToken).toHaveBeenCalledTimes(1);
    });

    it('refresh itself fails: original 401 surfaces as terminal AuthError, no retry (AC6)', async () => {
        mockFetch.mockResolvedValueOnce(fakeResponse({ status: 401 }));
        mockGetFreshToken.mockRejectedValue(new AuthError('revoked'));

        await expect(listBackupFiles('stale-token')).rejects.toBeInstanceOf(AuthError);
        expect(mockFetch).toHaveBeenCalledTimes(1); // build() not re-run
    });

    it('non-401 error (403 quota): does NOT refresh, throws QuotaError (AC7)', async () => {
        mockFetch.mockResolvedValueOnce(
            fakeResponse({
                status: 403,
                body: { error: { errors: [{ reason: 'storageQuotaExceeded' }] } },
            }),
        );

        await expect(listBackupFiles('t')).rejects.toBeInstanceOf(QuotaError);
        expect(mockGetFreshToken).not.toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('network failure: treated as transient NetworkError, no refresh (AC8)', async () => {
        mockFetch.mockRejectedValueOnce(new Error('offline'));

        await expect(listBackupFiles('t')).rejects.toBeInstanceOf(NetworkError);
        expect(mockGetFreshToken).not.toHaveBeenCalled();
    });
});

describe('authorizedFetch shared across verbs', () => {
    it('downloadBackup: 401 then success refreshes and retries (AC3, AC4)', async () => {
        mockFetch
            .mockResolvedValueOnce(fakeResponse({ status: 401 }))
            .mockResolvedValueOnce(fakeResponse({ status: 200, body: { tasks: [] } }));
        mockGetFreshToken.mockResolvedValue('fresh-token');

        await downloadBackup('stale-token', 'file-1');

        expect(mockGetFreshToken).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(authHeaderOf(1)).toBe('Bearer fresh-token');
    });

    it('uploadBackup: 401 then success refreshes and retries (AC4)', async () => {
        mockFetch
            .mockResolvedValueOnce(fakeResponse({ status: 401 }))
            .mockResolvedValueOnce(
                fakeResponse({
                    status: 200,
                    body: {
                        id: 'up-1',
                        name: 'dragonflow-backup-ongoing-x.json',
                        modifiedTime: '2026-07-28T00:00:00Z',
                        size: '1',
                    },
                }),
            );
        mockGetFreshToken.mockResolvedValue('fresh-token');

        const meta = await uploadBackup('stale-token', { tasks: [] }, 'ongoing');

        expect(meta.fileId).toBe('up-1');
        expect(mockGetFreshToken).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(authHeaderOf(1)).toBe('Bearer fresh-token');
    });
});
