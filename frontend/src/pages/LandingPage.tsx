/**
 * Public landing page: what Gradebook Ghana is, what it does, and how a
 * school starts using it. Plain, honest copy — no invented numbers, no
 * fake testimonials, no made-up schools or people. The demo section lets
 * anyone try the seeded demo school before registering.
 */
const DEMO_ACCOUNTS = [
  { label: 'Admin', detail: 'Demo Admin', username: 'admin@demo' },
  { label: 'Teacher', detail: 'Mrs. Asante — 2 Arts 1', username: 'teacher@demo' },
  { label: 'Student', detail: 'Kwame Mensah — 3 Science 4', username: '0050101001' },
] as const;

export default function LandingPage({
  onLogin,
  onRegister,
  onTryDemo,
}: {
  onLogin: () => void;
  onRegister: () => void;
  onTryDemo: (username: string) => void;
}) {
  return (
    <main className="landing">
      <header className="landing-top">
        <div className="brand">Gradebook Ghana</div>
        <div className="landing-top-links">
          <button type="button" className="link-button" onClick={onLogin}>
            Log in
          </button>
          <button type="button" className="btn-primary" onClick={onRegister}>
            Register your school
          </button>
        </div>
      </header>

      <section className="hero">
        <h1>Free grading for Ghanaian senior high schools.</h1>
        <p>
          Gradebook Ghana is a gradebook built for Ghanaian SHS: WAEC grading, class work and
          exam marks, class rankings, and report cards your students can download. It is free —
          built by Jemimah Osei as a community project, for schools to use, not to buy.
        </p>
        <div className="landing-actions">
          <button type="button" className="btn-primary" onClick={onRegister}>
            Register your school — it&rsquo;s free
          </button>
          <button type="button" onClick={onLogin}>
            Log in
          </button>
        </div>
        <p className="small">
          No fees, no trial, no card. Registering creates your school&rsquo;s own gradebook with
          its own teachers, classes and students.
        </p>
      </section>

      <section aria-label="What it does">
        <h2>What it does</h2>
        <div className="feature-grid">
          <div className="feature-card">
            <h3>WAEC A1–F9 grading</h3>
            <p>
              Totals map to the WAEC bands you already use — A1 90–100 down to F9 0–39 — with
              remarks. Your admin can adjust the bands if your school grades differently.
            </p>
          </div>
          <div className="feature-card">
            <h3>Class work 30% · Exam 70%</h3>
            <p>
              Teachers enter two marks per subject. The weighted total is worked out
              automatically, so a class-work mark of 80 and an exam mark of 90 is 87.0.
            </p>
          </div>
          <div className="feature-card">
            <h3>Marks entry &amp; class rankings</h3>
            <p>
              Class teachers see their whole class in one grid, with live averages, grade
              letters and ranks as they type. Tied averages share a rank.
            </p>
          </div>
          <div className="feature-card">
            <h3>Report cards as PDF</h3>
            <p>
              Students log in with their index number, see their published results, and
              download their report card as a PDF (or CSV) for the term.
            </p>
          </div>
          <div className="feature-card">
            <h3>Admin tools</h3>
            <p>
              The school admin manages classes, teachers, students, subjects and the grading
              scale — and assigns teachers to the subjects they teach.
            </p>
          </div>
          <div className="feature-card">
            <h3>Your school, your data</h3>
            <p>
              Each school gets its own gradebook. Teachers and students only ever see their
              own school&rsquo;s classes, marks and report cards.
            </p>
          </div>
        </div>
      </section>

      <section aria-label="How it works">
        <h2>How a school starts</h2>
        <ol className="steps">
          <li>
            <strong>Register your school</strong> — school name, town and region, and the contact
            person&rsquo;s email. That person becomes the school admin.
          </li>
          <li>
            <strong>Add teachers, classes and students</strong> — your school starts with the
            standard WAEC grading scale and subject list already filled in.
          </li>
          <li>
            <strong>Teachers enter marks</strong> and publish them when they are ready.
          </li>
          <li>
            <strong>Students download their report cards.</strong>
          </li>
        </ol>
      </section>

      <section className="demo-box" aria-label="Try the demo">
        <h2>See it working first — try the demo school</h2>
        <p>
          Password for all demo accounts: <code>demo123</code>. The demo school is fictional
          data for showing how the gradebook works — not a real school.
        </p>
        <ul>
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.username}>
              <button
                type="button"
                className="link-button"
                onClick={() => onTryDemo(a.username)}
                title="Open the login page with this demo account filled in"
              >
                {a.label} ({a.detail}): {a.username}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="landing-footer">
        <small>
          Gradebook Ghana — a free community project for Ghanaian senior high schools, built by
          Jemimah Osei.
        </small>
      </footer>
    </main>
  );
}
