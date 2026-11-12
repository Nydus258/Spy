#!/usr/bin/env python3
"""assets/www/data.js dosyasını üretir.

Girdi:
  tools/categories.json       Masaüstü Spy 1.4.5 ile gelen kural veritabanı (v1.8).
  tools/i18n_desktop_en.json  Masaüstü çeviri tablosunun İngilizce sütunu (Türkçe metin -> İngilizce).
  tools/i18n_extra_en.json    Yalnızca telefonda geçen metinlerin İngilizcesi.
Çıktı:
  window.SPY_RULES  = {apps: {kategori: [uygulama adı parçaları]}, roots: {kategori: [site kökleri]}}
  window.SPY_I18N_EN = {Türkçe metin: İngilizce metin}   (yalnızca arayüzde kullanılanlar)
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
WWW = HERE.parent / "assets" / "www"

# Telefonda uygulama adıyla eşleştirmek için fazla genel kalan kökler.
GENERIC_ROOTS = {"google", "microsoft", "apple", "android", "yahoo", "max", "hey", "nature", "science", "pocket",
                 "medium", "live", "mail", "docs", "web", "news", "store", "play", "maps", "meet", "weather"}
SUFFIXES = {"com", "org", "net", "co", "uk", "tr", "io", "edu", "gov", "app", "tv", "me", "ai", "dev", "us", "de",
            "fm", "social", "world", "info", "gg", "to", "ly"}


def site_root(domain):
    parts = domain.lower().split(".")
    while parts and parts[-1] in SUFFIXES:
        parts.pop()
    if len(parts) != 1:  # alt alan adları (mail.google.com) ve uzantı kuralları (edu.tr) atlanır
        return None
    root = parts[0]
    if len(root) < 4 or root in GENERIC_ROOTS:
        return None
    return root


def build_rules():
    db = json.loads((HERE / "categories.json").read_text(encoding="utf-8"))
    apps, roots, seen_app, seen_root = {}, {}, set(), set()
    for key in db["precedence"]:
        cat = db["categories"].get(key, {})
        out = []
        for token in cat.get("apps", []):
            token = re.sub(r"\.exe$", "", token.strip().lower())
            if token and token not in seen_app:
                seen_app.add(token)
                out.append(token)
        apps[key] = out
        out = []
        for domain in cat.get("domains", []):
            root = site_root(domain)
            if root and root not in seen_root and root not in seen_app:
                seen_root.add(root)
                out.append(root)
        roots[key] = out
    return {"version": db["version"], "apps": apps, "roots": roots}


def _string_end(text, i):
    quote = text[i]
    i += 1
    while i < len(text) and text[i] != quote:
        i += 2 if text[i] == "\\" else 1
    return i


def _unquote(lit):
    body = lit[1:-1]
    if lit[0] == "'":
        body = body.replace("\\'", "'").replace('"', '\\"')
    return json.loads('"' + body + '"')


def used_strings():
    """t(...) çağrısının İLK argümanındaki ve T('...') işaretli tüm metin sabitleri (üçlü koşullar dahil)."""
    found = set()
    for name in ("core.js", "app.js", "native.js"):
        text = (WWW / name).read_text(encoding="utf-8")
        for m in re.finditer(r"(?<![A-Za-z0-9_$.])[tT]\(", text):
            i, depth = m.end(), 0
            while i < len(text):
                ch = text[i]
                if ch in "'\"":
                    end = _string_end(text, i)
                    try:
                        found.add(_unquote(text[i:end + 1]))
                    except Exception:
                        pass
                    i = end
                elif ch in "([{":
                    depth += 1
                elif ch in ")]}":
                    if depth == 0:
                        break
                    depth -= 1
                elif ch == "," and depth == 0:
                    break
                i += 1
    return found


def main():
    desktop = json.loads((HERE / "i18n_desktop_en.json").read_text(encoding="utf-8"))
    extra = json.loads((HERE / "i18n_extra_en.json").read_text(encoding="utf-8"))
    table, missing = {}, []
    for text in sorted(used_strings()):
        if text in extra:
            table[text] = extra[text]
        elif text in desktop:
            table[text] = desktop[text]
        elif re.search(r"[A-Za-zÇĞİÖŞÜçğıöşü]{2}", text):
            missing.append(text)
    # Kategori adları her zaman gerekir.
    for text in ("Üretkenlik", "Eğlence / Dikkat dağıtıcı", "Eğlence", "İletişim", "Potansiyel", "Haber & Bilgi",
                 "Alışveriş & Yaşam", "Diğer", "Android / Sistem", "Sistem"):
        table.setdefault(text, extra.get(text) or desktop.get(text) or text)
    rules = build_rules()
    js = ("/* Otomatik üretildi: tools/gen_data.py — elle düzenlemeyin. */\n"
          "window.SPY_RULES = " + json.dumps(rules, ensure_ascii=False, separators=(",", ":")) + ";\n"
          "window.SPY_I18N_EN = " + json.dumps(table, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + ";\n")
    (WWW / "data.js").write_text(js, encoding="utf-8")
    print("data.js: %d uygulama kuralı, %d site kökü, %d çeviri" % (
        sum(map(len, rules["apps"].values())), sum(map(len, rules["roots"].values())), len(table)))
    if missing:
        print("ÇEVİRİSİ EKSİK (%d):" % len(missing))
        for text in missing:
            print("  " + json.dumps(text, ensure_ascii=False))
        if "--strict" in sys.argv:
            sys.exit(1)


if __name__ == "__main__":
    main()
