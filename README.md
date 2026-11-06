# Gradebook Ghana — Working Prototype

Demo Senior High School gradebook: WAEC A1–F9 grades, 30% class work + 70% exam,
teacher / student / admin portals. Built from the Mac app (Spring Boot + JWT +
Create React App) with the §14 defects fixed and the from-scratch Admin +
Student pages ported in. Spec: UI-SPEC.md (§13 acceptance bar, §14 defects) — kept with the project notes, not in this repo.

## MVP upgrade (Nov 6, 2026) — real schools can sign up and use it

The prototype is now a multi-school, free community tool, not a single-school
demo. A logged-out visitor lands on a public landing page (what it is, what it
does, how a school starts, demo accounts); a school registers at
**Register your school** and gets its own isolated gradebook.

- **Public landing page** (`/` when logged out): plain copy — free grading for
  Ghanaian senior high schools, built by Jemimah Osei as a community project.
  Features, 4-step start, "Register your school" + "Log in" + a "Try the demo"
  section with the demo logins. No invented numbers, testimonials, or schools.
- **School signup** (`POST /api/auth/register-school`, public): school name,
  town, region, contact person name, email, password. Creates the School +
  its first ADMIN (contact person), seeds the standard WAEC A1–F9 scale and
  the 17-subject list, and logs the admin straight in.
- **Multi-tenancy**: every school-scoped record (admins, teachers, classes,
  subjects, students, grading scales) carries a `school_id`. All API queries
  filter by the authenticated user's school (resolved from the user row on
  each request — never from a JWT claim or a request parameter). Another
  school's record reads as "not found" (404): lists, creates, updates,
  deletes, grade saves, and student record views are all scoped. Grades and
  report cards belong to a school through their student.
- **Onboarding**: new schools start with the WAEC scale + subjects seeded.
  The admin creates teachers (server-generated temporary password shown once
  in the UI — no email sending), classes (class teacher is auto-assigned to
  the class's subjects: core + programme), students (temporary password shown
  once), and manages subject assignments on the Assignments tab. A
  "Getting started" box on the empty admin dashboard walks through the order.
- **App shell**: the header shows the logged-in user's own school name; the
  footer says "demo only" only for the demo school (real schools get the
  community-project line). Report-card PDFs carry the "Demo data" line only
  for the demo school.
- **Upgrade path for the live database** (Neon, currently demo-only data):
  on first boot after deploy, `ddl-auto=update` adds the new nullable
  columns (`school_id` on admins/teachers/classes/subjects/students/
  grading_scales, `town` + `demo` on schools — no manual step, no downtime
  beyond the deploy) and `SchoolBackfill` (runs before the seeder) assigns
  every pre-upgrade row to Demo Senior High School (verified: 67 rows) and
  marks it demo=true. It is idempotent — later boots are a no-op. Existing
  demo logins and data survive untouched.
- **Known MVP limits**: student index numbers are globally unique (not
  per-school); teacher/admin emails are globally unique. The free Render
  tier still sleeps when idle (~50s first load).

New endpoints: `POST /api/auth/register-school`, `GET /api/auth/me`,
`GET|POST|DELETE /api/admin/teachers`, `GET|POST|DELETE /api/admin/assignments`.
New/changed files: `model/*` (school links), `SchoolBackfill.java`,
`AuthService.java` (login school info + signup + seed defaults),
`CurrentUserService.java` (school resolution + school-scoped scales),
`AdminController.java` (scoped + teachers + assignments + temp passwords),
`TeacherController` / `GradeController` / `StudentController` /
`StudentMeController` (scoped), `AuthController.java`, `SecurityConfig.java`
(only login + register-school are unauthenticated now),
`ReportCardService.java` (demo footer flag), `frontend/src/pages/LandingPage.tsx`,
`frontend/src/pages/RegisterPage.tsx`, `App.tsx`, `Login.tsx`,
`AdminDashboard.tsx` (Teachers + Assignments tabs, getting-started box),
`lib/api.ts`, `App.css` (landing styles), `backend/tools/verify-mvp.sh`
(39-check MVP suite: signup → onboarding → publish → isolation).

## Demo accounts (password `demo123` for all)

| Role | Login | Who |
| --- | --- | --- |
| Admin | `admin@demo` | Demo Admin |
| Teacher | `teacher@demo` | Mrs. Asante — class teacher of **2 Arts 1**; also teaches Integrated Science in 3 Science 4 |
| Student | `0050101001` | Kwame Mensah, 3 Science 4 — has published grades |

Seeded data: Demo Senior High School, 4 classes (2 Arts 1, 3 Science 4,
1 Business 2, 1 Visual Arts 1), 32 students, 4 teachers, 1 admin, WAEC scale,
published grades for 3 Science 4 only (other classes start empty so the
teacher demo can enter marks live). Semester: `2025/2026-1` (server-owned,
never hardcoded in the UI).

