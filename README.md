# Gradebook Ghana

## 🔗 Live site: https://gradebook-frontend.onrender.com

A free, community give-back gradebook for Ghanaian high schools. Schools register and manage classes, subjects, students, and grading scales; teachers enter assessments; students view their results and download report cards. Built for three roles — admin, teacher, and student.

## Architecture

```
Browser ──▶ Vite + React frontend (TypeScript)
              │  REST /api
              ▼
           Spring Boot API (Java 17)
              │  Spring Data JPA
              ▼
           Neon Postgres
```

- **Frontend** (Vite + React 19 + TypeScript): login and admin, teacher, and student pages. Talks to the backend only through its REST API (`/api`).
- **Backend** (Spring Boot 3.3.5): serves auth (`/api/auth`), admin (`/api/admin` — classes, subjects, students, grading scales, dashboard), teacher (`/api/teacher` — assessments, grades), and student (`/api/student/me` — dashboard, results, report card) endpoints. Grade, ranking, and PDF report-card services (OpenPDF) run server-side.
- **Deploy**: static frontend + Spring Boot API on Render, backed by a Neon Postgres database.

## Stack

Vite · React 19 · TypeScript · Spring Boot 3.3.5 · Java 17 · Spring Data JPA · PostgreSQL (Neon) · Render

## Run it locally

```bash
docker compose up -d        # Postgres on localhost:5432
cd backend && mvn spring-boot:run   # API on http://localhost:8080
cd frontend && npm install && npm run dev   # site on http://localhost:5173
```

The frontend calls the API at `http://localhost:8080/api`.

## Tests

16 backend tests (`backend/src/test/java/com/gradebookghana/service/`, `cd backend && mvn test`).

## Notes

- The live site is on Render's free tier, so the first load can take about a minute while it wakes up.
