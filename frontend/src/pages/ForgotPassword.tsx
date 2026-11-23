import { useState } from 'react';
import type { FormEvent } from 'react';
import { forgotPassword, resetPassword } from '../lib/api';
import { Logo, errorText } from '../components';

/**
 * Forgot password — mockup screen 22, wired to the real flow:
 * POST /api/auth/forgot-password creates a one-hour reset token and
 * delivers the link (by email when the server has mail configured;
 * the token can also be pasted here directly). The second step posts
 * the token + new password to /api/auth/reset-password.
 * Students have no email — their admin resets them from the Students page.
 */
export default function ForgotPassword({
  onBack,
  onLogin,
}: {
  onBack: () => void;
  onLogin: () => void;
}) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function doReset(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pub-wrap">
      <header className="pub-header">
        <Logo onClick={onBack} />
      </header>
      <main className="pub-main narrow">
        <div className="card card-pad">
          {done ? (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>Password changed</h1>
              <p style={{ margin: '0 0 20px', color: '#5c6488' }}>
                Your new password is set. Log in with it now.
              </p>
              <button type="button" className="btn block" onClick={onLogin}>
                Back to log in
              </button>
            </>
          ) : !sent ? (
            <form onSubmit={sendLink}>
              <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>Reset your password</h1>
              <p style={{ margin: '0 0 20px', color: '#5c6488' }}>
                Enter your email. We send you a link to choose a new one.
              </p>
              <span className="label">Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input"
                style={{ marginBottom: 20 }}
              />
              {error && (
                <p style={{ color: '#c0392b', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
              )}
              <button type="submit" className="btn block" disabled={busy}>
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <p style={{ margin: '16px 0 0', color: '#5c6488', fontSize: 14 }}>
                Students have no email. Ask your school admin to reset your password.
              </p>
            </form>
          ) : (
            <form onSubmit={doReset}>
              <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>Check your email</h1>
              <p style={{ margin: '0 0 20px', color: '#5c6488' }}>
                If that email has an account, a reset link is on its way. It works for one hour.
                Open the link, or paste the reset code from it here.
              </p>
              <span className="label">Reset code</span>
              <input
                type="text"
                autoComplete="one-time-code"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                className="input"
                style={{ marginBottom: 16 }}
              />
              <span className="label">New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                style={{ marginBottom: 16 }}
              />
              <span className="label">Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="input"
                style={{ marginBottom: 8 }}
              />
              {error && (
                <p style={{ color: '#c0392b', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
              )}
              <button type="submit" className="btn block" disabled={busy} style={{ marginTop: 12 }}>
                {busy ? 'Saving…' : 'Save new password'}
              </button>
              <button
                type="button"
                className="btn secondary block"
                onClick={onLogin}
                style={{ marginTop: 10 }}
              >
                Back to log in
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
