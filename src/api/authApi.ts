import { apiClient } from "./apiClient";
import type { User } from "../types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

function unwrap<T>(payload: unknown): T {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === "object") {
      return record.data as T;
    }
  }
  return payload as T;
}

function normalizeLoginResponse(payload: unknown): LoginResponse {
  const record = payload as Record<string, unknown>;
  const nested = unwrap<Record<string, unknown>>(payload);
  const token = (record.token || record.access_token || nested.token || nested.access_token || "") as string;
  const user = (record.user || nested.user || nested) as User;
  return { token, user };
}

export const authApi = {
  login: async (payload: LoginPayload) => normalizeLoginResponse((await apiClient.post("/api/login", payload)).data),
  me: async () => unwrap<User>((await apiClient.get("/api/user")).data),
  logout: async () => apiClient.post("/api/logout")
};
