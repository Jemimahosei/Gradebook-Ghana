/**
 * API client for Gradebook Ghana.
 *
 * Backend: Spring Boot on http://localhost:8080/api, JWT Bearer auth.
 * The JWT is stored in localStorage after login and cleared
 * on logout and on any 401 response. Demo credentials are shown on the
 * login page; the JWT secret is env-based on the server (dev default
 * only — see backend application.properties).
 *
 * Types follow the prototype backend's actual DTOs (see
 * backend/src/main/java/com/gradebook/controller/*).
 */
import axios from 'axios';
import type { AxiosError } from 'axios';

// ---------------------------------------------------------------- types

export type Role = 'ADMIN' | 'TEACHER' | 'STUDENT';

export interface AuthUser {
  name: string;
  role: Role;
  /** The user's own school (shown in the app header). Absent for sessions
   * stored before the multi-school upgrade — App.tsx hydrates it via me(). */
  schoolId?: number | null;
  schoolName?: string | null;
  demoSchool?: boolean;
}

export interface AuthResponse {
  token: string;
  role: Role;
  name: string;
  schoolId: number | null;
  schoolName: string | null;
  demoSchool: boolean;
}

/** One cell of the teacher's My Class grid: 30% class work + 70% exam. */
export interface GradeCell {
  classScore: number | null;
  examScore: number | null;
  total: number | null;
}

export interface MyClassStudent {
  id: number;
  fullName: string;
  indexNumber: string;
  grades: Record<string, number | null>;
  gradeCells: Record<string, GradeCell>;
  average: number | null;
  grade: string;
  rank: number | null;
  published: boolean;
}

export interface MyClass {
  isClassTeacher: boolean;
  className?: string;
  programme?: string;
  subjects?: string[];
  students?: MyClassStudent[];
  semester?: string;
}

export interface SubjectAssignment {
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
}

export interface RankEntry {
  rank: number;
  studentId: number;
  studentName: string;
  average: number;
  grade: string;
}

export interface GradeRequest {
  studentId: number;
  subject: string;
  classScore: number | null;
  examScore: number | null;
}

export interface RosterStudent {
  id: number;
  fullName: string;
  indexNumber: string;
  programme: string;
  year: number;
  classId: number | null;
  className: string | null;
}

export interface GradeRow {
  id: number;
  studentId: number;
  subject: string;
  classScore: number | null;
  examScore: number | null;
  score: number | null;
  semester: string;
  published: boolean;
}

export interface SubjectAverage {
  subject: string;
  average: number | null;
  letter: string | null;
}

export interface StudentDashboard {
  student: { id: number; fullName: string; indexNumber: string };
  className: string | null;
  overallAverage: number | null;
  classRank: number | null;
  classSize: number;
  subjectAverages: SubjectAverage[];
  semester: string;
}

export interface StudentResult {
  subject: string;
  classScore: number | null;
  examScore: number | null;
  total: number | null;
  letter: string | null;
  remark: string | null;
  published: boolean;
}

export interface ClassSummary {
  classId: number;
  className: string;
  studentCount: number;
  average: number | null;
}

export interface AdminDashboard {
  studentCount: number;
  teacherCount: number;
  classCount: number;
  subjectCount: number;
  assessmentCount: number;
  classSummaries: ClassSummary[];
}

export interface SchoolClass {
  id: number;
  name: string;
  programme: string;
  formYear: number;
  classTeacherId: number | null;
  classTeacherName: string | null;
}

export interface Subject {
  id: number;
  name: string;
  programme: string;
  isCore: boolean;
}

export interface AdminStudent {
  id: number;
  fullName: string;
  indexNumber: string;
  programme: string;
  year: number;
  classId: number | null;
  className: string | null;
  /** Returned once, on create only: the student's login password, so the
   * admin can pass it on (there is no email sending). */
  temporaryPassword?: string;
  loginUsername?: string;
}

export interface TeacherRow {
  id: number;
  fullName: string;
  email: string;
  subject: string | null;
  /** Returned once, on create only, when the server generated the password. */
  temporaryPassword?: string;
  loginUsername?: string;
}

