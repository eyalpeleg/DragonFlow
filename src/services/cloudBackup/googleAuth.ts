import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { GoogleAuthTokens } from './types';

WebBrowser.maybeCompleteAuthSession();

const AUTH_STORAGE_KEY = 'dragonflow-google-auth';

const GOOGLE_DISCOVERY = {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenEndpoint: 'https://oauth2.googleapis.com/token',
    revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const SCOPES = ['https://www.googleapis.com/auth/drive.appdata', 'email', 'profile'];

function getClientId(): string {
    const extra = Constants.expoConfig?.extra?.googleOAuth;
    if (!extra) throw new Error('Google OAuth client IDs not configured in app.config.ts');
    if (Platform.OS === 'ios') return extra.iosClientId;
    if (Platform.OS === 'android') return extra.androidClientId;
    return extra.webClientId;
}

function getRedirectUri(): string {
    return AuthSession.makeRedirectUri({ scheme: 'dragonflow' });
}

let cachedTokens: GoogleAuthTokens | null = null;

export async function loadStoredAuth(): Promise<GoogleAuthTokens | null> {
    try {
        const stored = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
        if (stored) {
            cachedTokens = JSON.parse(stored);
            return cachedTokens;
        }
    } catch {}
    return null;
}

async function storeTokens(tokens: GoogleAuthTokens): Promise<void> {
    cachedTokens = tokens;
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokens));
}

async function clearTokens(): Promise<void> {
    cachedTokens = null;
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function signIn(): Promise<GoogleAuthTokens> {
    const clientId = getClientId();
    const redirectUri = getRedirectUri();

    const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri,
        scopes: SCOPES,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        extraParams: {
            access_type: 'offline',
            prompt: 'consent',
        },
    });

    const result = await request.promptAsync(GOOGLE_DISCOVERY);

    if (result.type !== 'success' || !result.params.code) {
        throw new Error('Sign-in was cancelled or failed');
    }

    const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
            clientId,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier! },
        },
        GOOGLE_DISCOVERY,
    );

    // Fetch user info
    let userEmail: string | undefined;
    let userName: string | undefined;
    try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenResponse.accessToken}` },
        });
        if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json();
            userEmail = userInfo.email;
            userName = userInfo.name;
        }
    } catch {}

    const tokens: GoogleAuthTokens = {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken ?? null,
        expiresAt: tokenResponse.issuedAt * 1000 + (tokenResponse.expiresIn ?? 3600) * 1000,
        idToken: tokenResponse.idToken ?? undefined,
        userEmail,
        userName,
    };

    await storeTokens(tokens);
    return tokens;
}

export async function signOut(): Promise<void> {
    await clearTokens();
}

export async function getValidToken(): Promise<string> {
    if (!cachedTokens) {
        await loadStoredAuth();
    }
    if (!cachedTokens) {
        throw new Error('Not signed in');
    }

    // Token still valid (with 60s buffer)
    if (cachedTokens.expiresAt > Date.now() + 60_000) {
        return cachedTokens.accessToken;
    }

    // Need to refresh
    if (!cachedTokens.refreshToken) {
        await clearTokens();
        throw new Error('Session expired. Please sign in again.');
    }

    try {
        const clientId = getClientId();
        const tokenResponse = await AuthSession.refreshAsync(
            {
                clientId,
                refreshToken: cachedTokens.refreshToken,
            },
            GOOGLE_DISCOVERY,
        );

        const refreshedTokens: GoogleAuthTokens = {
            ...cachedTokens,
            accessToken: tokenResponse.accessToken,
            expiresAt: tokenResponse.issuedAt * 1000 + (tokenResponse.expiresIn ?? 3600) * 1000,
            refreshToken: tokenResponse.refreshToken ?? cachedTokens.refreshToken,
        };

        await storeTokens(refreshedTokens);
        return refreshedTokens.accessToken;
    } catch {
        await clearTokens();
        throw new Error('Session expired. Please sign in again.');
    }
}

export function getCachedTokens(): GoogleAuthTokens | null {
    return cachedTokens;
}
