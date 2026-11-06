import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PROGRAMMES, adminApi, formatAverage } from '../lib/api';
import type {
  AdminDashboard as AdminDashboardData,
  AdminStudent,
  AdminUserRow,
  AssignmentRow,
  GradingScale,
  SchoolClass,
  SchoolProfile,
  Subject,
  TeacherRow,
} from '../lib/api';
import { Card, Empty, ErrorBanner, Field, Loading, errorText, isUnauthorized } from '../components';

/**
 * Admin portal — dashboard counts, classes, subjects, students, grading
 * scale (WAEC A1–F9), school profile, and the user list. All writes go
 * through the admin API; the backend enforces ADMIN-only access and
 * rejects overlapping grading-scale ranges.
 */
export default function AdminDashboard({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [tab, setTab] = useState<
    | 'dashboard'
    | 'classes'
    | 'subjects'
    | 'students'
    | 'teachers'
    | 'assignments'
    | 'scales'
    | 'school'
    | 'users'
  >('dashboard');
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
      <h2>Admin portal</h2>
      <div className="tabs">
        {(
          [
            ['dashboard', 'Dashboard'],
            ['classes', 'Classes'],
            ['subjects', 'Subjects'],
            ['students', 'Students'],
            ['teachers', 'Teachers'],
            ['assignments', 'Assignments'],
            ['scales', 'Grading scale'],
            ['school', 'School profile'],
            ['users', 'Users'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'tab active' : 'tab'}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'dashboard' && <DashboardPanel onFail={onFail} />}
      {tab === 'classes' && <ClassManager onFail={onFail} />}
      {tab === 'subjects' && <SubjectManager onFail={onFail} />}
      {tab === 'students' && <StudentManager onFail={onFail} />}
      {tab === 'teachers' && <TeacherManager onFail={onFail} />}
      {tab === 'assignments' && <AssignmentManager onFail={onFail} />}
      {tab === 'scales' && <ScaleManager onFail={onFail} />}
      {tab === 'school' && <SchoolPanel onFail={onFail} />}
      {tab === 'users' && <UserList onFail={onFail} />}
    </div>
  );
}

// ---------------------------------------------------------- dashboard

function DashboardPanel({ onFail }: { onFail: (err: unknown) => void }) {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .dashboard()
      .then(setData)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  if (loading) return <Loading />;
  if (!data) return <Empty text="No dashboard data available." />;

  const isEmptySchool =
    data.studentCount === 0 && data.teacherCount === 0 && data.classCount === 0;

  return (
    <div>
      {isEmptySchool && (
        <div className="demo-box" role="note">
          <h2>Getting started</h2>
          <p>Your school is set up. To get grading:</p>
          <ol>
            <li>
              <strong>Add teachers</strong> under the Teachers tab — each gets a login you can
              share with them.
            </li>
            <li>
              <strong>Add classes</strong> under the Classes tab and pick a class teacher for
              each.
            </li>
            <li>
              <strong>Add students</strong> under the Students tab, into their classes.
            </li>
            <li>Teachers sign in, enter marks, and publish. Students see their report cards.</li>
          </ol>
          <p className="small">
            Your school already has the standard WAEC grading scale and subject list filled in —
            change them under Grading scale and Subjects if you need to.
          </p>
        </div>
      )}
      <div className="stats-grid">
        <Card title="Students" value={String(data.studentCount)} />
        <Card title="Teachers" value={String(data.teacherCount)} />
        <Card title="Classes" value={String(data.classCount)} />
        <Card title="Subjects" value={String(data.subjectCount)} />
      </div>
      <h2>Classes</h2>
      {data.classSummaries.length === 0 ? (
        <Empty text="No classes yet." />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Class</th>
                <th>Students</th>
                <th>Class average</th>
              </tr>
            </thead>
            <tbody>
              {data.classSummaries.map((c) => (
                <tr key={c.classId}>
                  <td>{c.className}</td>
                  <td>{c.studentCount}</td>
                  <td>{formatAverage(c.average)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ classes

function ClassManager({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [programme, setProgramme] = useState<string>('SCIENCE');
  const [formYear, setFormYear] = useState('1');
  const [classTeacherId, setClassTeacherId] = useState<number | ''>('');
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.classes(),
      adminApi.users().then((u) => u.filter((x) => x.role === 'TEACHER')),
    ])
      .then(([c, t]) => {
        setRows(c);
        setTeachers(t);
      })
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  function resetForm() {
    setName('');
    setProgramme('SCIENCE');
    setFormYear('1');
    setClassTeacherId('');
    setEditing(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const body = {
        name: name.trim(),
        programme,
        formYear: Number(formYear),
        classTeacherId: classTeacherId === '' ? null : classTeacherId,
      };
      if (editing) {
        await adminApi.updateClass(editing.id, body);
        setNotice('Class updated.');
      } else {
        await adminApi.createClass(body);
        setNotice('Class created.');
      }
      resetForm();
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: SchoolClass) {
    if (!window.confirm(`Delete class "${row.name}"?`)) return;
    try {
      await adminApi.deleteClass(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div className="split">
      <form onSubmit={submit} className="form-card">
        <h2>{editing ? 'Edit class' : 'Add class'}</h2>
        <Field label="Class name">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. 3 Science 4" />
        </Field>
        <Field label="Programme">
          <select value={programme} onChange={(e) => setProgramme(e.target.value)}>
            {PROGRAMMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Form year">
          <input
            type="number"
            min={1}
            max={3}
            value={formYear}
            onChange={(e) => setFormYear(e.target.value)}
            required
          />
        </Field>
        <Field label="Class teacher" hint="Optional — the teacher who sees this class in My Class.">
          <select
            value={classTeacherId}
            onChange={(e) => setClassTeacherId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">No class teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.username})
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editing ? 'Save changes' : 'Create class'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
        {notice && <p className="success">{notice}</p>}
      </form>
      <div>
        <h2>Classes</h2>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No classes yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Programme</th>
                  <th>Form</th>
                  <th>Class teacher</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.programme}</td>
                    <td>{r.formYear}</td>
                    <td>{r.classTeacherName ?? '—'}</td>
                    <td className="actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setName(r.name);
                          setProgramme(r.programme);
                          setFormYear(String(r.formYear));
                          setClassTeacherId(r.classTeacherId ?? '');
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- subjects

function SubjectManager({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [programme, setProgramme] = useState<string>('CORE');
  const [isCore, setIsCore] = useState(true);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    adminApi
      .subjects()
      .then(setRows)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  function resetForm() {
    setName('');
    setProgramme('CORE');
    setIsCore(true);
    setEditing(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const body = { name: name.trim(), programme, isCore };
      if (editing) {
        await adminApi.updateSubject(editing.id, body);
        setNotice('Subject updated.');
      } else {
        await adminApi.createSubject(body);
        setNotice('Subject created.');
      }
      resetForm();
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: Subject) {
    if (!window.confirm(`Delete subject "${row.name}"?`)) return;
    try {
      await adminApi.deleteSubject(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div className="split">
      <form onSubmit={submit} className="form-card">
        <h2>{editing ? 'Edit subject' : 'Add subject'}</h2>
        <Field label="Subject name">
          <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Integrated Science" />
        </Field>
        <Field label="Programme" hint="CORE for subjects every programme takes; otherwise the programme it belongs to.">
          <select value={programme} onChange={(e) => setProgramme(e.target.value)}>
            <option value="CORE">CORE</option>
            {PROGRAMMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Core subject">
          <input
            type="checkbox"
            checked={isCore}
            onChange={(e) => setIsCore(e.target.checked)}
            style={{ width: 'auto' }}
          />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editing ? 'Save changes' : 'Create subject'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
        {notice && <p className="success">{notice}</p>}
      </form>
      <div>
        <h2>Subjects</h2>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No subjects yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Programme</th>
                  <th>Core</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.programme}</td>
                    <td>{r.isCore ? 'Yes' : 'No'}</td>
                    <td className="actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setName(r.name);
                          setProgramme(r.programme);
                          setIsCore(r.isCore);
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- students

function StudentManager({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<AdminStudent[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [programme, setProgramme] = useState<string>('SCIENCE');
  const [year, setYear] = useState('1');
  const [classId, setClassId] = useState<number | ''>('');
  const [editing, setEditing] = useState<AdminStudent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([adminApi.students(), adminApi.classes()])
      .then(([s, c]) => {
        setRows(s);
        setClasses(c);
      })
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  function resetForm() {
    setFullName('');
    setIndexNumber('');
    setProgramme('SCIENCE');
    setYear('1');
    setClassId('');
    setEditing(null);
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
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: AdminStudent) {
    if (!window.confirm(`Delete student "${row.fullName}" (${row.indexNumber})?`)) return;
    try {
      await adminApi.deleteStudent(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div className="split">
      <form onSubmit={submit} className="form-card">
        <h2>{editing ? 'Edit student' : 'Add student'}</h2>
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Kwame Mensah" />
        </Field>
        <Field label="Index number" hint="The student's login username.">
          <input value={indexNumber} onChange={(e) => setIndexNumber(e.target.value)} required placeholder="e.g. 0050101033" />
        </Field>
        <Field label="Programme">
          <select value={programme} onChange={(e) => setProgramme(e.target.value)}>
            {PROGRAMMES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <input type="number" min={1} max={3} value={year} onChange={(e) => setYear(e.target.value)} required />
        </Field>
        <Field label="Class">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editing ? 'Save changes' : 'Create student'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
        {notice && <p className="success">{notice}</p>}
      </form>
      <div>
        <h2>Students</h2>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No students yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Index No.</th>
                  <th>Programme</th>
                  <th>Class</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>{r.indexNumber}</td>
                    <td>{r.programme}</td>
                    <td>{r.className ?? '—'}</td>
                    <td className="actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(r);
                          setFullName(r.fullName);
                          setIndexNumber(r.indexNumber);
                          setProgramme(r.programme);
                          setYear(String(r.year));
                          setClassId(r.classId ?? '');
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" className="btn-danger" onClick={() => void remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------- teachers

function TeacherManager({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [password, setPassword] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    adminApi
      .teachers()
      .then(setRows)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    try {
      const created = await adminApi.createTeacher({
        fullName: fullName.trim(),
        email: email.trim(),
        subject: subject.trim(),
        password: password.trim(),
      });
      setNotice(
        created.temporaryPassword
          ? `Teacher created — login: ${created.loginUsername ?? created.email} / temporary password: ${created.temporaryPassword}. Share this with the teacher; there is no email sending.`
          : `Teacher created — login: ${created.loginUsername ?? created.email} with the password you set.`,
      );
      setFullName('');
      setEmail('');
      setSubject('');
      setPassword('');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: TeacherRow) {
    if (!window.confirm(`Delete teacher "${row.fullName}" (${row.email})?`)) return;
    try {
      await adminApi.deleteTeacher(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div className="split">
      <form onSubmit={submit} className="form-card">
        <h2>Add teacher</h2>
        <Field label="Full name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Mrs. Asante" />
        </Field>
        <Field label="Email" hint="The teacher's login username.">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="teacher@yourschool.edu.gh" />
        </Field>
        <Field label="Main subject">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Integrated Science" />
        </Field>
        <Field
          label="Password (optional)"
          hint="Leave blank and the system generates a temporary password, shown to you once after creating the teacher."
        >
          <input
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            placeholder="Leave blank for a generated password"
          />
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Create teacher
          </button>
        </div>
        {notice && <p className="success">{notice}</p>}
      </form>
      <div>
        <h2>Teachers</h2>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No teachers yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Main subject</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.fullName}</td>
                    <td>{r.email}</td>
                    <td>{r.subject ?? '—'}</td>
                    <td className="actions">
                      <button type="button" className="btn-danger" onClick={() => void remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------- assignments

function AssignmentManager({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherId, setTeacherId] = useState<number | ''>('');
  const [subjectId, setSubjectId] = useState<number | ''>('');
  const [classId, setClassId] = useState<number | ''>('');
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminApi.assignments(),
      adminApi.teachers(),
      adminApi.subjects(),
      adminApi.classes(),
    ])
      .then(([a, t, s, c]) => {
        setRows(a);
        setTeachers(t);
        setSubjects(s);
        setClasses(c);
      })
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  useEffect(refresh, [refresh]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setNotice(null);
    if (teacherId === '' || subjectId === '' || classId === '') return;
    try {
      await adminApi.createAssignment({ teacherId, subjectId, classId });
      setNotice('Assignment created.');
      setTeacherId('');
      setSubjectId('');
      setClassId('');
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  async function remove(row: AssignmentRow) {
    if (
      !window.confirm(
        `Remove ${row.teacherName} from ${row.subjectName} in ${row.className}?`,
      )
    )
      return;
    try {
      await adminApi.deleteAssignment(row.id);
      refresh();
    } catch (err) {
      onFail(err);
    }
  }

  return (
    <div className="split">
      <form onSubmit={submit} className="form-card">
        <h2>Assign a teacher</h2>
        <p className="small">
          A class teacher is automatically assigned to their class&rsquo;s subjects when the class
          is created. Use this form for subject teachers, or to change who teaches what.
        </p>
        <Field label="Teacher">
          <select
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value === '' ? '' : Number(e.target.value))}
            required
          >
            <option value="">Choose a teacher</option>
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.fullName} ({t.email})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Subject">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value === '' ? '' : Number(e.target.value))}
            required
          >
            <option value="">Choose a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Class">
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value === '' ? '' : Number(e.target.value))}
            required
          >
            <option value="">Choose a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Create assignment
          </button>
        </div>
        {notice && <p className="success">{notice}</p>}
      </form>
      <div>
        <h2>Assignments</h2>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No assignments yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Subject</th>
                  <th>Class</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.teacherName}</td>
                    <td>{r.subjectName}</td>
                    <td>{r.className}</td>
                    <td className="actions">
                      <button type="button" className="btn-danger" onClick={() => void remove(r)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- scales

function ScaleManager({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<GradingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [letter, setLetter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [maxScore, setMaxScore] = useState('');
  const [remark, setRemark] = useState('');
  const [editing, setEditing] = useState<GradingScale | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    adminApi
      .gradingScales()
      .then(setRows)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

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
    <div className="split">
      <form onSubmit={submit} className="form-card">
        <h2>{editing ? 'Edit grade' : 'Add grade'}</h2>
        <Field label="Letter">
          <input value={letter} onChange={(e) => setLetter(e.target.value)} required maxLength={2} placeholder="A1" />
        </Field>
        <Field label="Minimum score">
          <input type="number" min={0} max={100} step="any" value={minScore} onChange={(e) => setMinScore(e.target.value)} required />
        </Field>
        <Field label="Maximum score">
          <input type="number" min={0} max={100} step="any" value={maxScore} onChange={(e) => setMaxScore(e.target.value)} required />
        </Field>
        <Field label="Remark">
          <input value={remark} onChange={(e) => setRemark(e.target.value)} required placeholder="e.g. Excellent" />
        </Field>
        <p className="small">
          Ranges must not overlap (WAEC default: A1 90–100, B2 80–89, B3 70–79, C4 60–69, C5
          55–59, C6 50–54, D7 45–49, E8 40–44, F9 0–39). Changing a range changes every grade
          letter derived from it.
        </p>
        <div className="form-actions">
          <button type="submit" className="btn-primary">
            {editing ? 'Save changes' : 'Create grade'}
          </button>
          {editing && (
            <button type="button" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
        {notice && <p className="success">{notice}</p>}
      </form>
      <div>
        <h2>Grading scale</h2>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty text="No grading scale rows yet." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Letter</th>
                  <th>Range</th>
                  <th>Remark</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.letter}</td>
                    <td>
                      {r.minScore}–{r.maxScore}
                    </td>
                    <td>{r.remark}</td>
                    <td className="actions">
                      <button
                        type="button"
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
                      <button type="button" className="btn-danger" onClick={() => void remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- school

function SchoolPanel({ onFail }: { onFail: (err: unknown) => void }) {
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
  if (!school) return <Empty text="No school profile found." />;

  return (
    <form onSubmit={submit} className="form-card" style={{ maxWidth: 640 }}>
      <h2>School profile</h2>
      <Field label="School name">
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <Field label="Town">
        <input value={town} onChange={(e) => setTown(e.target.value)} placeholder="e.g. Kumasi" />
      </Field>
      <Field label="Region">
        <input value={region} onChange={(e) => setRegion(e.target.value)} placeholder="e.g. Ashanti Region" />
      </Field>
      <Field label="Address">
        <input value={address} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <Field label="Email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} />
      </Field>
      <div className="form-actions">
        <button type="submit" className="btn-primary">
          Save school profile
        </button>
      </div>
      {notice && <p className="success">{notice}</p>}
    </form>
  );
}

// --------------------------------------------------------------- users

function UserList({ onFail }: { onFail: (err: unknown) => void }) {
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .users()
      .then(setRows)
      .catch(onFail)
      .finally(() => setLoading(false));
  }, [onFail]);

  if (loading) return <Loading />;
  if (rows.length === 0) return <Empty text="No users yet." />;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Username (email)</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.role}-${r.id}`}>
              <td>{r.fullName}</td>
              <td>{r.username}</td>
              <td>{r.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small">
        Teacher accounts are created under the Teachers tab. Students are managed under the
        Students tab and log in with their index number.
      </p>
    </div>
  );
}
