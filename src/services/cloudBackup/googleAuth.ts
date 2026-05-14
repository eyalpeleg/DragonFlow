import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import { GoogleAuthTokens, AuthError } from './types';

GoogleSignin.configure({
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
});

export async function loadStoredAuth(): Promise<GoogleAuthTokens | null> {
    try {
        const user = GoogleSignin.getCurrentUser();
        if (!user) return null;
        const tokens = await GoogleSignin.getTokens();
        return {
            accessToken: tokens.accessToken,
            refreshToken: null,
            expiresAt: 0,
            idToken: tokens.idToken ?? undefined,
            userEmail: user.user.email,
            userName: user.user.name ?? undefined,
        };
    } catch {
        return null;
    }
}

export async function signIn(): Promise<GoogleAuthTokens> {
    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const response = await GoogleSignin.signIn();
        if (response.type === 'cancelled') {
            throw new Error('Sign-in was cancelled');
        }
        const tokens = await GoogleSignin.getTokens();
        return {
            accessToken: tokens.accessToken,
            refreshToken: null,
            expiresAt: 0,
            idToken: tokens.idToken ?? undefined,
            userEmail: response.data.user.email,
            userName: response.data.user.name ?? undefined,
        };
    } catch (e: any) {
        if (isErrorWithCode(e)) {
            if (e.code === statusCodes.SIGN_IN_CANCELLED) throw new Error('Sign-in was cancelled');
            if (e.code === statusCodes.IN_PROGRESS) throw new Error('Sign-in already in progress');
            if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new Error('Google Play Services not available');
        }
        throw e;
    }
}

export async function signOut(): Promise<void> {
    await GoogleSignin.signOut();
}

export async function getValidToken(): Promise<string> {
    const user = GoogleSignin.getCurrentUser();
    if (!user) throw new AuthError('Not signed in');
    try {
        const tokens = await GoogleSignin.getTokens();
        return tokens.accessToken;
    } catch {
        throw new AuthError('Session expired. Please sign in again.');
    }
}
