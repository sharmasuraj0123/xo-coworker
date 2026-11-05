// P0's numbers for js/diffview.js, in this machine's headless Chrome, at 1× and with the CPU slowed 4×.
// It opens tools/diffview/lab.html on a thread's preview port, draws real patches from this repo (Astra's
// re-audit, 1088c48: app.js is a 3,155-line file), and reports: what loads before a diff is asked for, the
// first draw of a session, a warm draw, long tasks, and whether the syntax colours match XO's code tokens.
//
//   node tools/diffview/measure.cjs http://127.0.0.1:5262 [out.json] [shots-dir]
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const { execFileSync } = require('node:child_process');
const { writeFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.argv[2] || 'http://127.0.0.1:5262';
const OUT = process.argv[3];
const SHOTS = process.argv[4];
const REPO = path.resolve(__dirname, '../..');

// git's patch per file, exactly as Space's /changes sends it
const patch = (f) => execFileSync('git', ['-c', 'core.quotePath=false', 'diff', '-p', '-M', '--no-relative', '--no-color', '--no-ext-diff', '--src-prefix=a/', '--dst-prefix=b/', '1088c48^', '1088c48', '--', f], { cwd: REPO, encoding: 'utf8' });
const P = Object.fromEntries(['js/app.js', 'js/follow.js', 'css/app.css', 'js/markdown.js'].map((f) => [f, patch(f)]));
const whole = execFileSync('git', ['show', '1088c48:js/app.js'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 26 });

async function run(cpu, theme) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: SHOTS ? 2 : 1 });
  const page = await ctx.newPage();
  const fetched = [];
  page.on('request', (r) => fetched.push(r.url().replace(BASE, '')));
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${BASE}/tools/diffview/lab.html`);
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.waitForFunction(() => window.labReady);
  await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false }); });
  const before = fetched.filter((u) => u.includes('pierre-diffs')).length;
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });

  // one diff: time to its rows, time to its colour, and the long tasks while it drew
  const draw = (file, opts = {}) => page.evaluate(async ([file, p, opts]) => {
    window.__lt.length = 0;
    const host = window.lab.card(file);
    const t0 = performance.now();
    await window.D.diff(host, p, { path: file, ...opts });
    const root = () => host.querySelector('diffs-container')?.shadowRoot;
    const rows = () => root()?.querySelectorAll('[data-line]').length || 0;
    const coloured = () => [...(root()?.querySelectorAll('[data-line] span[style]') || [])].some((s) => /--diffs-token-/.test(s.getAttribute('style')));
    let tRows = null, tColour = null;
    for (let i = 0; i < 600 && (tRows == null || tColour == null); i++) {
      if (tRows == null && rows()) tRows = performance.now() - t0;
      if (tColour == null && coloured()) tColour = performance.now() - t0;
      if (tRows == null || tColour == null) await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => setTimeout(r, 50));
    return { rows: tRows && Math.round(tRows), colour: tColour && Math.round(tColour), lines: rows(), longTasks: [...window.__lt] };
  }, [file, P[file], opts]);

  const r = { cpu, theme, fetchedBeforeAsked: before };
  r.coldFirstDiff = await draw('js/follow.js');           // no prefetch: library, grammar and its patterns
  r.fetchedForFirst = fetched.filter((u) => u.includes('pierre-diffs')).length;
  r.coldBigFile = await draw('js/app.js');                 // 3,155 lines, +16 −13: more of the grammar compiles
  r.cssCold = await draw('css/app.css');                   // a language not yet loaded: rows at once, colour after
  // the product's path: a place with changes opens, and prefetch() warms the library and each language with
  // the patches /changes sent, while the browser is idle; then you click
  await page.evaluate(() => window.lab.clear());
  await page.goto(`${BASE}/tools/diffview/lab.html`);
  await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await page.waitForFunction(() => window.labReady);
  await page.evaluate(() => { window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: false }); });
  await page.evaluate((items) => { window.__lt.length = 0; window.D.prefetch(items); }, ['js/follow.js', 'css/app.css'].map((f) => ({ path: f, patch: P[f] })));
  await page.waitForTimeout(cpu > 1 ? 6000 : 2500);
  r.prefetchLongTasks = await page.evaluate(() => [...window.__lt]);
  r.warmFirstClick = await draw('js/app.js');              // the first click of the session
  r.warmSmall = await draw('js/follow.js');
  r.warmCss = await draw('css/app.css');
  r.warmBigFileAgain = await draw('js/app.js');
  // a whole file of 3,155 lines: rows at once, colour from the worker
  r.wholeFile = await page.evaluate(async (text) => {
    window.__lt.length = 0;
    const host = window.lab.card('app.js (whole file)');
    const t0 = performance.now();
    await window.D.file(host, text, { path: 'js/app.js' });
    const root = () => host.querySelector('diffs-container')?.shadowRoot;
    let tRows = null, tColour = null;
    for (let i = 0; i < 3000 && (tRows == null || tColour == null); i++) {
      if (tRows == null && root()?.querySelector('[data-line]')) tRows = performance.now() - t0;
      if (tColour == null && [...(root()?.querySelectorAll('[data-line] span[style]') || [])].slice(0, 50).some((s) => /--diffs-token-/.test(s.getAttribute('style')))) tColour = performance.now() - t0;
      if (tRows == null || tColour == null) await new Promise((r) => setTimeout(r, 5));
    }
    return { rows: tRows && Math.round(tRows), colour: tColour && Math.round(tColour), longTasks: [...window.__lt] };
  }, whole);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });

  // the syntax colours, as drawn, against XO's code tokens in this theme
  r.theme = await page.evaluate(async () => {
    const T = await import('/js/diffthemes.js');
    const t = document.documentElement.dataset.theme === 'light' ? T.XO_LIGHT : T.XO_DARK;
    const probe = document.createElement('i'); document.body.appendChild(probe);
    const hex = (c) => '#' + c.match(/[\d.]+/g).slice(0, 3).map((x) => Math.round(+x * (c.startsWith('color(') ? 255 : 1)).toString(16).padStart(2, '0')).join('').toUpperCase();
    const out = {};
    for (const k of ['ink', 'com', 'kw', 'str', 'num', 'fn', 'bi', 'prop', 'tag', 'pun', 'var', 'add', 'del', 'bg']) { probe.style.color = `var(--code-${k})`; out[k] = hex(getComputedStyle(probe).color); }
    probe.remove();
    const mine = { ink: t.colors['editor.foreground'], bg: t.colors['editor.background'] };
    for (const tc of t.tokenColors) { const key = { comment: 'com', keyword: 'kw', string: 'str', 'constant.numeric': 'num', 'entity.name.function': 'fn', 'support.class': 'bi', 'variable.other.property': 'prop', 'entity.name.tag': 'tag', 'keyword.operator': 'pun', 'variable.parameter': 'var', 'markup.inserted': 'add', 'markup.deleted': 'del' }[[].concat(tc.scope || [])[0]]; if (key) mine[key] = tc.settings.foreground; }
    // within 1 of 255 a channel: the page serialises color-mix() to six digits before this rounds it
    const near = (a, b) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 1);
    const off = Object.keys(out).filter((k) => !mine[k] || !near(out[k], mine[k])).map((k) => `${k}: page ${out[k]} theme ${mine[k]}`);
    return { matches: !off.length, off };
  });
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await page.evaluate(() => { window.lab.clear(); });
    await draw('js/follow.js'); await draw('css/app.css');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `p0-diffs-${theme}.png`), fullPage: true });
  }
  await browser.close();
  return r;
}

(async () => {
  const all = [];
  for (const theme of ['dark', 'light']) all.push(await run(1, theme));
  all.push(await run(4, 'dark'));
  console.log(JSON.stringify(all, null, 1));
  if (OUT) writeFileSync(OUT, JSON.stringify(all, null, 1) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
