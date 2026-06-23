import Link from "next/link";

export default function Home() {
  return (
    <>
      <nav className="nav">
        <div className="brand">Face<span>Guard</span></div>
        <div className="row">
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Log in</Link>
          <Link className="btn primary" href="/signup">Get started</Link>
        </div>
      </nav>

      <div className="container">
        <section className="hero card" style={{ marginTop: 24 }}>
          <h1>Find out where <span style={{ color: "var(--brand)" }}>your face</span> shows up online.</h1>
          <p>
            FaceGuard is a privacy tool for monitoring <strong>your own</strong> likeness.
            Upload a photo of yourself and we’ll show you where that image already appears
            on the public web — then keep watch and alert you when it shows up somewhere new.
          </p>
          <div className="row" style={{ marginTop: 24 }}>
            <Link className="btn primary" href="/signup">Run my first scan</Link>
            <Link className="btn" href="/pricing">See plans</Link>
          </div>
        </section>

        <div className="notice" style={{ marginTop: 16 }}>
          <strong>Consent-first by design.</strong> FaceGuard only searches for photos of
          <em> yourself</em>. Every scan requires you to confirm the photo is of you. We do not
          let you search for other people, and we never build a biometric database of strangers.
        </div>

        <section className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 24 }}>
          <div className="card">
            <h3>1. Upload your photo</h3>
            <p className="muted">A clear photo of your own face. It’s used only to run your search.</p>
          </div>
          <div className="card">
            <h3>2. See where it appears</h3>
            <p className="muted">Confidence-scored results showing pages and images that match.</p>
          </div>
          <div className="card">
            <h3>3. Monitor & get alerts</h3>
            <p className="muted">Pro plans re-scan on a schedule and alert you to new appearances.</p>
          </div>
        </section>

        <footer className="muted" style={{ marginTop: 40, fontSize: 13 }}>
          FaceGuard processes biometric-adjacent data only with your explicit consent and only for
          your own likeness. See our terms for data handling and deletion rights (GDPR).
        </footer>
      </div>
    </>
  );
}