export interface AssignmentRow {
  id: number;
  teacherId: number;
  teacherName: string;
  subjectId: number;
  subjectName: string;
  classId: number;
  className: string;
}

export interface RegisterSchoolBody {
  schoolName: string;
  town: string;
  region: string;
  contactName: string;
  email: string;
  password: string;
}

export interface GradingScale {
  id: number;
  letter: string;
  minScore: number;
  maxScore: number;
  remark: string;
}

export interface AdminUserRow {
  id: number;
  username: string;
  fullName: string;
  role: Role;
}

export interface SchoolProfile {
  id: number;
  name: string;
  town: string | null;
  region: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  demoSchool: boolean;
}

export const PROGRAMMES = ['SCIENCE', 'GENERAL ARTS', 'BUSINESS', 'VISUAL ARTS'] as const;

// ------------------------------------------------------------- errors

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const TOKEN_KEY = 'gg_token';
const USER_KEY = 'gg_user';

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function statusMessage(status: number): string {
  if (status === 401)
    return 'Your session has expired or the credentials are invalid. Please log in again.';
  if (status === 403) return 'You do not have permission to do that (403 Forbidden).';
  if (status === 404) return 'That item was not found (404).';
  if (status === 400) return 'The server rejected that input (400). Check the form and try again.';
  return `Request failed (HTTP ${status}).`;
}

// ------------------------------------------------------------ client

// API base URL: set REACT_APP_API_URL at build time for a deployed backend
// (e.g. the Render service URL + /api). Falls back to the local backend.
const API_BASE_URL =
  process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const status = err.response?.status ?? 0;
    if (status === 401) clearSession();
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    const message =
      (typeof data === 'string' ? data : data?.message ?? data?.error) ||
      (status === 0
        ? `Could not reach the backend at ${API_BASE_URL}. Is it running?`
        : statusMessage(status));
    throw new ApiError(status, message);
  },
);

