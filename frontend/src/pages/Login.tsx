import { useState } from 'react';
import type { FormEvent } from 'react';
import { login } from '../lib/api';
import type { AuthUser } from '../lib/api';
import { ErrorBanner, Logo, errorText } from '../components';

const DEMO_ACCOUNTS = [
  { label: 'Open as Admin', username: 'admin@demo' },
  { label: 'Open as Teacher', username: 'teacher@demo' },
  { label: 'Open as Student', username: '0050101001' },
] as const;

/**
 * Log in — mockup screen 03 ("Log in and demo preview"): form card on the
 * left, demo-school panel on the right. Demo buttons sign straight in
 * with the seeded demo accounts (password demo123), as the mockup's
 * "Open as …" links imply.
 */
export default function Login({
  onLoggedIn,
  onRegister,
  onBack,
  onForgot,
  initialUsername,
}: {
  onLoggedIn: (user: AuthUser) => void;
  onRegister: () => void;
  onBack: () => void;
  onForgot: () => void;
  initialUsername?: string;
}) {
  const [username, setUsername] = useState(initialUsername ?? '');
  const [password, setPassword] = useState(initialUsername ? 'demo123' : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doLogin(u: string, p: string) {
    setError(null);
    setBusy(true);
    try {
      const user = await login(u.trim(), p);
      onLoggedIn(user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void doLogin(username, password);
  }

  return (
    <div className="pub-wrap">
      <header className="pub-header">
        <Logo onClick={onBack} />
      </header>
      <main
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '16px 32px 56px',
          display: 'flex',
          gap: 28,
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
        className="pub-main"
      >
        <form
          onSubmit={handleSubmit}
          className="card card-pad"
          style={{ flex: '1 1 380px', minWidth: 0 }}
        >
          <h1 style={{ margin: '0 0 20px', fontSize: 28 }}>Log in</h1>
          <span className="label">Email or index number</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input"
            style={{ marginBottom: 16 }}
          />
          <span className="label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
            style={{ marginBottom: 8 }}
          />
          <button type="button" className="text-link" style={{ fontSize: 14 }} onClick={onForgot}>
            Forgot password
          </button>
          <ErrorBanner error={error} />
          <div style={{ marginTop: 22 }}>
            <button type="submit" className="btn block" style={{ padding: 13 }} disabled={busy}>
              {busy ? 'Logging in…' : 'Log in'}
            </button>
          </div>
          <p style={{ margin: '16px 0 0', color: '#5c6488', fontSize: 14 }}>
            New school?{' '}
            <button type="button" className="text-link" onClick={onRegister}>
              Register your school
            </button>
          </p>
        </form>

        <div className="card" style={{ flex: '1 1 300px', minWidth: 0, padding: 26 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>Try the demo school</h2>
          <p style={{ margin: '0 0 18px', color: '#5c6488' }}>
            Look around with example data. Nothing here is a real school.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.username}
                type="button"
                className="btn secondary"
                disabled={busy}
                onClick={() => void doLogin(a.username, 'demo123')}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
