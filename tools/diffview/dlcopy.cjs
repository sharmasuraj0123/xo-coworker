// Download and Copy in Files, on a file of a project (the owner, 5 Nov: adrm's os-animation.html). FILE=, PROJ=, MODE=preview|source, THEME=, PHONE=1
//   node tools/diffview/dlcopy.cjs <url>
// Owner's bug: Download and Copy on adrm's os-animation.html in the full-file view (live). Desktop or phone,
// Preview or Source. Reports what each click does: a download event, the clipboard's text, errors.
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const url = process.argv[2] || 'http://127.0.0.1:3000/';
const theme = process.env.THEME || 'dark', phone = !!process.env.PHONE, mode = process.env.MODE || 'preview';
const FILE = process.env.FILE || 'os-animation.html', PROJ = process.env.PROJ || 'adrm';
(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: theme, isMobile: phone, hasTouch: phone, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(url).origin });
  await ctx.addInitScript((t) => { try { localStorage.setItem('cv-theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  const log = { errors: [], blocked: [], requests: [] };
  page.on('pageerror', (e) => log.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') log.errors.push('console: ' + m.text()); });
  await page.route('**/*', (r) => { const q = r.request(); if (q.method() !== 'GET' && q.method() !== 'HEAD') { log.blocked.push(q.method() + ' ' + q.url()); return r.abort(); } if (/download/.test(q.url())) log.requests.push(q.url().split('/api/')[1]); return r.continue(); });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 100 && !(await page.evaluate(() => !!document.querySelector('#projects .prow')).catch(() => false)); i++) await page.waitForTimeout(150);
  await page.evaluate((p) => document.querySelector(`[data-go="p:${p}"]`)?.click(), PROJ); await page.waitForTimeout(1500);
  // open the file through the API path the app uses: the viewer, from Files
  await page.evaluate(() => { const b = document.querySelector('[data-stage-toggle]'); if (b && document.getElementById('stage').hidden) b.click(); });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('[data-open-files]')?.click()); await page.waitForTimeout(1500);
  // a file in a folder: open its folders first
  const parts = FILE.split('/'); for (let i = 1; i < parts.length; i++) { await page.evaluate((d) => { const b = document.querySelector(`[data-fl-dir="${d}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }, parts.slice(0, i).join('/')); await page.waitForTimeout(900); }
  const ok = await page.evaluate((f) => { const b = document.querySelector(`[data-fl-file="${f}"]`); if (b) { b.click(); return true; } return false; }, FILE);
  await page.waitForTimeout(2500);
  if (mode === 'source') { await page.evaluate(() => document.querySelector('[data-vw-mode="source"]')?.click()); await page.waitForTimeout(1200); }
  const state = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], visible: e.checkVisibility(), hit: (() => { const x = b.left + b.width / 2, y = b.top + b.height / 2; const h = document.elementFromPoint(x, y); return h ? (h.closest(s) ? 'itself' : (h.id || h.className || h.tagName).toString().slice(0, 40)) : 'nothing'; })() }; };
    return { opened: !!document.querySelector('#viewer:not([hidden])'), body: [...document.body.classList].filter((c) => /files|dock|sheet|fv-|viewer/.test(c)).join(' '), save: r('[data-vw-download]'), copy: r('[data-vw-copy]'), vwInert: !!document.getElementById('viewer')?.closest('[inert]'), mode: document.querySelector('[data-vw-mode][aria-pressed="true"]')?.dataset.vwMode };
  });
  console.log(`${FILE} ${phone ? 'phone' : 'desktop'} ${theme} ${mode} opened:${ok}`, JSON.stringify({ body: state.body, save: state.save && state.save.hit, copy: state.copy && state.copy.hit }));
  // Copy
  await page.evaluate(() => navigator.clipboard.writeText('(before)'));
  if (state.copy) { const b = state.copy.box; await page.mouse.click((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); await page.waitForTimeout(600); }
  const clip = await page.evaluate(async () => { try { return (await navigator.clipboard.readText()).slice(0, 40); } catch (e) { return 'read failed: ' + e.message; } });
  console.log('  copy → clipboard:', JSON.stringify(clip), '| button says:', await page.evaluate(() => { const b = document.querySelector('[data-vw-copy]'); return b ? `${b.getAttribute('aria-label')}${b.querySelector('.tk') ? ' ✓' : ''}` : null; }));
  // Download
  let dl = null;
  page.once('download', (d) => { dl = d.suggestedFilename(); });
  if (state.save) { const b = state.save.box; await page.mouse.click((b[0] + b[2]) / 2, (b[1] + b[3]) / 2); await page.waitForTimeout(2500); }
  console.log('  download →', dl || 'no download event', '| requests', JSON.stringify(log.requests), '| head error', JSON.stringify(await page.evaluate(() => document.querySelector('.vw-err, .vw-save-err, [class*="err"]')?.innerText?.slice(0, 80) || null)));
  console.log('  errors', JSON.stringify(log.errors.slice(0, 4)));
  await page.screenshot({ path: `/tmp/fv/dlcopy-${phone ? 'phone' : 'desk'}-${theme}-${mode}.png` });
  await browser.close();
})();
