import { useState } from 'react';
import type { FormEvent } from 'react';
import { registerSchool } from '../lib/api';
import type { AuthUser } from '../lib/api';
import { ErrorBanner, Logo, errorText } from '../components';
import { SCHOOL_COLOURS, getStoredBrand, storeBrand, storeCrest, storeMotto } from '../theme';

const REGIONS = [
  'Eastern',
  'Ashanti',
  'Greater Accra',
  'Central',
  'Volta',
  'Western',
  'Western North',
  'Bono',
  'Bono East',
  'Ahafo',
  'Northern',
  'North East',
  'Savannah',
  'Upper East',
  'Upper West',
  'Oti',
] as const;

const SCHOOL_TYPES = ['Senior high school', 'Junior high school', 'Primary school'] as const;

/**
 * Register your school — mockup screen 02, including the school-colour
 * picker and the live preview aside. The API contract has no colour,
 * motto, crest or school-type fields, so those four are kept on this
 * device (localStorage) and applied as the app theme; name, town,
 * region, contact name, email and password go to the API as before.
 */
export default function RegisterPage({
  onRegistered,
  onLogin,
  onBack,
  onBrand,
}: {
  onRegistered: (user: AuthUser) => void;
  onLogin: () => void;
  onBack: () => void;
  onBrand: (colour: string) => void;
}) {
  const [schoolName, setSchoolName] = useState('');
  const [town, setTown] = useState('');
  const [region, setRegion] = useState<string>('Eastern');
  const [schoolType, setSchoolType] = useState<string>(SCHOOL_TYPES[0]);
  const [colour, setColour] = useState<string>(getStoredBrand());
  const [motto, setMotto] = useState('');
  const [crest, setCrest] = useState(false);
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const shown = schoolName.trim() || 'Your school name';
  const initial = shown.charAt(0).toUpperCase();

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
        region: `${region} Region`,
        contactName: contactName.trim(),
        email: email.trim(),
        password,
      });
      storeBrand(colour);
      storeMotto(motto.trim());
      storeCrest(crest);
      onBrand(colour);
      onRegistered(user);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pub-wrap" style={{ ['--brand' as string]: colour }}>
      <header className="pub-header">
        <Logo onClick={onBack} />
        <button type="button" className="text-link" style={{ fontSize: 15 }} onClick={onLogin}>
          Log in
        </button>
      </header>
      <main
        className="pub-main"
        style={{ display: 'flex', gap: 36, flexWrap: 'wrap', alignItems: 'flex-start' }}
      >
        <form
          onSubmit={handleSubmit}
          className="card card-pad"
          style={{ flex: '1 1 520px', minWidth: 0 }}
        >
          <h1 style={{ margin: '0 0 4px', fontSize: 28 }}>Register your school</h1>
          <p style={{ margin: '0 0 24px', color: '#5c6488' }}>
            Takes about two minutes. Gradebook then looks like your school.
          </p>

          <div className="form-grid">
            <div>
              <span className="label">School name</span>
              <input
                className="input"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
            </div>
            <div>
              <span className="label">Town</span>
              <input
                className="input"
                value={town}
                onChange={(e) => setTown(e.target.value)}
                required
                placeholder="Koforidua"
              />
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 24 }}>
            <div>
              <span className="label">Region</span>
              <select
                className="input"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">School type</span>
              <select
                className="input"
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value)}
              >
                {SCHOOL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <span className="label">School colour</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {SCHOOL_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label="School colour"
                  className="swatch"
                  onClick={() => setColour(c)}
                  style={{
                    background: c,
                    boxShadow: `0 0 0 2px ${c === colour ? '#1d2347' : 'transparent'}`,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 24 }}>
            <div>
              <span className="label">School motto</span>
              <input
                className="input"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <span className="label">Crest or logo</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => setCrest((v) => !v)}
                >
                  {crest ? 'Remove crest' : 'Upload an image'}
                </button>
                <span style={{ color: '#5c6488', fontSize: 14 }}>
                  {crest ? 'Crest added' : 'PNG or JPG, square works best'}
                </span>
              </div>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 24 }}>
            <div>
              <span className="label">Your name</span>
              <input
                className="input"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
                placeholder="Headmaster or administrator"
              />
            </div>
            <div>
              <span className="label">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@school.edu.gh"
              />
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: 26 }}>
            <div>
              <span className="label">Password</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div>
              <span className="label">Confirm password</span>
              <input
                className="input"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          </div>

          <ErrorBanner error={error} />
          <button
            type="submit"
            className="btn"
            style={{ background: colour, padding: '13px 28px', fontSize: 16, minHeight: 0 }}
            disabled={busy}
          >
            {busy ? 'Creating…' : 'Create my school'}
          </button>
        </form>

        <aside style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div style={{ color: '#5c6488', fontSize: 14, marginBottom: 10 }}>
            Preview of your school
          </div>
          <div
            className="card"
            style={{ overflow: 'hidden', boxShadow: '0 14px 34px rgba(29,35,71,.1)' }}
          >
            <div style={{ display: 'flex', minHeight: 300 }}>
              <div
                style={{
                  flex: '0 0 62px',
                  background: colour,
                  display: 'flex',
                  justifyContent: 'center',
                  paddingTop: 14,
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: colour,
                  }}
                >
                  {crest ? (
                    <svg viewBox="0 0 40 40" width="26" height="26" aria-hidden="true">
                      <path
                        d="M20 3l15 5v11c0 9-6.5 15-15 18C11.5 34 5 28 5 19V8z"
                        fill={colour}
                      />
                      <path
                        d="M13 16h14M13 21h14M20 11v17"
                        stroke="#fff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                    </svg>
                  ) : (
                    initial
                  )}
                </div>
              </div>
              <div style={{ flex: 1, padding: 18, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{shown}</div>
                <div style={{ color: '#5c6488', fontSize: 13, marginBottom: 14 }}>Dashboard</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div
                    style={{
                      flex: 1,
                      border: '1px solid #dde0ee',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ height: 46, background: colour }} />
                    <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>2 Arts 1</div>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      border: '1px solid #dde0ee',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    <div style={{ height: 46, background: colour, opacity: 0.7 }} />
                    <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600 }}>
                      3 Science 4
                    </div>
                  </div>
                </div>
                <div style={{ marginTop: 16 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      background: colour,
                      color: '#fff',
                      borderRadius: 6,
                      padding: '7px 14px',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    Save marks
                  </span>
                </div>
              </div>
            </div>
          </div>
          <p style={{ color: '#5c6488', fontSize: 14 }}>
            Your teachers and students see this colour, name and crest.
          </p>
        </aside>
      </main>
    </div>
  );
}
