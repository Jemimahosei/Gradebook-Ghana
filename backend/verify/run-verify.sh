#!/bin/bash
# Standalone verification for the dependency-free grading utilities.
# Runs with plain javac/java — no Maven, no Spring, no database — because
# this VM cannot resolve Maven dependencies (Maven Central is unreachable
# for Maven's HTTP client here; see the prototype README).
#
# Usage: from prototype/backend/verify/ run:  ./run-verify.sh
set -e
cd "$(dirname "$0")"
JAVA_HOME="${JAVA_HOME:-/home/hatch/tools/jdk-17}"
JAVAC="$JAVA_HOME/bin/javac"
JAVA="$JAVA_HOME/bin/java"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"' EXIT
"$JAVAC" -encoding UTF-8 -d "$OUT" ../src/main/java/com/gradebook/util/WaecGrading.java \
    ../src/main/java/com/gradebook/util/RankingUtil.java VerifyUtils.java
"$JAVA" -cp "$OUT" VerifyUtils
