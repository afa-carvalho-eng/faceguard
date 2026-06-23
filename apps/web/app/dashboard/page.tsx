"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearToken, getToken } from "../../lib/api";
import { Scan, User } from "../../lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [ownPhoto, setOwnPhoto] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Scan | null>(null);

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    api.me().then(setUser).catch(() => { clearToken(); router.push("/login"); });
    api.listScans().then(setScans).catch(() => {});
  }, [router]);

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !ownPhoto || !terms) return;
    setBusy(true); setError("");
    try {
      const scan = await api.createScan(file, ownPhoto, terms);
      setActive(scan);
      setScans(await api.listScans());
      setFile(null); setOwnPhoto(false); setTerms(false);
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  function logout() { clearToken(); router.push("/"); }

  return (
    <>
      <nav className="nav">
        <div className="brand">Face<span>Guard</span></div>
        <div className="row">
          <Link href="/dashboard">Scan</Link>
          <Link href="/dashboard/monitors">Monitors</Link>
          <Link href="/dashboard/settings">Settings</Link>
          <span className="muted">{user?.displayName} · {user?.plan}</span>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
      </nav>

      <div className="container grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <h2>New scan</h2>
          <p className="muted">Upload a clear photo of <strong>yourself</strong>.</p>
          <form onSubmit={runScan}>
            <input type="file" accept="image/*" className="input"
              onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <label className="consent">
              <input type="checkbox" checked={ownPhoto} onChange={(e) => setOwnPhoto(e.target.checked)} />
              <span>I confirm this is a photo of <strong>myself</strong> and I consent to FaceGuard searching for it.</span>
            </label>
            <label className="consent">
              <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
              <span>I accept the Terms and understand results may be incomplete.</span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn primary" style={{ marginTop: 16 }}
              disabled={busy || !file || !ownPhoto || !terms}>
              {busy ? "Scanning…" : "Run scan"}
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Results {active ? `(${active.matchCount})` : ""}</h2>
          {active?.provider === "mock" && (
            <div className="notice" style={{ borderColor: "var(--warn)", color: "var(--warn)" }}>
              Demo data — these are placeholder results, not real web findings. Add a Google Vision
              or TinEye API key (see README) to search the real web.
            </div>
          )}
          {active?.faceDetected && (
            <p className="muted" style={{ fontSize: 13 }}>
              AI face verification ran — results show how confidently each location matches your face.
            </p>
          )}
          {!active && <p className="muted">Run a scan to see where your photo appears.</p>}
          {active?.status === "failed" && <div className="error">{active.error}</div>}
          {active && active.matches.length === 0 && active.status === "completed" &&
            <p className="muted">No public matches found above the confidence threshold. Good news.</p>}
          <div className="grid">
            {active?.matches.map((m, i) => (
              <div key={i} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className={`badge ${m.kind}`}>{m.kind}</span>
                  <div className="row">
                    <div className="confbar"><div style={{ width: `${Math.round(m.confidence * 100)}%` }} /></div>
                    <span className="muted">{Math.round(m.confidence * 100)}% image</span>
                  </div>
                </div>
                {typeof m.faceConfidence === "number" && (
                  <div className="row" style={{ marginTop: 8 }}>
                    <span className={`badge ${m.faceVerified ? "full" : "partial"}`}>
                      {m.faceVerified ? "✓ face matched" : "face uncertain"} · {Math.round(m.faceConfidence * 100)}%
                    </span>
                  </div>
                )}
                <div style={{ marginTop: 8 }}>
                  <a href={m.pageUrl || m.url} target="_blank" rel="noreferrer">
                    {m.siteName || m.pageUrl || m.url}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        <div className="card">
          <h3>Scan history</h3>
          <table>
            <thead><tr><th>Date</th><th>Provider</th><th>Matches</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="muted">{s.provider}</td>
                  <td>{s.matchCount}</td>
                  <td>{s.status}</td>
                  <td><button className="btn" onClick={() => setActive(s)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
