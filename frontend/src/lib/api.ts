import { API_URL } from "./constants";

const TOKEN_KEY = "netland_token";
const USER_KEY = "netland_user";

export const authStorage = {
  getToken: () => localStorage.getItem(TOKEN_KEY),
  setSession: (token: string, user: unknown) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  getUser: () => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  authenticated = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authenticated) {
    const token = authStorage.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (response.status === 401) {
    authStorage.clear();
    if (authenticated) window.location.href = "/admin/login";
    throw new Error("Sesión expirada. Inicia sesión nuevamente.");
  }

  if (!response.ok) {
    let detail = "Error en la solicitud.";
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const api = {
  get: <T>(path: string, authenticated = false, signal?: AbortSignal) =>
    request<T>(path, { method: "GET", signal }, authenticated),
  post: <T>(path: string, body: unknown, authenticated = false, signal?: AbortSignal) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body), signal }, authenticated),
  put: <T>(path: string, body: unknown, authenticated = false, signal?: AbortSignal) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body), signal }, authenticated),
  patch: <T>(path: string, body: unknown, authenticated = false, signal?: AbortSignal) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), signal }, authenticated),
  del: <T>(path: string, authenticated = false, signal?: AbortSignal) =>
    request<T>(path, { method: "DELETE", signal }, authenticated),
};