"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "../../lib/api";

export default function Signup() {
  const router = useRouter();
  const [displayName, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { token } = await api.signup(email, password, displayName);
      setToken(token);
      router.push("/dashboard");
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <Link href="/">← Back</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>Create account</h1>
        <form onSubmit={submit}>
          <label className="label">Name</label>
          <input className="input" value={displayName} onChange={(e) => setName(e.target.value)} required />
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">Password (min 8 chars)</label>
          <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button className="btn primary" style={{ marginTop: 18, width: "100%" }} disabled={busy}>
            {busy ? "…" : "Create account"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>Have an account? <Link href="/login">Log in</Link></p>
      </div>
    </div>
  );
}
