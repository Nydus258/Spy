/* Çekirdek testleri: `node tests/core.test.js`
 * desktop_reference.json, masaüstü Spy 1.4.5'in KENDİ modüllerinden (spy_license, spy_focus, spy_pomodoro,
 * coaching, spy_categorization) üretilmiş beklenen değerlerdir; telefon çekirdeği aynı sonucu vermelidir. */
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const C = require('../assets/www/core.js');
const ref = require('./desktop_reference.json');

const sha512 = (bytes) => new Uint8Array(crypto.createHash('sha512').update(Buffer.from(bytes)).digest());
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('  ok  ' + name); }

// data.js (kurallar) yüklenir
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/www/data.js'), 'utf8'), sandbox);
const RULES = sandbox.window.SPY_RULES;

test('lisans: masaüstü anahtarları aynı kimliği verir (Ed25519)', () => {
  ref.keys.forEach((key, i) => assert.strictEqual(C.parseKey(key, sha512, ref.pub), ref.ids[i]));
  assert.strictEqual(C.parseKey(ref.keys[0].toLowerCase().replace(/-/g, ' - '), sha512, ref.pub), ref.ids[0], 'küçük harf/boşluk hoşgörüsü');
});
test('lisans: bozuk ya da yabancı anahtar reddedilir', () => {
  const k = ref.keys[0];
  const bad = k.slice(0, 20) + (k[20] === 'A' ? 'B' : 'A') + k.slice(21);
  assert.strictEqual(C.parseKey(bad, sha512, ref.pub), null);
  assert.strictEqual(C.parseKey(k, sha512), null, 'test anahtarı gerçek açık anahtarla geçmemeli');
  assert.strictEqual(C.parseKey('SPY-AAAA', sha512), null);
  assert.strictEqual(C.parseKey('', sha512), null);
  assert.strictEqual(C.parseKey('XYZ-' + k.slice(4), sha512, ref.pub), null);
});
test('lisans: 3 günlük deneme ve süre dolumu', () => {
  const d = {};
  let s = C.licenseStatus(d, 1000000, sha512);
  assert.deepStrictEqual([s.state, s.days_left], ['trial', 3]);
  s = C.licenseStatus(d, 1000000 + 86400 * 1.5, sha512);
  assert.deepStrictEqual([s.state, s.days_left], ['trial', 2]);
  s = C.licenseStatus(d, 1000000 + 86400 * 2.9, sha512);
  assert.deepStrictEqual([s.state, s.days_left], ['trial', 1]);
  s = C.licenseStatus(d, 1000000 + 86400 * 3, sha512);
  assert.strictEqual(s.state, 'expired');
  s = C.licenseStatus(d, 1000000, sha512);
  assert.strictEqual(s.state, 'expired', 'saat geri alınsa da deneme geri gelmez');
  d.key = ref.keys[1];
  s = C.licenseStatus(d, 1000000 + 86400 * 30, sha512, ref.pub);
  assert.deepStrictEqual([s.state, s.license_id], ['licensed', ref.ids[1]]);
});