async function download(path: string, filename: string): Promise<void> {
  const res = await api.get(path, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// -------------------------------------------------------------- auth

export async function login(username: string, password: string): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/login', { username, password });
  return storeAuth(data);
}

/** Public school signup: creates the school + its first admin, logs them in. */
export async function registerSchool(body: RegisterSchoolBody): Promise<AuthUser> {
  const { data } = await api.post<AuthResponse>('/auth/register-school', body);
  return storeAuth(data);
}

function storeAuth(data: AuthResponse): AuthUser {
  localStorage.setItem(TOKEN_KEY, data.token);
  const user: AuthUser = {
    name: data.name,
    role: data.role,
    schoolId: data.schoolId,
    schoolName: data.schoolName,
    demoSchool: data.demoSchool,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

/** Who is logged in (school included) — for sessions stored before the upgrade. */
export async function me(): Promise<AuthUser> {
  const { data } = await api.get<AuthResponse>('/auth/me');
  const user: AuthUser = {
    name: data.name,
    role: data.role,
    schoolId: data.schoolId,
    schoolName: data.schoolName,
    demoSchool: data.demoSchool,
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function logout(): void {
  clearSession();
}

// ------------------------------------------------------------- admin

export const adminApi = {
  dashboard: () => api.get<AdminDashboard>('/admin/dashboard').then((r) => r.data),
  users: () => api.get<AdminUserRow[]>('/admin/users').then((r) => r.data),

  classes: () => api.get<SchoolClass[]>('/admin/classes').then((r) => r.data),
  createClass: (body: { name: string; programme: string; formYear: number; classTeacherId: number | null }) =>
    api.post<SchoolClass>('/admin/classes', body).then((r) => r.data),
  updateClass: (id: number, body: { name: string; programme: string; formYear: number; classTeacherId: number | null }) =>
    api.put<SchoolClass>(`/admin/classes/${id}`, body).then((r) => r.data),
  deleteClass: (id: number) => api.delete(`/admin/classes/${id}`),

  subjects: () => api.get<Subject[]>('/admin/subjects').then((r) => r.data),
  createSubject: (body: { name: string; programme: string; isCore: boolean }) =>
    api.post<Subject>('/admin/subjects', body).then((r) => r.data),
  updateSubject: (id: number, body: { name: string; programme: string; isCore: boolean }) =>
    api.put<Subject>(`/admin/subjects/${id}`, body).then((r) => r.data),
  deleteSubject: (id: number) => api.delete(`/admin/subjects/${id}`),

  students: () => api.get<AdminStudent[]>('/admin/students').then((r) => r.data),
  createStudent: (body: { fullName: string; indexNumber: string; programme: string; year: number; classId: number | null }) =>
    api.post<AdminStudent>('/admin/students', body).then((r) => r.data),
  updateStudent: (id: number, body: { fullName: string; indexNumber: string; programme: string; year: number; classId: number | null }) =>
    api.put<AdminStudent>(`/admin/students/${id}`, body).then((r) => r.data),
  deleteStudent: (id: number) => api.delete(`/admin/students/${id}`),

  teachers: () => api.get<TeacherRow[]>('/admin/teachers').then((r) => r.data),
  createTeacher: (body: { fullName: string; email: string; subject: string; password: string }) =>
    api.post<TeacherRow>('/admin/teachers', body).then((r) => r.data),
  deleteTeacher: (id: number) => api.delete(`/admin/teachers/${id}`),

  assignments: () => api.get<AssignmentRow[]>('/admin/assignments').then((r) => r.data),
  createAssignment: (body: { teacherId: number; subjectId: number; classId: number }) =>
    api.post<AssignmentRow>('/admin/assignments', body).then((r) => r.data),
  deleteAssignment: (id: number) => api.delete(`/admin/assignments/${id}`),

  gradingScales: () => api.get<GradingScale[]>('/admin/grading-scales').then((r) => r.data),
  createGradingScale: (body: { letter: string; minScore: number; maxScore: number; remark: string }) =>
    api.post<GradingScale>('/admin/grading-scales', body).then((r) => r.data),
  updateGradingScale: (id: number, body: { letter: string; minScore: number; maxScore: number; remark: string }) =>
    api.put<GradingScale>(`/admin/grading-scales/${id}`, body).then((r) => r.data),
  deleteGradingScale: (id: number) => api.delete(`/admin/grading-scales/${id}`),

  school: () => api.get<SchoolProfile>('/admin/school').then((r) => r.data),
  updateSchool: (body: { name: string; town: string | null; region: string | null; address: string | null; email: string | null; phone: string | null }) =>
    api.put<SchoolProfile>('/admin/school', body).then((r) => r.data),
};

// ----------------------------------------------------------- teacher

export const teacherApi = {
  myClass: () => api.get<MyClass>('/teacher/my-class').then((r) => r.data),
  mySubjects: () => api.get<SubjectAssignment[]>('/teacher/my-subjects').then((r) => r.data),
  rankings: () => api.get<RankEntry[]>('/teacher/rankings').then((r) => r.data),
  publish: () => api.post<{ status: string; count: string }>('/teacher/publish').then((r) => r.data),
  saveGrades: (rows: GradeRequest[]) =>
    api.post<{ status: string; count: number }>('/grades/batch', rows).then((r) => r.data),
  studentsByClass: (classId: number) =>
    api.get<RosterStudent[]>(`/students/by-class/${classId}`).then((r) => r.data),
  allGrades: () => api.get<GradeRow[]>('/grades').then((r) => r.data),
};

// ----------------------------------------------------------- student

export const studentApi = {
  dashboard: () => api.get<StudentDashboard>('/student/me/dashboard').then((r) => r.data),
  results: () => api.get<StudentResult[]>('/student/me/results').then((r) => r.data),
  reportCard: (format: 'pdf' | 'csv') =>
    download(`/student/me/report-card?format=${format}`, `report-card.${format}`),
};

// ------------------------------------------------------------ helpers

/** Weighted total for the 30% class work + 70% exam split; null until both are present. */
export function weightedTotal(classScore: number | null, examScore: number | null): number | null {
  if (classScore === null || classScore === undefined || examScore === null || examScore === undefined)
    return null;
  return Math.round((0.3 * classScore + 0.7 * examScore) * 100) / 100;
}

export function formatAverage(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(2)}%`;
}
