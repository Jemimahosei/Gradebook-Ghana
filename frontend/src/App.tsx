import { useCallback, useEffect, useState } from 'react';
import { getStoredUser, logout, me } from './lib/api';
import type { AuthUser } from './lib/api';
import Login from './pages/Login';
import RegisterPage from './pages/RegisterPage';
import LandingPage from './pages/LandingPage';
import ForgotPassword from './pages/ForgotPassword';
import ChoosePassword from './pages/ChoosePassword';
import AdminDashboard from './pages/AdminDashboard';
import type { AdminTab } from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import type { TeacherTab } from './pages/TeacherDashboard';
import StudentDashboard from './pages/StudentDashboard';
import type { StudentView } from './pages/StudentDashboard';
import { ErrorBanner } from './components';
import { getStoredBrand } from './theme';
import './App.css';

type LoggedOutView = 'landing' | 'login' | 'register' | 'forgot' | 'choose';

const ADMIN_NAV: { key: AdminTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'classes', label: 'Classes and subjects' },
  { key: 'students', label: 'Students' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'assignments', label: 'Assignments' },
  { key: 'terms', label: 'Terms' },
  { key: 'scales', label: 'Grading scale' },
  { key: 'school', label: 'School profile' },
];

const ADMIN_PHONE_NAV: { key: AdminTab; label: string }[] = [
  { key: 'dashboard', label: 'Home' },
  { key: 'students', label: 'Students' },
  { key: 'teachers', label: 'Teachers' },
  { key: 'classes', label: 'Classes' },
  { key: 'more', label: 'More' },
];

const TEACHER_NAV: { key: TeacherTab; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'marks', label: 'Marks' },
  { key: 'myclass', label: 'My Class' },
  { key: 'rankings', label: 'Rankings' },
];

const STUDENT_NAV: { key: StudentView; label: string }[] = [
  { key: 'results', label: 'Results' },
  { key: 'report', label: 'Report card' },
];

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [view, setView] = useState<LoggedOutView>('landing');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [brand, setBrand] = useState<string>(() => getStoredBrand());
  const [adminTab, setAdminTab] = useState<AdminTab>('dashboard');
  const [teacherTab, setTeacherTab] = useState<TeacherTab>('dashboard');
  const [studentView, setStudentView] = useState<StudentView>('results');

  // Sessions stored before the multi-school upgrade have no school info —
  // hydrate it once from /api/auth/me so the header shows the right school.
  useEffect(() => {
    if (user && !user.schoolName) {
      me()
        .then(setUser)
        .catch(() => {
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

  const brandStyle = { ['--brand' as string]: brand };

  if (!user) {
    return (
      <div style={brandStyle}>
        {sessionNotice && (
          <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem 1rem 0' }}>
            <ErrorBanner error={sessionNotice} onDismiss={() => setSessionNotice(null)} />
          </div>
        )}
        {view === 'landing' && (
          <LandingPage onLogin={() => setView('login')} onRegister={() => setView('register')} />
        )}
        {view === 'login' && (
          <Login
            onLoggedIn={(u) => {
              setUser(u);
              setSessionNotice(null);
            }}
            onRegister={() => setView('register')}
            onBack={() => setView('landing')}
            onForgot={() => setView('forgot')}
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
            onBrand={setBrand}
          />
        )}
        {view === 'forgot' && (
          <ForgotPassword onBack={() => setView('landing')} onLogin={() => setView('login')} />
        )}
        {view === 'choose' && (
          <ChoosePassword
            name="there"
            onDone={() => setView('login')}
            onBack={() => setView('landing')}
          />
        )}
      </div>
    );
  }

  const schoolName = user.schoolName ?? 'Gradebook Ghana';
  const isDemo = user.demoSchool ?? false;
  const initial = schoolName.charAt(0).toUpperCase();
  const roleLine =
    user.role === 'ADMIN'
      ? 'Administrator'
      : user.role === 'TEACHER'
        ? `Teacher: ${user.name}`
        : `Student: ${user.name}`;

  const navItems =
    user.role === 'ADMIN'
      ? ADMIN_NAV.map((n) => ({
          key: n.key as string,
          label: n.label,
          active: adminTab === n.key,
          go: () => setAdminTab(n.key),
        }))
      : user.role === 'TEACHER'
        ? TEACHER_NAV.map((n) => ({
            key: n.key as string,
            label: n.label,
            active: teacherTab === n.key,
            go: () => setTeacherTab(n.key),
          }))
        : STUDENT_NAV.map((n) => ({
            key: n.key as string,
            label: n.label,
            active: studentView === n.key,
            go: () => setStudentView(n.key),
          }));

  const phoneItems =
    user.role === 'ADMIN'
      ? ADMIN_PHONE_NAV.map((n) => ({
          key: n.key as string,
          label: n.label,
          active: adminTab === n.key || (n.key === 'more' && adminTab === 'more'),
          go: () => setAdminTab(n.key),
        }))
      : user.role === 'TEACHER'
        ? TEACHER_NAV.map((n) => ({
            key: n.key as string,
            label: n.key === 'dashboard' ? 'Home' : n.label,
            active: teacherTab === n.key,
            go: () => setTeacherTab(n.key),
          }))
        : STUDENT_NAV.map((n) => ({
            key: n.key as string,
            label: n.label,
            active: studentView === n.key,
            go: () => setStudentView(n.key),
          }));

  return (
    <div style={brandStyle}>
      <div className="phone-bar">
        <div className="avatar">{initial}</div>
        <strong>{schoolName}</strong>
      </div>
      <div className="shell">
        <aside className="rail">
          <div className="rail-avatar">{initial}</div>
          <button type="button" className="rail-logout" onClick={handleLogout}>
            Log out
          </button>
        </aside>
        <aside className="sidebar">
          <div className="sidebar-school">
            <div className="name">{schoolName}</div>
            <div className="role">{roleLine}</div>
          </div>
          <nav>
            {navItems.map((n) => (
              <button
                key={n.key}
                type="button"
                className={n.active ? 'nav-item active' : 'nav-item'}
                onClick={n.go}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="main">
          {user.role === 'ADMIN' && (
            <AdminDashboard
              tab={adminTab}
              onTab={setAdminTab}
              onSessionExpired={handleSessionExpired}
              onBrand={setBrand}
              onLogout={handleLogout}
            />
          )}
          {user.role === 'TEACHER' && (
            <TeacherDashboard
              user={user}
              tab={teacherTab}
              onTab={setTeacherTab}
              onSessionExpired={handleSessionExpired}
            />
          )}
          {user.role === 'STUDENT' && (
            <StudentDashboard
              user={user}
              view={studentView}
              onView={setStudentView}
              onSessionExpired={handleSessionExpired}
            />
          )}
          <footer
            style={{
              textAlign: 'center',
              padding: '2rem 1rem 0',
              color: '#5c6488',
              fontSize: 13,
            }}
          >
            {isDemo
              ? 'Demo application — seeded demo data only, not a real school.'
              : 'Gradebook Ghana — a free community project for Ghanaian senior high schools, built by Jemimah Osei.'}
          </footer>
        </main>
      </div>
      <nav className="phone-nav">
        {phoneItems.map((n) => (
          <button
            key={n.key}
            type="button"
            className={n.active ? 'active' : undefined}
            onClick={n.go}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
