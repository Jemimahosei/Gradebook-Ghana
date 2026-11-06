import { useCallback, useEffect, useState } from 'react';
import { teacherApi, weightedTotal } from '../lib/api';
import type { AuthUser, GradeRequest, MyClass, RankEntry, SubjectAssignment } from '../lib/api';
import { Empty, ErrorBanner, Loading, errorText, isUnauthorized } from '../components';

/**
 * Teacher dashboard — My Class grid, per-subject entry, and class rankings.
 *
 * Grading is WAEC A1–F9 with a 30% class-work / 70% exam split (the SHS
 * WAEC bands jem agreed Oct 12 and the Mac code implements: A1 90–100,
 * B2 80–89, B3 70–79, C4 60–69, C5 55–59, C6 50–54, D7 45–49, E8 40–44,
 * F9 0–39 — the same bands the backend enforces in WaecGrading and the
 * seeded grading-scale table). The semester is owned by the server — never
 * hardcoded here.
 */

function ghanaGrade(score: number): string {
  if (score >= 90) return 'A1';
  if (score >= 80) return 'B2';
  if (score >= 70) return 'B3';
  if (score >= 60) return 'C4';
  if (score >= 55) return 'C5';
  if (score >= 50) return 'C6';
  if (score >= 45) return 'D7';
  if (score >= 40) return 'E8';
  return 'F9';
}

function gradeColor(g: string): string {
  if (g.startsWith('A')) return '#5a8f00';
  if (g.startsWith('B')) return '#1a6fbf';
  if (g.startsWith('C')) return '#b8860b';
  if (g.startsWith('D') || g === 'E8') return '#cc6600';
  return '#cc2200';
}

type DraftCell = { classScore: string; examScore: string };
type Drafts = Record<number, Record<string, DraftCell>>;

function emptyCell(): DraftCell {
  return { classScore: '', examScore: '' };
}

