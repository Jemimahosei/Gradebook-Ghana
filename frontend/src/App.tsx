import { useCallback, useEffect, useState } from 'react';
import { getStoredUser, logout, me } from './lib/api';
import type { AuthUser } from './lib/api';
import Login from './pages/Login';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import { ErrorBanner } from './components';
import './App.css';

type LoggedOutView = 'landing' | 'login' | 'register';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [view, setView] = useState<LoggedOutView>('landing');
  const [demoFill, setDemoFill] = useState<string | undefined>(undefined);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  // Sessions stored before the multi-school upgrade have no school info —
  // hydrate it once from /api/auth/me so the header shows the right school.
  useEffect(() => {
    if (user && !user.schoolName) {
      me()
        .then(setUser)
        .catch(() => {
          // Token genuinely expired: the api interceptor already cleared it.
          const stored = getStoredUser();
          setUser(stored);
          if (!stored) {
            setView('login');
            setSessionNotice('Your session expired. Please log in again.');
          }
        });
    }
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSessionExpired = useCallback(() => {
    logout();
    setUser(null);
    setView('login');
    setSessionNotice('Your session expired. Please log in again.');
  }, []);

  function handleLogout() {
    logout();
    setUser(null);
    setView('landing');
  }

  if (!user) {
    return (
      <>
        {sessionNotice && (
          <div className="top-notice">
            <ErrorBanner error={sessionNotice} onDismiss={() => setSessionNotice(null)} />
          </div>
        )}
        {view === 'landing' && (
          <LandingPage
            onLogin={() => setView('login')}
            onRegister={() => setView('register')}
            onTryDemo={(username) => {
              setDemoFill(username);
              setView('login');
            }}
          />
        )}
        {view === 'login' && (
          <Login
            key={demoFill ?? 'login'}
            initialUsername={demoFill}
            onLoggedIn={(u) => {
              setUser(u);
              setSessionNotice(null);
            }}
            onRegister={() => setView('register')}
            onBack={() => setView('landing')}
          />
        )}
        {view === 'register' && (
          <RegisterPage
            onRegistered={(u) => {
              setUser(u);
              setSessionNotice(null);
            }}
            onLogin={() => setView('login')}
            onBack={() => setView('landing')}
          />
        )}
      </>
    );
  }

  const schoolName = user.schoolName ?? 'Gradebook Ghana';
  const isDemo = user.demoSchool ?? false;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="brand">Gradebook Ghana</div>
          <div className="brand-sub">{schoolName}</div>
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
        {isDemo ? (
          <small>Demo application — seeded demo data only, not a real school.</small>
        ) : (
          <small>
            Gradebook Ghana — a free community project for Ghanaian senior high schools, built by
            Jemimah Osei.
          </small>
        )}
      </footer>
    </div>
  );
}
