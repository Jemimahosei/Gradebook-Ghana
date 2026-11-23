import { useCallback, useEffect, useState } from 'react';
import { schoolContext, teacherApi, weightedTotal } from '../lib/api';
import type { AuthUser, GradeRequest, MyClass, RankEntry, SubjectAssignment } from '../lib/api';
import { EmptyState, ErrorBanner, GradeChip, Loading, PageHead, errorText, isUnauthorized } from '../components';
import { bandStyle, classCode, gradeBand, isValidMark } from '../theme';

export type TeacherTab = 'dashboard' | 'marks' | 'myclass' | 'rankings';

/**
 * Teacher portal — mockup screens 11, 12, 13, 16, 23.
 * Dashboard = subject cards; Marks = per subject+class entry grid with
 * live totals, grades, remarks and positions (the school's class-work /
 * exam weighting — 30/70 unless the admin changed it — fetched from
 * /api/context); Rankings = class positions with CSV download. The My
 * Class tab keeps the class teacher's whole-class grid from the previous
 * version, restyled. The Term select mirrors the mockup; the semester
 * itself is owned by the server.
 */

function ghanaGrade(score: number): string {
  return gradeBand(score).letter;
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

type Fail = (err: unknown) => void;

export default function TeacherDashboard({
  user,
  tab,
  onTab,
  onSessionExpired,
}: {
  user: AuthUser;
  tab: TeacherTab;
  onTab: (t: TeacherTab) => void;
  onSessionExpired: () => void;
}) {
  const [classData, setClassData] = useState<MyClass | null>(null);
  const [mySubjects, setMySubjects] = useState<SubjectAssignment[]>([]);
  const [classWeight, setClassWeight] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onFail = useCallback(
    (err: unknown) => {
      if (isUnauthorized(err)) onSessionExpired();
      else setError(errorText(err));
    },
    [onSessionExpired],
  );

  const loadClass = useCallback(() => {
    return teacherApi.myClass().then(setClassData).catch(onFail);
  }, [onFail]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadClass(),
      teacherApi.mySubjects().then(setMySubjects).catch(onFail),
      schoolContext()
        .then((ctx) => setClassWeight(ctx.classWeightPercent))
        .catch(() => undefined), // totals fall back to the 30/70 default
    ]).finally(() => setLoading(false));
  }, [loadClass, onFail]);

  if (loading) return <Loading />;

  const isClassTeacher = classData?.isClassTeacher ?? false;

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {tab === 'dashboard' && (
        <TeacherHome
          user={user}
          classData={classData}
          mySubjects={mySubjects}
          onTab={onTab}
          onFail={onFail}
        />
      )}
      {tab === 'marks' && (
        <MarksPanel mySubjects={mySubjects} onFail={onFail} onTab={onTab} classWeight={classWeight} />
      )}
      {tab === 'myclass' &&
        (isClassTeacher ? (
          <MyClassGrid classData={classData!} onFail={onFail} reload={loadClass} classWeight={classWeight} />
        ) : (
          <EmptyState
            title="You are not a class teacher"
            text="Your school admin has not made you class teacher of a class. Use Marks to enter marks for the classes you teach."
          />
        ))}
      {tab === 'rankings' &&
        (isClassTeacher ? (
          <RankingsPanel classData={classData!} onFail={onFail} />
        ) : (
          <EmptyState
            title="Rankings are for class teachers"
            text="Your school admin has not made you class teacher of a class, so there is no class to rank yet."
          />
        ))}
    </div>
  );
}

// ------------------------------------------------------------- dashboard

