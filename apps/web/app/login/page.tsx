"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, setToken } from "../../lib/api";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const { token } = await api.login(email, password);
      setToken(token);
      router.push("/dashboard");
    } catch (err: any) { setError(err.message); } finally { setBusy(false); }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <Link href="/">← Back</Link>
      <div className="card" style={{ marginTop: 16 }}>
        <h1>Log in</h1>
        <form onSubmit={submit}>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error">{error}</div>}
          <button className="btn primary" style={{ marginTop: 18, width: "100%" }} disabled={busy}>
            {busy ? "…" : "Log in"}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 14 }}>No account? <Link href="/signup">Sign up</Link></p>
      </div>
    </div>
  );
}
