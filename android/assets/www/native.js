/* Yerel katman sarmalayıcısı. Telefonda window.SpyNative (Java) kullanılır; tarayıcıda açılırsa
 * (geliştirme / önizleme) aynı arayüzü örnek veriyle taklit eden bir kopya devreye girer. */
(function () {
  'use strict';
  var J = window.SpyNative;
  var real = !!J;

  // ------------------------------------------------------------ SHA-512 (yalnızca tarayıcı önizlemesi için; telefonda Java hesaplar)
  function sha512js(bytes) {
    var B = BigInt, M = (B(1) << B(64)) - B(1);
    var K = ('428a2f98d728ae22 7137449123ef65cd b5c0fbcfec4d3b2f e9b5dba58189dbbc 3956c25bf348b538 59f111f1b605d019 923f82a4af194f9b ab1c5ed5da6d8118 ' +
      'd807aa98a3030242 12835b0145706fbe 243185be4ee4b28c 550c7dc3d5ffb4e2 72be5d74f27b896f 80deb1fe3b1696b1 9bdc06a725c71235 c19bf174cf692694 ' +
      'e49b69c19ef14ad2 efbe4786384f25e3 0fc19dc68b8cd5b5 240ca1cc77ac9c65 2de92c6f592b0275 4a7484aa6ea6e483 5cb0a9dcbd41fbd4 76f988da831153b5 ' +
      '983e5152ee66dfab a831c66d2db43210 b00327c898fb213f bf597fc7beef0ee4 c6e00bf33da88fc2 d5a79147930aa725 06ca6351e003826f 142929670a0e6e70 ' +
      '27b70a8546d22ffc 2e1b21385c26c926 4d2c6dfc5ac42aed 53380d139d95b3df 650a73548baf63de 766a0abb3c77b2a8 81c2c92e47edaee6 92722c851482353b ' +
      'a2bfe8a14cf10364 a81a664bbc423001 c24b8b70d0f89791 c76c51a30654be30 d192e819d6ef5218 d69906245565a910 f40e35855771202a 106aa07032bbd1b8 ' +
      '19a4c116b8d2d0c8 1e376c085141ab53 2748774cdf8eeb99 34b0bcb5e19b48a8 391c0cb3c5c95a63 4ed8aa4ae3418acb 5b9cca4f7763e373 682e6ff3d6b2b8a3 ' +
      '748f82ee5defb2fc 78a5636f43172f60 84c87814a1f0ab72 8cc702081a6439ec 90befffa23631e28 a4506cebde82bde9 bef9a3f7b2c67915 c67178f2e372532b ' +
      'ca273eceea26619c d186b8c721c0c207 eada7dd6cde0eb1e f57d4f7fee6ed178 06f067aa72176fba 0a637dc5a2c898a6 113f9804bef90dae 1b710b35131c471b ' +
      '28db77f523047d84 32caab7b40c72493 3c9ebe0a15c9bebc 431d67c49c100d4c 4cc5d4becb3e42b6 597f299cfc657e2a 5fcb6fab3ad6faec 6c44198c4a475817')
      .split(' ').map(function (h) { return B('0x' + h); });
    var H = ['6a09e667f3bcc908', 'bb67ae8584caa73b', '3c6ef372fe94f82b', 'a54ff53a5f1d36f1', '510e527fade682d1', '9b05688c2b3e6c1f', '1f83d9abfb41bd6b', '5be0cd19137e2179']
      .map(function (h) { return B('0x' + h); });
    var rotr = function (x, n) { return ((x >> B(n)) | (x << B(64 - n))) & M; };
    var len = bytes.length, padLen = ((len + 17 + 127) >> 7) << 7, data = new Uint8Array(padLen);
    data.set(bytes); data[len] = 0x80;
    var bits = B(len) * B(8);
    for (var i = 0; i < 8; i++) data[padLen - 1 - i] = Number((bits >> B(8 * i)) & B(255));
    var W = new Array(80);
    for (var off = 0; off < padLen; off += 128) {
      for (var t = 0; t < 16; t++) { var v = B(0); for (var j = 0; j < 8; j++) v = (v << B(8)) | B(data[off + t * 8 + j]); W[t] = v; }
      for (t = 16; t < 80; t++) {
        var s0 = rotr(W[t - 15], 1) ^ rotr(W[t - 15], 8) ^ (W[t - 15] >> B(7));
        var s1 = rotr(W[t - 2], 19) ^ rotr(W[t - 2], 61) ^ (W[t - 2] >> B(6));
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) & M;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 80; t++) {
        var S1 = rotr(e, 14) ^ rotr(e, 18) ^ rotr(e, 41), ch = (e & f) ^ (~e & M & g);
        var t1 = (h + S1 + ch + K[t] + W[t]) & M;
        var S0 = rotr(a, 28) ^ rotr(a, 34) ^ rotr(a, 39), maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) & M;
        h = g; g = f; f = e; e = (d + t1) & M; d = c; c = b; b = a; a = (t1 + t2) & M;
      }
      H = [(H[0] + a) & M, (H[1] + b) & M, (H[2] + c) & M, (H[3] + d) & M, (H[4] + e) & M, (H[5] + f) & M, (H[6] + g) & M, (H[7] + h) & M];
    }
    var out = new Uint8Array(64);
    for (i = 0; i < 8; i++) for (j = 0; j < 8; j++) out[i * 8 + j] = Number((H[i] >> B(8 * (7 - j))) & B(255));
    return out;
  }

  // ------------------------------------------------------------ tarayıcı önizlemesi (örnek veri)
  function makeMock() {
    var params = {};
    (location.search || '').replace(/^\?/, '').split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[p[0]] = decodeURIComponent(p[1] || ''); });
    var APPS = {
      'com.spyapp.mobile': ['Spy', ''], 'com.sec.android.app.launcher': ['One UI Ana Ekran', 'launcher'],
      'com.instagram.android': ['Instagram', 'social'], 'com.google.android.youtube': ['YouTube', 'video'],
      'com.whatsapp': ['WhatsApp', 'social'], 'com.android.chrome': ['Chrome', ''], 'com.spotify.music': ['Spotify', 'audio'],
      'com.google.android.apps.docs.editors.docs': ['Dokümanlar', 'productivity'], 'notion.id': ['Notion', 'productivity'],
      'com.openai.chatgpt': ['ChatGPT', 'productivity'], 'com.google.android.gm': ['Gmail', 'productivity'],
      'trendyol.com': ['Trendyol', ''], 'com.google.android.apps.maps': ['Haritalar', 'maps'], 'com.duolingo': ['Duolingo', ''],
      'com.supercell.brawlstars': ['Brawl Stars', 'game'], 'org.wikipedia': ['Vikipedi', ''], 'com.zhiliaoapp.musically': ['TikTok', 'social'],
      'com.microsoft.office.word': ['Word', 'productivity'], 'com.example.notlar': ['Not Defterim', ''], 'com.android.settings': ['Ayarlar', 'system'],
      'com.bundle.haber': ['Bundle Haber', 'news'], 'com.garanti.cepsubesi': ['Garanti BBVA', '']
    };
    var seed = 20261111;
    function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
    function pick(list) { return list[Math.floor(rnd() * list.length)]; }
    var now = params.now ? Number(params.now) : Date.now() / 1000;
    var events = [];
    if (params.demo !== 'empty') {
      var d0 = new Date(now * 1000), midnight = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()).getTime() / 1000;
      var blocks = [
        [8.0, 9.0, ['com.whatsapp', 'com.instagram.android', 'com.bundle.haber', 'com.google.android.gm']],
        [9.3, 12.2, ['notion.id', 'com.google.android.apps.docs.editors.docs', 'com.openai.chatgpt', 'com.android.chrome', 'com.microsoft.office.word', 'com.whatsapp']],
        [12.3, 13.2, ['com.instagram.android', 'com.google.android.youtube', 'trendyol.com', 'com.zhiliaoapp.musically']],
        [13.5, 17.5, ['com.google.android.apps.docs.editors.docs', 'notion.id', 'com.duolingo', 'com.openai.chatgpt', 'com.google.android.gm', 'org.wikipedia', 'com.example.notlar']],
        [18.0, 19.0, ['com.google.android.apps.maps', 'com.spotify.music', 'com.whatsapp', 'com.garanti.cepsubesi']],
        [20.5, 23.2, ['com.google.android.youtube', 'com.instagram.android', 'com.supercell.brawlstars', 'com.zhiliaoapp.musically', 'com.whatsapp', 'com.android.chrome']]
      ];
      for (var day = 13; day >= 0; day--) {
        var base = midnight - day * 86400, lazy = 0.55 + rnd() * 0.6;
        blocks.forEach(function (b) {
          var t = base + b[0] * 3600 + rnd() * 900, end = base + b[1] * 3600;
          while (t < end) {
            var app = pick(b[2]), dur = (40 + rnd() * rnd() * 1500) * lazy;
            if (rnd() < 0.55) { events.push([t, t + 2 + rnd() * 4, 'com.sec.android.app.launcher']); t += 3 + rnd() * 4; }
            var e = Math.min(t + dur, end);
            if (e > now) e = now;
            if (e - t > 2) events.push([t, e, app]);
            t = e + (rnd() < 0.3 ? 60 + rnd() * 900 : 1);
            if (t >= now) break;
          }
        });
      }
      events = events.filter(function (ev) { return ev[0] < now; });
      events.push([Math.max(now - 40, events.length ? events[events.length - 1][1] : now - 40), now, 'com.spyapp.mobile']);
    }
    var access = params.demo !== 'noaccess', alarms = [];
    return {
      _mock: true, _alarms: alarms, _now: params.now ? now : null,
      version: function () { return '1.4.5'; }, ownPackage: function () { return 'com.spyapp.mobile'; },
      deviceLang: function () { return params.lang || (navigator.language || 'tr').slice(0, 2); },
      hasUsageAccess: function () { return access; },
      openUsageSettings: function () { access = true; setTimeout(function () { window.onSpyResume && window.onSpyResume(); }, 300); },
      sync: function () { return access ? 0 : -1; }, skipToNow: function () { },
      queryEvents: function (s, e) { return JSON.stringify(access ? events.filter(function (ev) { return ev[1] > s && ev[0] < e; }) : []); },
      apps: function () { var o = {}; Object.keys(APPS).forEach(function (k) { o[k] = { l: APPS[k][0], h: APPS[k][1] }; }); return JSON.stringify(o); },
      countEvents: function () { return events.length; },
      countOlderThan: function (days) { return events.filter(function (ev) { return ev[1] < now - days * 86400; }).length; },
      deleteOlderThan: function (days) { var n = events.length; events = events.filter(function (ev) { return ev[1] >= now - days * 86400; }); return n - events.length; },
      clearEvents: function () { var n = events.length; events = []; return n; },
      setExcluded: function (json) { var ex = JSON.parse(json); events = events.filter(function (ev) { return ex.indexOf(ev[2]) < 0; }); },
      sha512Hex: null, requestNotifications: function () { }, notify: function (title, text) { console.log('[bildirim]', title, text); },
      scheduleAlarm: function (slot, at, title, text) { alarms[slot] = { at: at, title: title, text: text }; },
      cancelAlarms: function () { alarms.length = 0; }, vibrate: function () { },
      saveFile: function (name, mime, content) {
        try {
          var a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.download = name; a.click();
        } catch (e) { }
        window._lastSaved = { name: name, mime: mime, content: content };
        setTimeout(function () { window.onSpySaved && window.onSpySaved(true); }, 50);
      },
      pickFile: function () {
        if (window._pickText !== undefined) { var txt = window._pickText; setTimeout(function () { window.onSpyFile && window.onSpyFile(txt); }, 50); return; }
        var input = document.createElement('input'); input.type = 'file';
        input.onchange = function () { var r = new FileReader(); r.onload = function () { window.onSpyFile && window.onSpyFile(String(r.result)); }; r.readAsText(input.files[0]); };
        input.click();
      },
      openUrl: function (url) { window.open(url, '_blank'); }
    };
  }
  if (!real) J = makeMock();

  function hex(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16); return s; }
  function unhex(h) { var out = new Uint8Array(h.length / 2); for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16); return out; }
  function parse(json, fallback) { try { return JSON.parse(json); } catch (e) { return fallback; } }

  window.Native = {
    real: real, raw: J,
    version: function () { return J.version(); },
    ownPackage: function () { return J.ownPackage(); },
    deviceLang: function () { return J.deviceLang(); },
    now: function () { return J._now || Date.now() / 1000; },
    hasUsageAccess: function () { return !!J.hasUsageAccess(); },
    openUsageSettings: function () { J.openUsageSettings(); },
    sync: function () { return J.sync(); },
    skipToNow: function () { J.skipToNow(); },
    events: function (start, end) { return parse(J.queryEvents(start, end), []); },
    apps: function () { return parse(J.apps(), {}); },
    countEvents: function () { return Number(J.countEvents()) || 0; },
    countOlderThan: function (days) { return Number(J.countOlderThan(days)) || 0; },
    deleteOlderThan: function (days) { return Number(J.deleteOlderThan(days)) || 0; },
    clearEvents: function () { return Number(J.clearEvents()) || 0; },
    setExcluded: function (list) { J.setExcluded(JSON.stringify(list || [])); },
    sha512: function (bytes) {
      if (J.sha512Hex) { var out = J.sha512Hex(hex(bytes)); if (out && out.length === 128) return unhex(out); }
      return sha512js(bytes);
    },
    sha512js: sha512js,
    requestNotifications: function () { J.requestNotifications(); },
    notify: function (title, text) { J.notify(title, text); },
    scheduleAlarm: function (slot, atMs, title, text) { J.scheduleAlarm(slot, atMs, title, text); },
    cancelAlarms: function () { J.cancelAlarms(); },
    vibrate: function (ms) { J.vibrate(ms); },
    saveFile: function (name, mime, content) { J.saveFile(name, mime, content); },
    pickFile: function () { J.pickFile(); },
    openUrl: function (url) { J.openUrl(url); }
  };
})();
