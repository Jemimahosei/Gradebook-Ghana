import { useState } from 'react';
import type { FormEvent } from 'react';
import { Logo } from '../components';

/**
 * Forgot password — mockup screen 22. The backend has no password-reset
 * endpoint and sends no email, so this is the mockup's UI with local
 * state only: submitting shows the "Check your email" state exactly as
 * the mockup does. Wiring it to real email needs a backend endpoint.
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

  function submit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div className="pub-wrap">
      <header className="pub-header">
        <Logo onClick={onBack} />
      </header>
      <main className="pub-main narrow">
        <div className="card card-pad">
          {!sent ? (
            <form onSubmit={submit}>
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
              <button type="submit" className="btn block">
                Send reset link
              </button>
              <p style={{ margin: '16px 0 0', color: '#5c6488', fontSize: 14 }}>
                Students have no email. Ask your school admin to reset your password.
              </p>
            </form>
          ) : (
            <>
              <h1 style={{ margin: '0 0 8px', fontSize: 28 }}>Check your email</h1>
              <p style={{ margin: '0 0 20px', color: '#5c6488' }}>
                If that email has an account, a reset link is on its way. It works for one hour.
              </p>
              <button type="button" className="btn secondary block" onClick={onLogin}>
                Back to log in
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
