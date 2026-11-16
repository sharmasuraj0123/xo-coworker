// Whole rows in the panel with lists longer than their room.   FAKE=0 THEME=light SIZE=390x844 node tools/diffview/rows-long.cjs <url>
// Lists longer than their room, made by cloning rows in the page (the live data has two agents): Agents at
// its 3 rows, Agents taking the room that's left (Changes and Map folded), the touched-files list of a
// project that isn't a git repository. Cut rows at rest and after a wheel.
const H = require('./panel.cjs');
const url = process.argv[2] || 'http://127.0.0.1:5262/';
const theme = process.env.THEME || 'dark';
const [w, h] = (process.env.SIZE || '1440x900').split('x').map(Number);
const check = () => {
  const st = document.getElementById('stage');
  const clipOf = (e) => { for (let p = e.parentElement; p && p !== st; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowY)) return p; } return st; };
  const cut = [], per = {};
  for (const r of st.querySelectorAll('.ag-r, .ch-r, .cx-r, .cx-more')) {
    if (!r.checkVisibility()) continue;
    const a = r.getBoundingClientRect(); let top = a.top, bot = a.bottom;
    for (let p = clipOf(r); p; p = p === st ? null : clipOf(p)) { const b = p.getBoundingClientRect(); top = Math.max(top, b.top); bot = Math.min(bot, b.bottom); }
    const shown = Math.max(0, bot - top), fr = r.closest('[data-fr]').dataset.fr;
    if (shown > 0.5) per[fr] = (per[fr] || 0) + (shown >= a.height - 0.5 ? 1 : 0);
    if (shown > 0.5 && shown < a.height - 0.5) cut.push(`${fr} ${Math.round(shown)}/${Math.round(a.height)}`);
  }
  const fh = {}; for (const f of st.querySelectorAll('[data-fr]')) if (!f.hidden) fh[f.dataset.fr] = `${Math.round(f.getBoundingClientRect().height)}${f.classList.contains('is-grow') ? ' grow' : ''}${f.classList.contains('is-folded') ? ' folded' : ''}`;
  return { frames: fh, wholeRowsShown: per, cut };
};
const clone = ([sel, n]) => { const ul = document.querySelector(sel); const li = ul.querySelector('li'); for (let i = 0; i < n; i++) ul.appendChild(li.cloneNode(true)); return ul.children.length; };
(async () => {
  const { browser, page, log } = await H.open(theme, { width: w, height: h, dpr: 1, mobile: w < 760, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
  const wheel = async (sel, label) => {
    const b = await page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + 20 }; }, sel);
    await page.mouse.move(b.x, b.y); await page.mouse.wheel(0, 70); await page.waitForTimeout(900);
    console.log(label, 'after a wheel', JSON.stringify(await page.evaluate(check)));
  };
  // Agents at its 3 rows, with 8
  await page.evaluate(() => document.querySelector('[data-go="p:xo-coworker"]')?.click()); await page.waitForTimeout(3000);
  await page.evaluate(clone, ['[data-fr="agents"] .ag-list', 6]);
  await page.waitForTimeout(300);
  console.log('agents, 8 of them', JSON.stringify(await page.evaluate(check)));
  await page.screenshot({ path: `/tmp/agcut3-agents8-${theme}-${w}.png` });
  await wheel('[data-fr="agents"] .fr-b', 'agents, 8 of them');
  // Agents taking the room that's left
  for (const id of ['changes', 'map']) await page.evaluate((id) => document.querySelector(`[data-fr-fold="${id}"]`).click(), id);
  await page.waitForTimeout(500);
  await page.evaluate(clone, ['[data-fr="agents"] .ag-list', 14]);
  await page.waitForTimeout(300);
  console.log('agents growing, 22', JSON.stringify(await page.evaluate(check)));
  await page.screenshot({ path: `/tmp/agcut3-agentsgrow-${theme}-${w}.png` });
  await wheel('[data-fr="agents"] .fr-b', 'agents growing, 22');
  for (const id of ['changes', 'map']) await page.evaluate((id) => document.querySelector(`[data-fr-fold="${id}"]`).click(), id);
  // touched files, in a project that isn't a git repository
  await page.evaluate(() => document.querySelector('[data-go="p:human-ai-interaction"]')?.click()); await page.waitForTimeout(1500);
  const t = 't:cmsg_27184f14987b4ee3';
  await page.evaluate((t) => document.querySelector(`[data-go="${t}"]`)?.click(), t); await page.waitForTimeout(4000);
  const n = await page.evaluate(() => { const ul = document.querySelector('.ch-old:not([hidden]) .ch-list'); if (!ul) return 0; const li = ul.querySelector('li'); for (let i = 0; i < 24; i++) ul.appendChild(li.cloneNode(true)); return ul.children.length; });
  await page.waitForTimeout(300);
  console.log(`touched files, ${n}`, JSON.stringify(await page.evaluate(check)));
  await page.screenshot({ path: `/tmp/agcut3-touched-${theme}-${w}.png` });
  if (n) await wheel('.ch-old', `touched files, ${n}`);
  if (log.errors.length) console.log('errors', JSON.stringify(log.errors.slice(0, 3)));
  await browser.close();
})();
