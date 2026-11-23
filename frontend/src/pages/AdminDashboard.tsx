import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { PROGRAMMES, adminApi } from '../lib/api';
import type {
  AdminDashboard as AdminDashboardData,
  AdminStudent,
  AssignmentRow,
  GradingScale,
  SchoolClass,
  SchoolProfile,
  Subject,
  TeacherRow,
  TermRow,
} from '../lib/api';
import { EmptyState, ErrorBanner, GradeChip, Loading, PageHead, errorText, isUnauthorized } from '../components';
import { bandStyle, classCode } from '../theme';

export type AdminTab =
  | 'dashboard'
  | 'classes'
  | 'students'
  | 'teachers'
  | 'assignments'
  | 'terms'
  | 'scales'
  | 'school'
  | 'more';

/**
 * Admin portal — mockup screens 04-10, 18-20, 25, 27-30.
 * Nav: Dashboard, Classes and subjects, Students, Teachers, Assignments,
 * Terms, Grading scale, School profile. All writes go through the admin
 * API, including per-class result publishing and Terms open/close
 * (real backend endpoints since the Nov 2026 follow-up).
 */
export default function AdminDashboard({
  tab,
  onTab,
  onSessionExpired,
  onLogout,
}: {
  tab: AdminTab;
  onTab: (t: AdminTab) => void;
  onSessionExpired: () => void;
  onLogout: () => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const onFail = useCallback(
    (err: unknown) => {
      if (isUnauthorized(err)) onSessionExpired();
      else setError(errorText(err));
    },
    [onSessionExpired],
  );

  return (
    <div>
      <ErrorBanner error={error} onDismiss={() => setError(null)} />
      {tab === 'dashboard' && <DashboardPanel onFail={onFail} onTab={onTab} />}
      {tab === 'classes' && <ClassesSubjects onFail={onFail} />}
      {tab === 'students' && <StudentsPanel onFail={onFail} />}
      {tab === 'teachers' && <TeachersPanel onFail={onFail} />}
      {tab === 'assignments' && <AssignmentsPanel onFail={onFail} />}
      {tab === 'terms' && <TermsPanel onFail={onFail} />}
      {tab === 'scales' && <ScalesPanel onFail={onFail} />}
      {tab === 'school' && <SchoolPanel onFail={onFail} />}
      {tab === 'more' && <MorePanel onTab={onTab} onLogout={onLogout} />}
    </div>
  );
}

type Fail = (err: unknown) => void;

// ---------------------------------------------------------- dashboard

function DashboardPanel({ onFail, onTab }: { onFail: Fail; onTab: (t: AdminTab) => void }) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [assignmentCount, setAssignmentCount] = useState(0);
  const [scaleCount, setScaleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.dashboard().then(setData),
      adminApi.classes().then(setClasses),
      adminApi.assignments().then((a) => setAssignmentCount(a.length)),
      adminApi.gradingScales().then((s) => setScaleCount(s.length)),
    ])
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  if (loading) return <Loading />;
  if (!data) return <EmptyState title="No dashboard data" text="No dashboard data available." />;

  const isEmptySchool =
    data.studentCount === 0 && data.teacherCount === 0 && data.classCount === 0;

  if (isEmptySchool) {
    // Mockup screen 19: a brand-new school gets the five-step welcome.
    const steps: { n: number; title: string; sub: string; cta: string; tab: AdminTab; primary?: boolean }[] = [
      { n: 1, title: 'Add your classes', sub: 'Create each class, such as 2 Arts 1.', cta: 'Add your first class', tab: 'classes', primary: true },
      { n: 2, title: 'Add your subjects', sub: 'Core and elective subjects the school teaches.', cta: 'Add subjects', tab: 'classes' },
      { n: 3, title: 'Add your teachers', sub: 'Each teacher gets a temporary password.', cta: 'Add teachers', tab: 'teachers' },
      { n: 4, title: 'Assign teachers to classes', sub: 'Choose who teaches what.', cta: 'Assign teachers', tab: 'assignments' },
      { n: 5, title: 'Add your students', sub: 'One by one, or from a CSV file.', cta: 'Add students', tab: 'students' },
    ];
    return (
      <div>
        <PageHead crumb="Administrator" title="Welcome to Gradebook" />
        <p className="lede">Your school is registered. Five steps and teachers can start entering marks.</p>
        <div className="card" style={{ overflow: 'hidden', maxWidth: 860 }}>
          {steps.map((s) => (
            <div
              key={s.n}
              style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                padding: '16px 20px',
                borderTop: '1px solid #e8eaf4',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  flex: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  background: s.primary ? 'var(--brand)' : '#eceef8',
                  color: s.primary ? '#fff' : '#5c6488',
                }}
              >
                {s.n}
              </span>
              <div style={{ flex: '1 1 240px' }}>
                <div style={{ fontWeight: 700 }}>{s.title}</div>
                <div style={{ color: '#5c6488', fontSize: 14 }}>{s.sub}</div>
              </div>
              <button
                type="button"
                className={s.primary ? 'btn' : 'btn secondary'}
                onClick={() => onTab(s.tab)}
              >
                {s.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const teacherByClass = new Map<number, string>();
  classes.forEach((c) => {
    if (c.classTeacherName) teacherByClass.set(c.id, c.classTeacherName);
  });
  const countByClass = new Map<number, number>();
  data.classSummaries.forEach((c) => countByClass.set(c.classId, c.studentCount));

  const todoSteps: { label: string; done: boolean; tab: AdminTab }[] = [
    { label: 'Add classes', done: data.classCount > 0, tab: 'classes' },
    { label: 'Add subjects', done: data.subjectCount > 0, tab: 'classes' },
    { label: 'Add teachers', done: data.teacherCount > 0, tab: 'teachers' },
    { label: 'Assign teachers to classes', done: assignmentCount > 0, tab: 'assignments' },
    { label: 'Add students', done: data.studentCount > 0, tab: 'students' },
    { label: 'Set the grading scale', done: scaleCount > 0, tab: 'scales' },
  ];
  const doneCount = todoSteps.filter((s) => s.done).length;

  return (
    <div>
      <PageHead crumb="Administrator" title="Dashboard">
        <button type="button" className="btn" onClick={() => onTab('students')}>
          Add students
        </button>
      </PageHead>
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
          <div className="stat-inline" style={{ marginBottom: 24 }}>
            <div>
              <span className="value num">{data.studentCount}</span>{' '}
              <span className="unit">students</span>
            </div>
            <div>
              <span className="value num">{data.teacherCount}</span>{' '}
              <span className="unit">teachers</span>
            </div>
            <div>
              <span className="value num">{data.classCount}</span>{' '}
              <span className="unit">classes</span>
            </div>
            <div>
              <span className="value num">{data.subjectCount}</span>{' '}
              <span className="unit">subjects</span>
            </div>
          </div>
          <h2 style={{ fontSize: 18, margin: '0 0 12px' }}>Classes</h2>
          {classes.length === 0 ? (
            <p className="muted">No classes yet.</p>
          ) : (
            <div className="class-grid">
              {classes.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className="class-card"
                  onClick={() => onTab('classes')}
                >
                  <div className="band" style={bandStyle(i)}>
                    {classCode(c.name)}
                  </div>
                  <div className="body">
                    <div className="t">{c.name}</div>
                    <div className="s">{countByClass.get(c.id) ?? 0} students</div>
                    <div className="foot">{c.classTeacherName ?? 'Not assigned'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <aside className="todo">
          <h2>To do</h2>
          <div style={{ color: '#5c6488', fontSize: 14, marginBottom: 6 }}>
            {doneCount} of {todoSteps.length} steps done
          </div>
          {todoSteps.map((s) => (
            <button key={s.label} type="button" className="step" onClick={() => onTab(s.tab)}>
              <span className={s.done ? 'dot done' : 'dot open'} />
              <span>{s.label}</span>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}

// ------------------------------------------- classes and subjects (05)

function ClassesSubjects({ onFail }: { onFail: Fail }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [counts, setCounts] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [classFormOpen, setClassFormOpen] = useState(false);
  const [subjectFormOpen, setSubjectFormOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // class form
  const [cName, setCName] = useState('');
  const [cProgramme, setCProgramme] = useState<string>('SCIENCE');
  const [cYear, setCYear] = useState('1');
  const [cTeacherId, setCTeacherId] = useState<number | ''>('');
  // subject form
  const [sName, setSName] = useState('');
  const [sProgramme, setSProgramme] = useState<string>('CORE');
  const [sCore, setSCore] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.classes().then(setClasses),
      adminApi.subjects().then(setSubjects),
      adminApi.teachers().then(setTeachers),
      adminApi.dashboard().then((d) => {
        const m = new Map<number, number>();
        d.classSummaries.forEach((c) => m.set(c.classId, c.studentCount));
        setCounts(m);
      }),
    ])
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  async function togglePublish(c: SchoolClass) {
    // Real endpoint: POST /admin/classes/{id}/publish. The server also
    // enforces the switch on the student endpoints, so unpublished
    // results are hidden even outside this page.
    setNotice(null);
    try {
      const updated = await adminApi.setClassPublished(c.id, !c.resultsPublished);
      setClasses((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setNotice(
        updated.resultsPublished
          ? `${updated.name} results are now visible to students.`
          : `${updated.name} results are hidden from students.`,
      );
    } catch (err) {
      onFail(err);
    }
  }

  async function submitClass(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const body = {
        name: cName.trim(),
        programme: cProgramme,
        formYear: Number(cYear),
        classTeacherId: cTeacherId === '' ? null : cTeacherId,
      };
      if (editingClass) {
        await adminApi.updateClass(editingClass.id, body);
        setNotice('Class updated.');
      } else {
        await adminApi.createClass(body);
        setNotice('Class created.');
      }
      setEditingClass(null);
      setClassFormOpen(false);
      setCName('');
      setCTeacherId('');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function removeClass(row: SchoolClass) {
    if (!window.confirm(`Delete class "${row.name}"?`)) return;
    try {
      await adminApi.deleteClass(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function submitSubject(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const body = { name: sName.trim(), programme: sProgramme, isCore: sCore };
      if (editingSubject) {
        await adminApi.updateSubject(editingSubject.id, body);
        setNotice('Subject updated.');
      } else {
        await adminApi.createSubject(body);
        setNotice('Subject created.');
      }
      setEditingSubject(null);
      setSubjectFormOpen(false);
      setSName('');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function removeSubject(row: Subject) {
    if (!window.confirm(`Delete subject "${row.name}"?`)) return;
    try {
      await adminApi.deleteSubject(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div>
      <PageHead crumb="Administrator / Classes and subjects" title="Classes and subjects" />
      {notice && <p className="success-note">{notice}</p>}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Classes</h2>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditingClass(null);
                setClassFormOpen((v) => !v);
              }}
            >
              Add class
            </button>
          </div>
          {classFormOpen && (
            <form onSubmit={submitClass} className="add-panel">
              <div className="form-grid">
                <div>
                  <span className="label">Class name</span>
                  <input className="input" value={cName} onChange={(e) => setCName(e.target.value)} required placeholder="e.g. 3 Science 4" />
                </div>
                <div>
                  <span className="label">Programme</span>
                  <select className="input" value={cProgramme} onChange={(e) => setCProgramme(e.target.value)}>
                    {PROGRAMMES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div>
                  <span className="label">Form year</span>
                  <input className="input" type="number" min={1} max={3} value={cYear} onChange={(e) => setCYear(e.target.value)} required />
                </div>
                <div>
                  <span className="label">Class teacher</span>
                  <select
                    className="input"
                    value={cTeacherId}
                    onChange={(e) => setCTeacherId(e.target.value === '' ? '' : Number(e.target.value))}
                  >
                    <option value="">No class teacher</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>{t.fullName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn">{editingClass ? 'Save changes' : 'Create class'}</button>
                <button type="button" className="btn secondary" onClick={() => setClassFormOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
          {loading ? (
            <Loading />
          ) : classes.length === 0 ? (
            <EmptyState title="No classes yet" text="Add your first class, such as 2 Arts 1." actionLabel="Add class" onAction={() => setClassFormOpen(true)} />
          ) : (
            <>
              <div className="tbl hide-mobile">
                <div className="tbl-head">
                  <span style={{ flex: 2 }}>Class</span>
                  <span style={{ flex: 2.4 }}>Results for students</span>
                  <span style={{ flex: 1.6 }} />
                </div>
                {classes.map((c) => {
                  const p = c.resultsPublished;
                  return (
                    <div key={c.id} className="tbl-row">
                      <span style={{ flex: 2, minWidth: 0 }}>
                        <strong>{c.name}</strong>
                        <span style={{ display: 'block', fontSize: 13, color: '#5c6488' }}>
                          {counts.get(c.id) ?? 0} students
                        </span>
                        <span style={{ display: 'block', fontSize: 13 }}>
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => {
                              setEditingClass(c);
                              setCName(c.name);
                              setCProgramme(c.programme);
                              setCYear(String(c.formYear));
                              setCTeacherId(c.classTeacherId ?? '');
                              setClassFormOpen(true);
                            }}
                          >
                            Edit
                          </button>{' '}
                          <button type="button" className="text-link danger" onClick={() => void removeClass(c)}>
                            Delete
                          </button>
                        </span>
                      </span>
                      <span style={{ flex: 2.4 }}>
                        <span className={p ? 'chip ok' : 'chip neutral'}>
                          {p ? 'Visible to students' : 'Hidden from students'}
                        </span>
                      </span>
                      <span style={{ flex: 1.6, display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className={p ? 'btn secondary' : 'btn'}
                          onClick={() => void togglePublish(c)}
                        >
                          {p ? 'Unpublish' : 'Publish results'}
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="m-cards">
                {classes.map((c) => {
                  const p = c.resultsPublished;
                  return (
                    <div key={c.id} className="m-card">
                      <strong>{c.name}</strong>
                      <div className="small">{counts.get(c.id) ?? 0} students</div>
                      <div style={{ margin: '8px 0' }}>
                        <span className={p ? 'chip ok' : 'chip neutral'}>
                          {p ? 'Visible to students' : 'Hidden from students'}
                        </span>
                      </div>
                      <button type="button" className={p ? 'btn secondary block' : 'btn block'} onClick={() => void togglePublish(c)}>
                        {p ? 'Unpublish' : 'Publish results'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <p style={{ color: '#5c6488', fontSize: 14, margin: '10px 0 0' }}>
                Students see a class's results only after you publish them.
              </p>
            </>
          )}
        </div>

        <div style={{ flex: '1 1 400px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 18 }}>Subjects</h2>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditingSubject(null);
                setSubjectFormOpen((v) => !v);
              }}
            >
              Add subject
            </button>
          </div>
          {subjectFormOpen && (
            <form onSubmit={submitSubject} className="add-panel">
              <div style={{ marginBottom: 16 }}>
                <span className="label">Subject name</span>
                <input className="input" value={sName} onChange={(e) => setSName(e.target.value)} required placeholder="e.g. Integrated Science" />
              </div>
              <div className="form-grid">
                <div>
                  <span className="label">Programme</span>
                  <select className="input" value={sProgramme} onChange={(e) => setSProgramme(e.target.value)}>
                    <option value="CORE">CORE</option>
                    {PROGRAMMES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="label">Core subject</span>
                  <input type="checkbox" checked={sCore} onChange={(e) => setSCore(e.target.checked)} style={{ width: 22, height: 22 }} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn">{editingSubject ? 'Save changes' : 'Create subject'}</button>
                <button type="button" className="btn secondary" onClick={() => setSubjectFormOpen(false)}>Cancel</button>
              </div>
            </form>
          )}
          {loading ? (
            <Loading />
          ) : subjects.length === 0 ? (
            <EmptyState title="No subjects yet" text="Add the core and elective subjects your school teaches." actionLabel="Add subject" onAction={() => setSubjectFormOpen(true)} />
          ) : (
            <div className="tbl">
              <div className="tbl-head">
                <div style={{ flex: 3 }}>Subject</div>
                <div style={{ flex: 2 }}>Type</div>
                <div style={{ flex: 0.6 }} />
                <div style={{ flex: 0.7 }} />
              </div>
              {subjects.map((s) => (
                <div key={s.id} className="tbl-row">
                  <div style={{ flex: 3 }}>{s.name}</div>
                  <div style={{ flex: 2 }}>
                    <span style={{ color: '#5c6488' }}>{s.isCore ? 'Core' : 'Elective'}</span>
                  </div>
                  <div style={{ flex: 0.6 }}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setEditingSubject(s);
                        setSName(s.name);
                        setSProgramme(s.programme);
                        setSCore(s.isCore);
                        setSubjectFormOpen(true);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  <div style={{ flex: 0.9 }}>
                    <button type="button" className="text-link danger" onClick={() => void removeSubject(s)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --------------------------------------------------------- students (06)

const PAGE_SIZE = 9;

function StudentsPanel({ onFail }: { onFail: Fail }) {
  const [rows, setRows] = useState<AdminStudent[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState<number | ''>('');
  const [page, setPage] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminStudent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [programme, setProgramme] = useState<string>('SCIENCE');
  const [year, setYear] = useState('1');
  const [classId, setClassId] = useState<number | ''>('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([adminApi.students().then(setRows), adminApi.classes().then(setClasses)])
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  function openEdit(r: AdminStudent) {
    setEditing(r);
    setFullName(r.fullName);
    setIndexNumber(r.indexNumber);
    setProgramme(r.programme);
    setYear(String(r.year));
    setClassId(r.classId ?? '');
    setGuardianName(r.guardianName ?? '');
    setGuardianPhone(r.guardianPhone ?? '');
    setFormOpen(true);
  }

  function resetForm() {
    setEditing(null);
    setFullName('');
    setIndexNumber('');
    setProgramme('SCIENCE');
    setYear('1');
    setClassId('');
    setGuardianName('');
    setGuardianPhone('');
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const body = {
        fullName: fullName.trim(),
        indexNumber: indexNumber.trim(),
        programme,
        year: Number(year),
        classId: classId === '' ? null : classId,
        guardianName: guardianName.trim() || null,
        guardianPhone: guardianPhone.trim() || null,
      };
      if (editing) {
        await adminApi.updateStudent(editing.id, body);
        setNotice('Student updated.');
      } else {
        const created = await adminApi.createStudent(body);
        setNotice(
          created.temporaryPassword
            ? `Student created — login: ${created.loginUsername ?? created.indexNumber} / temporary password: ${created.temporaryPassword}. Share this with the student.`
            : 'Student created.',
        );
      }
      resetForm();
      setFormOpen(false);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!window.confirm(`Delete student "${editing.fullName}" (${editing.indexNumber})?`)) return;
    try {
      await adminApi.deleteStudent(editing.id);
      resetForm();
      setFormOpen(false);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function resetPassword(r: AdminStudent) {
    if (!window.confirm(`Reset ${r.fullName}'s password? They will get a new temporary password and must choose their own at the next login.`)) return;
    setNotice(null);
    try {
      const res = await adminApi.resetStudentPassword(r.id);
      setNotice(
        `Password reset for ${r.fullName} — login: ${res.loginUsername ?? r.indexNumber} / new temporary password: ${res.temporaryPassword}. Share this with the student.`,
      );
    } catch (err) {
      onFail(err);
    }
  }

  async function importCsv(file: File) {
    setImporting(true);
    setNotice(null);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const col = (names: string[]) => header.findIndex((h) => names.includes(h));
      const ci = {
        name: col(['fullname', 'full name', 'name']),
        index: col(['indexnumber', 'index number', 'index']),
        programme: col(['programme', 'program']),
        year: col(['year', 'form']),
        cls: col(['classname', 'class name', 'class']),
        guardian: col(['guardianname', 'guardian name', 'guardian']),
        guardianPhone: col(['guardianphone', 'guardian phone']),
      };
      if (ci.name < 0 || ci.index < 0) {
        setNotice('CSV needs at least "fullName" and "indexNumber" columns.');
        return;
      }
      const classByName = new Map(classes.map((c) => [c.name.toLowerCase(), c.id]));
      let ok = 0;
      let failed = 0;
      for (const line of lines.slice(1)) {
        const cells = line.split(',').map((c) => c.trim());
        try {
          await adminApi.createStudent({
            fullName: cells[ci.name],
            indexNumber: cells[ci.index],
            programme: ci.programme >= 0 && cells[ci.programme] ? cells[ci.programme].toUpperCase() : 'SCIENCE',
            year: ci.year >= 0 && cells[ci.year] ? Number(cells[ci.year]) : 1,
            classId: ci.cls >= 0 ? (classByName.get((cells[ci.cls] ?? '').toLowerCase()) ?? null) : null,
            guardianName: ci.guardian >= 0 && cells[ci.guardian] ? cells[ci.guardian] : null,
            guardianPhone: ci.guardianPhone >= 0 && cells[ci.guardianPhone] ? cells[ci.guardianPhone] : null,
          });
          ok += 1;
        } catch {
          failed += 1;
        }
      }
      setNotice(`Import finished: ${ok} added${failed ? `, ${failed} failed` : ''}.`);
      refresh();
    } finally {
      setImporting(false);
    }
  }

  const filtered = rows.filter((r) => {
    if (classFilter !== '' && r.classId !== classFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.fullName.toLowerCase().includes(q) || r.indexNumber.toLowerCase().includes(q);
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <PageHead crumb="Administrator / Students" title="Students">
        <button type="button" className="btn secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? 'Importing…' : 'Import from CSV'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            resetForm();
            setFormOpen((v) => !v);
          }}
        >
          Add student
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importCsv(f);
            e.target.value = '';
          }}
        />
      </PageHead>
      {notice && <p className="success-note">{notice}</p>}
      {formOpen && (
        <form onSubmit={submit} className="add-panel">
          <div className="form-grid">
            <div>
              <span className="label">Full name</span>
              <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Kwame Mensah" />
            </div>
            <div>
              <span className="label">Index number</span>
              <input className="input" value={indexNumber} onChange={(e) => setIndexNumber(e.target.value)} required placeholder="e.g. 0050101033" />
            </div>
            <div>
              <span className="label">Programme</span>
              <select className="input" value={programme} onChange={(e) => setProgramme(e.target.value)}>
                {PROGRAMMES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <span className="label">Year</span>
              <input className="input" type="number" min={1} max={3} value={year} onChange={(e) => setYear(e.target.value)} required />
            </div>
            <div>
              <span className="label">Class</span>
              <select className="input" value={classId} onChange={(e) => setClassId(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">No class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-grid">
            <div>
              <span className="label">Guardian name</span>
              <input className="input" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <span className="label">Guardian phone</span>
              <input className="input" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" className="btn">{editing ? 'Save changes' : 'Create student'}</button>
            <button type="button" className="btn secondary" onClick={() => setFormOpen(false)}>Cancel</button>
            {editing && (
              <button type="button" className="btn danger" onClick={() => void remove()}>
                Delete student
              </button>
            )}
          </div>
        </form>
      )}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by name or index number"
          className="input"
          style={{ maxWidth: 340 }}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <select
          className="input"
          style={{ maxWidth: 220 }}
          value={classFilter}
          onChange={(e) => {
            setClassFilter(e.target.value === '' ? '' : Number(e.target.value));
            setPage(0);
          }}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title="No students yet" text="Add each student, or import them from a CSV file." actionLabel="Add your first student" onAction={() => setFormOpen(true)} />
      ) : (
        <>
          <div className="tbl hide-mobile">
            <div className="tbl-head">
              <div style={{ flex: 1.3 }}>Index number</div>
              <div style={{ flex: 2 }}>Name</div>
              <div style={{ flex: 1.4 }}>Class</div>
              <div style={{ flex: 1.5 }}>Guardian</div>
              <div style={{ flex: 1.5 }} />
            </div>
            {pageRows.map((r) => (
              <div key={r.id} className="tbl-row">
                <div style={{ flex: 1.3 }}>{r.indexNumber}</div>
                <div style={{ flex: 2 }}>
                  <strong>{r.fullName}</strong>
                </div>
                <div style={{ flex: 1.4 }}>{r.className ?? '—'}</div>
                <div style={{ flex: 1.5 }}>
                  {r.guardianName ?? '—'}
                  {r.guardianPhone ? (
                    <span style={{ display: 'block', fontSize: 13, color: '#5c6488' }}>{r.guardianPhone}</span>
                  ) : null}
                </div>
                <div style={{ flex: 1.5 }}>
                  <button type="button" className="text-link" onClick={() => openEdit(r)}>Edit</button>
                  &nbsp;&nbsp;
                  <button type="button" className="text-link" onClick={() => void resetPassword(r)}>Reset password</button>
                </div>
              </div>
            ))}
          </div>
          <div className="m-cards">
            {pageRows.map((r) => (
              <div key={r.id} className="m-card">
                <strong>{r.fullName}</strong>
                <div className="small">
                  {r.indexNumber}
                  {r.className ? `, ${r.className}` : ''}
                </div>
                {r.guardianName && (
                  <div className="small">
                    Guardian: {r.guardianName}
                    {r.guardianPhone ? ` · ${r.guardianPhone}` : ''}
                  </div>
                )}
                <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                  <button type="button" className="text-link" onClick={() => openEdit(r)}>Edit</button>
                  <button type="button" className="text-link" onClick={() => void resetPassword(r)}>Reset password</button>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 12,
            }}
          >
            <span style={{ color: '#5c6488', fontSize: 14 }}>
              {filtered.length === 0
                ? 'Showing 0 students'
                : `Showing ${safePage * PAGE_SIZE + 1} to ${Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)} of ${filtered.length} students`}
            </span>
            <span style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn secondary" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>
                Previous
              </button>
              <button type="button" className="btn secondary" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)}>
                Next
              </button>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------------- teachers (07, 20)

function TeachersPanel({ onFail }: { onFail: Fail }) {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teaches, setTeaches] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [made, setMade] = useState<TeacherRow | null>(null);
  const [editingTeacher, setEditingTeacher] = useState<TeacherRow | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [password, setPassword] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.teachers().then(setRows),
      adminApi.subjects().then(setSubjects),
      adminApi.assignments().then((list) => {
        const m = new Map<number, Set<string>>();
        list.forEach((a) => {
          if (!m.has(a.teacherId)) m.set(a.teacherId, new Set());
          m.get(a.teacherId)!.add(a.subjectName);
        });
        const out = new Map<number, string>();
        m.forEach((v, k) => out.set(k, Array.from(v).join(', ')));
        setTeaches(out);
      }),
    ])
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      if (editingTeacher) {
        await adminApi.updateTeacher(editingTeacher.id, {
          fullName: fullName.trim(),
          email: email.trim(),
          subject: subject.trim(),
        });
        setNotice(`Teacher updated: ${fullName.trim()}.`);
        setEditingTeacher(null);
        setOpen(false);
      } else {
        const created = await adminApi.createTeacher({
          fullName: fullName.trim(),
          email: email.trim(),
          subject: subject.trim(),
          password: password.trim(),
        });
        setMade(created);
      }
      setFullName('');
      setEmail('');
      setSubject('');
      setPassword('');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  function openEditTeacher(r: TeacherRow) {
    setMade(null);
    setNotice(null);
    setEditingTeacher(r);
    setFullName(r.fullName);
    setEmail(r.email);
    setSubject(r.subject ?? '');
    setPassword('');
    setOpen(true);
  }

  async function resetTeacher(r: TeacherRow) {
    if (!window.confirm(`Reset ${r.fullName}'s password? They will get a new temporary password and must choose their own at the next login.`)) return;
    setNotice(null);
    try {
      const res = await adminApi.resetTeacherPassword(r.id);
      setNotice(
        `Password reset for ${r.fullName} — login: ${res.loginUsername ?? r.email} / new temporary password: ${res.temporaryPassword}. Share this with the teacher.`,
      );
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: TeacherRow) {
    try {
      await adminApi.deleteTeacher(row.id);
      setConfirmId(null);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div>
      <PageHead crumb="Administrator / Teachers" title="Teachers">
        <button
          type="button"
          className="btn"
          onClick={() => {
            setMade(null);
            setEditingTeacher(null);
            setFullName('');
            setEmail('');
            setSubject('');
            setPassword('');
            setOpen(true);
          }}
        >
          Add teacher
        </button>
      </PageHead>
      {notice && <p className="success-note">{notice}</p>}
      {open && (
        <div className="add-panel">
          {!made ? (
            <form onSubmit={create}>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 220px' }}>
                  <span className="label">Full name</span>
                  <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div style={{ flex: '1 1 240px' }}>
                  <span className="label">Email</span>
                  <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div style={{ flex: '1 1 200px' }}>
                  <span className="label">Subject they teach</span>
                  {subjects.length > 0 ? (
                    <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)}>
                      <option value="">Choose a subject</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                  )}
                </div>
                {!editingTeacher && (
                  <div style={{ flex: '1 1 200px' }}>
                    <span className="label">Password (optional)</span>
                    <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} placeholder="Blank = generated" />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="submit" className="btn">{editingTeacher ? 'Save changes' : 'Create teacher'}</button>
                  <button type="button" className="btn secondary" onClick={() => { setOpen(false); setEditingTeacher(null); }}>Cancel</button>
                </div>
              </div>
            </form>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: 24,
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <strong>{made.fullName} is added.</strong>
                <div style={{ color: '#5c6488', fontSize: 14 }}>
                  {made.temporaryPassword
                    ? 'Share this temporary password now. It is shown only once. She chooses her own at first log in.'
                    : `Login: ${made.loginUsername ?? made.email} with the password you set.`}
                </div>
              </div>
              {made.temporaryPassword && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#5c6488', fontSize: 13 }}>Temporary password</div>
                  <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
                    {made.temporaryPassword}
                  </div>
                </div>
              )}
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          )}
        </div>
      )}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No teachers yet"
          text="Add each teacher with a name and email. Gradebook makes a temporary password for them to use at first log in."
          actionLabel="Add your first teacher"
          onAction={() => {
            setMade(null);
            setOpen(true);
          }}
        />
      ) : (
        <>
          <div className="tbl hide-mobile">
            <div className="tbl-head">
              <span style={{ flex: 1.8 }}>Name</span>
              <span style={{ flex: 2.3 }}>Email</span>
              <span style={{ flex: 2.4 }}>Teaches</span>
              <span style={{ flex: 1.1 }}>Status</span>
              <span style={{ flex: 1.6 }} />
            </div>
            {rows.map((r) => (
              <div key={r.id}>
                {confirmId !== r.id ? (
                  <div className="tbl-row">
                    <span style={{ flex: 1.8, fontWeight: 700 }}>{r.fullName}</span>
                    <span style={{ flex: 2.3 }}>{r.email}</span>
                    <span style={{ flex: 2.4 }}>{teaches.get(r.id) ?? r.subject ?? '—'}</span>
                    <span style={{ flex: 1.1 }}>
                      <span className="chip ok">Active</span>
                    </span>
                    <span style={{ flex: 1.6, display: 'flex', gap: 14, justifyContent: 'flex-end', alignItems: 'center' }}>
                      <button type="button" className="text-link" onClick={() => openEditTeacher(r)}>
                        Edit
                      </button>
                      <button type="button" className="text-link" onClick={() => void resetTeacher(r)}>
                        Reset password
                      </button>
                      <button type="button" className="text-link danger" onClick={() => setConfirmId(r.id)}>
                        Remove
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="tbl-row confirming">
                    <div style={{ flex: '1 1 320px' }}>
                      <strong>Remove {r.fullName}?</strong>
                      <div style={{ fontSize: 14, color: '#7a2a22' }}>
                        They lose access straight away. Their marks stay in the gradebook. This
                        can not be undone.
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button type="button" className="btn danger" onClick={() => void remove(r)}>
                        Remove teacher
                      </button>
                      <button type="button" className="btn secondary" onClick={() => setConfirmId(null)}>
                        Keep teacher
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="m-cards">
            {rows.map((r) => (
              <div key={r.id} className="m-card">
                {confirmId !== r.id ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{r.fullName}</strong>
                      <span className="chip ok">Active</span>
                    </div>
                    <div className="small">{r.email}</div>
                    <div className="small">{teaches.get(r.id) ?? r.subject ?? ''}</div>
                    <div style={{ marginTop: 6, display: 'flex', gap: 16 }}>
                      <button type="button" className="text-link" onClick={() => openEditTeacher(r)}>
                        Edit
                      </button>
                      <button type="button" className="text-link" onClick={() => void resetTeacher(r)}>
                        Reset password
                      </button>
                      <button type="button" className="text-link danger" onClick={() => setConfirmId(r.id)}>
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>Remove {r.fullName}?</strong>
                    <div style={{ fontSize: 14, color: '#7a2a22' }}>
                      She loses access straight away. Her marks stay in the gradebook. This can
                      not be undone.
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                      <button type="button" className="btn danger" onClick={() => void remove(r)}>
                        Remove teacher
                      </button>
                      <button type="button" className="btn secondary" onClick={() => setConfirmId(null)}>
                        Keep teacher
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------ assignments (08)

function AssignmentsPanel({ onFail }: { onFail: Fail }) {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.assignments().then(setAssignments),
      adminApi.teachers().then(setTeachers),
      adminApi.subjects().then(setSubjects),
      adminApi.classes().then(setClasses),
    ])
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  function applicable(c: SchoolClass, s: Subject): boolean {
    return s.isCore || s.programme === 'CORE' || s.programme === c.programme;
  }

  async function changeTeacher(cls: SchoolClass, subj: Subject, teacherId: number | '') {
    const existing = assignments.find((a) => a.classId === cls.id && a.subjectId === subj.id);
    try {
      if (existing) await adminApi.deleteAssignment(existing.id);
      if (teacherId !== '') {
        await adminApi.createAssignment({ teacherId, subjectId: subj.id, classId: cls.id });
      }
      setNotice('Assignment updated.');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div>
      <PageHead crumb="Administrator / Assignments" title="Assignments" />
      <p className="lede">
        Choose who teaches each subject in each class. Teachers then see that class in their
        marks.
      </p>
      {notice && <p className="success-note">{notice}</p>}
      {loading ? (
        <Loading />
      ) : (
        <div className="tbl">
          <div className="tbl-head">
            <div style={{ flex: 1.5 }}>Class</div>
            <div style={{ flex: 2 }}>Subject</div>
            <div style={{ flex: 2.4 }}>Teacher</div>
          </div>
          {classes.map((c) =>
            subjects
              .filter((s) => applicable(c, s))
              .map((s) => {
                const a = assignments.find((x) => x.classId === c.id && x.subjectId === s.id);
                return (
                  <div key={`${c.id}-${s.id}`} className="tbl-row">
                    <div style={{ flex: 1.5 }}>
                      <strong>{c.name}</strong>
                    </div>
                    <div style={{ flex: 2 }}>{s.name}</div>
                    <div style={{ flex: 2.4 }}>
                      <select
                        className="input"
                        style={{ borderColor: a ? '#c3c8de' : '#e0a000' }}
                        value={a?.teacherId ?? ''}
                        onChange={(e) =>
                          void changeTeacher(c, s, e.target.value === '' ? '' : Number(e.target.value))
                        }
                        aria-label={`${s.name} teacher in ${c.name}`}
                      >
                        <option value="">Not assigned</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }),
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ terms (18)
// Terms live in the backend (GET/POST /admin/terms, open/close
// endpoints). The open term is the school's current semester: marks
// are entered for it, and closing it locks mark entry server-side.

function TermsPanel({ onFail }: { onFail: Fail }) {
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [tName, setTName] = useState('');
  const [tSemester, setTSemester] = useState('');
  const [tDates, setTDates] = useState('');

  const refresh = useCallback(() => {
    setLoading(true);
    adminApi
      .terms()
      .then(setTerms)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  async function setOpen(t: TermRow, open: boolean) {
    setNotice(null);
    try {
      const updated = open ? await adminApi.openTerm(t.id) : await adminApi.closeTerm(t.id);
      setTerms((prev) =>
        prev.map((x) =>
          x.id === updated.id ? updated : open ? { ...x, open: false } : x,
        ),
      );
      setNotice(open ? `${updated.name} is open. Teachers can enter marks.` : `${updated.name} is closed. Marks are locked.`);
    } catch (err) {
      onFail(err);
    }
  }

  async function createTerm(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      await adminApi.createTerm({
        name: tName.trim(),
        semester: tSemester.trim(),
        dates: tDates.trim() || null,
      });
      setTName('');
      setTSemester('');
      setTDates('');
      setFormOpen(false);
      setNotice('Term added. Open it when it starts.');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  const closedTerms = terms.filter((t) => !t.open);
  const anyOpen = terms.some((t) => t.open);

  return (
    <div>
      <PageHead crumb="Administrator / Terms" title="Terms">
        <button type="button" className="btn" onClick={() => setFormOpen((v) => !v)}>
          Add term
        </button>
      </PageHead>
      <p className="lede">
        Teachers can enter and change marks only while a term is open. Close a term when marks
        are final. Results then appear in each student's history.
      </p>
      {notice && <p className="success-note">{notice}</p>}
      {formOpen && (
        <form onSubmit={createTerm} className="add-panel">
          <div className="form-grid">
            <div>
              <span className="label">Term name</span>
              <input className="input" value={tName} onChange={(e) => setTName(e.target.value)} required placeholder="e.g. Term 2" />
            </div>
            <div>
              <span className="label">Semester code</span>
              <input className="input" value={tSemester} onChange={(e) => setTSemester(e.target.value)} required placeholder="e.g. 2025/2026-2" />
            </div>
            <div>
              <span className="label">Dates</span>
              <input className="input" value={tDates} onChange={(e) => setTDates(e.target.value)} placeholder="e.g. 12 January to 27 March" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn">Add term</button>
            <button type="button" className="btn secondary" onClick={() => setFormOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
      {loading ? (
        <Loading />
      ) : (
        <div className="tbl">
          <div className="tbl-head">
            <span style={{ flex: '2 1 160px' }}>Term</span>
            <span style={{ flex: '1 1 140px' }}>Status</span>
            <span style={{ flex: '2 1 220px' }} />
          </div>
          {terms.map((t) => (
            <div key={t.id} className="tbl-row" style={{ flexWrap: 'wrap', padding: '14px 18px' }}>
              <div style={{ flex: '2 1 160px' }}>
                <strong>{t.name}</strong>
                <div style={{ color: '#5c6488', fontSize: 13 }}>
                  {t.dates ?? t.semester}
                </div>
              </div>
              <div style={{ flex: '1 1 140px' }}>
                {t.open ? (
                  <span className="chip ok">Open</span>
                ) : (
                  <span className="chip neutral">{anyOpen ? 'Closed' : 'Not started'}</span>
                )}
              </div>
              <div style={{ flex: '2 1 220px', display: 'flex', justifyContent: 'flex-end' }}>
                {t.open ? (
                  <button type="button" className="btn" onClick={() => void setOpen(t, false)}>
                    Close term
                  </button>
                ) : (
                  <button type="button" className="btn secondary" onClick={() => void setOpen(t, true)}>
                    {anyOpen ? 'Reopen term' : 'Start term'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {!anyOpen && closedTerms.length > 0 && (
        <p className="notice-amber">
          No term is open. Marks are locked and teachers can no longer edit them until a term is
          opened.
        </p>
      )}
    </div>
  );
}

// ----------------------------------------------------- grading scale (09)

function ScalesPanel({ onFail }: { onFail: Fail }) {
  const [rows, setRows] = useState<GradingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [remark, setRemark] = useState('');
  const [editing, setEditing] = useState<GradingScale | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cwPct, setCwPct] = useState('30');
  const [examPct, setExamPct] = useState('70');
  const [savingWeights, setSavingWeights] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.gradingScales().then((r) => setRows([...r].sort((a, b) => b.minScore - a.minScore))),
      adminApi.weights().then((w) => {
        setCwPct(String(w.classWeightPercent));
        setExamPct(String(w.examWeightPercent));
      }),
    ])
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  async function saveWeights() {
    const cw = Number(cwPct);
    if (!Number.isInteger(cw) || cw < 0 || cw > 100) {
      setNotice('Class work percent must be a whole number between 0 and 100.');
      return;
    }
    setSavingWeights(true);
    setNotice(null);
    try {
      const w = await adminApi.updateWeights(cw);
      setCwPct(String(w.classWeightPercent));
      setExamPct(String(w.examWeightPercent));
      setNotice(
        `Weighting saved: class work ${w.classWeightPercent}%, exam ${w.examWeightPercent}%.` +
          (w.totalsUpdated ? ` ${w.totalsUpdated} existing totals were recalculated.` : ''),
      );
    } catch (err) {
      onFail(err);
    } finally {
      setSavingWeights(false);
    }
  }

  useEffect(refresh, [refresh]);

  function resetForm() {
    setLetter('');
    setMinScore('');
    setMaxScore('');
    setRemark('');
    setEditing(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const body = {
        letter: letter.trim().toUpperCase(),
        minScore: Number(minScore),
        maxScore: Number(maxScore),
        remark: remark.trim(),
      };
      if (editing) {
        await adminApi.updateGradingScale(editing.id, body);
        setNotice('Grading scale updated.');
      } else {
        await adminApi.createGradingScale(body);
        setNotice('Grading scale created.');
      }
      resetForm();
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: GradingScale) {
    if (!window.confirm(`Delete grade "${row.letter}" (${row.minScore}–${row.maxScore})?`)) return;
    try {
      await adminApi.deleteGradingScale(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div>
      <PageHead crumb="Administrator / Grading scale" title="Grading scale">
        <button type="submit" form="scale-form" className="btn">
          Save changes
        </button>
      </PageHead>
      {notice && <p className="success-note">{notice}</p>}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 440px', minWidth: 0 }}>
          {loading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState title="No grading scale yet" text="Add the grade bands your school uses, starting with the form below." />
          ) : (
            <div className="tbl">
              <div className="tbl-head">
                <div style={{ flex: 1 }}>Grade</div>
                <div style={{ flex: 2 }}>Remark</div>
                <div style={{ flex: 2 }}>Marks</div>
                <div style={{ flex: 1.2 }} />
              </div>
              {rows.map((r) => (
                <div key={r.id} className="tbl-row">
                  <div style={{ flex: 1 }}>
                    <GradeChip letter={r.letter} />
                  </div>
                  <div style={{ flex: 2 }}>{r.remark}</div>
                  <div style={{ flex: 2 }}>
                    <span className="num">
                      {r.minScore} to {r.maxScore}
                    </span>
                  </div>
                  <div style={{ flex: 1.2, display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        setEditing(r);
                        setLetter(r.letter);
                        setMinScore(String(r.minScore));
                        setMaxScore(String(r.maxScore));
                        setRemark(r.remark);
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="text-link danger" onClick={() => void remove(r)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <form id="scale-form" onSubmit={submit} className="add-panel" style={{ marginTop: 18 }}>
            <div className="form-grid">
              <div>
                <span className="label">Letter</span>
                <input className="input" value={letter} onChange={(e) => setLetter(e.target.value)} required maxLength={2} placeholder="A1" />
              </div>
              <div>
                <span className="label">Remark</span>
                <input className="input" value={remark} onChange={(e) => setRemark(e.target.value)} required placeholder="e.g. Excellent" />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <span className="label">Minimum score</span>
                <input className="input" type="number" min={0} max={100} step="any" value={minScore} onChange={(e) => setMinScore(e.target.value)} required />
              </div>
              <div>
                <span className="label">Maximum score</span>
                <input className="input" type="number" min={0} max={100} step="any" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} required />
              </div>
            </div>
            <p className="small" style={{ marginTop: 0 }}>
              Ranges must not overlap (WAEC default: A1 90–100, B2 80–89, B3 70–79, C4 60–69, C5
              55–59, C6 50–54, D7 45–49, E8 40–44, F9 0–39).
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn">{editing ? 'Save grade' : 'Add grade'}</button>
              {editing && (
                <button type="button" className="btn secondary" onClick={resetForm}>Cancel</button>
              )}
            </div>
          </form>
        </div>
        <div className="card" style={{ flex: '0 1 320px', padding: 20 }}>
          <h2 style={{ margin: '0 0 14px', fontSize: 18 }}>How the total is worked out</h2>
          <span className="label">Class work counts for</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input
              type="text"
              value={cwPct}
              onChange={(e) => {
                setCwPct(e.target.value);
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n <= 100) setExamPct(String(100 - n));
              }}
              className="input num"
              style={{ width: 90 }}
            />
            <span>percent</span>
          </div>
          <span className="label">Exam counts for</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="text"
              value={examPct}
              onChange={(e) => {
                setExamPct(e.target.value);
                const n = Number(e.target.value);
                if (Number.isInteger(n) && n >= 0 && n <= 100) setCwPct(String(100 - n));
              }}
              className="input num"
              style={{ width: 90 }}
            />
            <span>percent</span>
          </div>
          <p style={{ color: '#5c6488', fontSize: 14, margin: '14px 0' }}>
            The two add up to 100 percent. Saving recalculates every total already entered.
          </p>
          <button type="button" className="btn" onClick={() => void saveWeights()} disabled={savingWeights}>
            {savingWeights ? 'Saving…' : 'Save weighting'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------- school profile (10)

function SchoolPanel({ onFail }: { onFail: Fail }) {
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [town, setTown] = useState('');
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .school()
      .then((s) => {
        setSchool(s);
        setName(s.name);
        setTown(s.town ?? '');
        setRegion(s.region ?? '');
        setAddress(s.address ?? '');
        setEmail(s.email ?? '');
        setPhone(s.phone ?? '');
      })
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const updated = await adminApi.updateSchool({
        name: name.trim(),
        town: town.trim() || null,
        region: region.trim() || null,
        address: address.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
      });
      setSchool(updated);
      setNotice('School profile updated.');
    } catch (err) {
      onFail(err);
    }
  }

  if (loading) return <Loading />;
  if (!school) return <EmptyState title="No school profile" text="No school profile found." />;

  return (
    <div>
      <PageHead crumb="Administrator / School profile" title="School profile">
        <button type="submit" form="school-form" className="btn">
          Save changes
        </button>
      </PageHead>
      {notice && <p className="success-note">{notice}</p>}
      <form id="school-form" onSubmit={submit}>
        <div className="card" style={{ padding: 26, maxWidth: 760 }}>
          <div className="form-grid" style={{ marginBottom: 0 }}>
            <div style={{ flex: '1 1 280px' }}>
              <span className="label">School name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <span className="label">Town</span>
              <input className="input" value={town} onChange={(e) => setTown(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="card" style={{ padding: 26, maxWidth: 760, marginTop: 18 }}>
          <div className="form-grid">
            <div style={{ flex: '1 1 280px' }}>
              <span className="label">Region</span>
              <input className="input" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <span className="label">Address</span>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div className="form-grid" style={{ marginBottom: 0 }}>
            <div style={{ flex: '1 1 280px' }}>
              <span className="label">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div style={{ flex: '1 1 280px' }}>
              <span className="label">Phone</span>
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// ------------------------------------------------------------- more (30)

function MorePanel({ onTab, onLogout }: { onTab: (t: AdminTab) => void; onLogout: () => void }) {
  const items: { label: string; tab: AdminTab }[] = [
    { label: 'Assignments', tab: 'assignments' },
    { label: 'Terms', tab: 'terms' },
    { label: 'Grading scale', tab: 'scales' },
    { label: 'School profile', tab: 'school' },
  ];
  return (
    <div>
      <PageHead crumb="Administrator" title="More" />
      {items.map((i) => (
        <button key={i.tab} type="button" className="more-item" onClick={() => onTab(i.tab)}>
          {i.label}
        </button>
      ))}
      <button type="button" className="more-item" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}
