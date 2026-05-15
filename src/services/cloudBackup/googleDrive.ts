import { validateExportData, ExportPayload } from '../../utils/dataTransfer';
import { AuthError, BackupBucket, BackupMetadata, NetworkError, QuotaError } from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const MAX_BACKUP_SIZE = 50 * 1024 * 1024;

function classifyBackup(name: string): BackupBucket {
    if (name.includes('-weekly-')) return 'weekly';
    if (name.includes('-daily-')) return 'daily';
    return 'ongoing';
}

async function handleResponse(response: Response): Promise<any> {
    if (response.ok) {
        const text = await response.text();
        return text ? JSON.parse(text) : null;
    }
    if (response.status === 401) {
        throw new AuthError('Authentication expired');
    }
    if (response.status === 403) {
        const body = await response.json().catch(() => ({}));
        const reason = body?.error?.errors?.[0]?.reason;
        if (reason === 'storageQuotaExceeded') {
            throw new QuotaError('Google Drive storage is full');
        }
        throw new Error(`Drive API forbidden: ${reason || response.statusText}`);
    }
    throw new Error(`Drive API error: ${response.status} ${response.statusText}`);
}

export async function listBackupFiles(token: string): Promise<BackupMetadata[]> {
    const query = encodeURIComponent("name contains 'dragonflow-backup-'");
    const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
    const url = `${DRIVE_API}/files?spaces=appDataFolder&q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=100`;

    let response: Response;
    try {
        response = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (e: any) {
        throw new NetworkError(e.message ?? 'Network request failed');
    }

    const data = await handleResponse(response);
    return (data.files ?? []).map((f: any) => ({
        fileId: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime,
        size: parseInt(f.size ?? '0', 10),
        bucket: classifyBackup(f.name),
    }));
}

export async function uploadBackup(
    token: string,
    payload: object,
    bucket: BackupBucket = 'ongoing',
): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `dragonflow-backup-${bucket}-${timestamp}.json`;

    const metadata = {
        name: fileName,
        parents: ['appDataFolder'],
        mimeType: 'application/json',
    };

    const boundary = '---dragonflow-boundary';
    const body =
        `--${boundary}\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(metadata)}\r\n` +
        `--${boundary}\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${JSON.stringify(payload)}\r\n` +
        `--${boundary}--`;

    let response: Response;
    try {
        response = await fetch(`${UPLOAD_API}/files?uploadType=multipart&fields=id,name,modifiedTime,size`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body,
        });
    } catch (e: any) {
        throw new NetworkError(e.message ?? 'Network request failed');
    }

    const data = await handleResponse(response);
    return {
        fileId: data.id,
        name: data.name,
        modifiedTime: data.modifiedTime,
        size: parseInt(data.size ?? '0', 10),
        bucket: classifyBackup(data.name),
    };
}

export async function cleanupOldBackups(
    token: string,
    backups: BackupMetadata[],
    retention: Record<BackupBucket, number>,
): Promise<void> {
    const byBucket: Record<BackupBucket, BackupMetadata[]> = { ongoing: [], daily: [], weekly: [] };
    for (const b of backups) byBucket[b.bucket].push(b);

    const toDelete: BackupMetadata[] = [];
    (Object.keys(byBucket) as BackupBucket[]).forEach((bucket) => {
        const sorted = byBucket[bucket].sort(
            (a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime(),
        );
        toDelete.push(...sorted.slice(retention[bucket]));
    });

    if (toDelete.length === 0) return;

    await Promise.all(
        toDelete.map(async (backup) => {
            try {
                const response = await fetch(`${DRIVE_API}/files/${backup.fileId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!response.ok && response.status !== 404) {
                    console.warn(`Failed to delete old backup ${backup.name}: ${response.status}`);
                }
            } catch {}
        }),
    );
}

export async function downloadBackup(token: string, fileId: string): Promise<ExportPayload> {
    let response: Response;
    try {
        response = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
        });
    } catch (e: any) {
        throw new NetworkError(e.message ?? 'Network request failed');
    }

    if (!response.ok) {
        await handleResponse(response); // throws typed error
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength) {
        const size = parseInt(contentLength, 10);
        if (size > MAX_BACKUP_SIZE) {
            throw new Error(`Backup file too large (${size} bytes, max ${MAX_BACKUP_SIZE} bytes)`);
        }
    }

    const text = await response.text();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error('Backup file is corrupted');
    }

    if (!validateExportData(parsed)) {
        throw new Error('Invalid backup file format');
    }

    return parsed;
}
