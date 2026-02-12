export const AUTH_KEY = "doctat_auth";

export type AuthState = {
  auth: boolean;
  name: string;
  bot?: "octa" | "octaLive";
};

export const setAuth = (data: AuthState) => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
};

export const getAuth = (): AuthState | null => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
};

export const clearAuth = () => {
  localStorage.removeItem(AUTH_KEY);
};
