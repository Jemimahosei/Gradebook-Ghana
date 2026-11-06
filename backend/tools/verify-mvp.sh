#!/usr/bin/env bash
# verify-mvp.sh — MVP checks for the multi-school Gradebook Ghana upgrade.
# Assumes the backend is running on http://localhost:8080 (H2 or Postgres)
# with the demo school seeded. Run AFTER verify-api.sh.
# Usage: ./verify-mvp.sh
# Exits 0 only if every check passes.
set -u
BASE=http://localhost:8080/api
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "FAIL: $1"; }

login() { # login USER PASS -> token on stdout
  curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("token",""))'
}
get()  { curl -s -H "Authorization: Bearer $1" "$BASE$2"; }
getcode() { curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $1" "$BASE$2"; }
post() { curl -s -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$BASE$2"; }
postcode() { curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$BASE$2"; }
putcode() { curl -s -o /dev/null -w '%{http_code}' -X PUT -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$BASE$2"; }
delcode() { curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "Authorization: Bearer $1" "$BASE$2"; }
postanon() { curl -s -X POST -H 'Content-Type: application/json' -d "$2" "$BASE$1"; }

# ---- 1. public signup: school A (Kumasi) ----
REG_A=$(postanon /auth/register-school '{"schoolName":"Kumasi Senior High School","town":"Kumasi","region":"Ashanti Region","contactName":"Ama Serwaa","email":"admin@kumasi-shs.test","password":"kumasi123"}')
echo "$REG_A" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["role"]=="ADMIN" and d["schoolName"]=="Kumasi Senior High School" and d["demoSchool"]==False and d["token"], d' \
  && ok "signup school A returns ADMIN token + school name" || bad "signup A: $REG_A"
ADMIN_A=$(echo "$REG_A" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')

# duplicate email -> 400, short password -> 400, missing school -> 400
DUP=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register-school" -H 'Content-Type: application/json' -d '{"schoolName":"Other School","town":"Accra","region":"Greater Accra","contactName":"Kofi","email":"admin@kumasi-shs.test","password":"other123"}')
[ "$DUP" = "400" ] && ok "duplicate signup email -> 400" || bad "duplicate signup -> $DUP (want 400)"
SHORT=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/register-school" -H 'Content-Type: application/json' -d '{"schoolName":"Other School","town":"Accra","region":"Greater Accra","contactName":"Kofi","email":"other@school.test","password":"abc"}')
[ "$SHORT" = "400" ] && ok "short signup password -> 400" || bad "short password -> $SHORT (want 400)"

# ---- 2. new school starts empty but seeded with WAEC scale + subjects ----
DASH_A=$(get "$ADMIN_A" /admin/dashboard)
echo "$DASH_A" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["studentCount"]==0 and d["teacherCount"]==0 and d["classCount"]==0 and d["subjectCount"]==17, d' \
  && ok "school A dashboard empty (0/0/0) with 17 seeded subjects" || bad "school A dashboard: $DASH_A"
get "$ADMIN_A" /admin/grading-scales | python3 -c 'import sys,json; s=json.load(sys.stdin); assert len(s)==9 and s[0]["letter"]=="A1" and s[-1]["letter"]=="F9", s' \
  && ok "school A has seeded WAEC scale (9 rows)" || bad "school A scale"
get "$ADMIN_A" /admin/school | python3 -c 'import sys,json; s=json.load(sys.stdin); assert s["name"]=="Kumasi Senior High School" and s["town"]=="Kumasi" and s["demoSchool"]==False, s' \
  && ok "school A profile (name + town, not demo)" || bad "school A profile"

# /auth/me returns the school for a logged-in user
get "$ADMIN_A" /auth/me | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["role"]=="ADMIN" and d["schoolName"]=="Kumasi Senior High School", d' \
  && ok "/auth/me returns school info" || bad "/auth/me"
NOAUTH_ME=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/auth/me")
([ "$NOAUTH_ME" = "401" ] || [ "$NOAUTH_ME" = "403" ]) \
  && ok "unauthenticated /auth/me -> $NOAUTH_ME" || bad "unauth /auth/me: $NOAUTH_ME"

# ---- 3. admin A creates a teacher (server-generated temp password) ----
TEACH_A=$(post "$ADMIN_A" /admin/teachers '{"fullName":"Mr. Owusu","email":"owusu@kumasi-shs.test","subject":"Core Mathematics","password":""}')
TEACH_A_ID=$(echo "$TEACH_A" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])' 2>/dev/null)
TEACH_A_PW=$(echo "$TEACH_A" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("temporaryPassword",""))' 2>/dev/null)
[ -n "$TEACH_A_ID" ] && [ -n "$TEACH_A_PW" ] && [ ${#TEACH_A_PW} -ge 6 ] \
  && ok "admin A creates teacher (id $TEACH_A_ID, temp password returned)" || bad "create teacher A: $TEACH_A"
TEACHER_A=$(login owusu@kumasi-shs.test "$TEACH_A_PW")
[ -n "$TEACHER_A" ] && ok "teacher A logs in with the temporary password" || bad "teacher A login"

# ---- 4. admin A creates a class with that teacher -> auto-assignments ----
CLASS_A=$(post "$ADMIN_A" /admin/classes "{\"name\":\"1 Science 1\",\"programme\":\"SCIENCE\",\"formYear\":1,\"classTeacherId\":$TEACH_A_ID}")
CLASS_A_ID=$(echo "$CLASS_A" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])' 2>/dev/null)
[ -n "$CLASS_A_ID" ] && ok "admin A creates class 1 Science 1 (id $CLASS_A_ID)" || bad "create class A: $CLASS_A"
get "$ADMIN_A" /admin/assignments | python3 -c 'import sys,json; a=json.load(sys.stdin); assert len(a)==8 and all(x["teacherName"]=="Mr. Owusu" and x["className"]=="1 Science 1" for x in a), a' \
  && ok "class teacher auto-assigned to 8 subjects (3 core + 5 science)" || bad "auto-assignments"
get "$TEACHER_A" /teacher/my-subjects | python3 -c 'import sys,json; s=json.load(sys.stdin); assert len(s)==8 and any(x["subjectName"]=="Core Mathematics" for x in s), s' \
  && ok "teacher A my-subjects shows the 8 assignments" || bad "teacher A my-subjects"

# duplicate assignment -> 400
SUBJ_A_ID=$(get "$ADMIN_A" /admin/subjects | python3 -c 'import sys,json; print([s for s in json.load(sys.stdin) if s["name"]=="Core Mathematics"][0]["id"])')
DUPASG=$(postcode "$ADMIN_A" /admin/assignments "{\"teacherId\":$TEACH_A_ID,\"subjectId\":$SUBJ_A_ID,\"classId\":$CLASS_A_ID}")
[ "$DUPASG" = "400" ] && ok "duplicate assignment -> 400" || bad "duplicate assignment -> $DUPASG (want 400)"

# ---- 5. admin A creates a student (temp password) ----
STU_A=$(post "$ADMIN_A" /admin/students "{\"fullName\":\"Akua Serwaa\",\"indexNumber\":\"2026001001\",\"programme\":\"SCIENCE\",\"year\":1,\"classId\":$CLASS_A_ID}")
STU_A_ID=$(echo "$STU_A" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])' 2>/dev/null)
STU_A_PW=$(echo "$STU_A" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("temporaryPassword",""))' 2>/dev/null)
[ -n "$STU_A_ID" ] && [ -n "$STU_A_PW" ] \
  && ok "admin A creates student (id $STU_A_ID, temp password returned)" || bad "create student A: $STU_A"
STUDENT_A=$(login 2026001001 "$STU_A_PW")
[ -n "$STUDENT_A" ] && ok "student A logs in with index number + temp password" || bad "student A login"

# ---- 6. teacher A: my-class, marks, publish; student A sees results + PDF ----
MYCLASS_A=$(get "$TEACHER_A" /teacher/my-class)
echo "$MYCLASS_A" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["isClassTeacher"] and d["className"]=="1 Science 1" and len(d["students"])==1 and len(d["subjects"])==8, d' \
  && ok "teacher A my-class = 1 Science 1, 1 student, 8 subjects" || bad "teacher A my-class: $MYCLASS_A"
SAVE_A=$(post "$TEACHER_A" /grades/batch "[{\"studentId\":$STU_A_ID,\"subject\":\"Core Mathematics\",\"classScore\":80,\"examScore\":90}]")
echo "$SAVE_A" | python3 -c 'import sys,json; assert json.load(sys.stdin)["count"]==1' \
  && ok "teacher A saves marks (Core Maths 80/90)" || bad "save marks A: $SAVE_A"
get "$TEACHER_A" /teacher/my-class | python3 -c 'import sys,json; d=json.load(sys.stdin); s=d["students"][0]; assert s["gradeCells"]["Core Mathematics"]["total"]==87.0, s' \
  && ok "school A 30/70 total = 87.0" || bad "school A total"
PUB_A=$(post "$TEACHER_A" /teacher/publish '{}')
echo "$PUB_A" | python3 -c 'import sys,json; assert json.load(sys.stdin)["status"]=="published"' \
  && ok "teacher A publishes" || bad "publish A: $PUB_A"
get "$STUDENT_A" /student/me/results | python3 -c 'import sys,json; r=json.load(sys.stdin); assert len(r)==1 and r[0]["subject"]=="Core Mathematics" and r[0]["total"]==87.0 and r[0]["letter"]=="B2", r' \
  && ok "student A sees published result (87.0, B2)" || bad "student A results"
curl -s -o /tmp/gradebook-build/report-card-a.pdf -w '%{http_code}' -H "Authorization: Bearer $STUDENT_A" "$BASE/student/me/report-card?format=pdf" | grep -q 200 \
  && file /tmp/gradebook-build/report-card-a.pdf | grep -qi pdf && ok "student A report-card PDF downloads" || bad "student A PDF"
if command -v python3 >/dev/null 2>&1; then
  # PDF content streams are Flate-compressed, so decompress before searching.
  pdf_has() { python3 -c "
import re, sys, zlib
data = open('$1', 'rb').read()
texts = []
for m in re.finditer(rb'stream\r?\n(.*?)endstream', data, re.S):
    chunk = m.group(1)
    try: chunk = zlib.decompress(chunk)
    except Exception: pass
    texts.append(chunk)
sys.exit(0 if b'$2' in b'\n'.join(texts) else 1)
"; }
  pdf_has /tmp/gradebook-build/report-card-a.pdf "Demo data" \
    && bad "school A PDF wrongly says Demo data" || ok "school A PDF has no Demo-data line"
  pdf_has /tmp/gradebook-build/report-card-a.pdf "Gradebook Ghana" \
    && ok "school A PDF carries the Gradebook Ghana footer" || bad "school A PDF footer"
  curl -s -H "Authorization: Bearer $(login 0050101001 demo123)" "$BASE/student/me/report-card?format=pdf" -o /tmp/gradebook-build/report-card-demo.pdf
  pdf_has /tmp/gradebook-build/report-card-demo.pdf "Demo data" \
    && ok "demo school PDF still says Demo data" || bad "demo PDF lost its Demo-data line"
fi

# ---- 7. cross-school isolation ----
get "$ADMIN_A" /admin/students | python3 -c 'import sys,json; s=json.load(sys.stdin); assert len(s)==1 and s[0]["indexNumber"]=="2026001001", s' \
  && ok "school A admin sees only school A students" || bad "school A student list leak"
get "$ADMIN_A" /admin/classes | python3 -c 'import sys,json; c=json.load(sys.stdin); assert len(c)==1 and c[0]["name"]=="1 Science 1", c' \
  && ok "school A admin sees only school A classes" || bad "school A class list leak"
get "$TEACHER_A" /teacher/subjects | python3 -c 'import sys,json; s=json.load(sys.stdin); assert len(s)==17, s' \
  && ok "school A teacher sees only school A subjects (17)" || bad "school A subject list leak"
get "$TEACHER_A" /grades | python3 -c 'import sys,json; g=json.load(sys.stdin); assert len(g)==1 and g[0]["subject"]=="Core Mathematics", g' \
  && ok "school A teacher sees only school A grades" || bad "school A grades leak"

DEMO_STUDENT_ID=$(login 0050101001 demo123 >/dev/null; get "$(login admin@demo demo123)" /admin/students | python3 -c 'import sys,json; print([s for s in json.load(sys.stdin) if s["indexNumber"]=="0050101001"][0]["id"])')
DEMO_CLASS_ID=$(get "$(login admin@demo demo123)" /admin/classes | python3 -c 'import sys,json; print([c for c in json.load(sys.stdin) if c["name"]=="2 Arts 1"][0]["id"])')
CROSS_GRADE=$(postcode "$TEACHER_A" /grades/batch "[{\"studentId\":$DEMO_STUDENT_ID,\"subject\":\"Core Mathematics\",\"classScore\":50,\"examScore\":50}]")
[ "$CROSS_GRADE" = "404" ] && ok "teacher A grading a demo student -> 404" || bad "cross-school grade -> $CROSS_GRADE (want 404)"
CROSS_DEL_STU=$(delcode "$ADMIN_A" /admin/students/$DEMO_STUDENT_ID)
[ "$CROSS_DEL_STU" = "404" ] && ok "admin A deleting a demo student -> 404" || bad "cross-school student delete -> $CROSS_DEL_STU (want 404)"
CROSS_PUT_CLASS=$(putcode "$ADMIN_A" /admin/classes/$DEMO_CLASS_ID '{"name":"Hacked","programme":"SCIENCE","formYear":1,"classTeacherId":null}')
[ "$CROSS_PUT_CLASS" = "404" ] && ok "admin A editing a demo class -> 404" || bad "cross-school class edit -> $CROSS_PUT_CLASS (want 404)"
CROSS_VIEW_STU=$(getcode "$ADMIN_A" "/student/me/dashboard?studentId=$DEMO_STUDENT_ID")
[ "$CROSS_VIEW_STU" = "404" ] && ok "admin A viewing a demo student dashboard -> 404" || bad "cross-school student view -> $CROSS_VIEW_STU (want 404)"
CROSS_STU_SELF=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $STUDENT_A" "$BASE/student/me/dashboard?studentId=$DEMO_STUDENT_ID")
[ "$CROSS_STU_SELF" = "400" ] && ok "student A viewing another student -> 400" || bad "student cross-view -> $CROSS_STU_SELF (want 400)"
CROSS_TEACH_DEL=$(delcode "$ADMIN_A" /admin/teachers/1)
[ "$CROSS_TEACH_DEL" = "404" ] && ok "admin A deleting a demo teacher -> 404" || bad "cross-school teacher delete -> $CROSS_TEACH_DEL (want 404)"

# ---- 8. second school B is independent; demo school untouched ----
REG_B=$(postanon /auth/register-school '{"schoolName":"Accra Academy","town":"Accra","region":"Greater Accra","contactName":"Kofi Mensah","email":"admin@accra-academy.test","password":"accra123"}')
ADMIN_B=$(echo "$REG_B" | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
[ -n "$ADMIN_B" ] && ok "signup school B works" || bad "signup B: $REG_B"
get "$ADMIN_B" /admin/students | python3 -c 'import sys,json; assert json.load(sys.stdin)==[], json.load(sys.stdin)' \
  && ok "school B starts with zero students (cannot see A or demo)" || bad "school B student list"
ADMIN_DEMO=$(login admin@demo demo123)
get "$ADMIN_DEMO" /admin/dashboard | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["studentCount"]==32 and d["teacherCount"]==4 and d["classCount"]==4, d' \
  && ok "demo school still intact (32 students, 4 teachers, 4 classes)" || bad "demo school counts changed"
[ -n "$ADMIN_DEMO" ] && [ -n "$(login teacher@demo demo123)" ] && [ -n "$(login 0050101001 demo123)" ] \
  && ok "all three demo logins still work" || bad "demo logins broken"

echo "----------------------------------------"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ]
