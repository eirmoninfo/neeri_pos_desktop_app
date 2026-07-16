import axios from "axios";

let sessionToken: string | null = null;
const authListeners: Array<() => void> = [];

export const onUnauthorized = (listener: () => void) => {
  authListeners.push(listener);
};

export const setAuthToken = (token: string | null) => {
  sessionToken = token;
};

export const apiClient = axios.create({
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json"
  }
});

apiClient.interceptors.request.use(async (config) => {
  const baseUrl = await window.desktopApi.getApiBaseUrl();
  config.baseURL = baseUrl;
  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      authListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  }
);