test('odak skoru masaüstü ile aynı (live_score)', () => {
  ref.live.forEach(([e, i, d, want]) => assert.strictEqual(C.liveScore(e, i, d), want, `live_score(${e},${i},${d})`));
});
test('kesinti izleyici masaüstü ile aynı (InterruptWatcher.observe)', () => {
  const w = new C.InterruptWatcher();
  ref.watch.forEach(([k, item, now, want]) => assert.strictEqual(w.observe(k, item, now), want, `${k}/${item}@${now}`));
});
test('üretkenlik formülü masaüstü ile aynı (focus_percentage)', () => {
  const map = { 'Üretkenlik': 'productive', 'Eğlence / Dikkat dağıtıcı': 'distraction', 'Windows / Sistem': 'system', 'Diğer': 'other' };
  ref.focus.forEach(([cats, want]) => {
    const byKey = {};
    Object.keys(cats).forEach((k) => { byKey[map[k]] = cats[k]; });
    assert.strictEqual(C.focusPercentage(byKey), want);
  });
});
test('koçluk cümleleri masaüstü ile aynı (generate_coaching_tip)', () => {
  ref.coach.forEach(([p, e, t, g, want]) => {
    const got = C.coachingTip(p, e, t, g).map((parts) => parts[0].replace('{}', parts[1])).join(' ');
    assert.strictEqual(got, want);
  });
});
test('pomodoro durum makinesi masaüstü ile aynı sırayı izler', () => {
  const p = new C.Pomodoro(25, 5, 15);
  const names = (events) => events.map((e) => e[0]);
  ref.pomo.forEach((row) => {
    if (row[0] === 'start') { assert.deepStrictEqual(names(p.start(row[1])), names(row[2])); return; }
    const got = p.tick(row[1]);
    assert.deepStrictEqual(names(got), names(row[2]));
    assert.deepStrictEqual([p.state, p.round], [row[3], row[4]]);
    got.forEach((e, i) => { if (e[0] === 'work_done') assert.strictEqual(e[1].seconds, row[2][i][1].seconds); });
  });
});
test('pomodoro: arka planda geçen süre zincirleme işlenir, alarm planı doğru', () => {
  const p = new C.Pomodoro(25, 5, 15);
  p.start(0);
  const plan = p.schedule(0);
  assert.strictEqual(plan.length, 8);
  assert.deepStrictEqual(plan.map((x) => x.at), [1500, 1800, 3300, 3600, 5100, 5400, 6900, 7800]);
  const events = p.catchUp(3400); // 2. çalışma bitti, 2. kısa mola sürüyor
  assert.deepStrictEqual(events.map((e) => e[0]), ['work_done', 'break_started', 'break_ended', 'work_started', 'work_done', 'break_started']);
  assert.deepStrictEqual([p.state, p.round, p.remaining(3400)], ['short_break', 2, 200]);
  const q = C.Pomodoro.fromJSON(JSON.parse(JSON.stringify(p.toJSON())));
  assert.deepStrictEqual(q.toJSON(), p.toJSON());
  p.pause(3400); assert.strictEqual(p.schedule(3400).length, 0);
  p.resume(4000); assert.strictEqual(p.end_at, 4200);
  const stop = new C.Pomodoro(25, 5, 15); stop.start(0);
  assert.deepStrictEqual(stop.stop(30).map((e) => e[0]), ['stopped']);
  stop.start(0);
  assert.deepStrictEqual(stop.stop(600).map((e) => e[0]), ['work_stopped', 'stopped']);
  const cl = new C.Pomodoro(5, 99, 1);
  assert.deepStrictEqual([cl.work_min, cl.short_min, cl.long_min], [15, 15, 15]);
});

test('sınıflandırma: paket, etiket, site kökü, Android ipucu ve kullanıcı kuralı', () => {
  const cls = C.makeClassifier(RULES, { 'com.example.work': 'productive', 'com.instagram.android': 'communication' }, 'com.spyapp.mobile');
  const cases = [
    ['com.whatsapp', 'WhatsApp', '', 'communication'], ['com.android.chrome', 'Chrome', '', 'potential'],
    ['com.google.android.youtube', 'YouTube', 'video', 'potential'], ['com.supercell.clashofclans', 'Clash of Clans', 'game', 'distraction'],
    ['com.unknown.game', 'Bilinmeyen Oyun', 'game', 'distraction'], ['com.example.work', 'Her Neyse', 'game', 'productive'],
    ['com.instagram.android', 'Instagram', 'social', 'communication'], ['com.spyapp.mobile', 'Spy', '', 'system'],
    ['com.sec.android.app.launcher', 'One UI Home', 'launcher', 'system'], ['com.foo.launcherx', 'Foo', 'launcher', 'system'],
    ['com.random.thing', 'Rastgele', '', 'other'], ['com.acme.app', 'Microsoft Teams', '', 'communication'],
    ['com.netflix.other', 'Netflix', '', 'distraction'], ['com.tinder', 'Tinder', '', 'other'],
    ['com.github.something', 'Bir Şey', '', 'productive'], ['com.vendor.settings2', 'Ayarlar', 'system', 'system'],
    ['com.duolingo', 'Duolingo', '', 'productive'], ['com.x.y', 'Trendyol', '', 'life'],
    ['com.google.android.gm', 'Gmail', 'productivity', 'communication'], ['org.example.news', 'Haberler', 'news', 'info']
  ];
  cases.forEach(([pkg, label, hint, want]) => assert.strictEqual(cls(pkg, label, hint), want, `${pkg} (${label})`));
  assert.strictEqual(cls.detail('com.example.work', 'Her Neyse', 'game')[1], 'user');
});
test('sınıflandırma: genel kökler (google/microsoft) yanlış eşleşmez', () => {
  const cls = C.makeClassifier(RULES, {}, 'x');
  assert.strictEqual(cls('com.google.android.apps.unknownthing', 'Bilinmeyen', ''), 'other');
  assert.strictEqual(cls('com.microsoft.unknownthing', 'Bilinmeyen', ''), 'other');
  ['google', 'microsoft', 'android', 'apple'].forEach((g) => Object.keys(RULES.roots).forEach((k) => assert.ok(RULES.roots[k].indexOf(g) < 0, g)));
});

