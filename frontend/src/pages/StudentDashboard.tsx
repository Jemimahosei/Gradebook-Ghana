import { useEffect, useState } from 'react';
import { formatAverage, studentApi } from '../lib/api';
import type { AuthUser, StudentDashboard as StudentDashboardData, StudentResult } from '../lib/api';
import { Card, Empty, ErrorBanner, Loading, errorText, isUnauthorized } from '../components';

/**
 * Student dashboard — own published grades only. Shows the overall average,
 * class rank (1224 ranking, ties share a rank), class size, per-subject
 * averages, the published result history with the 30/70 split, and PDF/CSV
 * report-card downloads.
 */
export default function StudentDashboard({
  user,
  onSessionExpired,
}: {
  user: AuthUser;
  onSessionExpired: () => void;
}) {
  const [dashboard, setDashboard] = useState<StudentDashboardData | null>(null);
  const [results, setResults] = useState<StudentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<'pdf' | 'csv' | null>(null);

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
  if (!dashboard) return <Empty text="No dashboard data available." />;

  const rankText =
    dashboard.classRank !== null && dashboard.classSize > 0
      ? `${dashboard.classRank} of ${dashboard.classSize}`
      : '—';

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      <h2>
        {dashboard.student.fullName} — {dashboard.className ?? '—'}
      </h2>
      <p className="muted">
        Index number {dashboard.student.indexNumber} · Semester {dashboard.semester} · Signed in
        as {user.name}
      </p>
      <div className="stats-grid">
        <Card title="Overall average" value={formatAverage(dashboard.overallAverage)} />
        <Card
          title="Class rank"
          value={rankText}
          sub="Ties share a rank (1224). Students with no grades are excluded."
        />
        <Card
          title="Class size"
          value={dashboard.classSize > 0 ? String(dashboard.classSize) : '—'}
        />
      </div>

      <h2>Per-subject averages</h2>
      {dashboard.subjectAverages.length === 0 ? (
        <Empty text="No published grades yet — your teacher has not published marks for this term." />
      ) : (
        <div className="subject-cards">
          {dashboard.subjectAverages.map((s) => (
            <div className="subject-card" key={s.subject}>
              <div className="subject-name">{s.subject}</div>
              <div className="subject-average">{formatAverage(s.average)}</div>
              <div className="subject-letter">{s.letter ?? '—'}</div>
            </div>
          ))}
        </div>
      )}

      <h2>Published results</h2>
      {results.length === 0 ? (
        <Empty text="No published results yet." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Class work (30%)</th>
                <th>Exam (70%)</th>
                <th>Total</th>
                <th>Grade</th>
                <th>Remark</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.subject}>
                  <td>{r.subject}</td>
                  <td>{r.classScore === null ? '—' : r.classScore}</td>
                  <td>{r.examScore === null ? '—' : r.examScore}</td>
                  <td>
                    <strong>{r.total === null ? '—' : r.total.toFixed(2)}</strong>
                  </td>
                  <td>{r.letter ?? '—'}</td>
                  <td>{r.remark ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Report card</h2>
      <div className="form-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={downloading !== null || results.length === 0}
          onClick={() => void download('pdf')}
        >
          {downloading === 'pdf' ? 'Downloading…' : 'Download PDF report card'}
        </button>
        <button
          type="button"
          disabled={downloading !== null || results.length === 0}
          onClick={() => void download('csv')}
        >
          {downloading === 'csv' ? 'Downloading…' : 'Download CSV report card'}
        </button>
      </div>
      {results.length === 0 && (
        <p className="small">Downloads unlock once your teacher publishes grades.</p>
      )}
    </div>
  );
}
