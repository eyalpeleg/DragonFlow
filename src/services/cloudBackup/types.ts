export interface GoogleAuthTokens {
    accessToken: string;
    refreshToken: string | null;
    expiresAt: number; // Unix ms
    idToken?: string;
    userEmail?: string;
    userName?: string;
}

export interface BackupMetadata {
    fileId: string;
    name: string;
    modifiedTime: string; // ISO
    size: number;
    taskCount?: number;
}

export type BackupStatus = 'idle' | 'backing-up' | 'restoring' | 'error';

export class AuthError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AuthError';
    }
}

export class QuotaError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'QuotaError';
    }
}

export class NetworkError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NetworkError';
    }
}
