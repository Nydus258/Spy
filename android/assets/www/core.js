/* Spy Mobile — çekirdek mantık (arayüzden bağımsız, Node ile test edilebilir).
 * Masaüstü Spy 1.4.5'teki modüllerin telefon karşılığı:
 *   spy_categorization -> makeClassifier / focusPercentage
 *   activity_tools     -> aggregate / analysis / dayStart
 *   spy_focus          -> liveScore / InterruptWatcher / focusFromEvents
 *   spy_pomodoro       -> Pomodoro
 *   spy_answers        -> answerFor / analysisText
 *   coaching           -> coachingTip
 *   spy_license        -> parseKey / licenseStatus (Ed25519)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SpyCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------------------------------------------------------------- kategoriler
  var CAT_KEYS = ['productive', 'distraction', 'communication', 'potential', 'info', 'life', 'system', 'other'];
  var PRECEDENCE = ['productive', 'distraction', 'communication', 'info', 'life', 'potential', 'system'];
  var CAT_LABELS = {
    productive: 'Üretkenlik', distraction: 'Eğlence / Dikkat dağıtıcı', communication: 'İletişim',
    potential: 'Potansiyel', info: 'Haber & Bilgi', life: 'Alışveriş & Yaşam', other: 'Diğer', system: 'Android / Sistem'
  };
  var CAT_SHORT = {
    productive: 'Üretkenlik', distraction: 'Eğlence', communication: 'İletişim',
    potential: 'Potansiyel', info: 'Haber & Bilgi', life: 'Alışveriş & Yaşam', other: 'Diğer', system: 'Sistem'
  };
  var CAT_COLORS = {
    productive: '#22c55e', distraction: '#ec4899', communication: '#7c4dff', potential: '#38bdf8',
    info: '#f59e0b', life: '#14b8a6', other: '#94a3b8', system: '#64748b'
  };

  // Android paket adı -> kategori (tam eşleşme). Masaüstündeki alan adı/uygulama kurallarının telefon karşılığı.
  var PKG_MAP = {
    // Eğlence / dikkat dağıtıcı
    'com.instagram.android': 'distraction', 'com.instagram.lite': 'distraction', 'com.instagram.barcelona': 'distraction',
    'com.zhiliaoapp.musically': 'distraction', 'com.zhiliaoapp.musically.go': 'distraction', 'com.ss.android.ugc.trill': 'distraction',
    'com.facebook.katana': 'distraction', 'com.facebook.lite': 'distraction', 'com.twitter.android': 'distraction',
    'com.snapchat.android': 'distraction', 'com.reddit.frontpage': 'distraction', 'com.pinterest': 'distraction',
    'tv.twitch.android.app': 'distraction', 'com.netflix.mediaclient': 'distraction', 'com.disney.disneyplus': 'distraction',
    'com.amazon.avod.thirdpartyclient': 'distraction', 'com.spotify.music': 'distraction', 'com.spotify.lite': 'distraction',
    'com.tumblr': 'distraction', 'com.vkontakte.android': 'distraction', 'org.videolan.vlc': 'distraction',
    'com.mxtech.videoplayer.ad': 'distraction', 'com.google.android.apps.youtube.music': 'distraction',
    'com.kick.mobile': 'distraction', 'com.blutv.androidapp': 'distraction', 'com.exxen.android': 'distraction',
    'com.dmp.puhutv': 'distraction', 'com.gain.app': 'distraction', 'com.bein.connect': 'distraction',
    'com.hbo.hbonow': 'distraction', 'com.wbd.stream': 'distraction', 'com.crunchyroll.crunchyroid': 'distraction',
    'com.valvesoftware.android.steam.community': 'distraction', 'com.roblox.client': 'distraction',
    'com.mojang.minecraftpe': 'distraction', 'com.tencent.ig': 'distraction', 'com.dts.freefireth': 'distraction',
    'com.nianticlabs.pokemongo': 'distraction', 'com.kiloo.subwaysurf': 'distraction', 'com.innersloth.spacemafia': 'distraction',
    'com.activision.callofduty.shooter': 'distraction', 'com.deezer.android.app': 'distraction', 'com.soundcloud.android': 'distraction',
    'com.ninegag.android.app': 'distraction', 'com.bereal.ft': 'distraction', 'com.lemon.lvoverseas': 'distraction',
    // İletişim
    'com.whatsapp': 'communication', 'com.whatsapp.w4b': 'communication', 'org.telegram.messenger': 'communication',
    'org.telegram.messenger.web': 'communication', 'org.thoughtcrime.securesms': 'communication', 'com.facebook.orca': 'communication',
    'com.facebook.mlite': 'communication', 'com.discord': 'communication', 'com.Slack': 'communication',
    'us.zoom.videomeetings': 'communication', 'com.microsoft.teams': 'communication', 'com.google.android.gm': 'communication',
    'com.microsoft.office.outlook': 'communication', 'com.google.android.apps.messaging': 'communication',
    'com.samsung.android.messaging': 'communication', 'com.android.mms': 'communication', 'com.google.android.dialer': 'communication',
    'com.samsung.android.dialer': 'communication', 'com.android.dialer': 'communication', 'com.google.android.contacts': 'communication',
    'com.samsung.android.app.contacts': 'communication', 'com.android.contacts': 'communication', 'com.samsung.android.incallui': 'communication',
    'com.android.incallui': 'communication', 'com.google.android.apps.tachyon': 'communication', 'com.google.android.apps.meetings': 'communication',
    'com.skype.raider': 'communication', 'com.viber.voip': 'communication', 'jp.naver.line.android': 'communication',
    'com.tencent.mm': 'communication', 'com.turkcell.bip': 'communication', 'ch.protonmail.android': 'communication',
    'com.yahoo.mobile.client.android.mail': 'communication', 'com.samsung.android.email.provider': 'communication',
    'com.linkedin.android': 'communication', 'com.android.server.telecom': 'communication',
    // Üretkenlik
    'com.google.android.apps.docs': 'productive', 'com.google.android.apps.docs.editors.docs': 'productive',
    'com.google.android.apps.docs.editors.sheets': 'productive', 'com.google.android.apps.docs.editors.slides': 'productive',
    'com.microsoft.office.word': 'productive', 'com.microsoft.office.excel': 'productive', 'com.microsoft.office.powerpoint': 'productive',
    'com.microsoft.office.officehubrow': 'productive', 'com.microsoft.office.onenote': 'productive', 'com.microsoft.skydrive': 'productive',
    'notion.id': 'productive', 'md.obsidian': 'productive', 'com.todoist': 'productive', 'com.ticktick.task': 'productive',
    'com.google.android.keep': 'productive', 'com.google.android.calendar': 'productive', 'com.samsung.android.calendar': 'productive',
    'com.github.android': 'productive', 'com.openai.chatgpt': 'productive', 'com.anthropic.claude': 'productive',
    'com.google.android.apps.bard': 'productive', 'ai.perplexity.app.android': 'productive', 'com.microsoft.copilot': 'productive',
    'com.adobe.reader': 'productive', 'com.duolingo': 'productive', 'com.google.android.apps.classroom': 'productive',
    'com.termux': 'productive', 'com.evernote': 'productive', 'com.trello': 'productive', 'com.figma.mirror': 'productive',
    'com.canva.editor': 'productive', 'com.google.android.apps.translate': 'productive', 'com.samsung.android.app.notes': 'productive',
    'com.miui.notes': 'productive', 'com.dropbox.android': 'productive', 'com.google.android.apps.tasks': 'productive',
    'org.coursera.android': 'productive', 'com.udemy.android': 'productive', 'org.khanacademy.android': 'productive',
    'com.deepl.mobiletranslator': 'productive', 'com.google.android.apps.authenticator2': 'productive',
    'com.microsoft.todos': 'productive', 'com.asana.app': 'productive', 'com.atlassian.android.jira.core': 'productive',
    // Haber & Bilgi
    'com.google.android.apps.magazines': 'info', 'flipboard.app': 'info', 'bbc.mobile.news.ww': 'info',
    'com.cnn.mobile.android.phone': 'info', 'org.wikipedia': 'info', 'com.google.android.apps.podcasts': 'info',
    'com.medium.reader': 'info', 'com.quora.android': 'info', 'com.tradingview.tradingviewapp': 'info',
    'com.fusionmedia.investing': 'info', 'com.weather.Weather': 'info', 'com.sec.android.daemonapp': 'info',
    'com.hurriyet.app': 'info', 'com.ntv': 'info', 'com.substack.app': 'info',
    // Alışveriş & Yaşam
    'trendyol.com': 'life', 'com.pozitron.hepsiburada': 'life', 'com.amazon.mShop.android.shopping': 'life',
    'com.getir': 'life', 'com.inovel.app.yemeksepeti': 'life', 'com.sahibinden': 'life', 'com.google.android.apps.maps': 'life',
    'com.yandex.maps': 'life', 'com.waze': 'life', 'com.akbank.android.apps.akbank_direkt': 'life', 'com.garanti.cepsubesi': 'life',
    'com.ziraat.ziraatmobil': 'life', 'com.vakifbank.mobile': 'life', 'com.ykb.android': 'life', 'com.tmobtech.halkbank': 'life',
    'com.pozitron.iscep': 'life', 'tr.gov.turkiye.edevlet.kapisi': 'life', 'com.ubercab': 'life', 'com.booking': 'life',
    'com.airbnb.android': 'life', 'com.dolap.android': 'life', 'com.alibaba.aliexpresshd': 'life', 'com.ebay.mobile': 'life',
    'com.einnovation.temu': 'life', 'com.zzkko': 'life', 'com.google.android.apps.walletnfcrel': 'life', 'com.paypal.android.p2pmobile': 'life',
    'com.n11.mobile': 'life', 'com.google.android.apps.fitness': 'life', 'com.sec.android.app.shealth': 'life',
    'com.myfitnesspal.android': 'life', 'tr.gov.saglik.enabiz': 'life', 'tr.gov.saglik.MHRSMOBIL': 'life',
    'com.finansbank.mobile.cepsube': 'life', 'com.denizbank.mobildeniz': 'life', 'com.teb': 'life', 'com.ingbanktr.ingmobil': 'life',
    'com.papara.app': 'life', 'com.migros.app': 'life', 'com.etsy.android': 'life', 'com.obilet.androidside': 'life',
    // Potansiyel (nötr): tarayıcılar, arama, YouTube
    'com.android.chrome': 'potential', 'org.mozilla.firefox': 'potential', 'com.opera.browser': 'potential',
    'com.opera.mini.native': 'potential', 'com.brave.browser': 'potential', 'com.microsoft.emmx': 'potential',
    'com.sec.android.app.sbrowser': 'potential', 'com.duckduckgo.mobile.android': 'potential', 'com.yandex.browser': 'potential',
    'com.vivaldi.browser': 'potential', 'com.mi.globalbrowser': 'potential', 'com.huawei.browser': 'potential',
    'com.google.android.youtube': 'potential', 'com.google.android.googlequicksearchbox': 'potential', 'com.google.android.apps.photos': 'potential',
    // Android / Sistem
    'android': 'system', 'com.android.systemui': 'system', 'com.android.settings': 'system', 'com.google.android.packageinstaller': 'system',
    'com.android.packageinstaller': 'system', 'com.google.android.permissioncontroller': 'system', 'com.android.permissioncontroller': 'system',
    'com.android.vending': 'system', 'com.google.android.gms': 'system', 'com.samsung.android.lool': 'system',
    'com.google.android.deskclock': 'system', 'com.sec.android.app.clockpackage': 'system', 'com.android.deskclock': 'system',
    'com.google.android.calculator': 'system', 'com.sec.android.app.popupcalculator': 'system', 'com.miui.calculator': 'system',
    'com.google.android.apps.nbu.files': 'system', 'com.sec.android.app.myfiles': 'system', 'com.android.documentsui': 'system',
    'com.google.android.documentsui': 'system', 'com.sec.android.app.camera': 'system', 'com.android.camera': 'system',
    'com.google.android.GoogleCamera': 'system', 'com.sec.android.gallery3d': 'system', 'com.miui.gallery': 'system',
    'com.miui.securitycenter': 'system', 'com.samsung.android.app.galaxyfinder': 'system', 'com.google.android.inputmethod.latin': 'system'
  };
  // Paket adı önekleri (çoğunlukla oyun yayıncıları ve başlatıcılar).
  var PKG_PREFIX = [
    ['com.supercell.', 'distraction'], ['com.king.', 'distraction'], ['com.riotgames.', 'distraction'], ['com.miHoYo.', 'distraction'],
    ['com.ea.', 'distraction'], ['com.gameloft.', 'distraction'], ['com.rovio.', 'distraction'], ['com.epicgames.', 'distraction'],
    ['com.playrix.', 'distraction'], ['com.outfit7.', 'distraction'], ['com.zynga.', 'distraction'], ['com.miniclip.', 'distraction'],
    ['com.nintendo.', 'distraction'], ['com.ubisoft.', 'distraction'], ['com.netease.', 'distraction'], ['com.garena.', 'distraction'],
    ['com.voodoo.', 'distraction'], ['com.halfbrick.', 'distraction'], ['com.dreamgames.', 'distraction'], ['com.peakgames.', 'distraction'],
    ['com.android.launcher', 'system'], ['com.google.android.apps.nexuslauncher', 'system'], ['com.sec.android.app.launcher', 'system'],
    ['com.miui.home', 'system'], ['com.huawei.android.launcher', 'system'], ['com.oppo.launcher', 'system'], ['com.android.systemui', 'system'],
    ['com.android.providers.', 'system'], ['com.android.inputmethod', 'system'], ['com.samsung.android.honeyboard', 'system']
  ];
  var HINT_MAP = { game: 'distraction', audio: 'distraction', video: 'distraction', social: 'distraction', news: 'info', maps: 'life', productivity: 'productive' };

  /** Çeviri tablosu üreticisi için işaret: metni olduğu gibi döndürür. */
  function T(s) { return s; }

  /** Python'un round() davranışı (yarımlar çift sayıya): masaüstüyle aynı puanı vermek için. */
  function pyRound(x) {
    var r = Math.round(x);
    return (Math.abs(x % 1) === 0.5 && r % 2 !== 0) ? r - 1 : r;
  }

  var TR_MAP = { 'ı': 'i', 'ş': 's', 'ğ': 'g', 'ü': 'u', 'ö': 'o', 'ç': 'c', 'â': 'a', 'î': 'i', 'û': 'u' };
  function norm(value) {
    return String(value == null ? '' : value).replace(/[İI]/g, 'i').toLowerCase().replace(/[ışğüöçâîû]/g, function (c) { return TR_MAP[c]; });
  }

  /** rules: {apps:{key:[..]}, roots:{key:[..]}} (data.js); overrides: {paket: kategori}. Dönüş: classify(pkg, label, hint) -> anahtar */
  function makeClassifier(rules, overrides, ownPackage) {
    rules = rules || { apps: {}, roots: {} };
    overrides = overrides || {};
    var cache = {};
    var appRules = [], rootRules = [];
    PRECEDENCE.forEach(function (key) {
      (rules.apps[key] || []).forEach(function (tok) { appRules.push([norm(tok), key]); });
      (rules.roots[key] || []).forEach(function (tok) { rootRules.push([norm(tok), key]); });
    });
    function detail(pkg, label, hint) {
      if (overrides[pkg]) return [overrides[pkg], 'user'];
      if (ownPackage && pkg === ownPackage) return ['system', 'spy'];
      if (PKG_MAP[pkg]) return [PKG_MAP[pkg], 'package'];
      for (var i = 0; i < PKG_PREFIX.length; i++) if (pkg.indexOf(PKG_PREFIX[i][0]) === 0) return [PKG_PREFIX[i][1], 'package'];
      if (hint === 'launcher') return ['system', 'launcher'];
      var lab = norm(label).replace(/[^0-9a-z]+/g, ' ').trim();
      var padded = ' ' + lab + ' ';
      var segs = pkg.toLowerCase().split('.');
      var j, tok;
      for (j = 0; j < appRules.length; j++) {
        tok = appRules[j][0];
        if (!tok) continue;
        if (lab === tok) return [appRules[j][1], 'app:' + tok];
        if (tok.length > 3 && (padded.indexOf(' ' + tok + ' ') >= 0 || (tok.indexOf(' ') < 0 && segs.indexOf(tok) >= 0))) return [appRules[j][1], 'app:' + tok];
      }
      for (j = 0; j < rootRules.length; j++) {
        tok = rootRules[j][0];
        if (tok.length < 4) continue;
        if (segs.indexOf(tok) >= 0 || padded.indexOf(' ' + tok + ' ') >= 0) return [rootRules[j][1], 'site:' + tok];
      }
      if (HINT_MAP[hint]) return [HINT_MAP[hint], 'android:' + hint];
      if (hint === 'system') return ['system', 'android:system'];
      return ['other', ''];
    }
    function classify(pkg, label, hint) {
      var id = pkg + '\u0001' + (label || '') + '\u0001' + (hint || '');
      var hit = cache[id];
      if (!hit) hit = cache[id] = detail(pkg, label, hint);
      return hit[0];
    }
    classify.detail = function (pkg, label, hint) { classify(pkg, label, hint); return cache[pkg + '\u0001' + (label || '') + '\u0001' + (hint || '')]; };
    return classify;
  }

  /** TEK odak/üretkenlik formülü: üretken / (toplam - sistem). */
  function focusPercentage(cats) {
    var prod = 0, system = 0, total = 0;
    Object.keys(cats || {}).forEach(function (k) {
      var s = Number(cats[k]) || 0; total += s;
      if (k === 'productive') prod += s; else if (k === 'system') system += s;
    });
    var denom = total - system;
    return denom > 0 ? pyRound(prod / denom * 100) : 0;
  }
  function distShare(cats) {
    var denom = 0;
    Object.keys(cats || {}).forEach(function (k) { if (k !== 'system') denom += Number(cats[k]) || 0; });
    return denom ? (Number(cats.distraction) || 0) / denom * 100 : 0;
  }

  // ---------------------------------------------------------------- zaman yardımcıları
  /** Yerel gece yarısı (epoch sn). daysAgo=0 bugün. */
  function dayStart(now, daysAgo) {
    var d = new Date(now * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (daysAgo || 0)).getTime() / 1000;
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ---------------------------------------------------------------- toplama
  /** events: [[start, end, paket], ...] (epoch sn). cls: paket -> kategori. opts: {excluded: {paket: true}, segments: bool} */
  function aggregate(events, start, end, cls, opts) {
    opts = opts || {};
    var excluded = opts.excluded || {};
    var apps = {}, cats = {}, hourly = [], hourlyProd = [], total = 0, switches = 0, lastApp = null, i, h;
    for (h = 0; h < 24; h++) { hourly.push(0); hourlyProd.push(0); }
    for (i = 0; i < events.length; i++) {
      var ev = events[i], s = Math.max(ev[0], start), e = Math.min(ev[1], end), app = ev[2];
      if (!(e > s) || excluded[app]) continue;
      var key = cls(app), dur = e - s;
      total += dur;
      cats[key] = (cats[key] || 0) + dur;
      var a = apps[app];
      if (!a) a = apps[app] = { app: app, key: key, secs: 0, first: s, last: e, segs: [] };
      a.secs += dur; a.last = e;
      if (opts.segments) {
        var prev = a.segs.length ? a.segs[a.segs.length - 1] : null;
        if (prev && s - prev[1] < 30) prev[1] = e; else a.segs.push([s, e]);
      }
      // saatlik dağılım (yerel saat)
      var t = s;
      while (t < e) {
        var d = new Date(t * 1000);
        var next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() + 1).getTime() / 1000;
        var part = Math.min(e, next) - t;
        hourly[d.getHours()] += part;
        if (key === 'productive') hourlyProd[d.getHours()] += part;
        t = Math.min(e, next);
      }
      // uygulama geçişi: ana ekran/sistem araya girse de A -> B tek geçiştir
      if (key !== 'system') {
        if (lastApp !== null && lastApp !== app) switches++;
        lastApp = app;
      }
    }
    var list = Object.keys(apps).map(function (k) { return apps[k]; }).sort(function (x, y) { return y.secs - x.secs; });
    return { start: start, end: end, total: total, cats: cats, apps: list, hourly: hourly, hourlyProd: hourlyProd, switches: switches, lastApp: lastApp };
  }

  /** Analiz sayfası: `days` günlük dönem + bir önceki dönem. days=1 için 'dün aynı saate kadar'. */
  function analysis(events, now, days, cls, opts) {
    var start = dayStart(now, days - 1);
    var prevStart, prevEnd;
    if (days === 1) { prevStart = dayStart(now, 1); prevEnd = prevStart + (now - start); }
    else { prevStart = dayStart(now, 2 * days - 1); prevEnd = start; }
    var cur = aggregate(events, start, now, cls, opts);
    var prev = aggregate(events, prevStart, prevEnd, cls, opts);
    var daily = [], activeDays = 0, busiest = null, lowest = null;
    for (var i = days - 1; i >= 0; i--) {
      var ds = dayStart(now, i), de = Math.min(now, dayStart(now, i - 1));
      var secs = aggregate(events, ds, de, cls, opts).total;
      var item = { date: ds, secs: secs };
      daily.push(item);
      if (secs >= 60) {
        activeDays++;
        if (!busiest || secs > busiest.secs) busiest = item;
        if (!lowest || secs < lowest.secs) lowest = item;
      }
    }
    var change = prev.total >= 300 ? (cur.total - prev.total) / prev.total * 100 : null;
    return {
      days: days, start: start, end: now, current_total: cur.total, previous_total: prev.total,
      cats: cur.cats, prevCats: prev.cats, apps: cur.apps, hourly: cur.hourly, hourlyProd: cur.hourlyProd,
      daily: daily, activeDays: activeDays, busiest: busiest, lowest: lowest,
      dailyAvg: cur.total / days, prevDailyAvg: prev.total / days, change: change, switches: cur.switches
    };
  }

  // ---------------------------------------------------------------- biçimlendirme
  var UNITS = {
    tr: { h: 's', m: 'dk', hLong: 'saat', mLong: 'dk', hMed: 'sa', s: 'sn' },
    en: { h: 'h', m: 'm', hLong: 'h', mLong: 'min', hMed: 'h', s: 's' }
  };
  function splitDur(seconds) {
    var s = Math.max(0, Math.round(Number(seconds) || 0));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s];
  }
  /** '5s 16dk' / '58 dk' (liste ve grafik etiketleri) */
  function fmtShort(seconds, lang) {
    var u = UNITS[lang] || UNITS.tr, p = splitDur(seconds);
    if (p[0]) return p[0] + u.h + ' ' + pad2(p[1]) + u.m;
    if (p[1]) return p[1] + ' ' + (lang === 'en' ? 'min' : 'dk');
    return p[2] + ' ' + u.s;
  }
  /** '5 saat 16 dk' (kutular) */
  function fmtLong(seconds, lang) {
    var u = UNITS[lang] || UNITS.tr, p = splitDur(seconds);
    if (p[0]) return p[0] + ' ' + u.hLong + ' ' + p[1] + ' ' + u.mLong;
    if (p[1]) return p[1] + ' ' + u.mLong;
    return p[2] + ' ' + u.s;
  }
  /** '1 sa 05 dk' (cümle içi; masaüstündeki fmt_dur) */
  function fmtMed(seconds, lang) {
    var u = UNITS[lang] || UNITS.tr, p = splitDur(seconds);
    if (p[0]) return p[0] + ' ' + u.hMed + ' ' + pad2(p[1]) + ' ' + u.mLong;
    if (p[1]) return p[1] + ' ' + u.mLong;
    return p[2] + ' ' + u.s;
  }
  function fmtClock(seconds) {
    var s = Math.max(0, Math.floor(seconds)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return (h ? h + ':' + pad2(m) : pad2(m)) + ':' + pad2(s % 60);
  }

  // ---------------------------------------------------------------- koçluk (coaching.py)
  /** Dönüş: çeviri için [şablon, ...değerler] parçaları dizisi. */
  function coachingTip(prodSecs, distSecs, totalSecs, goalHours) {
    if (!totalSecs || totalSecs <= 0) return [[T('Henüz bugün için yeterli veri yok. Biraz çalıştıktan sonra tekrar bak, sana özel bir tavsiye hazırlayayım.')]];
    var goal = Math.max(0, Number(goalHours) || 0) * 3600;
    var prodRatio = prodSecs / totalSecs, distRatio = distSecs / totalSecs, tips = [];
    if (goal > 0) {
      if (prodSecs >= goal) tips.push([T('Günlük hedefine ulaştın, harika gidiyorsun! 🎯')]);
      else tips.push([T('Hedefine ulaşmak için yaklaşık {} dakika daha üretken çalışman yeterli.'), Math.max(1, pyRound((goal - prodSecs) / 60))]);
    }
    if (distRatio >= 0.5) tips.push([T('Bugün vaktinin yarısından fazlası dikkat dağıtıcı uygulamalarda geçmiş; kısa bir mola sonrası odaklanmayı dene.')]);
    else if (prodRatio >= 0.6) tips.push([T('Odak oranın gayet iyi, bu tempoyu koru!')]);
    else if (prodRatio < 0.3 && distRatio < 0.5) tips.push([T('Üretken süre biraz düşük görünüyor, kısa ve net bir göreve odaklanmayı deneyebilirsin.')]);
    if (!tips.length) tips.push([T('Bugünkü dengen fena değil, böyle devam.')]);
    return tips;
  }

  // ---------------------------------------------------------------- odak (spy_focus.py)
  var INTERRUPT_KEYS = ['distraction', 'life', 'communication'];
  var ALL_INTERRUPT_KEYS = INTERRUPT_KEYS.concat(['system']);
  function liveScore(elapsed, interruptions, distractedSeconds) {
    if (elapsed <= 0) return 0;
    var bonus = Math.min(40, elapsed / 90);
    var ipen = Math.min(60, Math.max(0, interruptions) * 5);
    var dpen = Math.min(60, pyRound(Math.max(0, distractedSeconds) / elapsed * 100));
    return Math.max(0, Math.min(100, pyRound(60 + bonus - ipen - dpen)));
  }
  function InterruptWatcher(keys) {
    this.keys = keys || INTERRUPT_KEYS;
    this.ignored = {};
    this.newRound();
  }
  InterruptWatcher.CALM_SECONDS = 20;
  InterruptWatcher.prototype.newRound = function () { this.lastMeaningful = 'productive'; this.activeItem = null; this.calmSince = null; };
  InterruptWatcher.prototype.ignore = function (item) {
    this.ignored[item] = true;
    if (this.activeItem === item) this.activeItem = null;
    this.lastMeaningful = 'productive';
  };
  /** True: üretken çalışmadan kesinti sebebi bir içeriğe YENİ geçildi. */
  InterruptWatcher.prototype.observe = function (key, item, now) {
    if (this.ignored[item]) { this.activeItem = null; this.lastMeaningful = 'productive'; this.calmSince = null; return false; }
    if (this.keys.indexOf(key) >= 0) {
      this.calmSince = null;
      if (this.activeItem === item) return false;
      var started = this.lastMeaningful === 'productive';
      this.activeItem = item; this.lastMeaningful = key;
      return started;
    }
    this.activeItem = null;
    if (key === 'productive') { this.lastMeaningful = 'productive'; this.calmSince = null; return false; }
    if (this.calmSince === null) { this.calmSince = now; return false; }
    if (now - this.calmSince >= InterruptWatcher.CALM_SECONDS) this.lastMeaningful = 'productive';
    return false;
  };
  /** Oturum penceresindeki kullanım kayıtlarından kesinti ve dağılma süresi. pauses: [[bas, bit], ...] */
  function focusFromEvents(events, start, end, cls, keys, ignored, pauses, ownPackage) {
    var w = new InterruptWatcher(keys), list = [], distracted = 0;
    Object.keys(ignored || {}).forEach(function (k) { w.ignored[k] = true; });
    function inPause(t) { for (var i = 0; i < (pauses || []).length; i++) if (t >= pauses[i][0] && t < (pauses[i][1] || Infinity)) return true; return false; }
    for (var i = 0; i < events.length; i++) {
      var s = Math.max(events[i][0], start), e = Math.min(events[i][1], end), app = events[i][2];
      if (!(e > s) || inPause(s)) continue;
      // Spy'ın kendisine bakmak çalışmayı bölmez: üretken sayılır.
      var key = app === ownPackage ? 'productive' : cls(app);
      // Telefonda ana ekran/sistem yalnızca geçiş yoludur: (kesinti sayılması istenmediyse) hiç gözlenmez,
      // böylece YouTube -> ana ekran -> YouTube tek kesinti kalır.
      if (key === 'system' && w.keys.indexOf('system') < 0) continue;
      if (w.observe(key, app, s)) list.push({ time: s, app: app, key: key });
      if (w.keys.indexOf(key) >= 0 && !w.ignored[app]) distracted += e - s;
      w.observe(key, app, e);
    }
    return { interruptions: list.length, list: list, distracted: distracted };
  }

  // ---------------------------------------------------------------- pomodoro (spy_pomodoro.py)
  var IDLE = 'idle', WORK = 'work', SHORT = 'short_break', LONG = 'long_break', ROUNDS = 4;
  var WORK_RANGE = [15, 60], SHORT_RANGE = [3, 15], LONG_RANGE = [15, 30];
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, Math.round(Number(v) || lo))); }
  function Pomodoro(workMin, shortMin, longMin) {
    this.state = IDLE; this.round = 0; this.paused = false;
    this.end_at = 0; this.paused_remaining = 0; this.phase_seconds = 0; this.phase_started = 0;
    this.configure(workMin == null ? 25 : workMin, shortMin == null ? 5 : shortMin, longMin == null ? 15 : longMin);
  }
  Pomodoro.prototype.configure = function (w, s, l, doClamp) {
    if (doClamp !== false) { w = clamp(w, WORK_RANGE[0], WORK_RANGE[1]); s = clamp(s, SHORT_RANGE[0], SHORT_RANGE[1]); l = clamp(l, LONG_RANGE[0], LONG_RANGE[1]); }
    this.work_min = w; this.short_min = s; this.long_min = l;
  };
  Pomodoro.prototype.running = function () { return this.state !== IDLE; };
  Pomodoro.prototype.inBreak = function () { return this.state === SHORT || this.state === LONG; };
  Pomodoro.prototype.remaining = function (now) {
    if (this.state === IDLE) return 0;
    if (this.paused) return this.paused_remaining;
    return Math.max(0, this.end_at - now);
  };
  Pomodoro.prototype._begin = function (state, minutes, now) {
    this.state = state; this.paused = false; this.phase_seconds = minutes * 60; this.phase_started = now; this.end_at = now + this.phase_seconds;
  };
  Pomodoro.prototype._startWork = function (now) { this._begin(WORK, this.work_min, now); return ['work_started', { round: this.round, minutes: this.work_min }]; };
  Pomodoro.prototype._startBreak = function (now) {
    if (this.round < ROUNDS) { this._begin(SHORT, this.short_min, now); return ['break_started', { kind: 'short', minutes: this.short_min, round: this.round }]; }
    this._begin(LONG, this.long_min, now); return ['break_started', { kind: 'long', minutes: this.long_min, round: this.round }];
  };
  Pomodoro.prototype._reset = function () { this.state = IDLE; this.round = 0; this.paused = false; this.end_at = 0; this.paused_remaining = 0; this.phase_seconds = 0; };
  Pomodoro.prototype.start = function (now) { this.round = 1; var ev = this._startWork(now); return [['session_started', { round: 1, minutes: this.work_min }], ev]; };
  Pomodoro.prototype.pause = function (now) {
    if (this.state === IDLE || this.paused) return [];
    this.paused_remaining = Math.max(0, this.end_at - now); this.paused = true; return [['paused', {}]];
  };
  Pomodoro.prototype.resume = function (now) {
    if (this.state === IDLE || !this.paused) return [];
    this.end_at = now + this.paused_remaining; this.paused = false; return [['resumed', {}]];
  };
  Pomodoro.prototype.skipBreak = function (now) {
    if (!this.inBreak()) return [];
    var events = [['break_ended', { early: true }]];
    if (this.state === LONG) { events.push(['set_done', {}]); this.round = 1; }
    else this.round += 1;
    events.push(this._startWork(now));
    return events;
  };
  Pomodoro.prototype.stop = function (now) {
    var events = [];
    if (this.state === WORK) {
      var elapsed = this.phase_seconds - this.remaining(now);
      if (elapsed >= 60) events.push(['work_stopped', { round: this.round, start: now - elapsed, end: now, seconds: Math.floor(elapsed) }]);
    }
    if (this.state !== IDLE) events.push(['stopped', {}]);
    this._reset();
    return events;
  };
  /** Süre dolduysa sonraki aşamaya geçer. Telefonda uygulama arka plandayken zaman akmaya devam ettiği için aşamalar
   *  planlanan bitiş anından başlar (catchUp ile zincirleme işlenir). */
  Pomodoro.prototype.tick = function (now) {
    if (this.state === IDLE || this.paused || now < this.end_at) return [];
    var at = this.end_at;
    if (this.state === WORK) {
      var events = [['work_done', { round: this.round, start: this.end_at - this.phase_seconds, end: this.end_at, seconds: Math.floor(this.phase_seconds) }]];
      events.push(this._startBreak(at));
      return events;
    }
    if (this.state === SHORT) { this.round += 1; return [['break_ended', { early: false }], this._startWork(at)]; }
    this._reset();
    return [['break_ended', { early: false }], ['set_done', {}]];
  };
  Pomodoro.prototype.catchUp = function (now) {
    var all = [], guard = 0;
    while (guard++ < 20) { var ev = this.tick(now); if (!ev.length) break; all = all.concat(ev); }
    return all;
  };
  /** Kalan aşamaların bitiş anları (alarm kurmak için): [{at, state, round}] */
  Pomodoro.prototype.schedule = function (now) {
    if (this.state === IDLE || this.paused) return [];
    var c = Pomodoro.fromJSON(this.toJSON()), out = [], guard = 0;
    while (c.state !== IDLE && guard++ < 12) {
      out.push({ at: c.end_at, state: c.state, round: c.round });
      c.tick(c.end_at);
    }
    return out;
  };
  Pomodoro.prototype.toJSON = function () {
    return { state: this.state, round: this.round, paused: this.paused, end_at: this.end_at, paused_remaining: this.paused_remaining,
      phase_seconds: this.phase_seconds, phase_started: this.phase_started, work_min: this.work_min, short_min: this.short_min, long_min: this.long_min };
  };
  Pomodoro.fromJSON = function (o) {
    var p = new Pomodoro(o && o.work_min, o && o.short_min, o && o.long_min);
    if (o && [WORK, SHORT, LONG].indexOf(o.state) >= 0) {
      p.state = o.state; p.round = Number(o.round) || 1; p.paused = !!o.paused; p.end_at = Number(o.end_at) || 0;
      p.paused_remaining = Number(o.paused_remaining) || 0; p.phase_seconds = Number(o.phase_seconds) || 0; p.phase_started = Number(o.phase_started) || 0;
    }
    return p;
  };
  Pomodoro.ROUNDS = ROUNDS; Pomodoro.WORK_RANGE = WORK_RANGE; Pomodoro.SHORT_RANGE = SHORT_RANGE; Pomodoro.LONG_RANGE = LONG_RANGE;

  // ---------------------------------------------------------------- Spy cevapları (spy_answers.py)
  var ACTIONS = [
    ['📊', T('Bugün telefonumu nasıl kullandım?'), 'daily'], ['🎯', T('Odaklanmam nasıl?'), 'focus'],
    ['🔎', T('En çok hangi uygulamayı kullandım?'), 'top_app'], ['🚫', T('Beni en çok ne dağıtıyor?'), 'distraction'],
    ['⚖️', T('Dünle karşılaştırınca nasılım?'), 'vs_yesterday'], ['📈', T('Bu hafta nasıl gidiyor?'), 'week'],
    ['⏰', T('En verimli saatim hangisi?'), 'best_hour'], ['💡', T('Bana küçük bir öneri ver'), 'tip']
  ];
  function moodForFocus(focus, dist) {
    if (dist >= 50) return 'angry';
    if (focus >= 55) return 'happy';
    if (focus >= 40) return 'normal';
    if (focus >= 25) return 'worried';
    if (dist >= 35) return 'angry';
    return 'sad';
  }
  function moodForDelta(d) { return d >= 5 ? 'happy' : d > -5 ? 'normal' : d > -15 ? 'worried' : 'sad'; }

  /** ctx: {today (aggregate), week (analysis 7), yesterday (analysis 1), goalHours, name(pkg)->görünen ad, lang, t(şablon, ...)}.
   *  Dönüş: [metin, ruh_hali] */
  function answerFor(action, ctx) {
    var t = ctx.t, lang = ctx.lang, name = ctx.name, today = ctx.today;
    var total = today.total, cats = today.cats, apps = today.apps.filter(function (a) { return a.key !== 'system'; });
    var focus = focusPercentage(cats), dist = distShare(cats);
    var dur = function (s) { return fmtMed(s, lang); };
    if (['daily', 'focus', 'top_app', 'distraction', 'goal', 'switches', 'tip'].indexOf(action) >= 0 && total < 60)
      return [t('Bugün için henüz yeterli kullanım verim yok. Bir süre kullandıktan sonra tekrar sor.'), 'sleepy'];
    if (action === 'daily') {
      var top = apps.slice(0, 3).map(function (a) { return name(a.app); }).join(', ') || '—';
      return [t('Bugün toplam {} aktif kullanım var. En çok {}. Üretkenlik oranın %{}, eğlence payın %{}.', dur(total), top, focus, Math.round(dist)), moodForFocus(focus, dist)];
    }
    if (action === 'focus') {
      var verdict = T(focus >= 55 ? 'Güzel gidiyorsun.' : focus >= 40 ? 'Fena değil, daha iyisi olabilir.' : focus >= 25 ? 'Biraz dağınık görünüyor.' : 'Bugün odak düşük kalmış.');
      return [t(verdict) + ' ' + t("Bugün {} üretkenlik kategorisinde geçti. Bu, Sistem hariç kullanımın %{}'i. Bu basit bir gösterge; gerçek odağı tek başına ölçmez.", dur(cats.productive || 0), focus), moodForFocus(focus, dist)];
    }
    if (action === 'top_app') {
      var lines = apps.slice(0, 5).map(function (a, i) { return (i + 1) + '. ' + name(a.app) + ': ' + dur(a.secs); });
      var topDist = apps.length && apps[0].key === 'distraction';
      return [t(topDist ? 'Bugün en çok kullandığın uygulama dikkat dağıtıcı sınıfında:' : 'Bugün en çok kullandıkların:') + '\n' + lines.join('\n'), topDist ? 'worried' : (focus >= 55 ? 'happy' : 'normal')];
    }
    if (action === 'distraction') {
      var rows = apps.filter(function (a) { return a.key === 'distraction'; });
      var distTotal = cats.distraction || 0;
      if (distTotal < 60 || !rows.length) return [t('Bugün neredeyse hiç dikkat dağıtıcı kullanım görünmüyor. Böyle devam!'), 'happy'];
      return [t("Bugün {} dikkat dağıtıcı tarafta geçti (kullanımın %{}'i). En çok seni şunlar dağıtmış:", dur(distTotal), Math.round(dist)) + '\n' +
        rows.slice(0, 3).map(function (a, i) { return (i + 1) + '. ' + name(a.app) + ': ' + dur(a.secs); }).join('\n'), dist >= 35 ? 'angry' : 'worried'];
    }
    if (action === 'goal') {
      var goalS = (Number(ctx.goalHours) || 0) * 3600, prod = cats.productive || 0;
      if (goalS <= 0) return [t("Bir günlük hedef belirlenmemiş. Ayarlar'dan hedef süreni seçebilirsin."), 'normal'];
      if (prod >= goalS) return [t('Hedefe ulaştın! {} üretken süre, hedefin {} saat. Tebrikler.', dur(prod), ctx.goalHours), 'happy'];
      return [t('Hedefin {} saat. Şu an {} (%{}). Hedefe {} kaldı.', ctx.goalHours, dur(prod), Math.round(prod / goalS * 100), dur(goalS - prod)), prod / goalS >= 0.5 ? 'normal' : 'worried'];
    }
    if (action === 'switches' || action === 'tip') {
      var hours = Math.max(total / 3600, 0.25), perHour = Math.round(today.switches / hours);
      if (action === 'switches') {
        var note = T(perHour < 10 ? 'Sakin ve düzenli bir tempo.' : perHour < 20 ? 'Normal bir tempo.' : perHour < 35 ? 'Epey sık geçiş yapıyorsun; dikkat bölünüyor olabilir.' : 'Çok sık geçiş var. Bu odağı ciddi şekilde bölüyor.');
        return [t('Bugün {} kez uygulama değiştirdin (saatte yaklaşık {}).', today.switches, perHour) + ' ' + t(note), perHour < 20 ? 'normal' : 'worried'];
      }
      if (dist >= 35) return [t('Küçük bir öneri: bir sonraki çalışma bloğunda 25 dakika boyunca tek bir işe odaklan. Dikkat dağıtan uygulamaları o süre için kapat.'), 'worried'];
      if (perHour >= 35) return [t('Küçük bir öneri: bildirimleri kapatıp aynı anda tek uygulamada çalışmayı dene. Sık geçiş odağı bölüyor.'), 'worried'];
      if (focus >= 55) return [t('Harika gidiyorsun. Küçük bir öneri: her 50 dakikada bir 5–10 dakika mola ver; verimin uzun süre yüksek kalır.'), 'happy'];
      return [t('Küçük bir öneri: «En verimli saatim hangisi?» sorusuna bak ve zor işini o saate koy.'), 'normal'];
    }
    if (action === 'vs_yesterday') {
      var y = ctx.yesterday;
      if (!y || y.previous_total < 60 || total < 60) return [t('Karşılaştırmak için dün ya da bugün yeterli veri yok.'), 'sleepy'];
      var yFocus = focusPercentage(y.prevCats), delta = focus - yFocus;
      var word = delta > 0 ? t('{} puan arttı', Math.abs(delta)) : delta < 0 ? t('{} puan azaldı', Math.abs(delta)) : t('aynı kaldı');
      return [t('Üretkenlik oranın dün %{} idi, bugün %{}; {}. Kullanım: bugün şu ana kadar {}, dün aynı saate kadar {}.', yFocus, focus, word, dur(total), dur(y.previous_total)), moodForDelta(delta)];
    }
    if (action === 'week') {
      var w = ctx.week;
      if (!w || w.current_total < 300) return [t('Son 7 gün için yeterli veri henüz yok.'), 'sleepy'];
      var curFocus = focusPercentage(w.cats);
      if (w.previous_total >= 300) {
        var prevFocus = focusPercentage(w.prevCats), ch = Math.round((w.current_total - w.previous_total) / w.previous_total * 100);
        return [t('Son 7 günde toplam {} kullanım var.', dur(w.current_total)) + ' ' +
          t(ch >= 0 ? 'Kullanım önceki 7 güne göre %{} fazla.' : 'Kullanım önceki 7 güne göre %{} az.', Math.abs(ch)) + ' ' +
          t('Üretkenlik oranı %{} → %{}.', prevFocus, curFocus), moodForDelta(curFocus - prevFocus)];
      }
      return [t('Son 7 günde toplam {} kullanım var.', dur(w.current_total)) + ' ' + t('Üretkenlik oranın %{}. Karşılaştırmak için önceki hafta verisi yok.', curFocus), moodForFocus(curFocus, distShare(w.cats))];
    }
    if (action === 'best_hour') {
      var hp = (ctx.week && ctx.week.hourlyProd) || [];
      var ranked = hp.map(function (v, h) { return [h, v]; }).filter(function (x) { return x[1] >= 300; }).sort(function (a, b) { return b[1] - a[1]; });
      if (!ranked.length) return [t('Henüz yeterli üretken kullanım verisi yok. Birkaç gün kullandıkça netleşir.'), 'sleepy'];
      var span = function (h) { return pad2(h) + ':00–' + pad2((h + 1) % 24) + ':00'; };
      var text = t('Son 7 günde en verimli saatin {} (toplam {} üretken süre).', span(ranked[0][0]), dur(ranked[0][1]));
      if (ranked.length > 1) text += ' ' + t('Sonra {} geliyor. Zor işlerini bu saatlere koyabilirsin.', span(ranked[1][0]));
      return [text, 'happy'];
    }
    return [t('Bu soruyu henüz bilmiyorum.'), 'normal'];
  }

  /** Analiz sayfasındaki yerel yorum. Dönüş: [metin, ruh_hali] */
  function analysisText(res, ctx) {
    var t = ctx.t, lang = ctx.lang, name = ctx.name;
    var dur = function (s) { return fmtMed(s, lang); };
    if (!res || res.current_total < 60) return [t('Bu dönem için henüz yeterli veri yok.'), 'sleepy'];
    var period = res.days === 1 ? t('Bugün') : res.days === 7 ? t('Son 7 gün') : res.days === 30 ? t('Son 30 gün') : t('Son {} gün', res.days);
    var focus = focusPercentage(res.cats), dist = distShare(res.cats), mood = moodForFocus(focus, dist);
    var parts = [t('{} toplam {} aktif kullanım var.', period, dur(res.current_total))];
    if (res.previous_total >= 300) {
      var ch = Math.round((res.current_total - res.previous_total) / res.previous_total * 100);
      var prevLabel = res.days === 1 ? t('dünle') : t('önceki dönemle');
      parts.push(t(ch >= 0 ? 'Bu, {} karşılaştırınca %{} fazla.' : 'Bu, {} karşılaştırınca %{} az.', prevLabel, Math.abs(ch)));
      var delta = focus - focusPercentage(res.prevCats);
      parts.push(t('Üretkenlik oranı %{} ({} puan).', focus, (delta >= 0 ? '+' : '') + delta));
    } else parts.push(t('Üretkenlik oranı %{}.', focus));
    var apps = res.apps.filter(function (a) { return a.key !== 'system'; });
    if (apps.length) parts.push(t('En çok kullanılan: {}.', apps.slice(0, 2).map(function (a) { return name(a.app) + ', ' + dur(a.secs); }).join('; ')));
    var d = apps.filter(function (a) { return a.key === 'distraction'; })[0];
    if (d && d.secs >= 300) { parts.push(t('Seni en çok {} dağıtmış, {}.', name(d.app), dur(d.secs))); if (dist >= 35) mood = 'angry'; }
    var best = -1, bestV = 300;
    res.hourlyProd.forEach(function (v, h) { if (v > bestV) { bestV = v; best = h; } });
    if (best >= 0) parts.push(t('En verimli saatin {}.', pad2(best) + ':00–' + pad2((best + 1) % 24) + ':00'));
    if (res.days > 1 && res.busiest) parts.push(t('En yoğun gün {} ({}).', ctx.fmtDate(res.busiest.date), dur(res.busiest.secs)));
    return [parts.join(' '), mood];
  }

  // ---------------------------------------------------------------- lisans (spy_license.py)
  var TRIAL_DAYS = 3, KEY_PREFIX = 'SPY', KEY_VERSION = 1;
  var PUBLIC_KEY_HEX = '0960c269c84c114b535544be9a89ebe765338a4d3c921bedbb8bf0b31349574f';
  var ed = null;
  function edInit() {
    if (ed) return ed;
    var B = BigInt, P = (B(1) << B(255)) - B(19), Q = (B(1) << B(252)) + B('27742317777372353535851937790883648493');
    var mod = function (a) { a %= P; return a < 0 ? a + P : a; };
    var pow = function (b, e, m) { var r = B(1); b %= m; if (b < 0) b += m; while (e > 0) { if (e & B(1)) r = r * b % m; b = b * b % m; e >>= B(1); } return r; };
    var inv = function (x) { return pow(x, P - B(2), P); };
    var D = mod(B(-121665) * inv(B(121666))), SQM1 = pow(B(2), (P - B(1)) / B(4), P);
    var add = function (p, q) {
      var A = mod((p[1] - p[0]) * (q[1] - q[0])), Bv = mod((p[1] + p[0]) * (q[1] + q[0]));
      var C = mod(B(2) * p[3] * q[3] % P * D), Dv = mod(B(2) * p[2] * q[2]);
      var E = Bv - A, F = Dv - C, G = Dv + C, H = Bv + A;
      return [mod(E * F), mod(G * H), mod(F * G), mod(E * H)];
    };
    var mul = function (s, p) { var q = [B(0), B(1), B(1), B(0)]; while (s > 0) { if (s & B(1)) q = add(q, p); p = add(p, p); s >>= B(1); } return q; };
    var equal = function (p, q) { return mod(p[0] * q[2] - q[0] * p[2]) === B(0) && mod(p[1] * q[2] - q[1] * p[2]) === B(0); };
    var recoverX = function (y, sign) {
      if (y >= P) return null;
      var x2 = mod((y * y - B(1)) * inv(D * y % P * y + B(1)));
      if (x2 === B(0)) return sign ? null : B(0);
      var x = pow(x2, (P + B(3)) / B(8), P);
      if (mod(x * x - x2) !== B(0)) x = mod(x * SQM1);
      if (mod(x * x - x2) !== B(0)) return null;
      if ((x & B(1)) !== B(sign)) x = P - x;
      return x;
    };
    var fromLE = function (bytes) { var v = B(0); for (var i = bytes.length - 1; i >= 0; i--) v = (v << B(8)) | B(bytes[i]); return v; };
    var decompress = function (bytes) {
      if (bytes.length !== 32) return null;
      var y = fromLE(bytes), sign = Number(y >> B(255));
      y &= (B(1) << B(255)) - B(1);
      var x = recoverX(y, sign);
      return x === null ? null : [x, y, B(1), mod(x * y)];
    };
    var gy = mod(B(4) * inv(B(5))), gx = recoverX(gy, 0);
    ed = { Q: Q, add: add, mul: mul, equal: equal, decompress: decompress, fromLE: fromLE, G: [gx, gy, B(1), mod(gx * gy)] };
    return ed;
  }
  function hexToBytes(hex) { var out = new Uint8Array(hex.length / 2); for (var i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16); return out; }
  function bytesToHex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); return s; }
  function concatBytes() { var n = 0, i; for (i = 0; i < arguments.length; i++) n += arguments[i].length; var out = new Uint8Array(n), o = 0; for (i = 0; i < arguments.length; i++) { out.set(arguments[i], o); o += arguments[i].length; } return out; }
  /** sha512: (Uint8Array) -> Uint8Array (eşzamanlı). */
  function edVerify(pub, msg, sig, sha512) {
    try {
      if (pub.length !== 32 || sig.length !== 64) return false;
      var e = edInit(), A = e.decompress(pub), Rs = sig.slice(0, 32), R = e.decompress(Rs);
      if (!A || !R) return false;
      var s = e.fromLE(sig.slice(32));
      if (s >= e.Q) return false;
      var h = e.fromLE(sha512(concatBytes(Rs, pub, msg))) % e.Q;
      return e.equal(e.mul(s, e.G), e.add(R, e.mul(h, A)));
    } catch (err) { return false; }
  }
  function b32decode(text) {
    var alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = 0, value = 0, out = [];
    for (var i = 0; i < text.length; i++) {
      var idx = alphabet.indexOf(text[i]);
      if (idx < 0) throw new Error('b32');
      value = (value << 5) | idx; bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return new Uint8Array(out);
  }
  function cleanKey(key) { return String(key || '').trim().toUpperCase().replace(/ /g, ''); }
  /** Geçerliyse 8 baytlık lisans kimliği (hex), değilse null. */
  function parseKey(key, sha512, publicHex) {
    try {
      var text = cleanKey(key);
      if (text.indexOf(KEY_PREFIX + '-') !== 0) return null;
      var blob = b32decode(text.slice(KEY_PREFIX.length + 1).replace(/-/g, ''));
      if (blob.length !== 73 || blob[0] !== KEY_VERSION) return null;
      if (!edVerify(hexToBytes(publicHex || PUBLIC_KEY_HEX), blob.slice(0, 9), blob.slice(9), sha512)) return null;
      return bytesToHex(blob.slice(1, 9));
    } catch (err) { return null; }
  }
  /** data: {key, first_run, last_seen} (değiştirilir; çağıran kaydeder). Dönüş: {state, days_left, license_id} */
  function licenseStatus(data, now, sha512, publicHex) {
    var lid = data.key ? parseKey(data.key, sha512, publicHex) : null;
    if (lid) return { state: 'licensed', days_left: 0, license_id: lid };
    now = Math.max(now, Number(data.last_seen) || 0);
    var first = Number(data.first_run) > 0 ? Number(data.first_run) : now;
    data.first_run = first; data.last_seen = now;
    if (now - first >= TRIAL_DAYS * 86400) return { state: 'expired', days_left: 0, license_id: '' };
    return { state: 'trial', days_left: Math.max(1, TRIAL_DAYS - Math.floor((now - first) / 86400)), license_id: '' };
  }

  // ---------------------------------------------------------------- Spy gözü (widgets.py: SpyMascot)
  // Ruh hali tablosu masaüstündeki MASCOT_MOODS ile aynıdır.
  var MASCOT_MOODS = {"normal": {"ring": ["#2dd4a0", "#7c4dff"], "bg": ["#41378f", "#1d1950"], "white": "#e7e1fb", "lid": null, "shape": "poly", "every": 4.0, "kind": "single", "droop": 0.0, "smile": 0.0, "widen": 1.0, "look": 0.0, "spin": 0, "shake": 0.0, "bounce": 0.0, "tear": false}, "focus": {"ring": ["#22c55e", "#15803d"], "bg": ["#2c4a7a", "#16224a"], "white": "#e4f3ee", "lid": [0.55, 0.55, 0.55], "shape": "poly", "every": 7.0, "kind": "slow", "droop": 0.0, "smile": 0.0, "widen": 1.0, "look": 0.0, "spin": 0, "shake": 0.0, "bounce": 0.0, "tear": false}, "warning": {"ring": ["#ff9f43", "#ff4d67"], "bg": ["#7a4a1d", "#3d1f12"], "white": "#fff0dc", "lid": null, "shape": "poly", "every": 1.8, "kind": "double", "droop": 0.0, "smile": 0.0, "widen": 1.18, "look": 0.0, "spin": 0, "shake": 0.0, "bounce": 0.0, "tear": false}, "thinking": {"ring": ["#a78bfa", "#7c4dff"], "bg": ["#41378f", "#1d1950"], "white": "#e7e1fb", "lid": [0.05, 0.75, 1.45], "shape": "poly", "every": 2.6, "kind": "single", "droop": 0.0, "smile": 0.0, "widen": 1.0, "look": 2.4, "spin": 0, "shake": 0.0, "bounce": 0.0, "tear": false}, "loading": {"ring": ["#7dd3fc", "#a78bfa"], "bg": ["#41378f", "#1d1950"], "white": "#e7e1fb", "lid": [0.35, 0.9, 1.45], "shape": "poly", "every": 3.0, "kind": "single", "droop": 0.0, "smile": 0.0, "widen": 1.0, "look": 1.6, "spin": 330, "shake": 0.0, "bounce": 0.0, "tear": false}, "happy": {"ring": ["#facc15", "#22c55e"], "bg": ["#5a3f9a", "#2a2065"], "white": "#fff6d6", "lid": [0.3, 1.5, 0.3], "shape": "curve", "every": 3.2, "kind": "single", "droop": 0.0, "smile": 0.55, "widen": 1.0, "look": 0.0, "spin": 0, "shake": 0.0, "bounce": 0.02, "tear": false}, "sleepy": {"ring": ["#94a3b8", "#64748b"], "bg": ["#33385c", "#1a1d38"], "white": "#d9deee", "lid": [0.1, 0.1, 0.1], "shape": "poly", "every": 5.0, "kind": "slow", "droop": 0.15, "smile": 0.0, "widen": 1.0, "look": 0.0, "spin": 0, "shake": 0.0, "bounce": 0.0, "tear": false}, "worried": {"ring": ["#f59e0b", "#f97316"], "bg": ["#6b4a2a", "#33210f"], "white": "#fff1dc", "lid": [-0.9, 1.15, -0.9], "shape": "poly", "every": 2.2, "kind": "double", "droop": 0.0, "smile": 0.0, "widen": 1.05, "look": 0.0, "spin": 0, "shake": 0.004, "bounce": 0.0, "tear": false}, "sad": {"ring": ["#60a5fa", "#3b82f6"], "bg": ["#2b3f73", "#141e45"], "white": "#dbe8fb", "lid": [-1.6, 1.0, -1.6], "shape": "poly", "every": 4.5, "kind": "slow", "droop": 0.12, "smile": 0.0, "widen": 1.0, "look": 0.0, "spin": 0, "shake": 0.0, "bounce": 0.0, "tear": true}, "angry": {"ring": ["#ff3b4e", "#b91c1c"], "bg": ["#8a1d3b", "#3d0a1f"], "white": "#ffd3da", "lid": [1.7, 0.4, 1.7], "shape": "poly", "every": 6.5, "kind": "single", "droop": 0.0, "smile": 0.0, "widen": 0.95, "look": 0.0, "spin": 0, "shake": 0.012, "bounce": 0.0, "tear": false}};
  /** Zamana (sn) göre göz kapanma miktarı: 0 = açık, 1 = tam kapalı. */
  function blinkClosure(kind, t, every) {
    var phase = t % every;
    if (kind === 'double') {
      var starts = [0.0, 0.26];
      for (var i = 0; i < 2; i++) if (starts[i] <= phase && phase < starts[i] + 0.14) return Math.sin(Math.PI * (phase - starts[i]) / 0.14);
      return 0;
    }
    var length = kind === 'slow' ? 0.55 : 0.18;
    return phase < length ? Math.sin(Math.PI * phase / length) : 0;
  }
  /** animated=false ise kırpma/bakış/dönme/titreme/zıplama yoktur. */
  function mascotState(mood, t, animated) {
    var cfg = MASCOT_MOODS[mood] || MASCOT_MOODS.normal;
    var st = { closure: 0, look: 0, droop: cfg.droop, smile: cfg.smile, widen: cfg.widen, shake: 0, bounce: 0, spin: 0, tear: cfg.tear ? 0.35 : -1 };
    if (!animated) return st;
    st.closure = blinkClosure(cfg.kind, t, cfg.every);
    if (cfg.look) st.look = Math.sin(2 * Math.PI * t / cfg.look) * 0.8;
    if (cfg.spin) st.spin = t * cfg.spin % 360;
    if (cfg.shake) st.shake = cfg.shake * Math.sin(t * 55);
    if (cfg.bounce) st.bounce = cfg.bounce * Math.abs(Math.sin(t * 5));
    if (cfg.tear) st.tear = t % 2.4 / 2.4;
    return st;
  }
  /** Üst göz kapağının kenar noktaları (soldan sağa). */
  function mascotLidEdge(lid, shape, cx, cy, hw, hh0, n) {
    n = n || 60;
    var yl = cy - lid[0] * hh0, yc = cy - lid[1] * hh0, yr = cy - lid[2] * hh0, xl = cx - hw * 1.25, xr = cx + hw * 1.25;
    if (shape === 'curve') {
      var ctrl = 2 * yc - (yl + yr) / 2, pts = [];
      for (var i = 0; i <= n; i++) {
        var t = i / n, u = 1 - t;
        pts.push([u * u * xl + 2 * u * t * cx + t * t * xr, u * u * yl + 2 * u * t * ctrl + t * t * yr]);
      }
      return pts;
    }
    return [[xl, yl], [cx, yc], [xr, yr]];
  }
  /** Gözü tuvale çizer (SpyMascot.paintEvent ile aynı geometri). s: kenar uzunluğu (px). */
  function drawMascot(ctx, s, mood, st) {
    var cfg = MASCOT_MOODS[mood] || MASCOT_MOODS.normal, i;
    ctx.clearRect(0, 0, s, s);
    ctx.save();
    var bg = ctx.createLinearGradient(0, 0, s, s);
    bg.addColorStop(0, cfg.bg[0]); bg.addColorStop(1, cfg.bg[1]);
    var r = s * 0.22;
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.arcTo(s, 0, s, s, r); ctx.arcTo(s, s, 0, s, r); ctx.arcTo(0, s, 0, 0, r); ctx.arcTo(0, 0, s, 0, r); ctx.closePath();
    ctx.fillStyle = bg; ctx.fill(); ctx.clip();
    ctx.translate(st.shake * s, -st.bounce * s);
    var cx = s / 2, cy = s * 0.54, hw = s * 0.38, hh0 = s * 0.25 * st.widen;
    var hh = hh0 * Math.max(0.04, (1 - st.droop) * (1 - st.closure));
    var almond = function () {
      ctx.beginPath(); ctx.moveTo(cx - hw, cy);
      ctx.quadraticCurveTo(cx, cy - 2 * hh, cx + hw, cy);
      ctx.quadraticCurveTo(cx, cy + 2 * hh * (1 - st.smile), cx - hw, cy);
      ctx.closePath();
    };
    var edge = cfg.lid ? mascotLidEdge(cfg.lid, cfg.shape, cx, cy, hw, hh0) : null;
    ctx.save();
    almond(); ctx.clip();
    ctx.fillStyle = cfg.white; ctx.fillRect(0, 0, s, s);
    var ix = cx + st.look * s * 0.07, radius = s * 0.19, ringR = radius * 0.8;
    ctx.fillStyle = '#1c1a45'; ctx.beginPath(); ctx.arc(ix, cy, radius, 0, 2 * Math.PI); ctx.fill();
    var a0 = -(90 - st.spin) * Math.PI / 180, stroke = cfg.ring[0];
    if (ctx.createConicGradient) { stroke = ctx.createConicGradient(a0, ix, cy); stroke.addColorStop(0, cfg.ring[1]); stroke.addColorStop(1, cfg.ring[0]); }
    ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(1.5, s * 0.05); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(ix, cy, ringR, a0, a0 + 1.5 * Math.PI); ctx.stroke();
    var pr = s * 0.075;
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ix, cy, pr, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = '#7c4dff'; ctx.beginPath(); ctx.arc(ix - pr * 0.35, cy - pr * 0.35, pr * 0.25, 0, 2 * Math.PI); ctx.fill();
    if (edge) {
      // göz kapağı: kenarın üstünde kalan bölge (badem içinde) kapak rengine boyanır, kenar boyunca ince çizgi çekilir
      var n = parseInt(cfg.bg[0].slice(1), 16), ch = function (v) { return Math.min(255, Math.floor(v * 0.78 + 25)); };
      ctx.fillStyle = 'rgb(' + ch(n >> 16 & 255) + ',' + ch(n >> 8 & 255) + ',' + ch(n & 255) + ')';
      ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]);
      for (i = 1; i < edge.length; i++) ctx.lineTo(edge[i][0], edge[i][1]);
      ctx.lineTo(edge[edge.length - 1][0], cy - 4 * hh0); ctx.lineTo(edge[0][0], cy - 4 * hh0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = mood === 'angry' ? '#ffd0d6' : '#ffffff'; ctx.lineWidth = Math.max(1.6, s * 0.05); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(edge[0][0], edge[0][1]);
      for (i = 1; i < edge.length; i++) ctx.lineTo(edge[i][0], edge[i][1]);
      ctx.stroke();
    }
    ctx.restore();
    if (hh < s * 0.25 * 0.35) { almond(); ctx.strokeStyle = '#b9b0e6'; ctx.lineWidth = Math.max(1, s * 0.02); ctx.stroke(); }
    if (st.tear >= 0) {
      ctx.fillStyle = 'rgba(159,208,255,' + (230 / 255 * (1 - st.tear)).toFixed(3) + ')';
      ctx.beginPath(); ctx.ellipse(cx + s * 0.22, cy + s * (0.16 + 0.14 * st.tear), s * 0.035, s * 0.05, 0, 0, 2 * Math.PI); ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------- dışa aktarma
  function csvEscape(v) { v = String(v == null ? '' : v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function toCsv(rows) { return '﻿' + rows.map(function (r) { return r.map(csvEscape).join(','); }).join('\r\n') + '\r\n'; }

  return {
    CAT_KEYS: CAT_KEYS, CAT_LABELS: CAT_LABELS, CAT_SHORT: CAT_SHORT, CAT_COLORS: CAT_COLORS, PKG_MAP: PKG_MAP,
    INTERRUPT_KEYS: INTERRUPT_KEYS, ALL_INTERRUPT_KEYS: ALL_INTERRUPT_KEYS, ACTIONS: ACTIONS, TRIAL_DAYS: TRIAL_DAYS,
    norm: norm, makeClassifier: makeClassifier, focusPercentage: focusPercentage, distShare: distShare,
    dayStart: dayStart, pad2: pad2, aggregate: aggregate, analysis: analysis,
    fmtShort: fmtShort, fmtLong: fmtLong, fmtMed: fmtMed, fmtClock: fmtClock,
    coachingTip: coachingTip, liveScore: liveScore, InterruptWatcher: InterruptWatcher, focusFromEvents: focusFromEvents,
    Pomodoro: Pomodoro, moodForFocus: moodForFocus, moodForDelta: moodForDelta, answerFor: answerFor, analysisText: analysisText,
    parseKey: parseKey, licenseStatus: licenseStatus, cleanKey: cleanKey, edVerify: edVerify, hexToBytes: hexToBytes, bytesToHex: bytesToHex,
    MASCOT_MOODS: MASCOT_MOODS, blinkClosure: blinkClosure, mascotState: mascotState, mascotLidEdge: mascotLidEdge, drawMascot: drawMascot,
    toCsv: toCsv
  };
});
