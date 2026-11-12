/* Arayüz testleri (Playwright + Chromium): `node tests/ui.test.js`
 * Arayüz tarayıcıda örnek veriyle açılır (native.js içindeki önizleme kopyası) ve telefon boyutunda kullanılır. */
'use strict';
const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');

const URL = 'file://' + path.resolve(__dirname, '../assets/www/index.html');
const NOW = Math.floor(new Date(2026, 10, 11, 21, 30).getTime() / 1000);
let passed = 0;

async function open(browser, query, init) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  if (init) await page.addInitScript(init);
  await page.goto(URL + '?now=' + NOW + (query ? '&' + query : ''));
  await page.waitForSelector('#nav button');
  return page;
}
const text = (page, sel) => page.locator(sel).innerText();
const act = (page, name, arg) => page.locator('#view [data-act="' + name + '"]' + (arg ? '[data-arg="' + arg + '"]' : '')).first().click();
const nav = (page, id) => page.locator('[data-act="nav"][data-arg="' + id + '"]').first().click();
const advance = (page, seconds) => page.evaluate((s) => { window.Native.raw._now += s; }, seconds);
async function test(name, fn) { await fn(); passed++; console.log('  ok  ' + name); }

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  await test('tüm sayfalar hatasız açılır, yatay taşma yok (TR ve EN)', async () => {
    for (const lang of ['tr', 'en']) {
      const page = await open(browser, 'lang=' + lang);
      for (const id of ['general', 'analysis', 'timeline', 'focus', 'spy', 'manage', 'settings']) {
        await page.evaluate((p) => window.SpyApp.go(p), id);
        const body = await text(page, '#view');
        assert.ok(body.length > 40, id + ' boş');
        assert.ok(!/undefined|NaN|\{\}|\[object/.test(body), lang + '/' + id + ' içinde bozuk metin: ' + (body.match(/.{0,30}(undefined|NaN|\{\}|\[object).{0,30}/) || [''])[0]);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        assert.ok(!overflow, id + ' yatay taşıyor');
      }
      if (lang === 'en') {
        await nav(page, 'general');
        assert.strictEqual(await text(page, 'h1'), 'Today');
        const body = await text(page, '#view');
        assert.ok(/Total usage/.test(body) && /Productivity/.test(body), 'İngilizce çeviri uygulanmadı');
        assert.ok(!/[ğşıİĞŞ]/.test(body.replace(/Dokümanlar|Not Defterim|Vikipedi|Haritalar|Ayarlar|One UI Ana Ekran/g, '')), 'EN sayfada Türkçe kaldı: ' + (body.match(/.{0,25}[ğşıİĞŞ].{0,25}/) || [''])[0]);
      }
      assert.deepStrictEqual(page.errors, []);
      await page.context().close();
    }
  });

  await test('Genel: toplamlar tutarlı', async () => {
    const page = await open(browser, 'lang=tr');
    const s = await page.evaluate(() => { const d = window.SpyApp.state.today; return { total: d.total, cats: Object.values(d.cats).reduce((a, b) => a + b, 0), apps: d.apps.reduce((a, b) => a + b.secs, 0), hourly: d.hourly.reduce((a, b) => a + b, 0) }; });
    assert.ok(s.total > 3600);
    for (const k of ['cats', 'apps', 'hourly']) assert.ok(Math.abs(s[k] - s.total) < 1, k + ' toplamı tutmuyor');
    assert.ok(/Takip aktif/.test(await text(page, '#top')));
    await page.context().close();
  });

  await test('Analiz ve Timeline: dönem / filtre / gün seçimi', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'analysis');
    await act(page, 'adays', '30');
    assert.ok(/AKTİF GÜN\s*14 \/ 30/.test(await text(page, '#view')), 'örnek veri 14 gün');
    await act(page, 'adays', '1');
    assert.ok(/Günün yoğunluk haritası/.test(await text(page, '#view')));
    await nav(page, 'timeline');
    await act(page, 'tlfilter', 'distraction');
    const rows = await page.locator('.tl-row .name').allInnerTexts();
    assert.ok(rows.length > 0 && rows.every((n) => ['Instagram', 'TikTok', 'Brawl Stars', 'Spotify'].includes(n)), 'filtre: ' + rows);
    await act(page, 'tlday');
    await page.locator('.sheet [data-sact="pick"][data-arg="1"]').click();
    assert.ok(/Dün zaman akışı/.test(await text(page, '#view')));
    assert.strictEqual(await page.locator('.tl-now').count(), 0, 'dünde "şimdi" çizgisi olmaz');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  await test('Odak oturumu: başlat, duraklat, bitir, kaydet', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'focus');
    await act(page, 'focusstart');
    assert.ok(/Odak oturumu sürüyor/.test(await text(page, '#view')));
    assert.ok(await page.locator('#view [data-act="pomostart"]').isDisabled(), 'odak sürerken pomodoro kilitli');
    await advance(page, 600);
    await page.waitForFunction(() => document.querySelector('#focus-clock') && document.querySelector('#focus-clock').textContent === '10:00');
    await act(page, 'focuspause');
    await advance(page, 300);
    await act(page, 'focuspause');
    await advance(page, 300);
    await act(page, 'focusstop');
    const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('spy.sessions')));
    assert.strictEqual(sessions.length, 1);
    assert.deepStrictEqual([sessions[0].kind, sessions[0].duration], ['focus', 900]);
    assert.ok(/15 dk/.test(await text(page, '#view')), 'oturum listede');
    assert.strictEqual(await page.evaluate(() => localStorage.getItem('spy.focus')), 'null');
    await page.context().close();
  });

  await test('Pomodoro: aşamalar, alarmlar, arka planda geçen süre, yeniden açılış', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'focus');
    await act(page, 'pstep', 'pomoWork:1');
    assert.ok(/30 dk/.test(await text(page, '.steppers')));
    await act(page, 'pstep', 'pomoWork:-1');
    await act(page, 'pomostart');
    let alarms = await page.evaluate(() => window.Native.raw._alarms.map((a) => [Math.round(a.at / 1000), a.title]));
    assert.strictEqual(alarms.length, 8, '8 aşama alarmı');
    assert.deepStrictEqual(alarms.map((a) => a[0] - NOW), [1500, 1800, 3300, 3600, 5100, 5400, 6900, 7800]);
    assert.deepStrictEqual([alarms[0][1], alarms[1][1], alarms[6][1], alarms[7][1]], ['Mola zamanı', 'Çalışma zamanı', 'Uzun mola zamanı', 'Set tamamlandı 🎉']);
    assert.ok(/Çalışma 1\/4/.test(await text(page, '#pomo-label')));
    assert.ok(await page.locator('#view [data-act="focusstart"]').isDisabled());
    await advance(page, 1510);  // çalışma bitti -> kısa mola
    await page.waitForFunction(() => /Kısa mola/.test(document.querySelector('#pomo-label').textContent));
    assert.strictEqual(await text(page, '#pomo-clock'), '04:50');
    let sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('spy.sessions')));
    assert.deepStrictEqual([sessions.length, sessions[0].kind, sessions[0].duration], [1, 'pomodoro', 1500]);
    // uygulama kapanıp açılsın: durum saklanmış olmalı ve arada geçen süre işlenmeli
    await advance(page, 2000);
    const saved = await page.evaluate(() => ({ ls: JSON.stringify(localStorage), now: window.Native.raw._now }));
    const page2 = await open(browser, 'lang=tr', `(() => { const d = ${JSON.stringify(saved.ls)}; const o = JSON.parse(d); Object.keys(o).forEach(k => localStorage.setItem(k, o[k])); })()`);
    await page2.evaluate((n) => { window.Native.raw._now = n; window.onSpyResume(); }, saved.now);
    await nav(page2, 'focus');
    assert.ok(/Kısa mola/.test(await text(page2, '#pomo-label')), '2. çalışma da bitti, 2. mola sürüyor: ' + await text(page2, '#pomo-label'));
    sessions = await page2.evaluate(() => JSON.parse(localStorage.getItem('spy.sessions')));
    assert.strictEqual(sessions.filter((s) => s.kind === 'pomodoro').length, 2);
    await act(page2, 'pomoskip');
    assert.ok(/Çalışma 3\/4/.test(await text(page2, '#pomo-label')));
    await act(page2, 'pomopause');
    assert.strictEqual(await page2.evaluate(() => window.Native.raw._alarms.length), 0, 'duraklatınca alarmlar iptal');
    await act(page2, 'pomopause');
    assert.strictEqual(await page2.evaluate(() => window.Native.raw._alarms.length), 4);
    await advance(page2, 120);
    await act(page2, 'pomostop');
    sessions = await page2.evaluate(() => JSON.parse(localStorage.getItem('spy.sessions')));
    assert.strictEqual(sessions.filter((s) => s.kind === 'pomodoro').length, 3, 'yarım kalan tur (≥60 sn) kaydedilir');
    assert.ok(/Hazır/.test(await text(page2, '#pomo-label')));
    assert.deepStrictEqual(page.errors.concat(page2.errors), []);
    await page.context().close(); await page2.context().close();
  });

  await test('Spy sohbeti: 8 sorunun hepsi cevaplanır', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'spy');
    for (const a of ['daily', 'focus', 'top_app', 'distraction', 'vs_yesterday', 'week', 'best_hour', 'tip']) {
      await act(page, 'ask', a);
      await page.waitForFunction(() => !window.SpyApp.state.chatBusy);
    }
    const chat = await page.evaluate(() => window.SpyApp.state.chat);
    assert.strictEqual(chat.length, 16);
    chat.forEach((m) => assert.ok(m.text && !/undefined|NaN|\{\}/.test(m.text), m.text));
    assert.ok(/Bugün toplam .* aktif kullanım var/.test(chat[1].text));
    assert.ok(/Son 7 günde en verimli saatin \d\d:00–\d\d:00/.test(chat[13].text), chat[13].text);
    await page.context().close();
  });

  await test('Yönetim: kategori değiştirme anında işler ve geri alınır', async () => {
    const page = await open(browser, 'lang=tr');
    const before = await page.evaluate(() => window.SpyApp.state.today.cats.distraction);
    await nav(page, 'manage');
    await page.locator('#view [data-act="assign"][data-arg="com.example.notlar"]').first().click();
    await page.locator('.sheet [data-sact="pick"][data-arg="productive"]').click();
    assert.strictEqual(await page.evaluate(() => window.SpyApp.prefs.overrides['com.example.notlar']), 'productive');
    assert.ok(/senin kuralın/.test(await text(page, '#view')));
    assert.ok(/Sınıflandırılmamış öğe yok/.test(await text(page, '#view')));
    await act(page, 'mcat', 'distraction');
    await page.locator('#view [data-act="assign"][data-arg="com.instagram.android"]').click();
    await page.locator('.sheet [data-sact="pick"][data-arg="communication"]').click();
    const after = await page.evaluate(() => window.SpyApp.state.today.cats.distraction);
    assert.ok(after < before, 'Instagram artık eğlence sayılmıyor');
    // hazır kuralla aynı kategoriye geri alınca kullanıcı kuralı silinir
    await page.locator('#view [data-act="assign"][data-arg="com.instagram.android"]').click();
    await page.locator('.sheet [data-sact="pick"][data-arg="distraction"]').click();
    assert.strictEqual(await page.evaluate(() => window.SpyApp.prefs.overrides['com.instagram.android']), undefined);
    await act(page, 'mreset');
    await page.locator('.sheet [data-sact="ok"]').click();
    assert.deepStrictEqual(await page.evaluate(() => window.SpyApp.prefs.overrides), {});
    await page.context().close();
  });

  await test('Ayarlar: dil, hedef, takip, hariç tutma, saklama, temizleme', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'settings');
    await act(page, 'goal', '1');
    assert.strictEqual(await page.evaluate(() => window.SpyApp.prefs.goalHours), 5);
    await act(page, 'toggle', 'tracking');
    assert.ok(/Takip kapalı/.test(await text(page, '#top')));
    await act(page, 'toggle', 'tracking');
    await act(page, 'excluded');
    await page.locator('.sheet [data-sact="tog"][data-arg="com.zhiliaoapp.musically"]').click();
    await page.locator('.sheet [data-sact="ok"]').click();
    assert.ok(/1 uygulama kaydedilmiyor/.test(await text(page, '#view')));
    assert.ok(!(await page.evaluate(() => window.SpyApp.state.today.apps.some((a) => a.app === 'com.zhiliaoapp.musically'))));
    await act(page, 'retention');
    await page.locator('.sheet [data-sact="pick"][data-arg="30"]').click();
    assert.ok(/silinecek kayıt sayısı: 0/.test(await text(page, '.sheet')));
    await page.locator('.sheet [data-sact="ok"]').click();
    assert.strictEqual(await page.evaluate(() => window.SpyApp.prefs.retention), 30);
    await act(page, 'lang');
    await page.locator('.sheet [data-sact="pick"][data-arg="en"]').click();
    assert.strictEqual(await text(page, 'h1'), 'Settings');
    assert.ok(/1 apps are not recorded/.test(await text(page, '#view')));
    await act(page, 'clear');
    await page.locator('.sheet [data-sact="ok"]').click();
    assert.ok(/0 records stored/.test(await text(page, '#view')));
    await nav(page, 'general');
    assert.ok(/No records yet/.test(await text(page, '#view')));
    // ayarlar kalıcı mı?
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('spy.prefs')));
    assert.deepStrictEqual([stored.lang, stored.goalHours, stored.retention, stored.excluded], ['en', 5, 30, ['com.zhiliaoapp.musically']]);
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  await test('Dışa aktarma ve yedek: CSV, yedek dosyası, geri yükleme, bozuk dosya', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'settings');
    await act(page, 'export', '7');
    await page.waitForFunction(() => window._lastSaved && /\.csv$/.test(window._lastSaved.name));
    const csv = await page.evaluate(() => window._lastSaved.content);
    const lines = csv.trim().split('\r\n');
    assert.ok(lines[0].endsWith('Tarih,Uygulama,Paket,Kategori,Süre (sn),Süre'));
    assert.ok(lines.length > 50 && lines.every((l) => l.split(',').length >= 6));
    await act(page, 'accent', '#22c55e');
    await act(page, 'backup');
    await page.waitForFunction(() => /\.json$/.test(window._lastSaved.name));
    const backup = await page.evaluate(() => window._lastSaved.content);
    assert.strictEqual(JSON.parse(backup).prefs.accent, '#22c55e');
    await act(page, 'accent', '#ec4899');
    await page.evaluate((b) => { window._pickText = b; }, backup);
    await act(page, 'restore');
    await page.waitForFunction(() => window.SpyApp.prefs.accent === '#22c55e');
    await page.evaluate(() => { window._pickText = '{"hello":1}'; });
    await act(page, 'restore');
    await page.waitForSelector('.toast:has-text("Spy yedeği değil")');
    await page.evaluate(() => { window._pickText = JSON.stringify({ app: 'spy-mobile', prefs: { accent: 'javascript:1', goalHours: 99, retention: 7, overrides: { a: 'nope', b: 'life' }, excluded: 'x', onboarded: false } }); });
    await act(page, 'restore');
    await page.waitForFunction(() => window.SpyApp.prefs.overrides.b === 'life');
    const p = await page.evaluate(() => window.SpyApp.prefs);
    assert.deepStrictEqual([p.accent, p.goalHours, p.retention, p.overrides, p.excluded], ['#7c4dff', 12, 0, { b: 'life' }, []], 'geçersiz değerler temizlenir');
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  await test('Lisans: deneme, geçersiz anahtar, süre dolunca takip durur', async () => {
    const page = await open(browser, 'lang=tr');
    await nav(page, 'settings');
    assert.ok(/Deneme sürümü · 3 gün kaldı/.test(await text(page, '#view')));
    await act(page, 'license');
    await page.fill('#lic-key', 'SPY-AEAQCA-IBAEAQ-CAIH3K-UHMPQM-UJ5JIC-W2BTZM-EC7URA-RQV4GM-Y5XEDS-XYHQSM-XH2ZBW-C4JWEX-NZUPYV-2GNCEU-VA7CRF-6DKXUX-K2RJQA-JB5M6F-2IAAZN-2AW');
    await page.locator('.sheet [data-sact="ok"]').click();
    assert.ok(/Lisans anahtarı geçersiz/.test(await text(page, '#lic-err')), 'başka anahtarla imzalanmış anahtar reddedilir');
    await page.locator('.sheet [data-sact="cancel"]').click();
    await advance(page, 86400 * 3 + 60);
    await page.evaluate(() => window.onSpyResume());
    assert.ok(/Deneme bitti/.test(await text(page, '#top')));
    assert.ok(/Takip durduruldu \(lisans gerekli\)/.test(await text(page, '#view')));
    await nav(page, 'general');
    assert.ok(/Deneme süresi doldu/.test(await text(page, '#view')));
    assert.strictEqual(await page.evaluate(() => window.SpyApp.state.license.state), 'expired');
    // tarayıcı önizlemesindeki SHA-512, Java'dakiyle aynı sonucu vermeli (bilinen test vektörü)
    const digest = await page.evaluate(() => Array.from(window.Native.sha512js(new TextEncoder().encode('abc'))).map((b) => b.toString(16).padStart(2, '0')).join(''));
    assert.strictEqual(digest, require('crypto').createHash('sha512').update('abc').digest('hex'));
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  await test('İlk açılış: izin yokken karşılama ve izin şeridi; veri yokken boş durumlar', async () => {
    const page = await open(browser, 'lang=tr&demo=noaccess');
    assert.ok(/Spy’a hoş geldin/.test(await text(page, '.sheet')));
    assert.strictEqual(await page.evaluate(() => window.onSpyBack()), true, 'karşılama geri tuşuyla kapanmaz ama tuş işlenir');
    assert.strictEqual(await page.locator('.sheet').count(), 1);
    await page.locator('.sheet [data-sact="later"]').click();
    assert.ok(/Kullanım erişimi gerekli/.test(await text(page, '#view')));
    assert.ok(/İzin gerekli/.test(await text(page, '#top')));
    for (const id of ['analysis', 'timeline', 'focus', 'spy', 'manage', 'settings']) await page.evaluate((p) => window.SpyApp.go(p), id);
    await nav(page, 'spy');
    await act(page, 'ask', 'daily');
    await page.waitForFunction(() => !window.SpyApp.state.chatBusy);
    assert.ok(/henüz yeterli kullanım verim yok/.test(await text(page, '#chat')));
    assert.strictEqual(await page.evaluate(() => window.onSpyBack()), true, 'geri: Genel sayfasına döner');
    assert.strictEqual(await page.evaluate(() => window.SpyApp.state.page), 'general');
    assert.strictEqual(await page.evaluate(() => window.onSpyBack()), false, 'Genel sayfasında geri: uygulama arka plana gider');
    await act(page, 'grant');   // önizlemede izin verilmiş sayılır
    await page.waitForFunction(() => window.SpyApp.state.access === true);
    assert.ok(!/Kullanım erişimi gerekli/.test(await text(page, '#view')));
    assert.deepStrictEqual(page.errors, []);
    await page.context().close();
  });

  await browser.close();
  console.log('\n' + passed + ' arayüz testi geçti.');
})().catch((e) => { console.error(e); process.exit(1); });
