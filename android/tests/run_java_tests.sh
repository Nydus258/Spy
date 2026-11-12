#!/usr/bin/env bash
# Android'e bağımlı olmayan Java testleri (JVM üzerinde).
set -euo pipefail
cd "$(dirname "$0")/.."
unset JAVA_TOOL_OPTIONS
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
javac -nowarn -d "$T" src/com/spyapp/mobile/SessionBuilder.java tests/SessionBuilderTest.java
java -ea -cp "$T" SessionBuilderTest
