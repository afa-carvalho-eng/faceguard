import { User, Scan, Monitor, Alert } from "./types";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
export const API_BASE = API;
const TOKEN_KEY = "faceguard_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) { window.localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { window.localStorage.removeItem(TOKEN_KEY); }

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(opts.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  signup: (email: string, password: string, displayName: string) =>
    req<{ token: string; user: User }>("/api/auth/signup", {
      method: "POST", body: JSON.stringify({ email, password, displayName }),
    }),
  login: (email: string, password: string) =>
    req<{ token: string; user: User }>("/api/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    }),
  me: () => req<User>("/api/auth/me"),

  createScan: (photo: File, ownPhotoAttested: boolean, termsAccepted: boolean) => {
    const fd = new FormData();
    fd.append("photo", photo);
    fd.append("ownPhotoAttested", String(ownPhotoAttested));
    fd.append("termsAccepted", String(termsAccepted));
    return req<Scan>("/api/scans", { method: "POST", body: fd });
  },
  listScans: () => req<Scan[]>("/api/scans"),
  getScan: (id: string) => req<Scan>(`/api/scans/${id}`),

  createMonitor: (photo: File, label: string, frequency: string) => {
    const fd = new FormData();
    fd.append("photo", photo);
    fd.append("label", label);
    fd.append("frequency", frequency);
    fd.append("ownPhotoAttested", "true");
    fd.append("termsAccepted", "true");
    return req<Monitor>("/api/monitors", { method: "POST", body: fd });
  },
  listMonitors: () => req<Monitor[]>("/api/monitors"),
  runMonitor: (id: string) => req<{ newAlerts: Alert[] }>(`/api/monitors/${id}/run`, { method: "POST" }),
  listAlerts: () => req<Alert[]>("/api/monitors/alerts/all"),
  devUpgrade: () => req<{ ok: boolean }>("/api/billing/dev/upgrade", { method: "POST" }),

  plans: () => req<{ billingEnabled: boolean }>("/api/billing/plans"),
  checkout: () => req<{ url: string }>("/api/billing/checkout", { method: "POST" }),
  billingPortal: () => req<{ url: string }>("/api/billing/portal", { method: "POST" }),
  deleteAccount: () => req<{ ok: boolean }>("/api/account", { method: "DELETE" }),
};

/** Trigger a browser download of the GDPR data export (auth via token query is
 *  not used; we fetch with the header then save the blob). */
export async function downloadExport() {
  const res = await fetch(`${API}/api/account/export`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "faceguard-export.json"; a.click();
  URL.revokeObjectURL(url);
}
