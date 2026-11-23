import { useEffect, useState } from 'react';
import { studentApi } from '../lib/api';
import type { AuthUser, StudentDashboard as StudentDashboardData, StudentResult } from '../lib/api';
import { EmptyState, ErrorBanner, GradeChip, Loading, PageHead, errorText, isUnauthorized } from '../components';

export type StudentView = 'results' | 'report';

/**
 * Student portal — mockup screens 14, 15, 17, 26.
 * Results: term select, average / position / best-subject stats and the
 * published results table. Report card: the terminal-report card with
 * the school crest initial, results table, average and signature lines;
 * downloads go through the existing PDF/CSV endpoints.
 */
export default function StudentDashboard({
  user,
  view,
  onView,
  onSessionExpired,
}: {
  user: AuthUser;
  view: StudentView;
  onView: (v: StudentView) => void;
  onSessionExpired: () => void;
}) {
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);
  const [term, setTerm] = useState('Term 1');

  useEffect(() => {
    Promise.all([studentApi.dashboard(), studentApi.results()])
      .then(([d, r]) => {
        setDashboard(d);
        setResults(r);
      })
      .catch((err: unknown) => {
        if (isUnauthorized(err)) onSessionExpired();
        else setError(errorText(err));
      })
      .finally(() => setLoading(false));
  }, [onSessionExpired]);

  async function download(format: 'pdf' | 'csv') {
    setDownloading(format);
    setError(null);
    try {
      await studentApi.reportCard(format);
    } catch (err) {
      if (isUnauthorized(err)) onSessionExpired();
      else setError(errorText(err));
    } finally {
      setDownloading(null);
    }
  }

  if (loading) return <Loading />;
  if (!dashboard)
    return (
      <div>
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <EmptyState title="No results yet" text="No dashboard data available." />
      </div>
    );

  const published = results.filter((r) => r.published);
  const best = published.reduce<StudentResult | null>(
    (acc, r) => (r.total !== null && (acc === null || acc.total === null || r.total > acc.total) ? r : acc),
    null,
  );
  const schoolName = user.schoolName ?? 'Gradebook Ghana';

  const resultsTable = (compact: boolean, hideMobile = false) => (
    <div className={hideMobile ? 'tbl hide-mobile' : 'tbl'}>
      <div className="tbl-head" style={compact ? { padding: '9px 16px' } : undefined}>
        <div style={{ flex: 3 }}>Subject</div>
        <div style={{ flex: 1, textAlign: 'right' }}>Class work</div>
        <div style={{ flex: 1, textAlign: 'right' }}>Exam</div>
        <div style={{ flex: 1, textAlign: 'right' }}>Total</div>
        <div style={{ flex: 1, textAlign: 'center' }}>Grade</div>
        <div style={{ flex: 1.4 }}>Remark</div>
      </div>
      {published.map((r) => (
        <div key={r.subject} className="tbl-row" style={compact ? { padding: '9px 16px' } : undefined}>
          <div style={{ flex: 3 }}>
            <strong>{r.subject}</strong>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <span className="num">{r.classScore ?? '—'}</span>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <span className="num">{r.examScore ?? '—'}</span>
          </div>
          <div style={{ flex: 1, textAlign: 'right' }}>
            <span className="num" style={{ fontWeight: 700 }}>
              {r.total === null ? '—' : r.total.toFixed(1)}
            </span>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <GradeChip letter={r.letter} />
          </div>
          <div style={{ flex: 1.4 }}>{r.remark ?? '—'}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {view === 'results' && (
        <div>
          <PageHead crumb="Student / Results" title="My results">
            <button type="button" className="btn" onClick={() => onView('report')}>
              Download report card
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={downloading !== null || published.length === 0}
              onClick={() => void download('csv')}
            >
              {downloading === 'csv' ? 'Downloading…' : 'Download CSV'}
            </button>
          </PageHead>
          <div
            style={{
              display: 'flex',
              gap: 24,
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              marginBottom: 20,
            }}
          >
            <div style={{ flex: '0 1 160px' }}>
              <span className="label">Term</span>
              <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </div>
            <div className="stat-inline" style={{ gap: 36 }}>
              <div>
                <span className="value num">
                  {dashboard.overallAverage === null ? '—' : dashboard.overallAverage.toFixed(1)}
                </span>{' '}
                <span className="unit">average</span>
              </div>
              <div>
                <span className="value num">
                  {dashboard.classRank !== null && dashboard.classSize > 0
                    ? `${dashboard.classRank} of ${dashboard.classSize}`
                    : '—'}
                </span>{' '}
                <span className="unit">position in class</span>
              </div>
              {best && (
                <div>
                  <span className="value">{best.subject}</span>{' '}
                  <span className="unit">best subject</span>
                </div>
              )}
            </div>
          </div>
          {published.length === 0 ? (
            <EmptyState
              title="No published results yet"
              text="Your teacher has not published marks for this term. Results appear here once they are published."
            />
          ) : (
            <>
              {resultsTable(false, true)}
              <div className="m-cards">
                <div className="small" style={{ marginBottom: 10 }}>
                  {term}, position{' '}
                  {dashboard.classRank !== null && dashboard.classSize > 0
                    ? `${dashboard.classRank} of ${dashboard.classSize}`
                    : '—'}
                </div>
                {published.map((r) => (
                  <div key={r.subject} className="m-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span>
                        <strong>{r.subject}</strong>
                        <span style={{ display: 'block', color: '#5c6488', fontSize: 13 }}>
                          {r.remark ?? ''}
                        </span>
                      </span>
                      <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="num" style={{ fontWeight: 700 }}>
                          {r.total === null ? '—' : r.total.toFixed(1)}
                        </span>
                        <GradeChip letter={r.letter} />
                      </span>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn block"
                  disabled={downloading !== null}
                  onClick={() => void download('pdf')}
                >
                  {downloading === 'pdf' ? 'Downloading…' : 'Download report card'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {view === 'report' && (
        <div>
          <PageHead crumb="Student / Report card" title="Report card">
            <button
              type="button"
              className="btn"
              disabled={downloading !== null || published.length === 0}
              onClick={() => void download('pdf')}
            >
              {downloading === 'pdf' ? 'Downloading…' : 'Download PDF'}
            </button>
          </PageHead>
          <div className="card" style={{ maxWidth: 760, padding: '34px 40px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                borderBottom: '3px solid var(--brand)',
                paddingBottom: 16,
                marginBottom: 18,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--brand)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Fraunces, Georgia, serif',
                  fontWeight: 600,
                  fontSize: 30,
                  flex: 'none',
                }}
              >
                {schoolName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 600, fontSize: 24 }}>
                  {schoolName}
                </div>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>
                  Terminal report, {dashboard.semester}
                </div>
                <div>
                  {dashboard.student.fullName}, {dashboard.className ?? '—'}
                </div>
              </div>
              <div style={{ textAlign: 'right', color: '#5c6488' }}>
                Index number {dashboard.student.indexNumber}
                <br />
                Position{' '}
                {dashboard.classRank !== null && dashboard.classSize > 0
                  ? `${dashboard.classRank} of ${dashboard.classSize}`
                  : '—'}
              </div>
            </div>
            {published.length === 0 ? (
              <p className="muted">No published results yet — the report card fills in once your teacher publishes.</p>
            ) : (
              <>
                {resultsTable(true)}
                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '18px 0 28px' }}>
                  <strong>Average</strong>
                  <strong className="num">
                    {dashboard.overallAverage === null ? '—' : dashboard.overallAverage.toFixed(1)}
                  </strong>
                </div>
                <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                  <div
                    style={{
                      flex: '1 1 220px',
                      borderTop: '1px solid #9aa0bd',
                      paddingTop: 6,
                      color: '#5c6488',
                      fontSize: 14,
                    }}
                  >
                    Class teacher
                  </div>
                  <div
                    style={{
                      flex: '1 1 220px',
                      borderTop: '1px solid #9aa0bd',
                      paddingTop: 6,
                      color: '#5c6488',
                      fontSize: 14,
                    }}
                  >
                    Headmaster
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
