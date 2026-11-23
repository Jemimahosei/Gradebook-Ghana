import { Logo } from '../components';
import { gradeBand } from '../theme';

/**
 * Public landing page — mockup screen 01 ("Landing").
 * Hero: "Report cards in minutes, not weeks." with a live-looking marks
 * card and a floating position card; below, one column per role.
 */
const HERO_ROWS = [
  { name: 'Ama Boateng', cw: 72, ex: 81 },
  { name: 'Kofi Mensah', cw: 90, ex: 94 },
  { name: 'Esi Owusu', cw: 55, ex: 48 },
  { name: 'Yaw Darko', cw: 64, ex: 70 },
] as const;

export default function LandingPage({
  onLogin,
  onRegister,
}: {
  onLogin: () => void;
  onRegister: () => void;
}) {
  return (
    <div className="pub-wrap">
      <header className="pub-header">
        <Logo />
        <nav style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button type="button" className="btn secondary" onClick={onLogin}>
            Log in
          </button>
          <button type="button" className="btn" onClick={onRegister}>
            Register your school
          </button>
        </nav>
      </header>

      <section
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '56px 32px 40px',
          display: 'flex',
          gap: 56,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
        className="hero-section"
      >
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          <h1
            style={{
              fontFamily: 'Fraunces, Georgia, serif',
              fontWeight: 600,
              fontSize: 56,
              lineHeight: 1.08,
              margin: 0,
            }}
          >
            Report cards in minutes, not weeks.
          </h1>
          <p style={{ fontSize: 19, color: '#5c6488', margin: '20px 0 30px', maxWidth: '30em' }}>
            Type a mark and the total, grade and class position appear instantly. No adding up,
            no ranking by hand, no retyping.
          </p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn"
              style={{ padding: '14px 26px', fontSize: 17, minHeight: 0 }}
              onClick={onRegister}
            >
              Register your school
            </button>
            <button
              type="button"
              className="btn secondary"
              style={{ padding: '13px 24px', fontSize: 17, minHeight: 0 }}
              onClick={onLogin}
            >
              Log in
            </button>
          </div>
        </div>

        <div style={{ flex: '1 1 440px', minWidth: 0, position: 'relative', paddingBottom: 120 }}>
          <div className="card card-shadow" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', fontWeight: 700, borderBottom: '1px solid #dde0ee' }}>
              English Language, 2 Arts 1
            </div>
            <div
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                padding: '8px 14px',
                background: '#f4f5fa',
                color: '#5c6488',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              <div style={{ flex: 3 }}>Student</div>
              <div style={{ flex: 1 }}>Class work</div>
              <div style={{ flex: 1 }}>Exam</div>
              <div style={{ flex: 1 }}>Grade</div>
            </div>
            {HERO_ROWS.map((r) => {
              const total = Math.round((r.cw * 0.3 + r.ex * 0.7) * 100) / 100;
              const band = gradeBand(total);
              return (
                <div
                  key={r.name}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    padding: '9px 14px',
                    borderTop: '1px solid #e8eaf4',
                  }}
                >
                  <div style={{ flex: 3 }}>{r.name}</div>
                  <div style={{ flex: 1 }}>
                    <span className="num">{r.cw}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span className="num">{r.ex}</span>
                  </div>
                  <div style={{ flex: 1 }}>
                    <span
                      className="num"
                      style={{
                        display: 'inline-block',
                        minWidth: 34,
                        textAlign: 'center',
                        borderRadius: 6,
                        padding: '1px 8px',
                        fontWeight: 700,
                        fontSize: 14,
                        background: band.bg,
                      }}
                    >
                      {band.letter}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            className="card card-shadow"
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              padding: '14px 18px',
              width: 230,
            }}
          >
            <div style={{ color: '#5c6488', fontSize: 13 }}>Position in class</div>
            <div style={{ fontSize: 32, fontWeight: 700 }} className="num">
              3 of 38
            </div>
          </div>
        </div>
      </section>

      <section
        style={{
          maxWidth: 1160,
          margin: '0 auto',
          padding: '24px 32px 72px',
          display: 'flex',
          gap: 48,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Admins</div>
          <div style={{ color: '#5c6488' }}>Set up classes, subjects, teachers and students.</div>
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Teachers</div>
          <div style={{ color: '#5c6488' }}>Enter marks in a grid and see positions as you type.</div>
        </div>
        <div style={{ flex: '1 1 240px' }}>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Students</div>
          <div style={{ color: '#5c6488' }}>See results and download the report card.</div>
        </div>
      </section>
    </div>
  );
}
