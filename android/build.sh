#!/usr/bin/env bash
# Spy: Odak ve Ekran Süresi - derleme betiği.
#   Çıktı:   dist/Spy-<sürüm>-play.aab   (Google Play'e yüklenir)
#            dist/Spy-<sürüm>-play.apk   (yalnızca inceleme için; Play'in dağıttığı paketle aynı içerik, farklı imza)
#   Gerekenler: JDK 17+, Android SDK (platforms;android-36, build-tools;36.0.0), python3, node
#   Ortam:   ANDROID_HOME (varsayılan ~/android-sdk)
#            SPY_UPLOAD_KEYSTORE / SPY_UPLOAD_ALIAS / SPY_UPLOAD_PASS  -> Play yükleme anahtarı (yoksa paket imzasız çıkar)
set -euo pipefail
cd "$(dirname "$0")"
unset JAVA_TOOL_OPTIONS
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
[ -f local.properties ] || echo "sdk.dir=$ANDROID_HOME" > local.properties

VERSION="$(sed -n "s/^def spyVersionName = '\(.*\)'/\1/p" build.gradle)"
grep -q "VERSION = \"$VERSION\"" src/com/spyapp/mobile/BuildInfo.java || { echo "BuildInfo.VERSION ile build.gradle sürümü farklı" >&2; exit 1; }
[ -n "${SPY_UPLOAD_KEYSTORE:-}" ] || echo "UYARI: SPY_UPLOAD_KEYSTORE verilmedi; paketler imzasız olacak (Play Console reddeder)." >&2

echo "[1/3] veri + testler"
python3 tools/gen_data.py --strict
node tests/core.test.js >/dev/null
bash tests/run_java_tests.sh >/dev/null

echo "[2/3] gradle (R8 + AAB)"
GRADLE=./gradlew; [ -x "$GRADLE" ] || GRADLE=gradle
"$GRADLE" --no-daemon -q assembleRelease bundleRelease -x lint

echo "[3/3] dist"
mkdir -p dist
if [ -n "${SPY_UPLOAD_KEYSTORE:-}" ]; then S=""; else S="-unsigned"; fi
cp "build-gradle/outputs/bundle/release/spy-mobile-release.aab" "dist/Spy-$VERSION-play.aab"
cp "build-gradle/outputs/apk/release/spy-mobile-release$S.apk" "dist/Spy-$VERSION-play.apk"
ls -la "dist/Spy-$VERSION-play."*
