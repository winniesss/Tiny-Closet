
import { registerPlugin } from '@capacitor/core';
import { Capacitor } from '@capacitor/core';

interface AppleSignInResult {
  user: string;
  email?: string;
  givenName?: string;
  familyName?: string;
  identityToken?: string;
  authorizationCode?: string;
}

interface AppleSignInPluginInterface {
  signIn(): Promise<AppleSignInResult>;
  getCredentialState(options: { userId: string }): Promise<{ state: string }>;
}

const AppleSignIn = registerPlugin<AppleSignInPluginInterface>('AppleSignInPlugin');

const APPLE_USER_KEY = 'tiny_closet_apple_user';

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

// Check if the Sign In with Apple entitlement is configured
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    // A lightweight probe — getCredentialState with a dummy ID
    // will succeed (returning "notFound") if entitlement exists,
    // or throw if entitlement is missing
    await AppleSignIn.getCredentialState({ userId: '__probe__' });
    return true;
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<AppleSignInResult> {
  const result = await AppleSignIn.signIn();

  // Persist the Apple user ID for future sessions
  localStorage.setItem(APPLE_USER_KEY, result.user);
  const maxAge = 10 * 365 * 24 * 60 * 60;
  document.cookie = `${APPLE_USER_KEY}=${encodeURIComponent(result.user)}; path=/; max-age=${maxAge}; SameSite=Strict`;

  return result;
}

export function getStoredAppleUserId(): string | null {
  // Try cookie first
  const match = document.cookie.match(new RegExp('(?:^|; )' + APPLE_USER_KEY + '=([^;]*)'));
  if (match) return decodeURIComponent(match[1]);

  // Fallback to localStorage
  return localStorage.getItem(APPLE_USER_KEY);
}

export async function checkAppleCredentialState(userId: string): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'unknown';

  try {
    const result = await AppleSignIn.getCredentialState({ userId });
    return result.state;
  } catch {
    return 'unknown';
  }
}