function numOrNull(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export default function TeacherDashboard({
  user,
  onSessionExpired,
}: {
  user: AuthUser;
  onSessionExpired: () => void;
}) {
  const [tab, setTab] = useState<'class' | 'subjects' | 'rankings'>('class');
  const [classData, setClassData] = useState<MyClass | null>(null);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [mySubjects, setMySubjects] = useState<SubjectAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<SubjectAssignment | null>(null);
  const [subjectStudents, setSubjectStudents] = useState<
    { id: number; fullName: string; indexNumber: string }[]
  >([]);
  const [subjectDrafts, setSubjectDrafts] = useState<Record<number, DraftCell>>({});
  const [rankings, setRankings] = useState<RankEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const onFail = useCallback(
    (err: unknown) => {
      if (isUnauthorized(err)) onSessionExpired();
      else setError(errorText(err));
    },
    [onSessionExpired],
  );

  const loadClass = useCallback(() => {
    return teacherApi
      .myClass()
      .then((data) => {
        setClassData(data);
        const init: Drafts = {};
        (data.students ?? []).forEach((st) => {
          init[st.id] = {};
          Object.entries(st.gradeCells ?? {}).forEach(([subj, cell]) => {
            init[st.id][subj] = {
              classScore: cell.classScore === null ? '' : String(cell.classScore),
              examScore: cell.examScore === null ? '' : String(cell.examScore),
            };
          });
        });
        setDrafts(init);
      })
      .catch(onFail);
  }, [onFail]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadClass(), teacherApi.mySubjects().then(setMySubjects).catch(onFail)]).finally(() =>
      setLoading(false),
    );
  }, [loadClass, onFail]);

  // Rankings load lazily when the tab is opened.
  useEffect(() => {
    if (tab !== 'rankings' || rankings !== null) return;
    teacherApi
      .rankings()
      .then(setRankings)
      .catch((err: unknown) => {
        if (isUnauthorized(err)) onSessionExpired();
        else setRankings([]);
      });
  }, [tab, rankings, onSessionExpired]);

  // Per-subject entry: load the class roster + existing grades for the subject.
  useEffect(() => {
    if (!selectedAssignment) return;
    setSubjectStudents([]);
    setSubjectDrafts({});
    teacherApi
      .studentsByClass(selectedAssignment.classId)
      .then((students) => {
        setSubjectStudents(students);
        return teacherApi.allGrades();
      })
      .then((grades) => {
        const map: Record<number, DraftCell> = {};
        grades
          .filter((g) => g.subject === selectedAssignment.subjectName)
          .forEach((g) => {
            map[g.studentId] = {
              classScore: g.classScore === null ? '' : String(g.classScore),
              examScore: g.examScore === null ? '' : String(g.examScore),
            };
          });
        setSubjectDrafts(map);
      })
      .catch(onFail);
  }, [selectedAssignment, onFail]);

  function setDraft(studentId: number, subject: string, patch: Partial<DraftCell>) {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [subject]: { ...(prev[studentId]?.[subject] ?? emptyCell()), ...patch },
      },
    }));
  }

  /** Live average from the draft grid (mean of complete subject totals). */
  function liveAverage(studentId: number): number | null {
    if (!classData?.subjects) return null;
    const totals = classData.subjects
      .map((subj) => {
        const cell = drafts[studentId]?.[subj];
        if (!cell) return null;
        return weightedTotal(numOrNull(cell.classScore), numOrNull(cell.examScore));
      })
      .filter((t): t is number => t !== null);
    if (totals.length === 0) return null;
    return Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100;
  }

  function classBatch(): GradeRequest[] {
    const batch: GradeRequest[] = [];
    if (!classData?.subjects) return batch;
    classData.subjects.forEach((subj) => {
      (classData.students ?? []).forEach((st) => {
        const cell = drafts[st.id]?.[subj];
        if (!cell) return;
        const classScore = numOrNull(cell.classScore);
        const examScore = numOrNull(cell.examScore);
        if (classScore === null && examScore === null) return;
        batch.push({ studentId: st.id, subject: subj, classScore, examScore });
      });
    });
    return batch;
  }

  async function saveClassGrades() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const res = await teacherApi.saveGrades(classBatch());
      setNotice(`✓ Saved ${res.count} grade${res.count === 1 ? '' : 's'}.`);
      await loadClass();
    } catch (err) {
      onFail(err);
    } finally {
      setSaving(false);
    }
  }

  async function publishGrades() {
    setError(null);
    setNotice(null);
    setPublishing(true);
    try {
      const res = await teacherApi.publish();
      setNotice(`✓ Published ${res.count} grades — students can now view them.`);
      await loadClass();
    } catch (err) {
      onFail(err);
    } finally {
      setPublishing(false);
    }
  }

  async function saveSubjectGrades() {
    if (!selectedAssignment) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const batch: GradeRequest[] = Object.entries(subjectDrafts)
        .map(([studentId, cell]) => ({
          studentId: Number(studentId),
          subject: selectedAssignment.subjectName,
          classScore: numOrNull(cell.classScore),
          examScore: numOrNull(cell.examScore),
        }))
        .filter((r) => r.classScore !== null || r.examScore !== null);
      const res = await teacherApi.saveGrades(batch);
      setNotice(`✓ Saved ${res.count} grade${res.count === 1 ? '' : 's'} for ${selectedAssignment.subjectName}.`);
    } catch (err) {
      onFail(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading />;
  const isClassTeacher = classData?.isClassTeacher ?? false;

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {notice && <p className="success">{notice}</p>}

      <h2>
        Welcome, {user.name}
      </h2>
      {isClassTeacher && (
        <p className="muted">
          Class Teacher — {classData?.className} · {classData?.programme} · Semester{' '}
          {classData?.semester}
        </p>
      )}
      {!isClassTeacher && (
        <p className="muted">
          You are not assigned as a class teacher. Use My Subjects to enter marks for the
          classes you teach.
        </p>
      )}

      <div className="tabs">
        {isClassTeacher && (
          <button type="button" className={tab === 'class' ? 'tab active' : 'tab'} onClick={() => setTab('class')}>
            My Class — {classData?.className}
          </button>
        )}
        <button
          type="button"
          className={tab === 'subjects' ? 'tab active' : 'tab'}
          onClick={() => setTab('subjects')}
        >
          My Subjects
        </button>
        {isClassTeacher && (
          <button
            type="button"
            className={tab === 'rankings' ? 'tab active' : 'tab'}
            onClick={() => setTab('rankings')}
          >
            Rankings
          </button>
        )}
      </div>

      {tab === 'class' && isClassTeacher && (
        <div>
          <div className="form-actions" style={{ marginBottom: '1rem' }}>
            <button type="button" className="btn-primary" onClick={() => void saveClassGrades()} disabled={saving}>
              {saving ? 'Saving…' : 'Save Marks'}
            </button>
            <button type="button" onClick={() => void publishGrades()} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish Grades'}
            </button>
            <span className="small">
              Class work is 30%, exam is 70%. Totals and averages update as you type; save to
              persist. Publishing makes grades visible to students.
            </span>
          </div>
          {(classData?.students ?? []).length === 0 ? (
            <Empty text="No students in this class yet." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Index No.</th>
                    {(classData?.subjects ?? []).map((subj) => (
                      <th key={subj}>
                        {subj}
                        <br />
                        <span className="small">CW 30% / Exam 70% · Total</span>
                      </th>
                    ))}
                    <th>Avg</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(classData?.students ?? []).map((st) => {
                    const avg = liveAverage(st.id) ?? st.average;
                    const grade = avg === null ? '-' : ghanaGrade(avg);
                    return (
                      <tr key={st.id}>
                        <td>{st.rank ?? '—'}</td>
                        <td>
                          <strong>{st.fullName}</strong>
                        </td>
                        <td>{st.indexNumber}</td>
                        {(classData?.subjects ?? []).map((subj) => {
                          const cell = drafts[st.id]?.[subj] ?? emptyCell();
                          const total = weightedTotal(numOrNull(cell.classScore), numOrNull(cell.examScore));
                          return (
                            <td key={subj}>
                              <span className="grade-cell">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="any"
                                  aria-label={`${st.fullName} ${subj} class work`}
                                  value={cell.classScore}
                                  onChange={(e) => setDraft(st.id, subj, { classScore: e.target.value })}
                                  placeholder="CW"
                                />
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="any"
                                  aria-label={`${st.fullName} ${subj} exam`}
                                  value={cell.examScore}
                                  onChange={(e) => setDraft(st.id, subj, { examScore: e.target.value })}
                                  placeholder="Exam"
                                />
                              </span>
                              <div className="small">{total === null ? '—' : `Total ${total.toFixed(2)}`}</div>
                            </td>
                          );
                        })}
                        <td>
                          <strong>{avg === null ? '—' : avg.toFixed(2)}</strong>
                        </td>
                        <td style={{ color: gradeColor(grade), fontWeight: 700 }}>{grade}</td>
                        <td>
                          {st.published ? (
                            <span className="success">✓ Published</span>
                          ) : (
                            <span className="muted">Draft</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'subjects' && (
        <div className="split">
          <div>
            <h3>Classes I teach</h3>
            {mySubjects.length === 0 ? (
              <Empty text="No subject assignments yet." />
            ) : (
              mySubjects.map((a) => {
                const active =
                  selectedAssignment?.classId === a.classId &&
                  selectedAssignment?.subjectId === a.subjectId;
                return (
                  <button
                    key={`${a.classId}-${a.subjectId}`}
                    type="button"
                    className={active ? 'subject-card-btn active' : 'subject-card-btn'}
                    onClick={() => setSelectedAssignment(a)}
                  >
                    <div style={{ fontWeight: 700 }}>{a.className}</div>
                    <div className="small">{a.subjectName}</div>
                  </button>
                );
              })
            )}
          </div>
          <div>
            {!selectedAssignment && <p className="muted">Select a class on the left to enter marks.</p>}
            {selectedAssignment && (
              <>
                <h3>
                  {selectedAssignment.className} — {selectedAssignment.subjectName}
                </h3>
                <div className="form-actions" style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void saveSubjectGrades()}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save Marks'}
                  </button>
                  <span className="small">Class work 30% · Exam 70%</span>
                </div>
                {subjectStudents.length === 0 ? (
                  <Empty text="No students in this class yet." />
                ) : (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Index No.</th>
                          <th>Class work (30%)</th>
                          <th>Exam (70%)</th>
                          <th>Total</th>
                          <th>Grade</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subjectStudents.map((st) => {
                          const cell = subjectDrafts[st.id] ?? emptyCell();
                          const total = weightedTotal(numOrNull(cell.classScore), numOrNull(cell.examScore));
                          const grade = total === null ? '-' : ghanaGrade(total);
                          return (
                            <tr key={st.id}>
                              <td>{st.fullName}</td>
                              <td>{st.indexNumber}</td>
                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="any"
                                  aria-label={`${st.fullName} class work`}
                                  value={cell.classScore}
                                  onChange={(e) =>
                                    setSubjectDrafts((prev) => ({
                                      ...prev,
                                      [st.id]: { ...(prev[st.id] ?? emptyCell()), classScore: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="any"
                                  aria-label={`${st.fullName} exam`}
                                  value={cell.examScore}
                                  onChange={(e) =>
                                    setSubjectDrafts((prev) => ({
                                      ...prev,
                                      [st.id]: { ...(prev[st.id] ?? emptyCell()), examScore: e.target.value },
                                    }))
                                  }
                                />
                              </td>
                              <td>
                                <strong>{total === null ? '—' : total.toFixed(2)}</strong>
                              </td>
                              <td style={{ color: gradeColor(grade), fontWeight: 700 }}>{grade}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'rankings' && isClassTeacher && (
        <div>
          <h3>
            Class rankings — {classData?.className} ({classData?.semester})
          </h3>
          <p className="small">
            Ties share a rank and the next rank skips (1224 ranking). Students with no grades
            are excluded.
          </p>
          {rankings === null ? (
            <Loading />
          ) : rankings.length === 0 ? (
            <Empty text="No ranked students yet — enter and save marks first." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Average</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r) => (
                    <tr key={r.studentId}>
                      <td>
                        <strong>{r.rank}</strong>
                      </td>
                      <td>{r.studentName}</td>
                      <td>{r.average.toFixed(2)}%</td>
                      <td style={{ color: gradeColor(r.grade), fontWeight: 700 }}>{r.grade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
