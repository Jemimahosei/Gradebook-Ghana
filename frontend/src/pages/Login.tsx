import { useState } from 'react';
import type { FormEvent } from 'react';
import { login } from '../lib/api';
import type { AuthUser } from '../lib/api';
import { ErrorBanner, errorText } from '../components';

const DEMO_ACCOUNTS = [
  { label: 'Admin', username: 'admin@demo' },
  { label: 'Teacher (Mrs. Asante)', username: 'teacher@demo' },
  { label: 'Student (Kwame Mensah)', username: '0050101001' },
] as const;

export default function Login({
  onLoggedIn,
  onRegister,
  onBack,
  initialUsername,
}: {
  onLoggedIn: (user: AuthUser) => void;
  onRegister: () => void;
  onBack: () => void;
  initialUsername?: string;
}) {
  const [username, setUsername] = useState(initialUsername ?? '');
  const [password, setPassword] = useState(initialUsername ? 'demo123' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      onLoggedIn(user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function fillDemo(usernameValue: string) {
    setUsername(usernameValue);
    setPassword('demo123');
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Gradebook Ghana</h1>
        <p className="muted">Sign in to your school&rsquo;s gradebook.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="field">
            <span>Email or index number</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="admin@demo / teacher@demo / 0050101001"
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <ErrorBanner error={error} />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <section className="demo-box" aria-label="Demo credentials">
          <h2>Demo accounts — demo only</h2>
          <p>
            Password for all demo accounts: <code>demo123</code>
          </p>
          <ul>
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => fillDemo(a.username)}
                  title="Fill in this demo account"
                >
                  {a.label}: {a.username}
                </button>
              </li>
            ))}
          </ul>
          <p className="small">
            These are seeded demo credentials, not real accounts. Do not reuse real passwords here.
            Students log in with their index number; staff log in with email.
          </p>
        </section>
        <p className="small" style={{ marginTop: '1rem' }}>
          Your school isn&rsquo;t registered yet?{' '}
          <button type="button" className="link-button" onClick={onRegister}>
            Register your school — it&rsquo;s free
          </button>{' '}
          ·{' '}
          <button type="button" className="link-button" onClick={onBack}>
            Back to home
          </button>
        </p>
      </div>
    </main>
  );
}
