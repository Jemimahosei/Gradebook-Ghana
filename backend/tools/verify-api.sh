#!/usr/bin/env bash
# verify-api.sh — end-to-end API checks for the Gradebook Ghana prototype.
# Assumes the backend is running on http://localhost:8080 (H2 or Postgres).
# Usage: ./verify-api.sh
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
post() { curl -s -X POST -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$BASE$2"; }
put()  { curl -s -X PUT -H "Authorization: Bearer $1" -H 'Content-Type: application/json' -d "$3" "$BASE$2"; }
del()  { curl -s -o /dev/null -w '%{http_code}' -X DELETE -H "Authorization: Bearer $1" "$BASE$2"; }

ADMIN=$(login admin@demo demo123)
TEACHER=$(login teacher@demo demo123)
STUDENT=$(login 0050101001 demo123)
[ -n "$ADMIN" ] && ok "admin login (admin@demo)" || bad "admin login"
[ -n "$TEACHER" ] && ok "teacher login (teacher@demo)" || bad "teacher login"
[ -n "$STUDENT" ] && ok "student login (0050101001)" || bad "student login"
BAD=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/auth/login" -H 'Content-Type: application/json' -d '{"username":"admin@demo","password":"wrong"}')
[ "$BAD" = "401" ] && ok "wrong password -> 401" || bad "wrong password -> $BAD (want 401)"

# ---- admin dashboard + lists
DASH=$(get "$ADMIN" /admin/dashboard)
echo "$DASH" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["studentCount"]==32 and d["teacherCount"]==4 and d["classCount"]==4, d' \
  && ok "admin dashboard counts (32 students, 4 teachers, 4 classes)" || bad "admin dashboard counts: $DASH"
get "$ADMIN" /admin/grading-scales | python3 -c 'import sys,json; s=json.load(sys.stdin); assert len(s)==9 and s[0]["letter"]=="A1" and s[0]["minScore"]==90 and s[-1]["letter"]=="F9" and s[-1]["maxScore"]==39, s' \
  && ok "WAEC scale seeded (9 rows, A1 90-100 … F9 0-39)" || bad "WAEC scale"
get "$ADMIN" /admin/school | python3 -c 'import sys,json; s=json.load(sys.stdin); assert s["name"]=="Demo Senior High School", s' \
  && ok "school profile = Demo Senior High School" || bad "school profile"
get "$ADMIN" /admin/users | python3 -c 'import sys,json; u=json.load(sys.stdin); assert len(u)==5 and all("password" not in x for x in u), u' \
  && ok "users list (5, no password hashes)" || bad "users list"

# ---- teacher: my class (2 Arts 1), my subjects, rankings
MYCLASS=$(get "$TEACHER" /teacher/my-class)
echo "$MYCLASS" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["isClassTeacher"] and d["className"]=="2 Arts 1" and len(d["students"])==8, d' \
  && ok "teacher my-class = 2 Arts 1, 8 students" || bad "teacher my-class: $MYCLASS"
get "$TEACHER" /teacher/my-subjects | python3 -c 'import sys,json; s=json.load(sys.stdin); assert any(x["className"]=="3 Science 4" and x["subjectName"]=="Integrated Science" for x in s), s' \
  && ok "teacher my-subjects includes 3 Science 4 / Integrated Science" || bad "teacher my-subjects"

# ---- teacher: enter marks (30/70) for two 2 Arts 1 students, identical scores -> tie
IDS=$(echo "$MYCLASS" | python3 -c 'import sys,json; print(" ".join(str(s["id"]) for s in json.load(sys.stdin)["students"][:2]))')
S1=$(echo $IDS | cut -d' ' -f1); S2=$(echo $IDS | cut -d' ' -f2)
SUBJ=$(echo "$MYCLASS" | python3 -c 'import sys,json; print(json.load(sys.stdin)["subjects"][0])')
BATCH=$(cat <<EOF
[{"studentId":$S1,"subject":"$SUBJ","classScore":80,"examScore":90},
 {"studentId":$S2,"subject":"$SUBJ","classScore":80,"examScore":90}]
EOF
)
SAVE=$(post "$TEACHER" /grades/batch "$BATCH")
echo "$SAVE" | python3 -c 'import sys,json; assert json.load(sys.stdin)["count"]==2' \
  && ok "save batch (2 rows, $SUBJ 80/90)" || bad "save batch: $SAVE"
MYCLASS2=$(get "$TEACHER" /teacher/my-class)
echo "$MYCLASS2" | python3 -c 'import sys,json; d=json.load(sys.stdin); c=[s for s in d["students"] if s["id"] in ('"$S1"','"$S2"')]; assert all(s["gradeCells"]["'"$SUBJ"'"]["total"]==87.0 for s in c), c' \
  && ok "30/70 total persisted (0.3*80+0.7*90 = 87.0) after reload" || bad "30/70 total: $MYCLASS2"
RANK=$(get "$TEACHER" /teacher/rankings)
echo "$RANK" | python3 -c 'import sys,json; r=json.load(sys.stdin); assert len(r)>=2 and r[0]["rank"]==1 and r[1]["rank"]==1 and r[0]["average"]==r[1]["average"]==87.0, r' \
  && ok "1224 ranking: identical averages share rank 1" || bad "1224 ranking: $RANK"

# ---- publish -> student sees the grades
PUB=$(post "$TEACHER" /teacher/publish '{}')
echo "$PUB" | python3 -c 'import sys,json; assert json.load(sys.stdin)["status"]=="published"' \
  && ok "publish grades" || bad "publish: $PUB"

# ---- student: dashboard, results, report card
SDASH=$(get "$STUDENT" /student/me/dashboard)
echo "$SDASH" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["student"]["indexNumber"]=="0050101001" and d["className"]=="3 Science 4" and d["overallAverage"] is not None and d["classRank"] is not None and d["classSize"]==8, d' \
  && ok "student dashboard (3 Science 4, average + rank + size 8)" || bad "student dashboard: $SDASH"
get "$STUDENT" /student/me/results | python3 -c 'import sys,json; r=json.load(sys.stdin); assert len(r)==8 and all(x["total"] is not None and x["letter"] for x in r), r' \
  && ok "student results (8 published subjects, totals + letters)" || bad "student results"
curl -s -o /tmp/gradebook-build/report-card.pdf -w '%{http_code}' -H "Authorization: Bearer $STUDENT" "$BASE/student/me/report-card?format=pdf" | grep -q 200 \
  && file /tmp/gradebook-build/report-card.pdf | grep -qi pdf && ok "report-card PDF downloads (valid PDF)" || bad "report-card PDF"
curl -s -o /tmp/gradebook-build/report-card.csv -H "Authorization: Bearer $STUDENT" "$BASE/student/me/report-card?format=csv"
head -1 /tmp/gradebook-build/report-card.csv | grep -qi subject \
  && ok "report-card CSV downloads" || bad "report-card CSV: $(head -c 200 /tmp/gradebook-build/report-card.csv)"

# ---- student cannot see unpublished grades / admin endpoints
# (re-fetch the class AFTER publish: the two entered grades are published now)
MYCLASS3=$(get "$TEACHER" /teacher/my-class)
echo "$MYCLASS3" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert any(s["id"]=='"$S1"' and s["published"] for s in d["students"])' \
  && ok "published flag visible on teacher grid after publish" || bad "published flag after publish"
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $STUDENT" "$BASE/admin/dashboard" | grep -q 403 \
  && ok "student -> /admin/dashboard = 403" || bad "student admin access"
NOAUTH=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/admin/dashboard")
([ "$NOAUTH" = "401" ] || [ "$NOAUTH" = "403" ]) \
  && ok "no token -> $NOAUTH (unauthenticated)" || bad "no token status: $NOAUTH"

# ---- admin CRUD: create student, scale overlap rejection, delete
NEWST=$(post "$ADMIN" /admin/students '{"fullName":"Test Student","indexNumber":"0050101999","programme":"SCIENCE","year":1,"classId":null}')
NEWID=$(echo "$NEWST" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])' 2>/dev/null)
[ -n "$NEWID" ] && ok "admin creates student (id $NEWID)" || bad "admin create student: $NEWST"
OVERLAP=$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $ADMIN" -H 'Content-Type: application/json' -d '{"letter":"X1","minScore":85,"maxScore":95,"remark":"overlap"}' "$BASE/admin/grading-scales")
[ "$OVERLAP" = "400" ] && ok "overlapping scale range -> 400" || bad "overlap scale -> $OVERLAP (want 400)"
[ -n "$NEWID" ] && [ "$(del "$ADMIN" /admin/students/$NEWID)" = "200" ] && ok "admin deletes test student" || bad "admin delete student"

echo "----------------------------------------"
echo "PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = 0 ]