// --- toplama
const day = C.dayStart(Date.UTC(2026, 10, 11, 12) / 1000, 0); // yerel gün başı
const ev = (h1, m1, h2, m2, app, d) => [day + (d || 0) * 86400 + h1 * 3600 + m1 * 60, day + (d || 0) * 86400 + h2 * 3600 + m2 * 60, app];
const KEYS = { code: 'productive', yt: 'distraction', wa: 'communication', home: 'system', web: 'potential' };
const cls = (app) => KEYS[app] || 'other';
test('toplama: süreler, kategoriler, saatlik dağılım, geçiş sayısı', () => {
  const events = [ev(9, 0, 9, 30, 'code'), ev(9, 30, 9, 31, 'home'), ev(9, 31, 10, 15, 'yt'), ev(10, 15, 10, 16, 'home'), ev(10, 16, 10, 46, 'code'), ev(10, 46, 11, 0, 'code'), ev(23, 50, 24, 10, 'wa')];
  const a = C.aggregate(events, day, day + 86400, cls, { segments: true });
  assert.strictEqual(a.total, (30 + 1 + 44 + 1 + 30 + 14 + 10) * 60);
  assert.strictEqual(a.cats.productive, 74 * 60);
  assert.strictEqual(a.cats.distraction, 44 * 60);
  assert.strictEqual(a.cats.communication, 10 * 60, 'gün sınırında kırpılır');
  assert.strictEqual(a.switches, 3, 'code->yt->code->wa; ana ekran geçiş sayılmaz');
  assert.strictEqual(a.apps[0].app, 'code');
  assert.strictEqual(a.hourly[9], 60 * 60);
  assert.strictEqual(a.hourly[10], 60 * 60);
  assert.strictEqual(a.hourlyProd[10], 44 * 60);
  assert.strictEqual(a.hourly[23], 10 * 60);
  assert.strictEqual(Math.round(a.hourly.reduce((x, y) => x + y, 0)), a.total);
  assert.strictEqual(a.apps.find((x) => x.app === 'code').segs.length, 2, 'bitişik parçalar birleşir');
  assert.strictEqual(C.focusPercentage(a.cats), Math.round(74 / (119 + 9) * 100));
  const ex = C.aggregate(events, day, day + 86400, cls, { excluded: { yt: true } });
  assert.strictEqual(ex.cats.distraction, undefined);
  assert.strictEqual(ex.switches, 1);
});
test('analiz: dönem, önceki dönem, günlük seri', () => {
  const events = [];
  for (let d = -13; d <= 0; d++) { events.push(ev(9, 0, 10 + (d % 2 ? 1 : 0), 0, 'code', d)); events.push(ev(20, 0, 20, 30, 'yt', d)); }
  events.sort((a, b) => a[0] - b[0]);
  const now = day + 21 * 3600;
  const w = C.analysis(events, now, 7, cls);
  assert.strictEqual(w.daily.length, 7);
  assert.strictEqual(w.activeDays, 7);
  assert.strictEqual(w.current_total, w.daily.reduce((s, x) => s + x.secs, 0));
  assert.strictEqual(w.previous_total, 7 * 1800 + (3 * 3600 + 4 * 7200));
  assert.ok(Math.abs(w.change - (w.current_total - w.previous_total) / w.previous_total * 100) < 1e-9);
  assert.strictEqual(w.busiest.secs, 7200 + 1800);
  const t1 = C.analysis(events, day + 9.5 * 3600, 1, cls);
  assert.strictEqual(t1.current_total, 1800);
  assert.strictEqual(t1.previous_total, 1800, 'dün aynı saate kadar');
});
test('odak oturumu: kullanım kayıtlarından kesinti ve dağılma süresi', () => {
  const events = [ev(9, 0, 9, 10, 'code'), ev(9, 10, 9, 15, 'yt'), ev(9, 15, 9, 16, 'home'), ev(9, 16, 9, 20, 'yt'), ev(9, 20, 9, 40, 'code'), ev(9, 40, 9, 42, 'wa'), ev(9, 42, 10, 0, 'spy')];
  const r = C.focusFromEvents(events, day + 9 * 3600, day + 10 * 3600, cls, C.INTERRUPT_KEYS, {}, [], 'spy');
  assert.strictEqual(r.interruptions, 2, 'yt (ana ekran arası tek kesinti) + wa');
  assert.strictEqual(r.distracted, (5 + 4 + 2) * 60);
  const ig = C.focusFromEvents(events, day + 9 * 3600, day + 10 * 3600, cls, C.INTERRUPT_KEYS, { wa: true }, [], 'spy');
  assert.strictEqual(ig.interruptions, 1);
  assert.strictEqual(ig.distracted, 9 * 60);
  const onlyDist = C.focusFromEvents(events, day + 9 * 3600, day + 10 * 3600, cls, ['distraction'], {}, [], 'spy');
  assert.strictEqual(onlyDist.interruptions, 1);
  assert.strictEqual(C.liveScore(3600, r.interruptions, r.distracted), Math.round(60 + 40 - 10 - Math.round(660 / 3600 * 100)));
});