## Run on jem's Mac (the real run — Postgres 16)

Prerequisites: JDK 17+ (her JDK 22 works — the pom targets Java 17 bytecode),
Maven (with her local cache; it downloads anything missing from Central),
Node 18+, PostgreSQL 16 running locally.

```bash
# 1. Create the database (once). The app creates the tables itself (ddl-auto=update).
createdb gradebook_ghana
# If your postgres superuser is not jemimahosei, create that role first:
#   psql -c "CREATE ROLE jemimahosei LOGIN PASSWORD '' SUPERUSER;"

# 2. Backend (port 8080)
cd backend
mvn spring-boot:run
# If your Postgres user/password differ from the defaults (jemimahosei / empty):
#   SPRING_DATASOURCE_USERNAME=<user> SPRING_DATASOURCE_PASSWORD=<pass> mvn spring-boot:run
# Set a real JWT secret before any shared deploy:
#   JWT_SECRET=<long random string, at least 32 bytes> mvn spring-boot:run

# 3. Frontend (port 3000) — in a second terminal
cd frontend
npm install
npm start
# If npm start fails with an OpenSSL error, retry with:
#   NODE_OPTIONS=--openssl-legacy-provider npm start
```

Then open http://localhost:3000 and sign in with a demo account above.

## Run in this VM (H2 stand-in — Maven Central is unreachable here)

Maven cannot download from Central in this VM, so dependencies are fetched
with curl instead. The tooling lives in `backend/tools/`:

```bash
# 1. Fetch the full dependency closure (105 jars, ~65 MB) into /tmp/gradebook-m2
cd backend/tools
python3 fetch-deps.py --extra com.h2database:h2:2.2.224 \
  org.junit.platform:junit-platform-console-standalone:1.10.2

# 2. Compile (note -parameters: Spring needs it for @RequestParam/@PathVariable names)
export JAVA_HOME=~/tools/jdk-17
export PATH=$JAVA_HOME/bin:$PATH
cd ../..
mkdir -p /tmp/gradebook-build/classes
find backend/src/main/java -name '*.java' > /tmp/gradebook-build/sources.txt
javac -parameters -encoding UTF-8 \
  -cp "$(paste -sd: /tmp/gradebook-m2/classpath.txt)" \
  -d /tmp/gradebook-build/classes @/tmp/gradebook-build/sources.txt
cp backend/src/main/resources/application.properties /tmp/gradebook-build/classes/

# 3. Run against H2 (in-memory; NON_KEYWORDS=YEAR is required because the
#    Student entity has an unquoted `year` column — legal in Postgres,
#    a reserved word in H2)
CP="/tmp/gradebook-build/classes:$(paste -sd: /tmp/gradebook-m2/classpath.txt)"
SPRING_DATASOURCE_URL='jdbc:h2:mem:gradebook;DB_CLOSE_DELAY=-1;NON_KEYWORDS=YEAR' \
SPRING_DATASOURCE_USERNAME=sa SPRING_DATASOURCE_PASSWORD= \
SPRING_DATASOURCE_DRIVER_CLASS_NAME=org.h2.Driver \
SPRING_JPA_PROPERTIES_HIBERNATE_DIALECT=org.hibernate.dialect.H2Dialect \
java -cp "$CP" com.gradebook.GradebookApplication

# 4. Frontend
cd frontend
npm install
npm run build   # production build; or: npm start (dev server on :3000)
```

For a restart-persistent H2 run, use a file URL instead of mem:
`jdbc:h2:file:/tmp/gradebook-build/gradebook-db;NON_KEYWORDS=YEAR`

## What was verified in this VM (2026-11-06)

- **Grading utilities: 61/61 checks pass** — `backend/verify/run-verify.sh`
  (WAEC boundaries, 30/70 totals, validation, averages, "1224" ranking).
- **Backend compiles: yes** — `javac -parameters`, 50 class files, 0 errors
  (Spring Boot 3.2.5, Java 17, 105 jars fetched by `tools/fetch-deps.py`).
- **Backend runs + seeds: yes** — boots in ~13–20 s on H2, seeds
  "4 classes, 32 students, 4 teachers, 1 admin, WAEC scale, published
  grades for 3 Science 4".
- **API: 24/24 checks pass** — `backend/tools/verify-api.sh` against the
  running server: all 3 role logins, wrong password → 401, dashboard counts,
  WAEC scale (A1 90–100 … F9 0–39), teacher my-class (2 Arts 1, 8 students),
  my-subjects, batch save with 30/70 totals persisted across reload
  (0.3×80 + 0.7×90 = 87.0), "1224" ties share rank 1, publish → published
  flag, student dashboard/results (8 subjects), report-card PDF (valid PDF)
  + CSV, role enforcement (student → /admin = 403, no token → 403),
  admin create/delete student, overlapping scale range → 400.
