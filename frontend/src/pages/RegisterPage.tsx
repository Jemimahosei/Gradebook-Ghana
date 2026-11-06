import { useState } from 'react';
import type { FormEvent } from 'react';
import { registerSchool } from '../lib/api';
import type { AuthUser } from '../lib/api';
import { ErrorBanner, Field, errorText } from '../components';

/**
 * Public school signup. Creates the school plus its first admin account
 * and logs the admin straight in — the new school starts with the
 * standard WAEC grading scale and subject list already filled in.
 */
export default function RegisterPage({
  onRegistered,
  onLogin,
  onBack,
}: {
  onRegistered: (user: AuthUser) => void;
  onLogin: () => void;
  onBack: () => void;
}) {
  const [schoolName, setSchoolName] = useState('');
  const [town, setTown] = useState('');
  const [region, setRegion] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const user = await registerSchool({
        schoolName: schoolName.trim(),
        town: town.trim(),
        region: region.trim(),
        contactName: contactName.trim(),
        email: email.trim(),
        password,
      });
      onRegistered(user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <h1>Register your school</h1>
        <p className="muted">
          Free — no fees, now or later. Your school gets its own gradebook, and the contact
          person below becomes the school admin.
        </p>
        <form onSubmit={handleSubmit} className="form-stack">
          <Field label="School name">
            <input
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              required
              placeholder="e.g. Kumasi Senior High School"
            />
          </Field>
          <Field label="Town">
            <input
              value={town}
              onChange={(e) => setTown(e.target.value)}
              required
              placeholder="e.g. Kumasi"
            />
          </Field>
          <Field label="Region">
            <input
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
              placeholder="e.g. Ashanti Region"
            />
          </Field>
          <Field label="Contact person — full name">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
              placeholder="The school admin's name"
            />
          </Field>
          <Field label="Contact person — email" hint="This becomes the admin login.">
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@yourschool.edu.gh"
            />
          </Field>
          <Field label="Password" hint="At least 6 characters.">
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>
          <Field label="Confirm password">
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </Field>
          <ErrorBanner error={error} />
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Registering…' : 'Register school'}
          </button>
        </form>
        <p className="small" style={{ marginTop: '1rem' }}>
          Already registered?{' '}
          <button type="button" className="link-button" onClick={onLogin}>
            Log in
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
