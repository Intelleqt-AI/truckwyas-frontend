/**
 * Secure token storage module.
 *
 * Uses sessionStorage instead of localStorage to limit XSS exfiltration risk:
 * - sessionStorage is scoped to the browser tab and cleared when the tab closes
 * - Unlike localStorage, it is not shared across tabs/windows
 * - This reduces the window of opportunity for token theft via XSS
 *
 * For full protection, migrate to httpOnly cookies set by the backend.
 */

const TOKEN_KEY = 'access';
const REFRESH_KEY = 'refresh';
const USER_KEY = 'user';

export const tokenStorage = {
  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    sessionStorage.setItem(TOKEN_KEY, token);
  },

  getRefreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_KEY);
  },

  setRefreshToken(token: string): void {
    sessionStorage.setItem(REFRESH_KEY, token);
  },

  getUser(): Record<string, unknown> | null {
    const userStr = sessionStorage.getItem(USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  setUser(user: Record<string, unknown>): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  clearAll(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
  },
};
