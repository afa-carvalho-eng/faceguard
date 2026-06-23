import Link from "next/link";

export default function Pricing() {
  return (
    <div className="container">
      <Link href="/">← Back</Link>
      <h1 style={{ marginTop: 16 }}>Plans</h1>
      <div className="grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginTop: 16 }}>
        <div className="card">
          <h2>Free</h2>
          <p className="muted">€0 / month</p>
          <ul>
            <li>3 face scans per month</li>
            <li>Confidence-scored results</li>
            <li>Manual scans only</li>
          </ul>
          <Link className="btn" href="/signup">Start free</Link>
        </div>
        <div className="card" style={{ borderColor: "var(--brand)" }}>
          <h2>Pro</h2>
          <p className="muted">€9.99 / month</p>
          <ul>
            <li>200 scans per month</li>
            <li>Up to 10 continuous monitors</li>
            <li>Scheduled re-scans (daily / weekly / monthly)</li>
            <li>Email alerts on new appearances</li>
          </ul>
          <Link className="btn primary" href="/signup">Get Pro</Link>
          <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
            Payments scaffold included; wire your Stripe keys to go live.
          </p>
        </div>
      </div>
    </div>
  );
}
