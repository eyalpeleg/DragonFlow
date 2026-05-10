import { validateExportData, ExportPayload } from '../../utils/dataTransfer';
import { AuthError, BackupMetadata, NetworkError, QuotaError } from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

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
    const url = `${DRIVE_API}/files?spaces=appDataFolder&q=${query}&fields=${fields}&orderBy=modifiedTime desc&pageSize=10`;

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
    }));
}

export async function uploadBackup(token: string, payload: object): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `dragonflow-backup-${timestamp}.json`;

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
    };
}

export async function cleanupOldBackups(token: string, backups: BackupMetadata[], keepCount: number = 5): Promise<void> {
    if (backups.length <= keepCount) return;

    const toDelete = backups.slice(keepCount);
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
