/* Spy Mobile — arayüz. Masaüstü Spy 1.4.5'in sayfaları telefon düzeninde: Genel, Analiz, Timeline, Odak, Spy, Yönetim, Ayarlar. */
(function () {
  'use strict';
  var C = window.SpyCore, N = window.Native;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  function T(s) { return s; }

  // ------------------------------------------------------------------ kalıcı durum
  function load(key, fallback) { try { var v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; } }
  function save(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { } }

  var DEFAULTS = {
    lang: '', accent: '#7c4dff', animations: true, goalHours: 4, tracking: true, retention: 0, notify: true, vibrate: true,
    interruptKeys: 'distraction,life,communication', pomoWork: 25, pomoShort: 5, pomoLong: 15, excluded: [], overrides: {}, onboarded: false
  };
  var ACCENTS = ['#7c4dff', '#5f7cff', '#38bdf8', '#22c55e', '#f59e0b', '#ec4899', '#14b8a6'];
  var RETENTION = [0, 30, 90, 180, 365];
  var prefs = (function () {
    var p = load('spy.prefs', {}) || {}, out = {};
    Object.keys(DEFAULTS).forEach(function (k) { out[k] = (typeof p[k] === typeof DEFAULTS[k] && p[k] !== null) ? p[k] : DEFAULTS[k]; });
    if (!Array.isArray(out.excluded)) out.excluded = [];
    if (ACCENTS.indexOf(out.accent) < 0) out.accent = DEFAULTS.accent;
    if (RETENTION.indexOf(out.retention) < 0) out.retention = 0;
    return out;
  })();
  function setPref(key, value) { prefs[key] = value; save('spy.prefs', prefs); }

  // ------------------------------------------------------------------ dil
  var lang = prefs.lang || (N.deviceLang() === 'tr' ? 'tr' : 'en');
  var EN = window.SPY_I18N_EN || {};
  function t(text) {
    var out = (lang === 'en' && EN[text]) ? EN[text] : text, i = 1, args = arguments;
    return out.replace(/\{\}/g, function () { return args[i++]; });
  }
  var MONTHS = { tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] };
  function fmtDate(ts) { var d = new Date(ts * 1000); return C.pad2(d.getDate()) + ' ' + MONTHS[lang][d.getMonth()]; }
  function fmtTime(ts) { var d = new Date(ts * 1000); return C.pad2(d.getHours()) + ':' + C.pad2(d.getMinutes()); }
  var short = function (s) { return C.fmtShort(s, lang); }, long = function (s) { return C.fmtLong(s, lang); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pct(part, total) { return total > 0 ? (part / total * 100) : 0; }
  function pct1(v) { return v.toFixed(1) + '%'; }
  function catLabel(key) { return t(C.CAT_LABELS[key] || key); }
  function catShort(key) { return t(C.CAT_SHORT[key] || key); }

  // ------------------------------------------------------------------ uygulama durumu
  var PAGES = [
    { id: 'general', nav: T('Genel'), color: '#8b6cff', eyebrow: 'OVERVIEW / ' },
    { id: 'analysis', nav: T('Analiz'), color: '#38bdf8', eyebrow: 'INSIGHTS / PATTERN ANALYSIS' },
    { id: 'timeline', nav: 'Timeline', color: '#22c55e', eyebrow: 'TIMELINE / ACTIVITY FLOW' },
    { id: 'focus', nav: T('Odak'), color: '#f59e0b', eyebrow: 'FOCUS MODE / ATTENTION' },
    { id: 'spy', nav: 'Spy', color: '#ec4899', eyebrow: 'SPY AI / ASSISTANT' },
    { id: 'manage', nav: T('Yönetim'), color: '#7c4dff', eyebrow: 'MANAGEMENT / CATEGORIES' },
    { id: 'settings', nav: T('Ayarlar'), color: '#94a3b8', eyebrow: 'SETTINGS / PREFERENCES' }
  ];
  var S = {
    page: 'general', now: N.now(), access: false, apps: {}, cls: null, today: null, license: { state: 'trial', days_left: C.TRIAL_DAYS, license_id: '' },
    analysisDays: 7, analysisCache: {}, tlFilter: 'all', tlDay: 0, tlCache: {}, manageCat: 'distraction', chat: [], chatBusy: false,
    focusLive: null, sheet: null
  };
  var OWN = N.ownPackage();

  function excludedMap() { var m = {}; prefs.excluded.forEach(function (p) { m[p] = true; }); return m; }
  function appName(pkg) {
    var a = S.apps[pkg];
    if (a && a.l) return a.l;
    var seg = String(pkg).split('.').pop() || pkg;
    return seg.charAt(0).toUpperCase() + seg.slice(1);
  }
  function buildClassifier() {
    var base = C.makeClassifier(window.SPY_RULES, prefs.overrides, OWN);
    var fn = function (pkg) { var a = S.apps[pkg] || {}; return base(pkg, a.l || '', a.h || ''); };
    fn.detail = function (pkg) { var a = S.apps[pkg] || {}; return base.detail(pkg, a.l || '', a.h || ''); };
    S.cls = fn;
  }

  // ------------------------------------------------------------------ lisans
  function licenseData() { return load('spy.license', {}) || {}; }
  function refreshLicense() {
    var data = licenseData(), before = S.license.state;
    S.license = C.licenseStatus(data, N.now(), N.sha512);
    save('spy.license', data);
    if (before === 'expired' && S.license.state === 'licensed') N.skipToNow();
    return S.license;
  }
  function trackingAllowed() { return prefs.tracking && S.license.state !== 'expired'; }

  // ------------------------------------------------------------------ veri
  function agg(start, end, segments) { return C.aggregate(N.events(start, end), start, end, S.cls, { excluded: excludedMap(), segments: !!segments }); }
  function refresh() {
    S.now = N.now();
    refreshLicense();
    S.access = N.hasUsageAccess();
    if (S.access && trackingAllowed()) N.sync();
    S.apps = N.apps();
    buildClassifier();
    S.today = agg(C.dayStart(S.now, 0), S.now, false);
    S.analysisCache = {}; S.tlCache = {};
  }
  function getAnalysis(days) {
    if (!S.analysisCache[days]) {
      var from = C.dayStart(S.now, days === 1 ? 1 : 2 * days - 1);
      S.analysisCache[days] = C.analysis(N.events(from, S.now), S.now, days, S.cls, { excluded: excludedMap() });
    }
    return S.analysisCache[days];
  }
  function getTimeline(day) {
    if (!S.tlCache[day]) {
      var start = C.dayStart(S.now, day), end = day === 0 ? S.now : C.dayStart(S.now, day - 1);
      var a = agg(start, end, true); a.dayStart = start;
      S.tlCache[day] = a;
    }
    return S.tlCache[day];
  }

  // ------------------------------------------------------------------ küçük bileşenler
  var ICONS = {
    general: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    analysis: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
    timeline: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    focus: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
    spy: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    manage: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    refresh: '<path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>'; }

  var EYE_BG = { normal: '#2a1f5c', happy: '#14432a', worried: '#5a3a12', sad: '#1c3558', angry: '#5a1c2a', sleepy: '#2a3040', loading: '#2a1f5c' };
  function eye(mood, size) {
    mood = EYE_BG[mood] ? mood : 'normal';
    var bg = EYE_BG[mood], body;
    var open = '<path d="M7 24Q24 7 41 24Q24 41 7 24Z" fill="#ece8ff"/><circle cx="24" cy="24" r="8" fill="' + bg + '"/><circle cx="24" cy="24" r="5" fill="none" stroke="#38d6c4" stroke-width="2"/><circle cx="24" cy="24" r="2.2" fill="#8b6cff"/>';
    if (mood === 'happy') body = '<path d="M9 29Q24 10 39 29" fill="none" stroke="#d6ffe2" stroke-width="4.5" stroke-linecap="round"/>';
    else if (mood === 'worried') body = '<path d="M11 24H37" fill="none" stroke="#ffd9a0" stroke-width="4.5" stroke-linecap="round"/>';
    else if (mood === 'sad') body = '<path d="M9 21Q24 38 39 21" fill="none" stroke="#cfe3ff" stroke-width="4.5" stroke-linecap="round"/><circle cx="35" cy="34" r="2.4" fill="#7cc4ff"/>';
    else if (mood === 'sleepy') body = '<path d="M10 25Q24 32 38 25" fill="none" stroke="#c5cbe0" stroke-width="4" stroke-linecap="round"/><text x="32" y="17" font-size="10" fill="#c5cbe0" font-weight="700">z</text>';
    else if (mood === 'angry') body = open + '<path d="M4 6H44V18L4 9Z" fill="' + bg + '"/><path d="M8 11L40 19" stroke="#ff8fa3" stroke-width="3" stroke-linecap="round"/>';
    else body = open;
    return '<svg class="eye" width="' + size + '" height="' + size + '" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="' + bg + '"/>' + body + '</svg>';
  }

  function orderedCats(cats, includeEmptyMain) {
    var keys = C.CAT_KEYS.filter(function (k) { return (cats[k] || 0) > 0 || (includeEmptyMain && k !== 'system'); });
    return keys.sort(function (a, b) { return (cats[b] || 0) - (cats[a] || 0); });
  }
  function barsHtml(cats, total) {
    return '<div class="bars">' + orderedCats(cats, true).map(function (k) {
      var p = pct(cats[k] || 0, total);
      return '<div class="row"><span class="name">' + esc(catLabel(k)) + '</span><span class="bar"><i style="width:' + p.toFixed(1) + '%;background:' + C.CAT_COLORS[k] + '"></i></span><span class="pct">' + pct1(p) + '</span></div>';
    }).join('') + '</div>';
  }
  function donutHtml(cats, total) {
    var r = 15.915, off = 0, segs = '';
    orderedCats(cats, false).forEach(function (k) {
      var p = pct(cats[k], total);
      if (p <= 0) return;
      segs += '<circle cx="21" cy="21" r="' + r + '" fill="none" stroke="' + C.CAT_COLORS[k] + '" stroke-width="7" stroke-dasharray="' + p.toFixed(2) + ' ' + (100 - p).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
      off += p;
    });
    var legend = orderedCats(cats, true).map(function (k) {
      return '<div><i style="background:' + C.CAT_COLORS[k] + '"></i><span>' + esc(catLabel(k)) + '</span><em>' + pct1(pct(cats[k] || 0, total)) + '</em></div>';
    }).join('');
    return '<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 42 42"><circle cx="21" cy="21" r="' + r + '" fill="none" stroke="#242c42" stroke-width="7"/>' + segs +
      '</svg><div class="mid"><div><b>' + esc(short(total)) + '</b><span>' + esc(t('toplam')) + '</span></div></div></div><div class="legend">' + legend + '</div></div>';
  }
  function appRowsHtml(apps, limit) {
    var list = apps.filter(function (a) { return a.key !== 'system'; });
    if (!list.length) return '<div class="empty">' + esc(t('Henüz kayıt yok.')) + '</div>';
    var max = list[0].secs, shown = list.slice(0, limit);
    var html = shown.map(function (a) {
      var c = C.CAT_COLORS[a.key];
      return '<div class="approw"><div class="head"><i class="dot" style="background:' + c + '"></i><span class="name">' + esc(appName(a.app)) + '</span><span class="dur">' + esc(short(a.secs)) +
        '</span></div><div class="line"><i style="width:' + pct(a.secs, max).toFixed(1) + '%;background:' + c + '"></i></div></div>';
    }).join('');
    if (list.length > limit) html += '<div class="more">' + esc(t('+ {} uygulama daha', list.length - limit)) + '</div>';
    return html;
  }
  function statHtml(label, value, wide) { return '<div class="stat' + (wide ? ' wide' : '') + '"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>'; }
  function switchHtml(on, act, arg) { return '<button class="switch' + (on ? ' on' : '') + '" data-act="' + act + '"' + (arg ? ' data-arg="' + esc(arg) + '"' : '') + ' aria-pressed="' + !!on + '"></button>'; }

  // ------------------------------------------------------------------ uyarı şeritleri
  function bannersHtml() {
    var html = '';
    if (!S.access) {
      html += '<div class="banner fade"><b>' + esc(t('Kullanım erişimi gerekli')) + '</b>' +
        esc(t('Spy, hangi uygulamada ne kadar zaman geçirdiğini görebilmek için Android’in “Kullanım erişimi” iznine ihtiyaç duyar. Açılan listede Spy’ı bulup izni aç.')) +
        '<br><button class="btn" data-act="grant">' + esc(t('İzni aç')) + '</button></div>';
    }
    if (S.license.state === 'expired') {
      html += '<div class="banner bad fade"><b>' + esc(t('Deneme süresi doldu')) + '</b>' +
        esc(t('Takip durduruldu. Mevcut kayıtların duruyor; devam etmek için lisans anahtarını gir.')) +
        '<br><button class="btn" data-act="license">' + esc(t('Lisans anahtarı gir')) + '</button></div>';
    } else if (!prefs.tracking) {
      html += '<div class="banner fade"><b>' + esc(t('Takip kapalı')) + '</b>' + esc(t('Spy şu anda kayıt almıyor. Ayarlar’dan yeniden açabilirsin.')) + '</div>';
    }
    return html;
  }

  // ------------------------------------------------------------------ sayfalar
  function pageGeneral() {
    var d = S.today, cats = d.cats, total = d.total, prod = cats.productive || 0;
    var goal = prefs.goalHours * 3600, last = null;
    for (var i = 0; i < d.apps.length; i++) if (d.apps[i].key !== 'system' && (!last || d.apps[i].last > last.last)) last = d.apps[i];
    var html = bannersHtml();
    html += '<div class="panel now-card fade"><b>' + esc(t('SON UYGULAMA')) + '</b><span>' + (last ? esc(appName(last.app)) + ' <small class="muted">(' + esc(catShort(last.key)) + ')</small>' : '— —') + '</span></div>';
    if (goal > 0) {
      html += '<div class="panel goal fade"><b>🎯 ' + esc(t('GÜNLÜK HEDEF')) + '</b><div class="track"><i style="width:' + Math.min(100, pct(prod, goal)).toFixed(1) + '%"></i></div><span>' +
        esc(short(prod)) + ' / ' + prefs.goalHours + ' ' + esc(t('saat')) + ' (' + Math.round(Math.min(999, pct(prod, goal))) + '%)</span></div>';
    }
    html += '<div class="panel fade"><h2>' + esc(t('Günün dağılımı')) + '</h2>' + donutHtml(cats, total) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Kullanım dağılımı')) + '</h2>' + barsHtml(cats, total) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('En çok kullanılanlar')) + '</h2>' + appRowsHtml(d.apps, 8) + '</div>';
    html += '<div class="stats">' + statHtml(t('Toplam kullanım'), long(total)) + statHtml(t('Uygulama geçişleri'), String(d.switches)) +
      statHtml(t('Üretkenlik oranı'), C.focusPercentage(cats) + '%') + statHtml(t('Uygulama sayısı'), String(d.apps.filter(function (a) { return a.key !== 'system'; }).length)) + '</div>';
    var tip = C.coachingTip(prod, cats.distraction || 0, total, prefs.goalHours).map(function (p) { return t.apply(null, p); }).join(' ');
    html += '<div class="panel tip fade">' + eye(C.moodForFocus(C.focusPercentage(cats), C.distShare(cats)), 30) + '<p>' + esc(tip) + '</p></div>';
    html += '<div class="btn-row" style="margin-top:12px"><button class="btn block" data-act="refresh">' + icon('refresh').replace('<svg', '<svg width="16" height="16"') + ' ' + esc(t('Verileri yenile')) + '</button></div>';
    return html;
  }

  function lineChart(daily) {
    var W = 340, H = 130, L = 46, R = 10, Tp = 10, B = 20, max = 0;
    daily.forEach(function (x) { if (x.secs > max) max = x.secs; });
    if (max <= 0) return '<div class="empty">' + esc(t('Bu dönem için henüz yeterli veri yok.')) + '</div>';
    var n = daily.length, xs = function (i) { return L + (n === 1 ? (W - L - R) / 2 : i * (W - L - R) / (n - 1)); }, ys = function (v) { return Tp + (H - Tp - B) * (1 - v / max); };
    var pts = daily.map(function (x, i) { return xs(i).toFixed(1) + ',' + ys(x.secs).toFixed(1); });
    var grid = [0, 0.5, 1].map(function (f) {
      var y = ys(max * f);
      return '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="#242c42" stroke-width="1"/><text x="' + (L - 4) + '" y="' + (y + 3) + '" text-anchor="end">' + esc(short(max * f)) + '</text>';
    }).join('');
    var step = Math.max(1, Math.ceil(n / 6)), labels = '';
    daily.forEach(function (x, i) { if (i % step === 0 || i === n - 1) labels += '<text x="' + xs(i) + '" y="' + (H - 5) + '" text-anchor="' + (i === n - 1 ? 'end' : i === 0 ? 'start' : 'middle') + '">' + esc(fmtDate(x.date)) + '</text>'; });
    var dots = n <= 14 ? daily.map(function (x, i) { return '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(x.secs).toFixed(1) + '" r="2.5" fill="' + prefs.accent + '"/>'; }).join('') : '';
    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '">' + grid + '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + prefs.accent + '" stroke-width="2" stroke-linejoin="round"/>' + dots + labels + '</svg>';
  }
  function hourBars(hourly) {
    var max = Math.max.apply(null, hourly);
    return '<div class="heat">' + hourly.map(function (v) {
      var o = max > 0 ? v / max : 0;
      return '<i style="' + (o > 0.02 ? 'background:' + prefs.accent + ';opacity:' + (0.25 + 0.75 * o).toFixed(2) : '') + '"></i>';
    }).join('') + '</div><div class="heat-labels"><span>00</span><span>03</span><span>06</span><span>09</span><span>12</span><span>15</span><span>18</span><span>21</span></div>';
  }

  function pageAnalysis() {
    var days = S.analysisDays, r = getAnalysis(days), total = r.current_total;
    var tabs = [[1, T('BUGÜN')], [7, T('SON 7 GÜN')], [30, T('SON 30 GÜN')]].map(function (x) {
      return '<button class="tab' + (days === x[0] ? ' on' : '') + '" data-act="adays" data-arg="' + x[0] + '">' + esc(t(x[1])) + '</button>';
    }).join('');
    var apps = r.apps.filter(function (a) { return a.key !== 'system'; });
    var dominant = orderedCats(r.cats, false).filter(function (k) { return k !== 'system'; })[0];
    var ctx = { t: t, lang: lang, name: appName, fmtDate: fmtDate };
    var say = C.analysisText(r, ctx);
    var html = '<div class="tabs">' + tabs + '</div>';
    html += '<div class="stats fade">' + statHtml(t('İncelenen süre'), long(total)) + statHtml(t('Lider uygulama'), apps.length ? appName(apps[0].app) : '—') +
      statHtml(t('Baskın kategori'), dominant ? catShort(dominant) : '—') + statHtml(t('GÜNLÜK ORTALAMA'), long(r.dailyAvg)) +
      statHtml(t('ÖNCEKİ DÖNEME GÖRE'), r.change === null ? '—' : (r.change >= 0 ? '+' : '') + r.change.toFixed(1) + '%') +
      statHtml(days === 1 ? t('AKTİF GÜN') : t('EN YOĞUN DÖNEM'), days === 1 ? r.activeDays + ' / 1' : (r.busiest ? fmtDate(r.busiest.date) : '—')) +
      (days > 1 ? statHtml(t('AKTİF GÜN'), r.activeDays + ' / ' + days, true) : '') + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Kullanım payları')) + '</h2>' + donutHtml(r.cats, total) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Kategori karşılaştırması')) + '</h2>' + barsHtml(r.cats, total) + '</div>';
    if (days > 1) html += '<div class="panel fade"><h2>' + esc(t('Kullanım trendi')) + '<small>' + esc(t('Günlük toplam kullanımın dönem boyunca nasıl değiştiği')) + '</small></h2>' + lineChart(r.daily) + '</div>';
    else html += '<div class="panel fade"><h2>' + esc(t('Günün yoğunluk haritası')) + '<small>' + esc(t('Saatlere göre aktivite yoğunluğu')) + '</small></h2>' + hourBars(r.hourly) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Spy’ın analizi')) + '<small>' + esc(t('Seçili dönemin gerçek kayıtlarından, bu telefonda hesaplanır.')) + '</small></h2><div class="spy-says">' + eye(say[1], 34) + '<p>' + esc(say[0]) + '</p></div></div>';
    var patterns = [], changes = [];
    if (total >= 60) {
      patterns.push(t('Günlük ortalama kullanım: {}.', long(r.dailyAvg)));
      if (days > 1 && r.busiest) patterns.push(t('En yoğun gün: {} ({}).', fmtDate(r.busiest.date), long(r.busiest.secs)));
      if (days > 1 && r.lowest && r.activeDays > 1) patterns.push(t('En düşük aktif gün: {} ({}).', fmtDate(r.lowest.date), long(r.lowest.secs)));
      if (days > 1 && r.busiest && r.lowest && r.activeDays > 1) patterns.push(r.busiest.secs > r.lowest.secs * 1.6 ? t('Kullanım, ortalamaya göre dalgalı seyrediyor.') : t('Kullanım, günler arasında dengeli seyrediyor.'));
      patterns.push(t('Uygulama geçişleri: {}.', r.switches));
    }
    if (r.change !== null) {
      changes.push(r.change >= 0 ? t('Kullanım önceki döneme göre %{} arttı.', Math.abs(r.change).toFixed(1)) : t('Kullanım önceki döneme göre %{} azaldı.', Math.abs(r.change).toFixed(1)));
      if (days > 1) changes.push(t('Günlük ortalama: {}; önceki dönem: {}.', long(r.dailyAvg), long(r.prevDailyAvg)));
      var df = C.focusPercentage(r.cats) - C.focusPercentage(r.prevCats);
      changes.push(t('Üretkenlik oranı %{} ({} puan).', C.focusPercentage(r.cats), (df >= 0 ? '+' : '') + df));
    }
    var ul = function (list, emptyText) { return list.length ? '<ul class="bullets">' + list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<div class="empty">' + esc(emptyText) + '</div>'; };
    html += '<div class="panel fade"><h2>' + esc(t('Kullanım örüntüleri')) + '</h2>' + ul(patterns, t('Bu dönem için henüz yeterli veri yok.')) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Dikkat çeken değişimler')) + '</h2>' + ul(changes, t('Karşılaştırmak için önceki dönemde yeterli veri yok.')) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Uygulama sıralaması')) + '</h2><div class="rank">' + (apps.length ? apps.slice(0, 15).map(function (a) {
      return '<div class="r"><span>' + esc(appName(a.app)) + '</span><b>' + esc(short(a.secs)) + '</b></div>';
    }).join('') : '<div class="empty">' + esc(t('Henüz kayıt yok.')) + '</div>') + '</div></div>';
    html += '<p class="note">' + esc(t('{} günlük analiz gerçek kayıtlardan hesaplandı. {} gün aktif kullanım kaydedildi.', days, r.activeDays)) + '</p>';
    return html;
  }

  function dayLabel(day) { return day === 0 ? t('Bugün') : day === 1 ? t('Dün') : fmtDate(C.dayStart(S.now, day)); }
  function pageTimeline() {
    var a = getTimeline(S.tlDay), f = S.tlFilter, start = a.dayStart;
    var chips = [['all', t('Tümü'), prefs.accent]].concat(['productive', 'distraction', 'communication', 'potential', 'info', 'life', 'other', 'system'].map(function (k) { return [k, catShort(k), C.CAT_COLORS[k]]; }));
    var html = '<div class="tabs">' + chips.map(function (c) {
      return '<button class="tab cat' + (f === c[0] ? ' on' : '') + '" style="--c:' + c[2] + '" data-act="tlfilter" data-arg="' + c[0] + '">' + esc(c[1]) + '</button>';
    }).join('') + '</div>';
    var apps = a.apps.filter(function (x) { return f === 'all' ? x.key !== 'system' : x.key === f; });
    var total = 0, hourly = [], i;
    apps.forEach(function (x) { total += x.secs; });
    for (i = 0; i < 24; i++) hourly.push(0);
    apps.forEach(function (x) {
      x.segs.forEach(function (sg) {
        var tcur = sg[0];
        while (tcur < sg[1]) { var h = Math.floor((tcur - start) / 3600), next = start + (h + 1) * 3600, part = Math.min(sg[1], next) - tcur; if (h >= 0 && h < 24) hourly[h] += part; tcur = Math.min(sg[1], next); }
      });
    });
    var rows = apps.slice(0, 14).map(function (x) {
      var segs = x.segs.map(function (sg) {
        return '<i style="left:' + ((sg[0] - start) / 864).toFixed(2) + '%;width:' + Math.max(0.3, (sg[1] - sg[0]) / 864).toFixed(2) + '%;background:' + C.CAT_COLORS[x.key] + '"></i>';
      }).join('');
      return '<div class="tl-row"><span class="name">' + esc(appName(x.app)) + '</span><div class="tl-track">' + segs + '</div><span class="dur">' + esc(short(x.secs)) + '</span></div>';
    }).join('');
    var nowLine = S.tlDay === 0 ? '<i class="tl-now" style="left:calc(92px + (100% - 138px) * ' + ((S.now - start) / 86400).toFixed(4) + ')"></i>' : '';
    html += '<div class="panel fade"><div class="box-head"><b>' + esc(S.tlDay === 0 ? t('Bugünün zaman akışı') : t('{} zaman akışı', dayLabel(S.tlDay))) + '</b><button class="chip act" data-act="tlday">' + esc(dayLabel(S.tlDay)) + ' ▾</button></div>' +
      (rows ? '<div class="tl-hours" style="margin-top:10px"><span>00</span><span>04</span><span>08</span><span>12</span><span>16</span><span>20</span><span>24</span></div><div class="tl-body">' + rows + nowLine + '</div>' : '<div class="empty">' + esc(t('Bu filtre için kayıt yok.')) + '</div>') +
      (apps.length > 14 ? '<div class="more">' + esc(t('+ {} uygulama daha', apps.length - 14)) + '</div>' : '') + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Günün yoğunluk haritası')) + '<small>' + esc(t('Saatlere göre aktivite yoğunluğu')) + '</small></h2>' + hourBars(hourly) + '</div>';
    html += '<div class="panel fade"><h2>' + esc(t('Uygulama akışı')) + '</h2><div class="rank">' + (apps.length ? apps.slice(0, 20).map(function (x) {
      return '<div class="r"><span>' + esc(appName(x.app)) + ' <small class="muted">· ' + esc(fmtTime(x.first)) + '–' + esc(fmtTime(x.last)) + '</small></span><b>' + esc(short(x.secs)) + '</b></div>';
    }).join('') : '<div class="empty">' + esc(t('Bu filtre için kayıt yok.')) + '</div>') + '</div></div>';
    html += '<div class="stats">' + statHtml(t('TOPLAM KULLANIM'), long(total)) + statHtml(t('UYGULAMA SAYISI'), t('{} uygulama', apps.length)) +
      statHtml(t('EN UZUN KULLANIM'), apps.length ? appName(apps[0].app) + ' · ' + short(apps[0].secs) : '—', true) + '</div>';
    return html;
  }

  // ------------------------------------------------------------------ odak + pomodoro
  var focus = load('spy.focus', null);           // {start, pauses: [[bas, bit|0]], ignored: {}}
  var pomo = C.Pomodoro.fromJSON(load('spy.pomo', { work_min: prefs.pomoWork, short_min: prefs.pomoShort, long_min: prefs.pomoLong }));
  var sessions = load('spy.sessions', []) || [];
  function interruptKeys() {
    var raw = prefs.interruptKeys;
    if (raw === '-') return [];
    var chosen = raw.split(',');
    return C.ALL_INTERRUPT_KEYS.filter(function (k) { return chosen.indexOf(k) >= 0; });
  }
  function addSession(kind, start, end, duration, interruptions) {
    sessions.push({ kind: kind, start: start, end: end, duration: Math.round(duration), interruptions: interruptions });
    var cutoff = N.now() - 60 * 86400;
    sessions = sessions.filter(function (s) { return s.end >= cutoff; });
    save('spy.sessions', sessions);
  }
  function focusPaused() { return !!(focus && focus.pauses.length && !focus.pauses[focus.pauses.length - 1][1]); }
  function focusElapsed(now) {
    if (!focus) return 0;
    var paused = 0;
    focus.pauses.forEach(function (p) { paused += (p[1] || now) - p[0]; });
    return Math.max(0, now - focus.start - paused);
  }
  function windowStats(start, end, ignored, pauses) {
    if (S.access && trackingAllowed()) N.sync();
    return C.focusFromEvents(N.events(start, end), start, end, S.cls, interruptKeys(), ignored || {}, pauses || [], OWN);
  }
  function refreshFocusLive() {
    if (!focus) { S.focusLive = null; return; }
    var now = N.now();
    S.focusLive = windowStats(focus.start, now, focus.ignored, focus.pauses);
    S.focusLive.elapsed = focusElapsed(now);
    S.focusLive.score = C.liveScore(S.focusLive.elapsed, S.focusLive.interruptions, S.focusLive.distracted);
  }
  function pomoTexts(state, round) {
    if (state === 'work') return round < C.Pomodoro.ROUNDS ? [t('Mola zamanı'), t('Çalışma {}/{} bitti. {} dk kısa mola.', round, C.Pomodoro.ROUNDS, pomo.short_min)] : [t('Uzun mola zamanı'), t('4 tur tamamlandı. {} dk uzun mola.', pomo.long_min)];
    if (state === 'short_break') return [t('Çalışma zamanı'), t('Mola bitti. Çalışma {}/{} başlıyor ({} dk).', round + 1, C.Pomodoro.ROUNDS, pomo.work_min)];
    return [t('Set tamamlandı 🎉'), t('Pomodoro seti bitti. Eline sağlık!')];
  }
  function phaseLabel(state, round) {
    return state === 'work' ? t('Çalışma {}/{}', round, C.Pomodoro.ROUNDS) : state === 'short_break' ? t('Kısa mola') : t('Uzun mola');
  }
  function phaseNext(state, round) {
    if (state === 'work') return round < C.Pomodoro.ROUNDS ? t('Sonra: {} dk kısa mola', pomo.short_min) : t('Sonra: {} dk uzun mola', pomo.long_min);
    if (state === 'short_break') return t('Sonra: çalışma {}/{} ({} dk)', round + 1, C.Pomodoro.ROUNDS, pomo.work_min);
    return t('Sonra: set tamamlanır');
  }
  /** Bildirim çubuğundaki kalıcı oturum bildirimi (Pomodoro: geri sayım, odak: geçen süre). */
  function updateOngoing() {
    var now = N.now();
    if (!prefs.notify) { N.clearOngoing(); return; }
    if (pomo.running()) {
      if (pomo.paused) N.showOngoing('pomo', 'Pomodoro · ' + phaseLabel(pomo.state, pomo.round), t('Duraklatıldı · kalan {}', C.fmtClock(pomo.remaining(now))), 0, false, false, t('Devam et'), t('Bitir'));
      else N.showOngoing('pomo', 'Pomodoro · ' + phaseLabel(pomo.state, pomo.round), phaseNext(pomo.state, pomo.round), pomo.end_at * 1000, true, true, t('Duraklat'), t('Bitir'));
    } else if (focus) {
      if (focusPaused()) N.showOngoing('focus', t('Odak oturumu'), t('Duraklatıldı · geçen {}', C.fmtClock(focusElapsed(now))), 0, false, false, t('Devam et'), t('Bitir'));
      else N.showOngoing('focus', t('Odak oturumu'), t('Odak oturumu sürüyor'), (now - focusElapsed(now)) * 1000, true, false, t('Duraklat'), t('Bitir'));
    } else N.clearOngoing();
  }
  function savePomo() {
    save('spy.pomo', pomo.toJSON());
    N.cancelAlarms();
    if (prefs.notify) {
      var plan = pomo.schedule(N.now());
      plan.forEach(function (x, i) {
        var tx = pomoTexts(x.state, x.round), nx = plan[i + 1];
        N.scheduleAlarmEx(i, x.at * 1000, tx[0], tx[1], nx ? 'Pomodoro · ' + phaseLabel(nx.state, nx.round) : '', nx ? phaseNext(nx.state, nx.round) : '', nx ? nx.at * 1000 : 0, t('Duraklat'), t('Bitir'));
      });
    }
    updateOngoing();
  }
  function handlePomoEvents(events, silent) {
    if (!events.length) return;
    var lastToast = null;
    events.forEach(function (ev) {
      var name = ev[0], d = ev[1];
      if (name === 'work_done' || name === 'work_stopped') {
        var st = windowStats(d.start, d.end, {}, []);
        addSession('pomodoro', d.start, d.end, d.seconds, st.interruptions);
      }
      if (name === 'break_started') lastToast = d.kind === 'short' ? t('Mola zamanı: {} dk kısa mola.', d.minutes) : t('Uzun mola zamanı: {} dk.', d.minutes);
      else if (name === 'work_started' && d.round > 1) lastToast = t('Çalışma {}/{} başladı.', d.round, C.Pomodoro.ROUNDS);
      else if (name === 'set_done') lastToast = t('Set tamamlandı 🎉');
    });
    savePomo();
    if (!silent && lastToast) { toast(lastToast); if (prefs.vibrate) N.vibrate(250); }
  }
  function pomoLabel() {
    if (pomo.state === 'idle') return t('Hazır');
    var base = pomo.state === 'work' ? t('Çalışma {}/{}', pomo.round, C.Pomodoro.ROUNDS) : pomo.state === 'short_break' ? t('Kısa mola') : t('Uzun mola');
    return base + (pomo.paused ? ' · ' + t('duraklatıldı') : '');
  }
  function pomoNext() {
    if (pomo.state === 'idle') return t('Çalışma ve mola sürelerini seçip seansı başlat.');
    if (pomo.state === 'work') return pomo.round < C.Pomodoro.ROUNDS ? t('Sonra: {} dk kısa mola', pomo.short_min) : t('Sonra: {} dk uzun mola', pomo.long_min);
    if (pomo.state === 'short_break') return t('Sonra: çalışma {}/{} ({} dk)', pomo.round + 1, C.Pomodoro.ROUNDS, pomo.work_min);
    return t('Sonra: set tamamlanır');
  }
  function todaySessions() { var ds = C.dayStart(N.now(), 0); return sessions.filter(function (s) { return s.start >= ds; }).sort(function (a, b) { return b.start - a.start; }); }

  function pageFocus() {
    var now = N.now(), live = S.focusLive, running = !!focus, pRun = pomo.running();
    var score = running && live ? live.score : C.focusPercentage(S.today.cats);
    var lastInt = running && live && live.list.length ? appName(live.list[live.list.length - 1].app) : '—';
    var html = '<div class="stats three fade">' + statHtml(running ? t('Canlı odak skoru') : t('Odak skoru'), score + '%') +
      statHtml(t('Aktif oturum'), running ? (focusPaused() ? t('Duraklatıldı') : t('Odak')) : pRun ? 'Pomodoro' : t('Hazır')) + statHtml(t('Son kesinti'), lastInt) + '</div>';
    // odak kutusu
    html += '<div class="panel fade"><div class="box-head">' + eye(running ? (live && live.score < 40 ? 'worried' : 'happy') : 'normal', 34) + '<b>' + esc(running ? (focusPaused() ? t('Duraklatıldı') : t('Odak oturumu sürüyor')) : t('Hazır')) + '</b></div>';
    if (running) {
      html += '<div class="big-clock focus" id="focus-clock">' + C.fmtClock(focusElapsed(now)) + '</div><div class="muted small">' +
        esc(t('{} kesinti · {} dağılma', live ? live.interruptions : 0, short(live ? live.distracted : 0))) + '</div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn ghost" data-act="focuspause">' + esc(focusPaused() ? t('Devam et') : t('Duraklat')) + '</button><button class="btn" data-act="focusstop">' + esc(t('Oturumu bitir')) + '</button></div>';
    } else {
      html += '<p style="margin:10px 0 4px;font-weight:700">' + esc(t('Henüz bir odak oturumu başlatılmadı.')) + '</p><div class="big-clock focus">00:00</div><div class="muted small">' +
        esc(t('Oturum başlatıldığında kesintiler ve uygulama değişimleri burada izlenir.')) + '</div>' +
        '<div class="btn-row" style="margin-top:12px"><button class="btn block" data-act="focusstart"' + (pRun ? ' disabled' : '') + '>▶ ' + esc(t('Odak oturumu başlat')) + '</button></div>';
    }
    html += '</div>';
    // pomodoro kutusu
    html += '<div class="panel fade' + (pRun ? ' locked' : '') + '"><div class="box-head"><span style="font-size:20px">🍅</span><b>Pomodoro · <span id="pomo-label">' + esc(pomoLabel()) + '</span></b></div>';
    html += '<div class="big-clock pomo" id="pomo-clock">' + C.fmtClock(pRun ? pomo.remaining(now) : pomo.work_min * 60) + '</div><div class="muted small" id="pomo-next">' + esc(pomoNext()) + '</div>';
    if (pRun) {
      html += '<div class="btn-row" style="margin-top:12px"><button class="btn ghost" data-act="pomopause">' + esc(pomo.paused ? t('Devam et') : t('Duraklat')) + '</button>' +
        (pomo.inBreak() ? '<button class="btn ghost" data-act="pomoskip">' + esc(t('Çalışmaya devam et')) + '</button>' : '') + '<button class="btn" data-act="pomostop">' + esc(t('Seansı bitir')) + '</button></div>';
    } else {
      html += '<div class="btn-row" style="margin-top:12px"><button class="btn block" data-act="pomostart"' + (running ? ' disabled' : '') + '>▶ ' + esc(t('Pomodoro seansı başlat')) + '</button></div>';
    }
    var stepper = function (label, value, key) {
      return '<div class="stepper"><span>' + esc(label) + '</span><b>' + value + ' ' + esc(t('dk')) + '</b><div class="pm"><button data-act="pstep" data-arg="' + key + ':-1">−</button><button data-act="pstep" data-arg="' + key + ':1">+</button></div></div>';
    };
    html += '<div class="steppers">' + stepper(t('Çalışma süresi'), pomo.work_min, 'pomoWork') + stepper(t('Kısa mola'), pomo.short_min, 'pomoShort') + stepper(t('Uzun mola (4. turdan sonra)'), pomo.long_min, 'pomoLong') + '</div></div>';
    // oturumlar
    var ts = todaySessions();
    html += '<div class="panel fade"><h2>' + esc(t('Bugünkü odak oturumları')) + '</h2>' + (ts.length ? ts.map(function (s) {
      return '<div class="list-row"><span class="grow">' + (s.kind === 'pomodoro' ? '🍅 ' : '🎯 ') + fmtTime(s.start) + ' → ' + fmtTime(s.end) + '</span><span class="chip">' + esc(short(s.duration)) + '</span><span class="chip">' + esc(t('{} kesinti', s.interruptions)) + '</span></div>';
    }).join('') : '<div class="empty">' + esc(t('Bugün henüz oturum yok.')) + '</div>') + '</div>';
    // kesintiler
    html += '<div class="panel fade"><h2>' + esc(t('Son kesintiler')) + '</h2>';
    if (running && live && live.list.length) {
      html += live.list.slice(-6).reverse().map(function (x) {
        return '<div class="list-row"><i class="dot" style="width:7px;height:7px;border-radius:50%;background:' + C.CAT_COLORS[x.key] + '"></i><span class="grow">' + fmtTime(x.time) + ' · ' + esc(appName(x.app)) + '</span><button class="chip act" data-act="ignore" data-arg="' + esc(x.app) + '">' + esc(t('Kesinti sayma')) + '</button></div>';
      }).join('');
    } else html += '<div class="empty">' + esc(running ? t('Bu oturumda henüz kesinti yok.') : t('Oturum sürerken kesintiler burada görünür.')) + '</div>';
    html += '</div>';
    // kurallar
    var keys = interruptKeys();
    html += '<div class="panel fade"><h2>' + esc(t('Neler kesinti sayılsın?')) + '</h2><div class="hint">' + esc(t('Üretken çalışmadan seçtiğin kategorilere geçmek kesinti sayılır ve skoru düşürür. «Kesinti sayma» dersen o uygulama bu oturumda sayılmaz.')) + '</div>' +
      [['distraction', T('Eğlence')], ['life', T('Alışveriş & Yaşam')], ['communication', T('İletişim')], ['system', T('Sistem uygulamaları')]].map(function (x) {
        return '<div class="toggle-row"><i class="bar-c" style="background:' + C.CAT_COLORS[x[0]] + '"></i><span>' + esc(t(x[1])) + '</span>' + switchHtml(keys.indexOf(x[0]) >= 0, 'ikey', x[0]) + '</div>';
      }).join('') + '</div>';
    return html;
  }

  // ------------------------------------------------------------------ Spy sohbeti
  function pageSpy() {
    var html = '<div class="panel hello fade">' + eye(S.chatBusy ? 'loading' : 'normal', 52) + '<div><b>' + esc(t('Selam 👋 Ben Spy.')) + '</b><p>' + esc(t('Aşağıdan bir soru seç; verilerine bakıp sana cevap vereyim.')) + '</p></div></div>';
    html += '<div class="panel chat fade" id="chat">' + (S.chat.length ? '' : '<div class="msg">' + eye('normal', 28) + '<div class="bubble">' + esc(t('Buradayım. Aşağıdaki sorulardan birine dokun; verilerine bakıp cevaplayayım.')) + '</div></div>') +
      S.chat.map(function (m) {
        if (m.mine) return '<div class="msg me"><div class="bubble">' + esc(m.text) + '</div></div>';
        if (m.typing) return '<div class="msg">' + eye('loading', 28) + '<div class="bubble dots"><i></i><i></i><i></i></div></div>';
        return '<div class="msg">' + eye(m.mood, 28) + '<div class="bubble">' + esc(m.text) + '</div></div>';
      }).join('') + '</div>';
    html += '<div class="actions">' + C.ACTIONS.map(function (a) {
      return '<button class="action' + (S.chatBusy ? ' busy' : '') + '" data-act="ask" data-arg="' + a[2] + '"><span class="em">' + a[0] + '</span><span>' + esc(t(a[1])) + '</span></button>';
    }).join('') + '</div>';
    return html;
  }
  function ask(action) {
    if (S.chatBusy) return;
    var label = '';
    C.ACTIONS.forEach(function (a) { if (a[2] === action) label = t(a[1]); });
    S.chat.push({ mine: true, text: label }); S.chat.push({ typing: true }); S.chatBusy = true;
    render(); scrollChat();
    setTimeout(function () {
      var answer;
      try {
        refresh();
        answer = C.answerFor(action, { today: S.today, week: getAnalysis(7), yesterday: getAnalysis(1), goalHours: prefs.goalHours, lang: lang, t: t, name: appName, fmtDate: fmtDate });
      } catch (e) { answer = [t('Bu soruyu şu anda cevaplayamadım.'), 'worried']; }
      S.chat = S.chat.filter(function (m) { return !m.typing; });
      S.chat.push({ text: answer[0], mood: answer[1] });
      if (S.chat.length > 40) S.chat = S.chat.slice(-40);
      S.chatBusy = false;
      if (S.page === 'spy') { render(); scrollChat(); }
    }, prefs.animations ? 650 : 0);
  }
  function scrollChat() { var v = $('#view'); if (v) v.scrollTop = v.scrollHeight; }

  // ------------------------------------------------------------------ yönetim
  function knownApps(days) {
    var r = getAnalysis(days || 30), list = r.apps.slice();
    var seen = {}; list.forEach(function (a) { seen[a.app] = true; });
    Object.keys(prefs.overrides).forEach(function (pkg) { if (!seen[pkg]) list.push({ app: pkg, key: S.cls(pkg), secs: 0 }); });
    return list;
  }
  function pageManage() {
    var r = getAnalysis(7), total = r.current_total, apps = knownApps(30);
    var html = '<p class="note" style="margin-top:4px">' + esc(t('Spy bir uygulamayı yanlış sınıflandırdığında buradan düzeltirsin; değişiklik anında işler ve geçmiş kayıtlar da yeni kurala göre hesaplanır.')) + '</p>';
    html += '<div class="cat-cards">' + C.CAT_KEYS.map(function (k) {
      var count = apps.filter(function (a) { return a.key === k; }).length;
      return '<button class="cat-card' + (S.manageCat === k ? ' on' : '') + '" style="--c:' + C.CAT_COLORS[k] + '" data-act="mcat" data-arg="' + k + '"><div class="t"><i></i><span>' + esc(catLabel(k)) + '</span></div><b>' +
        pct1(pct(r.cats[k] || 0, total)).replace('.', lang === 'tr' ? ',' : '.') + '</b><small>' + esc(t('{} uygulama', count)) + '</small><div class="u"><i style="width:' + pct(r.cats[k] || 0, total).toFixed(1) + '%"></i></div></button>';
    }).join('') + '</div>';
    var inCat = apps.filter(function (a) { return a.key === S.manageCat; });
    html += '<div class="panel fade"><h2><span style="color:' + C.CAT_COLORS[S.manageCat] + '">●</span> ' + esc(catLabel(S.manageCat)) + ' <span class="muted" style="font-weight:400">· ' + esc(t('{} uygulama', inCat.length)) + '</span><small>' + esc(t('Kategorisini değiştirmek için uygulamaya dokun.')) + '</small></h2>' +
      (inCat.length ? inCat.map(function (a) {
        var user = !!prefs.overrides[a.app];
        return '<button class="list-row" style="width:100%;text-align:left" data-act="assign" data-arg="' + esc(a.app) + '"><span class="grow">' + esc(appName(a.app)) + '</span>' + (user ? '<span class="chip act">' + esc(t('senin kuralın')) + '</span>' : '') + '<span class="chip">' + esc(short(a.secs)) + '</span></button>';
      }).join('') : '<div class="empty">' + esc(t('Bu kategoride son 30 günde kullanılan uygulama yok.')) + '</div>') + '</div>';
    var others = getAnalysis(7).apps.filter(function (a) { return a.key === 'other'; });
    html += '<div class="panel fade"><h2>● ' + esc(t('Diğer kutusu')) + ' <span class="muted" style="font-weight:400">· ' + esc(t('son 7 gün')) + '</span></h2>' + (others.length ? others.slice(0, 12).map(function (a) {
      return '<button class="list-row" style="width:100%;text-align:left" data-act="assign" data-arg="' + esc(a.app) + '"><span class="grow">' + esc(appName(a.app)) + '</span><span class="chip">' + esc(short(a.secs)) + '</span><span class="chip act">' + esc(t('Hangi kategori?')) + '</span></button>';
    }).join('') : '<div class="empty">' + esc(t('Sınıflandırılmamış öğe yok. 🎉')) + '</div>') + '</div>';
    var n = Object.keys(prefs.overrides).length;
    html += '<div class="btn-row" style="margin-top:12px"><button class="btn ghost" data-act="mreset"' + (n ? '' : ' disabled') + '>' + esc(t('Varsayılana dön')) + '</button></div>';
    html += '<p class="note">' + esc(n ? t('{} uygulama için kendi kuralın var.', n) : t('Tüm uygulamalar Spy’ın hazır kurallarıyla sınıflandırılıyor.')) + '</p>';
    return html;
  }

  // ------------------------------------------------------------------ ayarlar
  function setRow(title, desc, control, act) {
    return '<div class="set-row"' + (act ? ' data-act="' + act + '"' : '') + '><div class="txt"><b>' + esc(title) + '</b>' + (desc ? '<span>' + esc(desc) + '</span>' : '') + '</div>' + (control || '') + '</div>';
  }
  function licenseText() {
    if (S.license.state === 'licensed') return t('Lisanslı · kimlik {}', S.license.license_id.slice(0, 8));
    if (S.license.state === 'expired') return t('Deneme süresi doldu');
    return t('Deneme sürümü · {} gün kaldı', S.license.days_left);
  }
  function trackingText() {
    if (S.license.state === 'expired') return t('Takip durduruldu (lisans gerekli)');
    if (!S.access) return t('Kullanım erişimi izni verilmedi');
    return prefs.tracking ? t('Takip aktif') : t('Takip kapalı');
  }
  function retentionLabel(days) { return days ? t('{} gün', days) : t('Hiçbir zaman'); }
  function pageSettings() {
    var html = '<div class="section-title">' + esc(t('Lisans')) + '</div><div class="panel">' +
      setRow(t('Lisans durumu'), licenseText(), S.license.state === 'licensed' ? '' : '<button class="btn" data-act="license">' + esc(t('Anahtar gir')) + '</button>') +
      setRow(t('Takip durumu'), trackingText(), S.access ? '' : '<button class="btn ghost" data-act="grant">' + esc(t('İzni aç')) + '</button>') + '</div>';
    html += '<div class="section-title">' + esc(t('Görünüm')) + '</div><div class="panel">' +
      setRow(t('Dil'), '', '<button class="chip act" data-act="lang">' + (lang === 'tr' ? 'Türkçe' : 'English') + ' ▾</button>') +
      setRow(t('Vurgu rengi'), '', '<div class="swatches">' + ACCENTS.map(function (c) { return '<button style="background:' + c + '" class="' + (prefs.accent === c ? 'on' : '') + '" data-act="accent" data-arg="' + c + '" aria-label="' + c + '"></button>'; }).join('') + '</div>') +
      setRow(t('Animasyonlar'), t('Geçişler ve grafik hareketleri'), switchHtml(prefs.animations, 'toggle', 'animations')) + '</div>';
    html += '<div class="section-title">' + esc(t('Takip')) + '</div><div class="panel">' +
      setRow(t('Takip'), t('Kapalıyken Spy kayıt almaz; mevcut kayıtlar ve ekranlar çalışır.'), switchHtml(prefs.tracking, 'toggle', 'tracking')) +
      setRow(t('Günlük hedef'), t('Günlük üretken süre hedefi'), '<div class="mini-step"><button data-act="goal" data-arg="-1">−</button><b>' + (prefs.goalHours ? prefs.goalHours + ' ' + esc(t('saat')) : esc(t('Yok'))) + '</b><button data-act="goal" data-arg="1">+</button></div>') +
      setRow(t('Hariç tutulan uygulamalar'), prefs.excluded.length ? t('{} uygulama kaydedilmiyor', prefs.excluded.length) : t('Seçtiğin uygulamalar hiç kaydedilmez.'), '<button class="chip act" data-act="excluded">' + esc(t('Düzenle')) + '</button>') + '</div>';
    html += '<div class="section-title">' + esc(t('Bildirimler')) + '</div><div class="panel">' +
      setRow(t('Oturum bildirimleri'), t('Oturum sürerken bildirim çubuğunda kalan süreyi gösterir; çalışma ve mola bittiğinde haber verir.'), switchHtml(prefs.notify, 'toggle', 'notify')) +
      setRow(t('Titreşim'), '', switchHtml(prefs.vibrate, 'toggle', 'vibrate')) + '</div>';
    html += '<div class="section-title">' + esc(t('Veri')) + '</div><div class="panel">' +
      setRow(t('Verileri otomatik sil'), t('Seçilen süreden eski kayıtlar silinir.'), '<button class="chip act" data-act="retention">' + esc(retentionLabel(prefs.retention)) + ' ▾</button>') +
      setRow(t('Bugünü dışa aktar (CSV)'), '', '<button class="chip act" data-act="export" data-arg="1">CSV</button>') +
      setRow(t('Son 7 günü dışa aktar (CSV)'), '', '<button class="chip act" data-act="export" data-arg="7">CSV</button>') +
      setRow(t('Ayarları yedekle'), t('Ayarlar ve kategori kuralların tek dosyada.'), '<button class="chip act" data-act="backup">' + esc(t('Dışa aktar')) + '</button>') +
      setRow(t('Yedeği geri yükle'), '', '<button class="chip act" data-act="restore">' + esc(t('İçe aktar')) + '</button>') +
      setRow(t('Aktivite geçmişini temizle'), t('{} kayıt saklanıyor', N.countEvents()), '<button class="btn danger" data-act="clear">' + esc(t('Temizle')) + '</button>') +
      setRow(t('Ayarları sıfırla'), '', '<button class="chip act" data-act="resetprefs">' + esc(t('Sıfırla')) + '</button>') + '</div>';
    html += '<div class="section-title">' + esc(t('Hakkında')) + '</div><div class="panel">' +
      setRow('Spy ' + N.version() + ' · Android', t('Verilerin telefonunda kalır. Uygulamanın internet izni yoktur.')) +
      setRow(t('Ne kaydedilir?'), t('Yalnızca hangi uygulamanın ne kadar süre açık kaldığı. Mesaj, ekran içeriği ya da konum kaydedilmez.')) +
      setRow(t('Destek'), 'spyisletme@gmail.com', '<button class="chip act" data-act="mail">' + esc(t('Yaz')) + '</button>') + '</div>';
    return html;
  }

  // ------------------------------------------------------------------ çizim
  var RENDER = { general: pageGeneral, analysis: pageAnalysis, timeline: pageTimeline, focus: pageFocus, spy: pageSpy, manage: pageManage, settings: pageSettings };
  var TITLES = {
    general: [T('Bugün'), T('Telefon kullanımının özeti')], analysis: [T('Analiz'), T('Kullanım alışkanlıklarını karşılaştır ve baskın davranışları gör')],
    timeline: ['Timeline', T('Günün uygulama akışını ve kullanım yoğunluğunu incele')], focus: [T('Odak'), T('Kesintisiz çalışma oturumlarını başlat, takip et ve dikkat bölünmelerini gör')],
    spy: ['Spy', T('Günlük kullanımınla ilgili merak ettiklerini Spy’a sor')], manage: [T('Yönetim'), T('Kategorileri ve uygulama eşleşmelerini düzenle')],
    settings: [T('Ayarlar'), T('Spy’ı kendine göre ayarla')]
  };
  function pageInfo(id) { for (var i = 0; i < PAGES.length; i++) if (PAGES[i].id === id) return PAGES[i]; return PAGES[0]; }
  function renderChrome() {
    var p = pageInfo(S.page), badge;
    if (S.license.state === 'expired') badge = '<span class="badge bad">' + esc(t('Deneme bitti')) + '</span>';
    else if (!S.access) badge = '<span class="badge off">' + esc(t('İzin gerekli')) + '</span>';
    else badge = prefs.tracking ? '<span class="badge">' + esc(t('Takip aktif')) + '</span>' : '<span class="badge off">' + esc(t('Takip kapalı')) + '</span>';
    document.documentElement.style.setProperty('--page', p.color);
    document.documentElement.style.setProperty('--accent', prefs.accent);
    document.body.classList.toggle('noanim', !prefs.animations);
    $('#top').innerHTML = '<div class="top-row"><span class="eyebrow">' + esc(p.eyebrow + (p.id === 'general' ? t('BUGÜN') : '')) + '</span>' + badge +
      '<button class="icon-btn' + (S.page === 'manage' ? ' on' : '') + '" data-act="nav" data-arg="manage" aria-label="' + esc(t('Yönetim')) + '">' + icon('manage') + '</button>' +
      '<button class="icon-btn' + (S.page === 'settings' ? ' on' : '') + '" data-act="nav" data-arg="settings" aria-label="' + esc(t('Ayarlar')) + '">' + icon('settings') + '</button></div>' +
      '<h1>' + esc(t(TITLES[S.page][0])) + '</h1><div class="subtitle">' + esc(t(TITLES[S.page][1])) + '</div>';
    $('#nav').innerHTML = PAGES.slice(0, 5).map(function (x) {
      return '<button class="' + (S.page === x.id ? 'on' : '') + '" style="--c:' + x.color + '" data-act="nav" data-arg="' + x.id + '">' + icon(x.id) + '<span>' + esc(t(x.nav)) + '</span></button>';
    }).join('');
  }
  function render(keepScroll) {
    var view = $('#view'), top = view.scrollTop;
    renderChrome();
    try { view.innerHTML = RENDER[S.page](); }
    catch (e) { view.innerHTML = '<div class="banner bad"><b>' + esc(t('Bu sayfa gösterilemedi')) + '</b>' + esc(String(e && e.message || e)) + '</div>'; if (window.console) console.error(e); }
    view.scrollTop = keepScroll ? top : 0;
  }
  function go(page) {
    if (page === S.page) { render(true); return; }
    S.page = page;
    if (page === 'focus') refreshFocusLive();
    render(false);
  }

  // ------------------------------------------------------------------ alt sayfa / bildirim
  function toast(text) {
    var el = document.createElement('div'); el.className = 'toast'; el.textContent = text;
    $('#toast-root').appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }
  function closeSheet() { S.sheet = null; $('#sheet-root').innerHTML = ''; }
  /** handlers: {act: fn(arg, el)} — sheet içindeki data-sact düğmeleri. */
  function openSheet(html, handlers, modal) {
    S.sheet = { handlers: handlers || {}, modal: !!modal };
    $('#sheet-root').innerHTML = '<div class="scrim" data-scrim="1"><div class="sheet"><div class="grip"></div>' + html + '</div></div>';
  }
  function confirmSheet(title, text, okLabel, onOk, danger) {
    openSheet('<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="btn-row"><button class="btn ghost" data-sact="cancel">' + esc(t('Vazgeç')) + '</button><button class="btn' + (danger ? ' danger' : '') + '" data-sact="ok">' + esc(okLabel) + '</button></div>',
      { cancel: closeSheet, ok: function () { closeSheet(); onOk(); } });
  }
  function optionSheet(title, options, current, onPick) {
    openSheet('<h3>' + esc(title) + '</h3>' + options.map(function (o) {
      return '<button class="opt' + (o[0] === current ? ' on' : '') + '" data-sact="pick" data-arg="' + esc(o[0]) + '">' + (o[2] ? '<i style="background:' + o[2] + '"></i>' : '') + '<span class="grow">' + esc(o[1]) + '</span>' + (o[0] === current ? '✓' : '') + '</button>';
    }).join(''), { pick: function (arg) { closeSheet(); onPick(arg); } });
  }

  function onboarding() {
    openSheet('<div class="center" style="margin:6px 0 10px">' + eye('normal', 64).replace('class="eye"', 'class="eye" style="margin:0 auto"') + '</div><h3>' + esc(t('Spy’a hoş geldin')) + '</h3>' +
      '<p>' + esc(t('Spy, telefonda hangi uygulamada ne kadar zaman geçirdiğini kaydeder ve gösterir.')) + '</p>' +
      '<p>' + esc(t('Yalnızca uygulama adı ve süresi kaydedilir; mesajların, ekran içeriğin ya da konumun kaydedilmez. Veriler telefonunda kalır, uygulamanın internet izni yoktur.')) + '</p>' +
      '<p>' + esc(t('Başlamak için Android’in “Kullanım erişimi” iznini açman gerekiyor. {} günlük ücretsiz deneme şimdi başlıyor.', C.TRIAL_DAYS)) + '</p>' +
      '<div class="btn-row"><button class="btn ghost" data-sact="later">' + esc(t('Sonra')) + '</button><button class="btn" data-sact="grant">' + esc(t('İzni aç')) + '</button></div>',
      { later: function () { setPref('onboarded', true); closeSheet(); }, grant: function () { setPref('onboarded', true); closeSheet(); N.openUsageSettings(); } }, true);
  }
  function licenseSheet() {
    openSheet('<h3>' + esc(t('Lisans anahtarı')) + '</h3><p>' + esc(t('Satın aldığında e-postana gelen SPY-… ile başlayan anahtarı yapıştır.')) + '</p>' +
      '<input class="field" id="lic-key" placeholder="SPY-XXXXXX-XXXXXX-…" autocomplete="off" autocapitalize="characters" spellcheck="false"><div class="err" id="lic-err"></div>' +
      '<div class="btn-row"><button class="btn ghost" data-sact="cancel">' + esc(t('Vazgeç')) + '</button><button class="btn" data-sact="ok">' + esc(t('Etkinleştir')) + '</button></div>',
      {
        cancel: closeSheet,
        ok: function () {
          var key = $('#lic-key').value;
          if (!C.parseKey(key, N.sha512)) { $('#lic-err').textContent = t('Lisans anahtarı geçersiz. Anahtarı kopyalarken eksik karakter kalmadığından emin ol.'); return; }
          var data = licenseData(); data.key = C.cleanKey(key); save('spy.license', data);
          closeSheet(); refresh(); render(true); toast(t('Lisans etkinleştirildi. Teşekkürler!'));
        }
      });
  }
  function excludedSheet() {
    var apps = knownApps(30).filter(function (a) { return a.app !== OWN; }), chosen = {};
    prefs.excluded.forEach(function (p) { chosen[p] = true; if (!apps.some(function (a) { return a.app === p; })) apps.push({ app: p, secs: 0 }); });
    function body() {
      return '<h3>' + esc(t('Hariç tutulan uygulamalar')) + '</h3><p>' + esc(t('Seçtiğin uygulamalar bundan sonra kaydedilmez ve geçmiş kayıtları silinir.')) + '</p>' +
        (apps.length ? apps.map(function (a) { return '<button class="opt' + (chosen[a.app] ? ' on' : '') + '" data-sact="tog" data-arg="' + esc(a.app) + '"><span class="check">✓</span><span class="grow">' + esc(appName(a.app)) + '</span></button>'; }).join('') : '<div class="empty">' + esc(t('Henüz kayıt yok.')) + '</div>') +
        '<div class="btn-row"><button class="btn ghost" data-sact="cancel">' + esc(t('Vazgeç')) + '</button><button class="btn" data-sact="ok">' + esc(t('Uygula')) + '</button></div>';
    }
    var handlers = {
      cancel: closeSheet,
      tog: function (arg, el) { chosen[arg] = !chosen[arg]; el.classList.toggle('on', chosen[arg]); },
      ok: function () {
        var list = Object.keys(chosen).filter(function (k) { return chosen[k]; });
        setPref('excluded', list); N.setExcluded(list); closeSheet(); refresh(); render(true);
      }
    };
    openSheet(body(), handlers);
  }

  // ------------------------------------------------------------------ dışa aktarma / yedek
  function stamp() { var d = new Date(N.now() * 1000); return d.getFullYear() + '-' + C.pad2(d.getMonth() + 1) + '-' + C.pad2(d.getDate()); }
  function exportCsv(days) {
    var rows = [[t('Tarih'), t('Uygulama'), t('Paket'), t('Kategori'), t('Süre (sn)'), t('Süre')]];
    for (var i = days - 1; i >= 0; i--) {
      var a = getTimeline(i), d = new Date(a.dayStart * 1000), date = d.getFullYear() + '-' + C.pad2(d.getMonth() + 1) + '-' + C.pad2(d.getDate());
      a.apps.forEach(function (x) { rows.push([date, appName(x.app), x.app, catLabel(x.key), Math.round(x.secs), long(x.secs)]); });
    }
    pendingSave = t('Dışa aktarıldı.');
    N.saveFile('spy-' + (days === 1 ? stamp() : days + 'gun-' + stamp()) + '.csv', 'text/csv', C.toCsv(rows));
  }
  var pendingSave = null;
  window.onSpySaved = function (ok) { toast(ok ? (pendingSave || t('Kaydedildi.')) : t('Dosya kaydedilemedi.')); pendingSave = null; };
  function backup() {
    pendingSave = t('Yedek kaydedildi.');
    N.saveFile('spy-yedek-' + stamp() + '.json', 'application/json', JSON.stringify({ app: 'spy-mobile', version: N.version(), exported: Math.round(N.now()), prefs: prefs, sessions: sessions }, null, 1));
  }
  window.onSpyFile = function (text) {
    if (text == null) return;
    var data;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    if (!data || data.app !== 'spy-mobile' || typeof data.prefs !== 'object' || !data.prefs) { toast(t('Bu dosya bir Spy yedeği değil.')); return; }
    var ov = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      var v = data.prefs[k];
      if (typeof v === typeof DEFAULTS[k] && v !== null && k !== 'onboarded') prefs[k] = v;
    });
    if (data.prefs.overrides && typeof data.prefs.overrides === 'object') Object.keys(data.prefs.overrides).forEach(function (p) { if (C.CAT_KEYS.indexOf(data.prefs.overrides[p]) >= 0) ov[p] = data.prefs.overrides[p]; });
    prefs.overrides = ov;
    prefs.excluded = Array.isArray(data.prefs.excluded) ? data.prefs.excluded.filter(function (x) { return typeof x === 'string'; }) : [];
    if (ACCENTS.indexOf(prefs.accent) < 0) prefs.accent = DEFAULTS.accent;
    if (RETENTION.indexOf(prefs.retention) < 0) prefs.retention = 0;
    prefs.goalHours = Math.max(0, Math.min(12, Math.round(prefs.goalHours)));
    save('spy.prefs', prefs);
    if (prefs.lang) lang = prefs.lang;
    N.setExcluded(prefs.excluded);
    if (!pomo.running()) { pomo.configure(prefs.pomoWork, prefs.pomoShort, prefs.pomoLong); savePomo(); }
    refresh(); render(true); toast(t('Yedek geri yüklendi.'));
  };

  // ------------------------------------------------------------------ eylemler
  var ACT = {
    nav: function (arg) { go(arg); },
    refresh: function () { refresh(); render(true); toast(t('Veriler yenilendi.')); },
    grant: function () { N.openUsageSettings(); },
    license: licenseSheet,
    adays: function (arg) { S.analysisDays = Number(arg); render(false); },
    tlfilter: function (arg) { S.tlFilter = arg; render(true); },
    tlday: function () {
      var opts = []; for (var i = 0; i < 7; i++) opts.push([String(i), dayLabel(i)]);
      optionSheet(t('Hangi gün?'), opts, String(S.tlDay), function (v) { S.tlDay = Number(v); render(false); });
    },
    focusstart: function () {
      if (pomo.running()) return;
      focus = { start: N.now(), pauses: [], ignored: {} }; save('spy.focus', focus);
      if (prefs.notify) N.requestNotifications();
      refreshFocusLive(); updateOngoing(); render(true); toast(t('Odak oturumu başladı. İyi çalışmalar!'));
    },
    focuspause: function () {
      if (!focus) return;
      var now = N.now();
      if (focusPaused()) focus.pauses[focus.pauses.length - 1][1] = now; else focus.pauses.push([now, 0]);
      save('spy.focus', focus); refreshFocusLive(); updateOngoing(); render(true);
    },
    focusstop: function () {
      if (!focus) return;
      var now = N.now();
      if (focusPaused()) focus.pauses[focus.pauses.length - 1][1] = now;
      refreshFocusLive();
      var live = S.focusLive, elapsed = focusElapsed(now);
      if (elapsed >= 60) { addSession('focus', focus.start, now, elapsed, live.interruptions); toast(t('Oturum bitti: {} · skor {}% · {} kesinti', short(elapsed), live.score, live.interruptions)); }
      else toast(t('Oturum 1 dakikadan kısa olduğu için kaydedilmedi.'));
      focus = null; save('spy.focus', null); S.focusLive = null; updateOngoing(); refresh(); render(true);
    },
    ignore: function (arg) { if (!focus) return; focus.ignored[arg] = true; save('spy.focus', focus); refreshFocusLive(); render(true); toast(t('{} bu oturumda kesinti sayılmayacak.', appName(arg))); },
    ikey: function (arg) {
      var keys = interruptKeys(), i = keys.indexOf(arg);
      if (i >= 0) keys.splice(i, 1); else keys.push(arg);
      setPref('interruptKeys', keys.length ? C.ALL_INTERRUPT_KEYS.filter(function (k) { return keys.indexOf(k) >= 0; }).join(',') : '-');
      refreshFocusLive(); render(true);
    },
    pomostart: function () {
      if (focus) return;
      pomo.configure(prefs.pomoWork, prefs.pomoShort, prefs.pomoLong);
      if (prefs.notify) N.requestNotifications();
      handlePomoEvents(pomo.start(N.now()), true); render(true); toast(t('Pomodoro başladı: {} dk çalışma.', pomo.work_min));
    },
    pomopause: function () { var now = N.now(); handlePomoEvents(pomo.paused ? pomo.resume(now) : pomo.pause(now), true); savePomo(); render(true); },
    pomoskip: function () { handlePomoEvents(pomo.skipBreak(N.now()), false); render(true); },
    pomostop: function () { handlePomoEvents(pomo.stop(N.now()), true); savePomo(); refresh(); render(true); toast(t('Pomodoro seansı bitirildi.')); },
    pstep: function (arg) {
      if (pomo.running()) return;
      var parts = arg.split(':'), key = parts[0], dir = Number(parts[1]);
      var range = key === 'pomoWork' ? C.Pomodoro.WORK_RANGE : key === 'pomoShort' ? C.Pomodoro.SHORT_RANGE : C.Pomodoro.LONG_RANGE, step = key === 'pomoShort' ? 1 : 5;
      setPref(key, Math.max(range[0], Math.min(range[1], prefs[key] + dir * step)));
      pomo.configure(prefs.pomoWork, prefs.pomoShort, prefs.pomoLong); save('spy.pomo', pomo.toJSON()); render(true);
    },
    ask: function (arg) { ask(arg); },
    mcat: function (arg) { S.manageCat = arg; render(true); },
    assign: function (arg) {
      var current = S.cls(arg);
      optionSheet(t('{} hangi kategori?', appName(arg)), C.CAT_KEYS.map(function (k) { return [k, catLabel(k), C.CAT_COLORS[k]]; }), current, function (key) {
        var ov = prefs.overrides; ov[arg] = key;
        // Spy'ın hazır kuralıyla aynıysa kullanıcı kuralına gerek yok.
        var plain = C.makeClassifier(window.SPY_RULES, {}, OWN), a = S.apps[arg] || {};
        if (plain(arg, a.l || '', a.h || '') === key) delete ov[arg];
        setPref('overrides', ov); refresh(); S.manageCat = key; render(true); toast(t('{} artık {} kategorisinde.', appName(arg), catLabel(key)));
      });
    },
    mreset: function () { confirmSheet(t('Varsayılana dön'), t('Kendi kategori kuralların silinir ve Spy’ın hazır kuralları geri gelir.'), t('Sıfırla'), function () { setPref('overrides', {}); refresh(); render(true); }, true); },
    toggle: function (arg) {
      var value = !prefs[arg];
      if (arg === 'tracking') {
        if (!value) { if (S.access && trackingAllowed()) N.sync(); } else N.skipToNow();
      }
      setPref(arg, value);
      if (arg === 'notify') { if (value) N.requestNotifications(); savePomo(); }
      refresh(); render(true);
    },
    lang: function () { optionSheet(t('Dil'), [['tr', 'Türkçe'], ['en', 'English']], lang, function (v) { lang = v; setPref('lang', v); document.documentElement.lang = v; savePomo(); render(true); }); },
    accent: function (arg) { setPref('accent', arg); render(true); },
    goal: function (arg) { setPref('goalHours', Math.max(0, Math.min(12, prefs.goalHours + Number(arg)))); render(true); },
    excluded: excludedSheet,
    retention: function () {
      optionSheet(t('Verileri otomatik sil'), RETENTION.map(function (d) { return [String(d), retentionLabel(d)]; }), String(prefs.retention), function (v) {
        var days = Number(v);
        if (!days) { setPref('retention', 0); render(true); return; }
        var count = N.countOlderThan(days);
        confirmSheet(t('Verileri otomatik sil'), t('{} günden eski kayıtlar silinecek ve bu geri alınamaz. Şu anda silinecek kayıt sayısı: {}.', days, count), t('Sil ve uygula'), function () {
          setPref('retention', days); N.deleteOlderThan(days); refresh(); render(true);
        }, true);
      });
    },
    export: function (arg) { exportCsv(Number(arg)); },
    backup: backup,
    restore: function () { N.pickFile(); },
    clear: function () {
      confirmSheet(t('Aktivite geçmişini temizle'), t('Tüm aktivite kayıtları silinecek. Bu işlem geri alınamaz.'), t('Temizle'), function () {
        var n = N.clearEvents(); refresh(); render(true); toast(t('{} kayıt silindi.', n));
      }, true);
    },
    resetprefs: function () {
      confirmSheet(t('Ayarları sıfırla'), t('Tüm ayarlar ilk haline döner. Aktivite kayıtların ve lisansın korunur.'), t('Sıfırla'), function () {
        var keepLang = prefs.lang;
        Object.keys(DEFAULTS).forEach(function (k) { prefs[k] = JSON.parse(JSON.stringify(DEFAULTS[k])); });
        prefs.onboarded = true; prefs.lang = keepLang; save('spy.prefs', prefs);
        N.setExcluded([]); N.skipToNow();
        if (!pomo.running()) pomo.configure(prefs.pomoWork, prefs.pomoShort, prefs.pomoLong);
        savePomo(); refresh(); render(true); toast(t('Ayarlar sıfırlandı.'));
      }, true);
    },
    mail: function () { N.openUrl('mailto:spyisletme@gmail.com'); }
  };

  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-sact],[data-act]') : null;
    if (S.sheet) {
      if (el && el.hasAttribute('data-sact')) { var h = S.sheet.handlers[el.getAttribute('data-sact')]; if (h) h(el.getAttribute('data-arg'), el); return; }
      if (e.target.hasAttribute && e.target.hasAttribute('data-scrim') && !S.sheet.modal) closeSheet();
      return;
    }
    if (!el || !el.hasAttribute('data-act')) return;
    var fn = ACT[el.getAttribute('data-act')];
    if (fn) fn(el.getAttribute('data-arg'), el);
  });

  // ------------------------------------------------------------------ yaşam döngüsü
  var lastLiveSync = 0;
  function tick() {
    var now = N.now();
    var events = pomo.catchUp(now);
    if (events.length) { handlePomoEvents(events, false); if (S.page === 'focus') { render(true); return; } }
    if (S.page !== 'focus' || S.sheet) return;
    var pc = $('#pomo-clock'); if (pc && pomo.running()) pc.textContent = C.fmtClock(pomo.remaining(now));
    var fc = $('#focus-clock'); if (fc && focus) fc.textContent = C.fmtClock(focusElapsed(now));
    if (focus && !focusPaused() && now - lastLiveSync > 15) { lastLiveSync = now; refreshFocusLive(); render(true); }
  }
  window.onSpyResume = function () {
    var wasExpired = S.license.state === 'expired';
    refresh();
    handlePomoEvents(pomo.catchUp(N.now()), false);
    if (focus) refreshFocusLive();
    updateOngoing();
    if (S.license.state === 'expired' && !wasExpired) toast(t('Deneme süresi doldu'));
    if (!S.chatBusy) render(true);
    runPendingAction();
  };
  window.onSpyPause = function () { };
  /** Bildirimdeki Duraklat/Devam et/Bitir düğmeleri uygulamayı açar ve eylemi buraya bırakır. */
  function runPendingAction() {
    var action = N.takeAction();
    if (!action) return;
    if (S.sheet && !S.sheet.modal) closeSheet();
    if (action === 'pomo_pause' && pomo.running()) { go('focus'); ACT.pomopause(); }
    else if (action === 'pomo_stop' && pomo.running()) { go('focus'); ACT.pomostop(); }
    else if (action === 'focus_pause' && focus) { go('focus'); ACT.focuspause(); }
    else if (action === 'focus_stop' && focus) { go('focus'); ACT.focusstop(); }
    else updateOngoing();
  }
  /** Geri tuşu: açık alt sayfayı kapatır, sonra Genel'e döner; işlenmediyse false (uygulama arka plana gider). */
  window.onSpyBack = function () {
    if (S.sheet) { if (!S.sheet.modal) closeSheet(); return true; }
    if (S.page !== 'general') { go('general'); return true; }
    return false;
  };

  function boot() {
    document.documentElement.lang = lang;
    refreshLicense();
    if (prefs.retention > 0) N.deleteOlderThan(prefs.retention);
    N.setExcluded(prefs.excluded);
    refresh();
    handlePomoEvents(pomo.catchUp(N.now()), true);
    if (focus) refreshFocusLive();
    updateOngoing();
    render(false);
    runPendingAction();
    setInterval(tick, 1000);
    if (!prefs.onboarded) { if (S.access) setPref('onboarded', true); else onboarding(); }
  }
  window.SpyApp = { state: S, prefs: prefs, go: go, render: render, refresh: refresh, t: t };
  boot();
})();
