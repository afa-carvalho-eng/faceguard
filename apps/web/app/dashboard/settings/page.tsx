"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken, downloadExport } from "../../../lib/api";
import { User } from "../../../lib/types";

export default function Settings() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    api.me().then(setUser).catch(() => router.push("/login"));
  }, [router]);

  async function doExport() {
    setError(""); setMsg("");
    try { await downloadExport(); setMsg("Your data export was downloaded."); }
    catch (e: any) { setError(e.message); }
  }

  async function manageBilling() {
    setError("");
    try { const { url } = await api.billingPortal(); window.location.href = url; }
    catch (e: any) { setError(e.message); }
  }

  async function deleteAccount() {
    if (confirmText !== "DELETE") return;
    setBusy(true); setError("");
    try {
      await api.deleteAccount();
      clearToken();
      router.push("/");
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

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

      <div className="container" style={{ maxWidth: 640 }}>
        <h1>Account & privacy</h1>
        {msg && <div className="notice" style={{ marginTop: 12 }}>{msg}</div>}
        {error && <div className="error">{error}</div>}

        <div className="card" style={{ marginTop: 16 }}>
          <h3>Your data (GDPR)</h3>
          <p className="muted">
            Download everything we hold about you, including consent records and scan history.
          </p>
          <button className="btn" onClick={doExport}>Export my data (JSON)</button>
        </div>

        {user?.plan === "pro" && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Subscription</h3>
            <p className="muted">Manage or cancel your Pro subscription.</p>
            <button className="btn" onClick={manageBilling}>Manage billing</button>
          </div>
        )}

        <div className="card" style={{ marginTop: 16, borderColor: "var(--bad)" }}>
          <h3 style={{ color: "var(--bad)" }}>Delete account</h3>
          <p className="muted">
            Permanently erases your account, all scans, monitors, alerts, consent records and
            uploaded images. This cannot be undone. Type <strong>DELETE</strong> to confirm.
          </p>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
          <button className="btn" style={{ marginTop: 12, background: "var(--bad)", border: "none", color: "#fff" }}
            disabled={confirmText !== "DELETE" || busy} onClick={deleteAccount}>
            {busy ? "Deleting…" : "Permanently delete my account"}
          </button>
        </div>
      </div>
    </>
  );
}
