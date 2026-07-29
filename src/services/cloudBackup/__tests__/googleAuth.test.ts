/* eslint-disable import/first */
// Tests for getFreshToken — the token-refresh primitive behind the
// "Fix Google auth expiration" story (AC1, AC6, AC10, AC11).

const mockGetTokens = jest.fn();
const mockClearCachedAccessToken = jest.fn();
const mockSignInSilently = jest.fn();
const mockGetCurrentUser = jest.fn();

jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        getTokens: (...args: unknown[]) => mockGetTokens(...args),
        clearCachedAccessToken: (...args: unknown[]) => mockClearCachedAccessToken(...args),
        signInSilently: (...args: unknown[]) => mockSignInSilently(...args),
        getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
    },
    isErrorWithCode: () => false,
    statusCodes: {},
}));

import { getFreshToken } from '../googleAuth';
import { AuthError } from '../types';

beforeEach(() => {
    jest.clearAllMocks();
});

describe('getFreshToken', () => {
    it('Path 1: clears the stale cached token and returns a fresh one (AC1)', async () => {
        mockGetTokens
            .mockResolvedValueOnce({ accessToken: 'stale-token' }) // read current
            .mockResolvedValueOnce({ accessToken: 'fresh-token' }); // refetch after clear
        mockClearCachedAccessToken.mockResolvedValue(null);

        const token = await getFreshToken();

        expect(token).toBe('fresh-token');
        // clears using the *old* token string
        expect(mockClearCachedAccessToken).toHaveBeenCalledWith('stale-token');
        expect(mockSignInSilently).not.toHaveBeenCalled();
    });

    it('Path 2: falls back to silent sign-in when clearing fails, then returns fresh (AC10)', async () => {
        // Path 1 fails somewhere (e.g. clearCachedAccessToken rejects)
        mockGetTokens
            .mockResolvedValueOnce({ accessToken: 'stale-token' }) // read current (Path 1)
            .mockResolvedValueOnce({ accessToken: 'silent-fresh-token' }); // getTokens after silent sign-in
        mockClearCachedAccessToken.mockRejectedValue(new Error('clear failed'));
        mockSignInSilently.mockResolvedValue({ type: 'success', data: { user: { email: 'x' } } });

        const token = await getFreshToken();

        expect(token).toBe('silent-fresh-token');
        expect(mockSignInSilently).toHaveBeenCalledTimes(1);
    });

    it('throws terminal AuthError when both refresh paths fail (AC6)', async () => {
        mockGetTokens.mockRejectedValue(new Error('no session')); // Path 1 read fails
        mockSignInSilently.mockResolvedValue({ type: 'noSavedCredentialFound' }); // Path 2 non-success

        await expect(getFreshToken()).rejects.toBeInstanceOf(AuthError);
    });
});