test('biçimlendirme', () => {
  assert.strictEqual(C.fmtShort(5 * 3600 + 16 * 60, 'tr'), '5s 16dk');
  assert.strictEqual(C.fmtShort(58 * 60, 'tr'), '58 dk');
  assert.strictEqual(C.fmtShort(3600, 'tr'), '1s 00dk');
  assert.strictEqual(C.fmtLong(5 * 3600 + 16 * 60, 'tr'), '5 saat 16 dk');
  assert.strictEqual(C.fmtMed(3600 + 5 * 60, 'tr'), '1 sa 05 dk');
  assert.strictEqual(C.fmtMed(3600 + 5 * 60, 'en'), '1 h 05 min');
  assert.strictEqual(C.fmtShort(45, 'en'), '45 s');
  assert.strictEqual(C.fmtClock(25 * 60), '25:00');
  assert.strictEqual(C.fmtClock(3725), '1:02:05');
});
test('Spy cevapları: her soru metin ve ruh hali döndürür', () => {
  const events = [];
  for (let d = -13; d <= 0; d++) { events.push(ev(9, 0, 11, 0, 'code', d)); events.push(ev(20, 0, 21, 30, 'yt', d)); events.push(ev(21, 30, 21, 40, 'wa', d)); }
  events.sort((a, b) => a[0] - b[0]);
  const now = day + 22 * 3600;
  const t = (s, ...args) => { let i = 0; return s.replace(/\{\}/g, () => args[i++]); };
  const ctx = { today: C.aggregate(events, day, now, cls), week: C.analysis(events, now, 7, cls), yesterday: C.analysis(events, now, 1, cls), goalHours: 4, lang: 'tr', t, name: (p) => p.toUpperCase(), fmtDate: () => '11 Kas' };
  const moods = ['happy', 'normal', 'worried', 'sad', 'angry', 'sleepy'];
  C.ACTIONS.map((a) => a[2]).concat(['goal', 'switches', 'nope']).forEach((action) => {
    const [text, mood] = C.answerFor(action, ctx);
    assert.ok(text && text.indexOf('{}') < 0 && text.indexOf('undefined') < 0 && text.indexOf('NaN') < 0, action + ': ' + text);
    assert.ok(moods.indexOf(mood) >= 0, action + ' mood ' + mood);
  });
  assert.ok(C.answerFor('daily', ctx)[0].indexOf('Bugün toplam 3 sa 40 dk aktif kullanım var. En çok CODE, YT, WA. Üretkenlik oranın %55, eğlence payın %41.') === 0);
  assert.ok(C.answerFor('best_hour', ctx)[0].indexOf('09:00–10:00') > 0);
  const [atext] = C.analysisText(ctx.week, ctx);
  assert.ok(atext.indexOf('Son 7 gün toplam') === 0 && atext.indexOf('{}') < 0, atext);
  const empty = { today: C.aggregate([], day, now, cls), week: C.analysis([], now, 7, cls), yesterday: C.analysis([], now, 1, cls), goalHours: 4, lang: 'tr', t, name: (p) => p, fmtDate: () => '' };
  C.ACTIONS.forEach((a) => assert.strictEqual(C.answerFor(a[2], empty)[1], 'sleepy', a[2]));
  assert.strictEqual(C.analysisText(empty.week, empty)[1], 'sleepy');
});
test('CSV kaçışları', () => {
  assert.strictEqual(C.toCsv([['a', 'b,c'], ['d"e', 1]]), '﻿a,"b,c"\r\n"d""e",1\r\n');
});

console.log('\n' + passed + ' test geçti.');
