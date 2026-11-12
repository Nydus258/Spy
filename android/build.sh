#!/usr/bin/env bash
# Spy Mobile derleme betiği (Gradle/Android Studio gerektirmez).
#   Gerekenler: JDK 11+, aapt, dalvik-exchange (dx), zipalign, apksigner, android.jar (API 23+), python3, node
#   Ubuntu/Debian:  apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23
#   Kullanım:       ./build.sh            -> dist/Spy-<sürüm>.apk
#   İmza:           SPY_KEYSTORE / SPY_KEY_ALIAS / SPY_KEYSTORE_PASS verilirse o anahtarla, verilmezse
#                   ~/.spy-mobile/debug.jks içinde bir kez üretilen yerel anahtarla imzalanır.
set -euo pipefail
cd "$(dirname "$0")"
unset JAVA_TOOL_OPTIONS

ANDROID_JAR="${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}"
DX="${DX:-dalvik-exchange}"
VERSION="$(sed -n 's/.*android:versionName="\([^"]*\)".*/\1/p' AndroidManifest.xml)"
grep -q "VERSION = \"$VERSION\"" src/com/spyapp/mobile/BuildInfo.java || { echo "BuildInfo.VERSION ile manifest sürümü farklı" >&2; exit 1; }
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/gen" "$OUT/classes" dist

echo "[1/6] veri + testler"
python3 tools/gen_data.py --strict
node tests/core.test.js >/dev/null
bash tests/run_java_tests.sh >/dev/null

echo "[2/6] kaynaklar (aapt)"
aapt package -f -m -J "$OUT/gen" -M AndroidManifest.xml -S res -I "$ANDROID_JAR"

echo "[3/6] java"
javac -nowarn --release 8 -Xlint:-options -cp "$ANDROID_JAR" -d "$OUT/classes" $(find src "$OUT/gen" -name '*.java')

echo "[4/6] dex"
"$DX" --dex --min-sdk-version=23 --output="$OUT/classes.dex" "$OUT/classes"

echo "[5/6] paket"
# resources.arsc sıkıştırılmadan saklanmalı (Android 11+ hedefleyen APK için zorunlu).
aapt package -f -0 arsc -M AndroidManifest.xml -S res -A assets -I "$ANDROID_JAR" -F "$OUT/unaligned.apk"
(cd "$OUT" && aapt add unaligned.apk classes.dex >/dev/null)
zipalign -f 4 "$OUT/unaligned.apk" "$OUT/aligned.apk"

echo "[6/6] imza"
KS="${SPY_KEYSTORE:-$HOME/.spy-mobile/debug.jks}"
ALIAS="${SPY_KEY_ALIAS:-spy}"
PASS="${SPY_KEYSTORE_PASS:-spymobile}"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Spy Mobile" >/dev/null 2>&1
fi
APK="dist/Spy-$VERSION.apk"
cp "$OUT/aligned.apk" "$APK"
apksigner sign --ks "$KS" --ks-key-alias "$ALIAS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --min-sdk-version 23 "$APK"
rm -f "$APK.idsig"
apksigner verify --min-sdk-version 23 "$APK"
echo "tamam: $APK ($(du -h "$APK" | cut -f1))"
