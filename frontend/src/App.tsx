import { useCallback, useState } from 'react';
import { getStoredUser, logout } from './lib/api';
import type { AuthUser } from './lib/api';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import { ErrorBanner } from './components';
import './App.css';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const handleSessionExpired = useCallback(() => {
    logout();
    setUser(null);
    setSessionNotice('Your session expired. Please log in again.');
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
  }

  if (!user) {
    return (
      <>
        {sessionNotice && (
          <div className="top-notice">
            <ErrorBanner error={sessionNotice} onDismiss={() => setSessionNotice(null)} />
          </div>
        )}
        <Login
          onLoggedIn={(u) => {
            setUser(u);
            setSessionNotice(null);
          }}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">Gradebook Ghana</div>
          <div className="brand-sub">Demo Senior High School</div>
        </div>
        <div className="header-user">
          <span>
            {user.name} · {user.role}
          </span>
          <button type="button" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        {user.role === 'ADMIN' && <AdminDashboard onSessionExpired={handleSessionExpired} />}
        {user.role === 'TEACHER' && (
          <TeacherDashboard user={user} onSessionExpired={handleSessionExpired} />
        )}
        {user.role === 'STUDENT' && (
          <StudentDashboard user={user} onSessionExpired={handleSessionExpired} />
        )}
      </main>
      <footer className="app-footer">
        <small>Demo application — seeded demo data only, not a real school.</small>
      </footer>
    </div>
  );
}
