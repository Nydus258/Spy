/* Google Play mağaza görselleri: `NODE_PATH=$(npm root -g) node store/make_graphics.js`
 * Çıktı: store/graphics/{icon-512.png, tr|en/feature-1024x500.png, tr|en/phone-*.png (1080x1920)} */
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const WWW = 'file://' + path.resolve(__dirname, '../assets/www/index.html');
const OUT = path.resolve(__dirname, 'graphics');
const NOW = Math.floor(new Date(2026, 10, 11, 21, 30).getTime() / 1000);
const EYE = (w) => `<svg viewBox="0 0 108 108" width="${w}" height="${w}"><defs><radialGradient id="g" cx=".4" cy=".35" r=".83"><stop offset="0" stop-color="#3D3496"/><stop offset="1" stop-color="#1A1550"/></radialGradient></defs>
<rect width="108" height="108" fill="url(#g)"/><path fill="#E6E0FF" d="M25,54 Q54,22 83,54 Q54,86 25,54 Z"/><circle cx="54" cy="54" r="14.5" fill="#1A1442"/>
<path fill="none" stroke="#7C4DFF" stroke-width="3" stroke-linecap="round" d="M54,42.5 A11.5,11.5 0 1,1 42.5,54"/>
<path fill="none" stroke="#34D399" stroke-width="3" stroke-linecap="round" d="M42.5,54 A11.5,11.5 0 0,0 54,65.5 A11.5,11.5 0 0,0 62,62"/>
<circle cx="54" cy="54" r="6.5" fill="#0B0827"/><circle cx="56.5" cy="51.5" r="2.6" fill="#fff"/></svg>`;
const EYE_BARE = `<svg viewBox="0 0 108 70" width="300"><path fill="#E6E0FF" d="M10,35 Q54,-9 98,35 Q54,79 10,35 Z"/><circle cx="54" cy="35" r="19" fill="#1A1442"/>
<path fill="none" stroke="#7C4DFF" stroke-width="3.6" stroke-linecap="round" d="M54,20.5 A14.5,14.5 0 1,1 39.5,35"/>
<path fill="none" stroke="#34D399" stroke-width="3.6" stroke-linecap="round" d="M39.5,35 A14.5,14.5 0 0,0 54,49.5 A14.5,14.5 0 0,0 64,46"/>
<circle cx="54" cy="35" r="8.2" fill="#0B0827"/><circle cx="57.2" cy="31.8" r="3.3" fill="#fff"/></svg>`;
const COPY = {
  tr: { title: 'Spy: Odak ve Ekran Süresi', tag: 'Telefonunda zamanın nereye gittiğini gör, odağını koru.', pts: ['Uygulama başına süre', 'Odak oturumu ve Pomodoro', 'Veriler telefonunda kalır'] },
  en: { title: 'Spy: Focus & Screen Time', tag: 'See where your phone time goes and keep your focus.', pts: ['Time per app', 'Focus sessions and Pomodoro', 'Your data stays on your phone'] }
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });

  let page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(`<body style="margin:0">${EYE(512)}</body>`);
  await page.screenshot({ path: path.join(OUT, 'icon-512.png') });
  await page.close();

  for (const lang of ['tr', 'en']) {
    const dir = path.join(OUT, lang);
    fs.mkdirSync(dir, { recursive: true });
    const c = COPY[lang];
    page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
    await page.setContent(`<body style="margin:0;width:1024px;height:500px;overflow:hidden;font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;color:#fff;
      background:radial-gradient(900px 600px at 20% 30%,#3D3496,#1A1550 70%,#0B0F1A);display:flex;align-items:center">
      <div style="flex:none;width:400px;display:flex;justify-content:center">${EYE_BARE}</div>
      <div style="flex:1;padding-right:48px"><div style="font-size:60px;font-weight:800;letter-spacing:-1px;line-height:1.05">${c.title}</div>
      <div style="margin-top:16px;font-size:24px;color:#cfc8ff;line-height:1.3">${c.tag}</div>
      <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap">${c.pts.map((p) => `<span style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:7px 14px;font-size:17px">${p}</span>`).join('')}</div></div></body>`);
    await page.screenshot({ path: path.join(dir, 'feature-1024x500.png') });
    await page.close();

    // telefon ekran görüntüleri: 360x640 CSS px x3 = 1080x1920
    const shot = async (name, prepare) => {
      const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
      const p = await ctx.newPage();
      p.on('pageerror', (e) => { throw e; });
      await p.goto(WWW + '?lang=' + lang + '&now=' + NOW);
      await p.waitForSelector('#nav button');
      await p.evaluate(() => { const s = document.querySelector('#splash'); if (s) s.remove(); });
      if (prepare) await prepare(p);
      await p.waitForTimeout(900);
      await p.screenshot({ path: path.join(dir, 'phone-' + name + '.png') });
      await ctx.close();
    };
    const go = (id) => (p) => p.evaluate((x) => window.SpyApp.go(x), id);
    await shot('1-general', go('general'));
    await shot('2-analysis', go('analysis'));
    await shot('3-timeline', go('timeline'));
    await shot('4-focus', async (p) => { await go('focus')(p); await p.locator('#view [data-act="pomostart"]').first().click(); await p.waitForTimeout(4200); await p.evaluate(() => { document.querySelector('#view').scrollTop = 0; }); });
    await shot('5-spy', async (p) => { await go('spy')(p); await p.locator('#view [data-act="ask"]').first().click(); await p.waitForTimeout(2500); });
    await shot('6-manage', go('manage'));
  }
  await browser.close();
  console.log('tamam: ' + OUT);
})();