function TeacherHome({
  user,
  classData,
  mySubjects,
  onTab,
  onFail,
}: {
  user: AuthUser;
  classData: MyClass | null;
  mySubjects: SubjectAssignment[];
  onTab: (t: TeacherTab) => void;
  onFail: Fail;
}) {
  const [progress, setProgress] = useState<Map<string, { entered: number; total: number }>>(new Map());

  useEffect(() => {
    if (mySubjects.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const grades = await teacherApi.allGrades();
        const next = new Map<string, { entered: number; total: number }>();
        for (const a of mySubjects) {
          const roster = await teacherApi.studentsByClass(a.classId);
          const ids = new Set(roster.map((s) => s.id));
          const entered = grades.filter(
            (g) => g.subject === a.subjectName && ids.has(g.studentId) && g.classScore !== null && g.examScore !== null,
          ).length;
          next.set(`${a.classId}-${a.subjectId}`, { entered, total: roster.length });
        }
        if (!cancelled) setProgress(next);
      } catch (err) {
        if (!cancelled) onFail(err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mySubjects, onFail]);

  const isClassTeacher = classData?.isClassTeacher ?? false;

  if (mySubjects.length === 0 && !isClassTeacher) {
    // Mockup screen 23.
    return (
      <div>
        <PageHead crumb="Teacher / Dashboard" title="Dashboard" />
        <EmptyState
          title="No subjects assigned yet"
          text="Your school admin chooses which subjects and classes you teach. Ask them to open Assignments and add you."
          actionLabel="Contact your admin"
          onAction={() => onTab('dashboard')}
        />
      </div>
    );
  }

  const todoItems: { title: string; sub: string }[] = [];
  mySubjects.forEach((a) => {
    const p = progress.get(`${a.classId}-${a.subjectId}`);
    if (!p) return;
    if (p.entered === 0 && p.total > 0) {
      todoItems.push({ title: `Start ${a.subjectName}, ${a.className}`, sub: 'No marks yet' });
    } else if (p.entered < p.total) {
      todoItems.push({
        title: `Enter exam marks for ${a.className}`,
        sub: `${p.total - p.entered} students still to enter`,
      });
    }
  });

  return (
    <div>
      <PageHead crumb="Teacher / Dashboard" title="Dashboard" />
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>My subjects</h2>
          <div className="class-grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))' }}>
            {mySubjects.map((a, i) => {
              const p = progress.get(`${a.classId}-${a.subjectId}`);
              return (
                <button
                  key={`${a.classId}-${a.subjectId}`}
                  type="button"
                  className="class-card"
                  onClick={() => onTab('marks')}
                >
                  <div className="band" style={bandStyle(i)}>
                    {classCode(a.className)}
                  </div>
                  <div className="body">
                    <div className="t">{a.subjectName}</div>
                    <div className="s">{a.className}</div>
                    <div className="foot">
                      {p
                        ? p.entered === 0
                          ? 'Not started'
                          : `${p.entered} of ${p.total} marks entered`
                        : ''}
                    </div>
                  </div>
                </button>
              );
            })}
            {isClassTeacher && classData?.className && (
              <button
                type="button"
                className="class-card"
                onClick={() => onTab('myclass')}
              >
                <div className="band" style={bandStyle(mySubjects.length)}>
                  {classCode(classData.className)}
                </div>
                <div className="body">
                  <div className="t">My Class</div>
                  <div className="s">{classData.className} — all subjects</div>
                  <div className="foot">{(classData.students ?? []).length} students</div>
                </div>
              </button>
            )}
          </div>
          <p className="small" style={{ marginTop: 16 }}>
            Signed in as {user.name}
            {isClassTeacher && classData?.semester
              ? ` · Class Teacher — ${classData.className} · Semester ${classData.semester}`
              : ''}
          </p>
        </div>
        {todoItems.length > 0 && (
          <aside className="todo">
            <h2>To do</h2>
            {todoItems.slice(0, 3).map((t) => (
              <div key={t.title} style={{ padding: '10px 0', borderTop: '1px solid #e8eaf4' }}>
                <div style={{ fontWeight: 600 }}>{t.title}</div>
                <div style={{ color: '#5c6488', fontSize: 13 }}>{t.sub}</div>
              </div>
            ))}
          </aside>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- marks

function MarksPanel({
  mySubjects,
  onFail,
  onTab,
  classWeight,
}: {
  mySubjects: SubjectAssignment[];
  onFail: Fail;
  onTab: (t: TeacherTab) => void;
  classWeight: number;
}) {
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [students, setStudents] = useState<{ id: number; fullName: string; indexNumber: string }[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftCell>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [term, setTerm] = useState('Term 1');

  const selected =
    mySubjects.find((a) => `${a.classId}-${a.subjectId}` === selectedKey) ?? mySubjects[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    setSaved(false);
    teacherApi
      .studentsByClass(selected.classId)
      .then((roster) => {
        setStudents(roster);
        return teacherApi.allGrades();
      })
      .then((grades) => {
        const map: Record<number, DraftCell> = {};
        grades
          .filter((g) => g.subject === selected.subjectName)
          .forEach((g) => {
            map[g.studentId] = {
              classScore: g.classScore === null ? '' : String(g.classScore),
              examScore: g.examScore === null ? '' : String(g.examScore),
            };
          });
        setDrafts(map);
      })
      .catch(onFail)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.classId, selected?.subjectId]);

  if (mySubjects.length === 0) {
    return (
      <div>
        <PageHead crumb="Teacher / Marks" title="Marks" />
        <EmptyState
          title="No subjects assigned yet"
          text="Your school admin chooses which subjects and classes you teach. Ask them to open Assignments and add you."
          actionLabel="Back to dashboard"
          onAction={() => onTab('dashboard')}
        />
      </div>
    );
  }

  const totals = students.map((st) => {
    const cell = drafts[st.id] ?? emptyCell();
    if (!isValidMark(cell.classScore) || !isValidMark(cell.examScore)) return null;
    return weightedTotal(numOrNull(cell.classScore), numOrNull(cell.examScore), classWeight);
  });
  const have = totals.filter((t): t is number => t !== null);
  const hasBad = students.some((st) => {
    const cell = drafts[st.id] ?? emptyCell();
    return !isValidMark(cell.classScore) || !isValidMark(cell.examScore);
  });
  const fmt = (n: number) => n.toFixed(1);
  const rankOf = (t: number) => 1 + have.filter((x) => x > t).length;

  function setCell(studentId: number, patch: Partial<DraftCell>) {
    setSaved(false);
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] ?? emptyCell()), ...patch },
    }));
  }

  async function save() {
    if (!selected || hasBad) return;
    setSaving(true);
    setNotice(null);
    try {
      const batch: GradeRequest[] = Object.entries(drafts)
        .map(([studentId, cell]) => ({
          studentId: Number(studentId),
          subject: selected.subjectName,
          classScore: numOrNull(cell.classScore),
          examScore: numOrNull(cell.examScore),
        }))
        .filter((r) => r.classScore !== null || r.examScore !== null);
      const res = await teacherApi.saveGrades(batch);
      setSaved(true);
      setNotice(`Saved ${res.count} grade${res.count === 1 ? '' : 's'} for ${selected.subjectName}.`);
    } catch (err) {
      onFail(err);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setNotice(null);
    try {
      const res = await teacherApi.publish();
      setNotice(`Published ${res.count} grades — students can now view them.`);
    } catch (err) {
      onFail(err);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div>
      <PageHead crumb="Teacher / Marks" title="Marks">
        <button type="button" className="btn secondary" onClick={() => void publish()} disabled={publishing}>
          {publishing ? 'Publishing…' : 'Publish grades'}
        </button>
        <button
          type="button"
          className={saved ? 'btn saved' : 'btn'}
          onClick={() => void save()}
          disabled={saving || hasBad}
        >
          {saving ? 'Saving…' : saved ? 'Marks saved' : 'Save marks'}
        </button>
      </PageHead>
      {notice && <p className="success-note">{notice}</p>}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '0 1 340px' }}>
          <span className="label">Subject and class</span>
          <select
            className="input"
            value={selected ? `${selected.classId}-${selected.subjectId}` : ''}
            onChange={(e) => setSelectedKey(e.target.value)}
          >
            {mySubjects.map((a) => (
              <option key={`${a.classId}-${a.subjectId}`} value={`${a.classId}-${a.subjectId}`}>
                {a.subjectName}, {a.className}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '0 1 160px' }}>
          <span className="label">Term</span>
          <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option>Term 1</option>
            <option>Term 2</option>
            <option>Term 3</option>
          </select>
        </div>
      </div>

      <div className="stat-cards">
        <div className="stat-card">
          <div className="k">Class average</div>
          <div className="v num">{have.length ? fmt(have.reduce((a, b) => a + b, 0) / have.length) : 'None yet'}</div>
        </div>
        <div className="stat-card">
          <div className="k">Highest</div>
          <div className="v num">{have.length ? fmt(Math.max(...have)) : 'None yet'}</div>
        </div>
        <div className="stat-card">
          <div className="k">Lowest</div>
          <div className="v num">{have.length ? fmt(Math.min(...have)) : 'None yet'}</div>
        </div>
        <div className="stat-card">
          <div className="k">Marks entered</div>
          <div className="v num">
            {have.length} of {students.length}
          </div>
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : students.length === 0 ? (
        <EmptyState title="No students in this class yet" text="Your admin adds students to the class before marks can be entered." />
      ) : (
        <>
          <div className="tbl hide-mobile">
            <div className="tbl-head" style={{ padding: '10px 18px' }}>
              <span style={{ flex: 3 }}>Student</span>
              <span style={{ flex: 1.2, textAlign: 'center' }}>Class work, out of 100</span>
              <span style={{ flex: 1.2, textAlign: 'center' }}>Exam, out of 100</span>
              <span style={{ flex: 1, textAlign: 'right' }}>Total</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Grade</span>
              <span style={{ flex: 1.3 }}>Remark</span>
              <span style={{ flex: 0.6, textAlign: 'right' }}>Position</span>
            </div>
            {students.map((st, i) => {
              const cell = drafts[st.id] ?? emptyCell();
              const t = totals[i];
              const band = t === null ? null : gradeBand(t);
              return (
                <div key={st.id} className="tbl-row" style={{ padding: '8px 18px' }}>
                  <span style={{ flex: 3 }}>
                    <strong>{st.fullName}</strong>
                    <span style={{ display: 'block', fontSize: 13, color: '#5c6488' }}>{st.indexNumber}</span>
                  </span>
                  <span style={{ flex: 1.2, display: 'flex', justifyContent: 'center' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`${st.fullName} class work mark`}
                      className={isValidMark(cell.classScore) ? 'mark-input num' : 'mark-input num invalid'}
                      value={cell.classScore}
                      onChange={(e) => setCell(st.id, { classScore: e.target.value })}
                    />
                  </span>
                  <span style={{ flex: 1.2, display: 'flex', justifyContent: 'center' }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      aria-label={`${st.fullName} exam mark`}
                      className={isValidMark(cell.examScore) ? 'mark-input num' : 'mark-input num invalid'}
                      value={cell.examScore}
                      onChange={(e) => setCell(st.id, { examScore: e.target.value })}
                    />
                  </span>
                  <span className="num" style={{ flex: 1, textAlign: 'right', fontWeight: 700 }}>
                    {t === null ? '' : t.toFixed(1)}
                  </span>
                  <span style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    {band ? (
                      <span className="grade-chip num" style={{ background: band.bg }}>
                        {band.letter}
                      </span>
                    ) : (
                      ''
                    )}
                  </span>
                  <span style={{ flex: 1.3 }}>{band?.remark ?? ''}</span>
                  <span className="num" style={{ flex: 0.6, textAlign: 'right', fontWeight: 700 }}>
                    {t === null ? '' : rankOf(t)}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="m-cards">
            {students.map((st, i) => {
              const cell = drafts[st.id] ?? emptyCell();
              const t = totals[i];
              const band = t === null ? null : gradeBand(t);
              return (
                <div key={st.id} className="m-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>{st.fullName}</strong>
                    <span style={{ fontSize: 13, color: '#5c6488' }}>
                      Position{' '}
                      <strong className="num" style={{ color: '#1d2347' }}>
                        {t === null ? '' : rankOf(t)}
                      </strong>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 8 }}>
                    <label style={{ fontSize: 12, color: '#5c6488' }}>
                      Class work
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${st.fullName} class work mark`}
                        className={isValidMark(cell.classScore) ? 'mark-input num' : 'mark-input num invalid'}
                        style={{ width: 68, height: 44, display: 'block' }}
                        value={cell.classScore}
                        onChange={(e) => setCell(st.id, { classScore: e.target.value })}
                      />
                    </label>
                    <label style={{ fontSize: 12, color: '#5c6488' }}>
                      Exam
                      <input
                        type="text"
                        inputMode="decimal"
                        aria-label={`${st.fullName} exam mark`}
                        className={isValidMark(cell.examScore) ? 'mark-input num' : 'mark-input num invalid'}
                        style={{ width: 68, height: 44, display: 'block' }}
                        value={cell.examScore}
                        onChange={(e) => setCell(st.id, { examScore: e.target.value })}
                      />
                    </label>
                    <span className="num" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                      {t === null ? '' : t.toFixed(1)}
                    </span>
                    {band && (
                      <span className="grade-chip num" style={{ background: band.bg }}>
                        {band.letter}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn block" onClick={() => void save()} disabled={saving || hasBad}>
              {saving ? 'Saving…' : 'Save marks'}
            </button>
          </div>
          {hasBad && (
            <p style={{ margin: '12px 0 0', color: '#c0392b', fontSize: 14 }}>
              Marks must be whole numbers or one decimal, from 0 to 100.
            </p>
          )}
          <p style={{ margin: '12px 0 0', color: '#5c6488', fontSize: 14 }}>
            Total is 30 percent class work plus 70 percent exam. Positions update as you type.
            Equal totals share a position.
          </p>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------------- my class
// The class teacher's whole-class grid (previous version's core feature),
// restyled to the mockup table pattern.

function MyClassGrid({
  classData,
  onFail,
  reload,
  classWeight,
}: {
  classData: MyClass;
  onFail: Fail;
  reload: () => Promise<void>;
  classWeight: number;
}) {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const init: Drafts = {};
    (classData.students ?? []).forEach((st) => {
      init[st.id] = {};
      Object.entries(st.gradeCells ?? {}).forEach(([subj, cell]) => {
        init[st.id][subj] = {
          classScore: cell.classScore === null ? '' : String(cell.classScore),
          examScore: cell.examScore === null ? '' : String(cell.examScore),
        };
      });
    });
    setDrafts(init);
  }, [classData]);

  function setDraft(studentId: number, subject: string, patch: Partial<DraftCell>) {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] ?? {}),
        [subject]: { ...(prev[studentId]?.[subject] ?? emptyCell()), ...patch },
      },
    }));
  }

  function liveAverage(studentId: number): number | null {
    if (!classData.subjects) return null;
    const totals = classData.subjects
      .map((subj) => {
        const cell = drafts[studentId]?.[subj];
        if (!cell) return null;
        return weightedTotal(numOrNull(cell.classScore), numOrNull(cell.examScore), classWeight);
      })
      .filter((t): t is number => t !== null);
    if (totals.length === 0) return null;
    return Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 100) / 100;
  }

  async function save() {
    setSaving(true);
    setNotice(null);
    try {
      const batch: GradeRequest[] = [];
      (classData.subjects ?? []).forEach((subj) => {
        (classData.students ?? []).forEach((st) => {
          const cell = drafts[st.id]?.[subj];
          if (!cell) return;
          const classScore = numOrNull(cell.classScore);
          const examScore = numOrNull(cell.examScore);
          if (classScore === null && examScore === null) return;
          batch.push({ studentId: st.id, subject: subj, classScore, examScore });
        });
      });
      const res = await teacherApi.saveGrades(batch);
      setNotice(`Saved ${res.count} grade${res.count === 1 ? '' : 's'}.`);
      await reload();
    } catch (err) {
      onFail(err);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    setNotice(null);
    try {
      const res = await teacherApi.publish();
      setNotice(`Published ${res.count} grades — students can now view them.`);
      await reload();
    } catch (err) {
      onFail(err);
    } finally {
      setPublishing(false);
    }
  }

  const students = classData.students ?? [];
  const subjects = classData.subjects ?? [];

  return (
    <div>
      <PageHead crumb="Teacher / My Class" title={`My Class — ${classData.className ?? ''}`}>
        <button type="button" className="btn secondary" onClick={() => void publish()} disabled={publishing}>
          {publishing ? 'Publishing…' : 'Publish Grades'}
        </button>
        <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save Marks'}
        </button>
      </PageHead>
      {notice && <p className="success-note">{notice}</p>}
      <p className="lede">
        {classData.programme} · Semester {classData.semester}. Class work is {classWeight}%, exam is {100 - classWeight}%.
        Totals and averages update as you type; save to persist.
      </p>
      {students.length === 0 ? (
        <EmptyState title="No students in this class yet" text="Your admin adds students to the class before marks can be entered." />
      ) : (
        <div className="tbl" style={{ overflowX: 'auto' }}>
          <div className="tbl-head" style={{ minWidth: 900 }}>
            <span style={{ flex: 0.6 }}>Rank</span>
            <span style={{ flex: 2 }}>Student</span>
            {subjects.map((subj) => (
              <span key={subj} style={{ flex: 2, textAlign: 'center' }}>
                {subj}
                <br />
                <span style={{ fontWeight: 500 }}>CW {classWeight}% / Exam {100 - classWeight}% · Total</span>
              </span>
            ))}
            <span style={{ flex: 0.8, textAlign: 'right' }}>Avg</span>
            <span style={{ flex: 0.8, textAlign: 'center' }}>Grade</span>
            <span style={{ flex: 1 }}>Status</span>
          </div>
          {students.map((st) => {
            const avg = liveAverage(st.id) ?? st.average;
            return (
              <div key={st.id} className="tbl-row" style={{ minWidth: 900, padding: '8px 18px' }}>
                <span style={{ flex: 0.6 }}>{st.rank ?? '—'}</span>
                <span style={{ flex: 2 }}>
                  <strong>{st.fullName}</strong>
                  <span style={{ display: 'block', fontSize: 13, color: '#5c6488' }}>{st.indexNumber}</span>
                </span>
                {subjects.map((subj) => {
                  const cell = drafts[st.id]?.[subj] ?? emptyCell();
                  const total = weightedTotal(numOrNull(cell.classScore), numOrNull(cell.examScore), classWeight);
                  return (
                    <span key={subj} style={{ flex: 2, textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', gap: 6 }}>
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${st.fullName} ${subj} class work`}
                          className="mark-input num"
                          style={{ width: 64, height: 38 }}
                          value={cell.classScore}
                          onChange={(e) => setDraft(st.id, subj, { classScore: e.target.value })}
                          placeholder="CW"
                        />
                        <input
                          type="text"
                          inputMode="decimal"
                          aria-label={`${st.fullName} ${subj} exam`}
                          className="mark-input num"
                          style={{ width: 64, height: 38 }}
                          value={cell.examScore}
                          onChange={(e) => setDraft(st.id, subj, { examScore: e.target.value })}
                          placeholder="Exam"
                        />
                      </span>
                      <span style={{ display: 'block', fontSize: 13, color: '#5c6488' }}>
                        {total === null ? '—' : `Total ${total.toFixed(2)}`}
                      </span>
                    </span>
                  );
                })}
                <span style={{ flex: 0.8, textAlign: 'right' }}>
                  <strong className="num">{avg === null ? '—' : avg.toFixed(2)}</strong>
                </span>
                <span style={{ flex: 0.8, textAlign: 'center' }}>
                  {avg === null ? '—' : <GradeChip letter={ghanaGrade(avg)} />}
                </span>
                <span style={{ flex: 1 }}>
                  {st.published ? (
                    <span className="chip ok">Published</span>
                  ) : (
                    <span className="chip neutral">Draft</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------- rankings

function RankingsPanel({ classData, onFail }: { classData: MyClass; onFail: Fail }) {
  const [rankings, setRankings] = useState<RankEntry[] | null>(null);
  const [term, setTerm] = useState('Term 1');

  useEffect(() => {
    teacherApi
      .rankings()
      .then(setRankings)
      .catch((err: unknown) => {
        onFail(err);
        setRankings([]);
      });
  }, [onFail]);

  function downloadCsv() {
    if (!rankings) return;
    const lines = [
      'Position,Student,Average,Grade',
      ...rankings.map((r) => `${r.rank},"${r.studentName.replace(/"/g, '""')}",${r.average.toFixed(2)},${r.grade}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rankings.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHead crumb="Teacher / Rankings" title="Rankings">
        <button type="button" className="btn secondary" onClick={downloadCsv} disabled={!rankings || rankings.length === 0}>
          Download CSV
        </button>
      </PageHead>
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: '0 1 260px' }}>
          <span className="label">Class</span>
          <select className="input" value={classData.className ?? ''} disabled>
            <option>{classData.className}</option>
          </select>
        </div>
        <div style={{ flex: '0 1 160px' }}>
          <span className="label">Term</span>
          <select className="input" value={term} onChange={(e) => setTerm(e.target.value)}>
            <option>Term 1</option>
            <option>Term 2</option>
            <option>Term 3</option>
          </select>
        </div>
      </div>
      <p style={{ margin: '0 0 14px', color: '#5c6488' }}>
        Students are ranked by their average across all subjects this term.
      </p>
      {rankings === null ? (
        <Loading />
      ) : rankings.length === 0 ? (
        <EmptyState title="No ranked students yet" text="Enter and save marks first — students with no grades are excluded." />
      ) : (
        <div className="tbl">
          <div className="tbl-head">
            <div style={{ flex: 0.8 }}>Position</div>
            <div style={{ flex: 3 }}>Student</div>
            <div style={{ flex: 1.2, textAlign: 'right' }}>Average</div>
            <div style={{ flex: 1, textAlign: 'center' }}>Grade</div>
          </div>
          {rankings.map((r) => (
            <div key={r.studentId} className="tbl-row">
              <div style={{ flex: 0.8 }}>
                <span className="num" style={{ fontWeight: 700 }}>{r.rank}</span>
              </div>
              <div style={{ flex: 3 }}>
                <strong>{r.studentName}</strong>
              </div>
              <div style={{ flex: 1.2, textAlign: 'right' }}>
                <span className="num">{r.average.toFixed(1)}</span>
              </div>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <GradeChip letter={r.grade} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
