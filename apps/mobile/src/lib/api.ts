import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const API =
  (Constants.expoConfig?.extra as any)?.apiUrl || "http://localhost:4000";
const TOKEN_KEY = "faceguard_token";

export async function getToken() { return SecureStore.getItemAsync(TOKEN_KEY); }
export async function setToken(t: string) { return SecureStore.setItemAsync(TOKEN_KEY, t); }
export async function clearToken() { return SecureStore.deleteItemAsync(TOKEN_KEY); }

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = await getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  signup: (email: string, password: string, displayName: string) =>
    req<{ token: string; user: any }>("/api/auth/signup", {
      method: "POST", body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    req<{ token: string; user: any }>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => req<any>("/api/auth/me"),
  listScans: () => req<any[]>("/api/scans"),
  createScan: (uri: string, ownPhoto: boolean, terms: boolean) => {
    const fd = new FormData();
    // React Native FormData file shape.
    fd.append("photo", { uri, name: "selfie.jpg", type: "image/jpeg" } as any);
    fd.append("ownPhotoAttested", String(ownPhoto));
    fd.append("termsAccepted", String(terms));
    return req<any>("/api/scans", { method: "POST", body: fd });
  },
};
