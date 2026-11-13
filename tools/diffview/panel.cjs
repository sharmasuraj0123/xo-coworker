// P1's browser harness: the app on a thread's preview port, read-only (every non-GET is aborted in the
// browser), with Space's /changes answered by tools/diffview/fake-changes.cjs from a real worktree until
// xo-space ships the route. Opens a thread, the panel, and shoots or measures.
//
//   node tools/diffview/panel.cjs <base url> <out dir> [scene…]
//   THREAD=cmsg_… WT=<worktree dir> BASE=<git base> THEMES=dark,light W=1440 H=900 DPR=2
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const path = require('node:path');
const { mkdirSync, writeFileSync } = require('node:fs');
const { changesFor } = require('./fake-changes.cjs');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const URL = process.argv[2] || 'http://127.0.0.1:5262/';
const OUT = process.argv[3] || '/tmp/p1';
const SCENES = process.argv.slice(4);
const THREAD = process.env.THREAD || 'cmsg_deadce65e4fe4027';
const WT = process.env.WT || `/home/coder/xo-coworker/.xo/worktrees/thread-${THREAD}`;
const BASE = process.env.BASE || '1088c48^';
const W = +process.env.W || 1440, H = +process.env.H || 900, DPR = +process.env.DPR || 2;
const FAKE = process.env.FAKE !== '0';

exports.open = async function open(theme, { width = W, height = H, dpr = DPR, mobile = false, ls = {} } = {}) {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, colorScheme: theme, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(([t, ls]) => { try { localStorage.setItem('cv-theme', t); for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v); } catch {} }, [theme, ls]);
  const page = await ctx.newPage();
  const log = { blocked: [], errors: [], changes: 0 };
  page.on('pageerror', (e) => log.errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource/.test(m.text())) log.errors.push('console: ' + m.text()); });
  await page.route('**/*', (r) => {
    const req = r.request(), u = new globalThis.URL(req.url());
    if (req.method() !== 'GET' && req.method() !== 'HEAD') { log.blocked.push(req.method() + ' ' + u.pathname); return r.abort(); }
    if (FAKE && /\/api\/xo-projects\/[^/]+\/changes$/.test(u.pathname)) {
      log.changes++;
      const wt = u.searchParams.get('worktree'), p = u.searchParams.get('path');
      if (!wt) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ root: '', files: [], total_files: 0, computed_at: new Date().toISOString() }) });
      const body = changesFor(wt === `thread-${THREAD}` ? WT : path.join(path.dirname(WT), wt), BASE, { root: `.xo/worktrees/${wt}`, path: p });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    }
    return r.continue();
  });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 100; i++) {
    if (await page.evaluate(() => !!document.querySelector('#projects .prow') && !/Connecting/i.test(document.querySelector('#herald')?.innerText || '')).catch(() => false)) break;
    await page.waitForTimeout(150);
  }
  return { browser, ctx, page, log };
};

/** Open a thread (through its project's list, as a person would). */
exports.thread = async function thread(page, id = THREAD, project = 'xo-coworker') {
  await page.evaluate((p) => document.querySelector(`[data-go="p:${p}"]`)?.click(), project);
  await page.waitForTimeout(1200);
  const ok = await page.evaluate((id) => { const b = document.querySelector(`[data-go="t:${id}"]`); if (b) { b.click(); return true; } return false; }, id);
  if (!ok) throw new Error(`no row for t:${id} in the project's lists`);
  await page.waitForTimeout(2500);
};
exports.panel = async function panel(page) {
  const open = await page.evaluate(() => !document.getElementById('stage')?.hidden);
  if (!open) await page.evaluate(() => document.querySelector('[data-stage-toggle]')?.click());
  await page.waitForTimeout(1500);
};

if (require.main === module) (async () => {
  mkdirSync(OUT, { recursive: true });
  const themes = (process.env.THEMES || 'dark,light').split(',');
  for (const theme of themes) {
    const { browser, page, log } = await exports.open(theme);
    await exports.thread(page);
    await exports.panel(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, `p1-panel-${theme}.png`) });
    const info = await page.evaluate(() => {
      const st = document.getElementById('stage'), r = st.getBoundingClientRect();
      const rows = [...st.querySelectorAll('.cx-r')].map((b) => b.innerText.replace(/\n/g, ' '));
      const chips = [...document.querySelectorAll('.tb-cf')].map((c) => c.innerText.replace(/\n/g, ' ')).slice(-8);
      return { width: Math.round(r.width), rows, chips, head: st.querySelector('[data-fr="changes"] .fr-h')?.innerText.replace(/\n/g, ' ') };
    });
    console.log(theme, JSON.stringify(info), JSON.stringify(log));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