- **Persistence across backend restart: verified** — file-based H2: a grade
  saved before restart (70/80 → 77.0) was still there after restart, and
  the seeder did not duplicate data (32 students / 4 teachers unchanged).
- **Frontend builds: yes** — `npm run build` → "Compiled successfully"
  (102.12 kB JS gzip), zero warnings. Production build serves (index + bundle
  both HTTP 200) with the correct title and API base URL.
- **MVP suite: 39/39 checks pass** — `backend/tools/verify-mvp.sh` against the
  running server: signup (token + school, duplicate email → 400, short
  password → 400), new school starts empty with 17 subjects + 9 scale rows
  seeded, `/auth/me` returns the school, teacher create (temp password) +
  login, class create with auto-assignment of the class teacher to 8 subjects
  (3 core + 5 science), student create (temp password) + login, teacher
  my-class (1 student, 8 subjects), 30/70 total 87.0, publish, student
  result (87.0, B2), report-card PDF (no "Demo data" line; demo PDF keeps
  it), and cross-school isolation — school A sees only its own students /
  classes / subjects / grades, teacher A grading a demo student → 404,
  admin A deleting/editing/viewing demo records → 404, student A viewing
  another student → 400, second school B starts empty, demo school intact
  (32/4/4) and all three demo logins still work.
- **Upgrade-path simulation: verified** — against a file H2 copy of the demo
  database with every `school_id` nulled and `demo=false` (the pre-upgrade
  state): first boot after the change ran `SchoolBackfill` and assigned all
  67 pre-upgrade rows to Demo Senior High School (classes=4, admins=1,
  teachers=4, subjects=17, scales=9, students=32), marked it demo=true, and
  the server started cleanly; demo admin/teacher/student flows all worked
  afterwards. A second restart printed no backfill line (idempotent) and the
  data survived (32 students, 4 teachers, 4 classes, 17 subjects).
- **Grading utilities: 61/61 checks pass** — `backend/verify/run-verify.sh`
  (re-run after the MVP changes).
- **§14 defects fixed**: TeacherDashboard rewritten (was the broken version
  that didn't compile) with 30/70 inputs, correct SHS WAEC bands, rankings
  tab, and error handling; login works for all 3 roles (the Oct 12
  never-200 defect); batch save attributes grades to the authenticated
  teacher; role enforcement on the API; single-student published-grades
  endpoint wired (`/student/me/dashboard`, `/results`, `/report-card`);
  real PDF (OpenPDF) + CSV report cards; "1224" ranking; semester is
  server-owned (`gradebook.semester=2025/2026-1`); Lombok removed entirely
  (no Lombok imports, not in the pom); JWT secret env-based with a demo-only
  default; no secrets committed.

## Not yet verified (needs jem's Mac)

- **Real Postgres 16 run** — the VM run used H2. The code path is the same
  JPA/Hibernate layer, but the Postgres DDL + the `year` column + the
  `gradebook_ghana` database have never been exercised end to end.
- **Browser click-through** — the UI was verified at the API + build level,
  not by clicking through the running app in a browser. The first thing to
  check on the Mac: log in as teacher@demo, enter marks in 2 Arts 1, Save,
  Publish; then log in as 0050101001 and download the PDF report card.
- The `year` column name works in Postgres but is a reserved word in H2
  (hence `NON_KEYWORDS=YEAR` in the VM run). If H2 is ever used for tests,
  quote it (`@Column(name = "\"year\"")`) or rename it to `form_year`.

## Layout

```
backend/    Spring Boot 3.2.5 / Java 17 / JWT / OpenPDF
  src/main/java/com/gradebook/   (42 source files)
  src/main/resources/application.properties
  tools/fetch-deps.py           curl-based Maven dependency fetcher
  tools/verify-api.sh           24-check end-to-end API suite
  verify/run-verify.sh          61-check grading-util suite
frontend/   Create React App 5 / React 19 / axios / react-router-dom (unused)
  src/lib/api.ts                JWT axios client + typed API
  src/components.tsx            shared UI (ErrorBanner, Card, Field, …)
  src/pages/Login.tsx           login + demo accounts
  src/pages/TeacherDashboard.tsx  My Class (30/70 grid) / My Subjects / Rankings
  src/pages/StudentDashboard.tsx  dashboard / results / PDF+CSV report card
  src/pages/AdminDashboard.tsx    dashboard / classes / subjects / students /
                                  grading scale / school profile / users
  src/App.tsx  src/App.css  src/index.css   (#76B900 theme)
```

This repo holds the prototype only. The earlier from-scratch build (Basic-auth/Vite) and the pristine copy of the Mac code live outside this repo.
