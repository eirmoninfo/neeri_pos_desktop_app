import { create } from "zustand";
import { authApi } from "../api/authApi";
import { onUnauthorized, setAuthToken } from "../api/apiClient";
import type { User, UserRole } from "../types";

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  canAccess: (roles: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  loading: true,
  init: async () => {
    const token = await window.desktopApi.getToken();
    if (!token) {
      set({ loading: false });
      return;
    }
    setAuthToken(token);
    try {
      const user = await authApi.me();
      set({ token, user, loading: false });
    } catch {
      await window.desktopApi.clearToken();
      set({ token: null, user: null, loading: false });
    }
  },
  login: async (email, password) => {
    const result = await authApi.login({ email, password });
    setAuthToken(result.token);
    await window.desktopApi.saveToken(result.token);
    set({ token: result.token, user: result.user });
  },
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore API logout failure and still clear session.
    }
    setAuthToken(null);
    await window.desktopApi.clearToken();
    set({ token: null, user: null });
  },
  canAccess: (roles) => {
    const role = get().user?.role;
    if (!role) return false;
    return roles.includes(role);
  }
}));

onUnauthorized(async () => {
  setAuthToken(null);
  await window.desktopApi.clearToken();
  useAuthStore.setState({ token: null, user: null });
});
