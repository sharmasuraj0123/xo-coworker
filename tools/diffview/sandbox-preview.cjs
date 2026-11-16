// tools/diffview/sandbox-preview.cjs <url>: the HTML preview with scripts, sealed off (owner/coordinator, 5 Nov)
// The HTML preview running its own scripts, sealed off from XO. On adrm's os-animation.html: does it play
// (frames differ, no "Blocked script execution"), and what can a script inside reach (run in the frame's
// own world, as the page's scripts are)? Every non-GET request is aborted in the browser.
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const url = process.argv[2] || 'http://127.0.0.1:5262/';
const crypto = require('node:crypto');
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => { try { localStorage.setItem('xo-probe-secret', 'parent-only'); document.cookie = 'xoprobe=parent-only; path=/'; } catch {} });
  const page = await ctx.newPage();
  const blocked = [], apiFromFrame = [], consoleErr = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErr.push(m.text()); });
  page.on('response', (r) => { if (/\/api\/xo-projects\/?$|probe-from-frame/.test(r.url())) apiFromFrame.push(`${r.status()} ${r.url().split('/api/')[1]}`); });
  await page.route('**/*', (r) => { const q = r.request(); if (q.method() !== 'GET' && q.method() !== 'HEAD') { blocked.push(q.method() + ' ' + q.url().split('/api/')[1]); return r.abort(); } return r.continue(); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!document.querySelector('#projects .prow')).catch(() => false)); i++) await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('[data-go="p:adrm"]')?.click()); await page.waitForTimeout(1500);
  await page.evaluate(() => { const b = document.querySelector('[data-stage-toggle]'); if (b && document.getElementById('stage').hidden) b.click(); }); await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-open-files]')?.click()); await page.waitForTimeout(1500);
  for (let i = 0; i < 60 && !(await page.evaluate(() => !!document.querySelector('[data-fl-file="os-animation.html"]'))); i++) await page.waitForTimeout(250);
  await page.evaluate(() => document.querySelector('[data-fl-file="os-animation.html"]')?.click()); await page.waitForTimeout(3000);
  const sandbox = await page.evaluate(() => document.querySelector('.vw-frame')?.getAttribute('sandbox'));
  const frame = page.frames().find((f) => f !== page.mainFrame() && f.url() === 'about:srcdoc');
  const shot = async () => crypto.createHash('sha1').update(await page.locator('.vw-frame').screenshot()).digest('hex').slice(0, 10);
  const s1 = await shot(); await page.waitForTimeout(1200); const s2 = await shot(); await page.waitForTimeout(1200); const s3 = await shot();
  const blockedScripts = consoleErr.filter((t) => /Blocked script execution/.test(t)).length;
  console.log(JSON.stringify({ url, sandbox, frame: !!frame, plays: new Set([s1, s2, s3]).size > 1, frames: [s1, s2, s3], blockedScriptErrors: blockedScripts }));
  if (frame) {
    const reach = await frame.evaluate(async () => {
      const t = (f) => { try { const v = f(); return v === undefined ? 'undefined' : String(v).slice(0, 60); } catch (e) { return 'blocked: ' + e.name; } };
      const out = {
        origin: String(self.origin),
        parentDocument: t(() => parent.document.title),
        parentStorage: t(() => parent.localStorage.getItem('xo-probe-secret')),
        topHref: t(() => top.location.href),
        cookie: t(() => document.cookie),
        localStorage: t(() => localStorage.getItem('xo-probe-secret')),
        sessionStorage: t(() => sessionStorage.length),
        indexedDB: await new Promise((r) => { try { const q = indexedDB.open('x'); q.onsuccess = () => r('opened'); q.onerror = () => r('blocked: ' + (q.error && q.error.name)); } catch (e) { r('blocked: ' + e.name); } }),
        popup: t(() => window.open('about:blank') === null ? 'null (no popup)' : 'a window opened'),
      };
      try { const r = await fetch('/api/xo-projects', { credentials: 'include' }); out.fetchApi = `read ${r.status}`; } catch (e) { out.fetchApi = 'blocked: ' + e.name; }
      try { const r = await fetch('/api/xo-projects', { mode: 'no-cors', credentials: 'include' }); out.fetchApiNoCors = `opaque: ${r.type}, nothing readable`; } catch (e) { out.fetchApiNoCors = 'blocked: ' + e.name; }
      try { top.location.href = 'about:blank#probe'; out.topNavigate = 'no error'; } catch (e) { out.topNavigate = 'blocked: ' + e.name; }
      try { const f = document.createElement('form'); f.action = '/api/xo-projects'; f.method = 'post'; document.body.appendChild(f); f.submit(); out.form = 'submitted?'; } catch (e) { out.form = 'blocked: ' + e.name; }
      return out;
    });
    await page.waitForTimeout(800);
    console.log(JSON.stringify(reach, null, 1));
    console.log(JSON.stringify({ mainPageStill: page.url(), apiResponsesSeenForFrameCalls: apiFromFrame, blockedWrites: blocked }));
  }
  // other files: Markdown and text don't use the frame
  for (const f of ['AGENTS.md', 'nginx.conf']) {
    await page.evaluate((f) => document.querySelector(`[data-fl-file="${f}"]`)?.click(), f); await page.waitForTimeout(1500);
    console.log(f, JSON.stringify(await page.evaluate(() => ({ frame: !!document.querySelector('.vw-frame'), markdown: !!document.querySelector('#viewer .md, #viewer .prose, #viewer .vw-md'), code: !!document.querySelector('#viewer diffs-container, #viewer .vw-code, #viewer pre') }))));
  }
  await browser.close();
})();
