// Astra's whole-row case (ed8aded): 8 agents, the Changes/Agents line ArrowUp ×5. FAKE=0 SIZE=390x844 THEME=light node tools/diffview/rows-max.cjs <url>
// Astra's case: 8 agents, Changes and Map open; the Changes/Agents line focused, ArrowUp ×5 from the default.
const H = require('./panel.cjs');
const [w, h] = (process.env.SIZE || '1440x900').split('x').map(Number);
const theme = process.env.THEME || 'dark';
const check = () => {
  const st = document.getElementById('stage');
  const clipOf = (e) => { for (let p = e.parentElement; p && p !== st; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowY)) return p; } return st; };
  const cut = []; const per = {};
  for (const r of st.querySelectorAll('.ag-r, .ch-r, .cx-r, .cx-more')) {
    if (!r.checkVisibility()) continue;
    const a = r.getBoundingClientRect(); let top = a.top, bot = a.bottom;
    for (let p = clipOf(r); p; p = p === st ? null : clipOf(p)) { const b = p.getBoundingClientRect(); top = Math.max(top, b.top); bot = Math.min(bot, b.bottom); }
    const shown = Math.max(0, bot - top), fr = r.closest('[data-fr]').dataset.fr;
    if (shown >= a.height - 0.5) per[fr] = (per[fr] || 0) + 1;
    if (shown > 0.5 && shown < a.height - 0.5) cut.push(`${fr} ${Math.round(shown)}/${Math.round(a.height)}`);
  }
  const fh = {}; for (const f of st.querySelectorAll('[data-fr]')) if (!f.hidden) fh[f.dataset.fr] = Math.round(f.getBoundingClientRect().height);
  const list = st.querySelector('.cx-list'); const pane = st.querySelector('.cx-pane');
  return { frames: fh, whole: per, cut, list: list && [list.clientHeight, list.scrollHeight], pane: pane && !pane.hidden ? Math.round(pane.getBoundingClientRect().height) : null, agRows: st.querySelector('[data-fr="agents"]').style.getPropertyValue('--ag-rows') };
};
(async () => {
  const { browser, page, log } = await H.open(theme, { width: w, height: h, dpr: 1, mobile: w < 760, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
  await page.evaluate(() => document.querySelector('[data-go="p:xo-coworker"]')?.click()); await page.waitForTimeout(3000);
  if (await page.evaluate(() => document.getElementById('stage').hidden)) { await page.evaluate(() => document.querySelector('[data-stage-toggle]')?.click()); await page.waitForTimeout(1500); }
  await page.evaluate(() => { const ul = document.querySelector('[data-fr="agents"] .ag-list'); const li = ul.querySelector('li'); while (ul.children.length < 8) ul.appendChild(li.cloneNode(true)); });
  await page.waitForTimeout(300);
  console.log(`${w}x${h} ${theme} default`, JSON.stringify(await page.evaluate(check)));
  await page.evaluate(() => document.querySelector('[data-gut="changes|agents"]').focus());
  for (let i = 0; i < 5; i++) { await page.keyboard.press('ArrowUp'); await page.waitForTimeout(120); }
  await page.waitForTimeout(500);
  console.log(`${w}x${h} ${theme} ArrowUp×5`, JSON.stringify(await page.evaluate(check)));
  // wheel the lists and check again
  for (const sel of ['.cx-list', '[data-fr="agents"] .fr-b']) { const b = await page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + 10 }; }, sel); if (b) { await page.mouse.move(b.x, b.y); await page.mouse.wheel(0, 60); await page.waitForTimeout(800); } }
  console.log(`${w}x${h} ${theme} after wheels`, JSON.stringify(await page.evaluate(check)));
  await page.screenshot({ path: `/tmp/agmax-${w}-${theme}.png` });
  console.log('errors', JSON.stringify(log.errors.slice(0, 3)));
  await browser.close();
})();
