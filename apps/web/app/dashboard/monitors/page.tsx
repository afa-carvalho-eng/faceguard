"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, getToken } from "../../../lib/api";
import { Monitor, Alert, User } from "../../../lib/types";

export default function Monitors() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setMonitors(await api.listMonitors().catch(() => []));
    setAlerts(await api.listAlerts().catch(() => []));
  }

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    api.me().then(setUser).catch(() => router.push("/login"));
    refresh();
  }, [router]);

  async function addMonitor(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    try {
      await api.createMonitor(file, label, frequency);
      setFile(null); setLabel("");
      await refresh();
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  async function upgrade() {
    try {
      const { billingEnabled } = await api.plans();
      if (billingEnabled) {
        const { url } = await api.checkout();
        window.location.href = url; // redirect to Stripe Checkout
        return;
      }
    } catch { /* fall through to dev upgrade */ }
    await api.devUpgrade();
    setUser(await api.me());
  }

  const isPro = user?.plan === "pro";

  return (
    <>
      <nav className="nav">
        <div className="brand">Face<span>Guard</span></div>
        <div className="row">
          <Link href="/dashboard">Scan</Link>
          <Link href="/dashboard/monitors">Monitors</Link>
          <Link href="/dashboard/settings">Settings</Link>
          <span className="muted">{user?.displayName} · {user?.plan}</span>
        </div>
      </nav>

      <div className="container">
        {!isPro && (
          <div className="notice">
            Continuous monitoring is a <strong>Pro</strong> feature.
            <button className="btn" style={{ marginLeft: 12 }} onClick={upgrade}>Upgrade (dev)</button>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="card" style={{ marginTop: 16, borderColor: "var(--warn)" }}>
            <h3>New appearance alerts ({alerts.filter(a => !a.acknowledged).length})</h3>
            {alerts.map((a) => (
              <div key={a.id} className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <a href={a.match.pageUrl || a.match.url} target="_blank" rel="noreferrer">
                  {a.match.siteName || a.match.url}
                </a>
                <span className="muted">{Math.round(a.match.confidence * 100)}% · {new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
          <div className="card">
            <h2>New monitor</h2>
            <form onSubmit={addMonitor}>
              <label className="label">Label</label>
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="My profile photo" required />
              <label className="label">Photo of yourself</label>
              <input type="file" accept="image/*" className="input" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <label className="label">Frequency</label>
              <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              {error && <div className="error">{error}</div>}
              <button className="btn primary" style={{ marginTop: 16 }} disabled={busy || !file || !isPro}>
                {busy ? "Creating…" : "Create monitor"}
              </button>
            </form>
          </div>

          <div className="card">
            <h2>Active monitors</h2>
            {monitors.length === 0 && <p className="muted">No monitors yet.</p>}
            {monitors.map((m) => (
              <div key={m.id} className="card" style={{ padding: 14, marginTop: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <strong>{m.label}</strong>
                  <span className="badge page">{m.frequency}</span>
                </div>
                <p className="muted" style={{ margin: "6px 0 0" }}>
                  Tracking {m.knownMatchUrls.length} known location(s).
                  {m.lastRunAt ? ` Last run ${new Date(m.lastRunAt).toLocaleString()}.` : ""}
                </p>
                <button className="btn" style={{ marginTop: 8 }}
                  onClick={() => api.runMonitor(m.id).then(refresh)}>Run now</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
