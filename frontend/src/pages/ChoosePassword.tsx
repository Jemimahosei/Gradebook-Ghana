import { useState } from 'react';
import type { FormEvent } from 'react';
import { Logo } from '../components';

/**
 * First log in: choose password — mockup screen 21. The backend has no
 * change-password endpoint and the login response carries no
 * "must change password" flag, so this screen is implemented with local
 * state only (see redesign notes): it validates and confirms exactly as
 * the mockup presents it, but cannot yet persist the new password.
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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    onDone();
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
            <button type="submit" className="btn block">
              Save password and continue
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
