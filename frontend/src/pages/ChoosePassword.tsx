import { useState } from 'react';
import type { FormEvent } from 'react';
import { changePassword } from '../lib/api';
import { Logo, errorText } from '../components';

/**
 * First log in: choose password — mockup screen 21. Shown when the
 * login response flags the account with mustChangePassword (every
 * admin-issued temporary password). Saving posts to
 * POST /api/auth/change-password, which clears the flag server-side.
 */
export default function ChoosePassword({
  name,
  onDone,
  onBack,
}: {
  name: string;
  onDone: () => void;
  onBack: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
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
      await changePassword(password);
      onDone();
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
          <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>Choose your own password</h1>
          <p style={{ margin: '0 0 20px', color: '#5c6488' }}>
            Welcome, {name}. Your temporary password works only once. Pick one you will remember.
          </p>
          <form onSubmit={submit}>
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
            <p style={{ margin: '0 0 20px', color: '#5c6488', fontSize: 14 }}>
              Use at least 8 characters.
            </p>
            {error && (
              <p style={{ color: '#c0392b', fontSize: 14, margin: '0 0 12px' }}>{error}</p>
            )}
            <button type="submit" className="btn block" disabled={busy}>
              {busy ? 'Saving…' : 'Save password and continue'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
