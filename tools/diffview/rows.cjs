// Whole rows in the panel (the owner, 5 November: Agents "cutting an option in half"), on live data.
//   FAKE=0 SIZES=1440x900,390x844 VIEWS=p:xo-coworker THEME=dark LS=<storage JSON> node tools/diffview/rows.cjs <url>
// The panel, cold load (or with storage given), on the branch preview: for every list row on screen, is it
// cut by the box that clips it (its scroller, or its frame)? Checked at rest, and after scrolling each list.
const H = require('./panel.cjs');
const url = process.argv[2] || 'http://127.0.0.1:5262/';
const sizes = (process.env.SIZES || '1440x900,390x844').split(',');
const views = (process.env.VIEWS || 'p:xo-coworker').split(',');
const theme = process.env.THEME || 'dark';
const check = () => {
  const st = document.getElementById('stage'); if (!st || st.hidden) return { stage: 'closed' };
  const clipOf = (e) => { for (let p = e.parentElement; p && p !== st; p = p.parentElement) { const o = getComputedStyle(p); if (/(auto|scroll|hidden|clip)/.test(o.overflowY)) return p; } return st; };
  const cut = [], per = {};
  for (const r of st.querySelectorAll('.ag-r, .ch-r, .cx-r, .cx-more')) {
    if (!r.checkVisibility()) continue;
    const fr = r.closest('[data-fr]')?.dataset.fr; per[fr] = (per[fr] || 0) + 1;
    // every clipping ancestor up to the stage
    let a = r.getBoundingClientRect(), top = a.top, bot = a.bottom;
    for (let p = clipOf(r); p; p = p === st ? null : clipOf(p)) { const b = p.getBoundingClientRect(); top = Math.max(top, b.top); bot = Math.min(bot, b.bottom); }
    const shown = Math.max(0, bot - top);
    if (shown > 0.5 && shown < a.height - 0.5) cut.push(`${fr}: ${(r.innerText || '').split('\n')[0].slice(0, 24)} ${Math.round(shown)}/${Math.round(a.height)}`);
  }
  const fh = {}; for (const f of st.querySelectorAll('[data-fr]')) if (!f.hidden) fh[f.dataset.fr] = `${Math.round(f.getBoundingClientRect().height)}${f.classList.contains('is-grow') ? ' grow' : ''}${f.classList.contains('is-folded') ? ' folded' : ''}`;
  return { frames: fh, rows: per, cut };
};
(async () => {
  for (const sz of sizes) {
    const [w, h] = sz.split('x').map(Number);
    const mobile = w < 760;
    const { browser, page, log } = await H.open(theme, { width: w, height: h, dpr: 1, mobile, ls: { 'xo-stage': JSON.stringify({ open: true }), ...(process.env.LS ? JSON.parse(process.env.LS) : {}) } });
    for (const v of views) {
      if (v !== 'home') { await page.evaluate((v) => document.querySelector(`[data-go="${v}"]`)?.click(), v); await page.waitForTimeout(2500); }
      if (v.startsWith('t:')) await page.waitForTimeout(3000);
      const open = await page.evaluate(() => !document.getElementById('stage')?.hidden);
      if (!open) { await page.evaluate(() => document.querySelector('[data-stage-toggle]')?.click()); await page.waitForTimeout(1500); }
      if (process.env.FOLD) { for (const id of process.env.FOLD.split(',')) await page.evaluate((id) => document.querySelector(`[data-fr-fold="${id}"]`)?.click(), id); await page.waitForTimeout(500); }
      console.log(sz, theme, v, 'rest', JSON.stringify(await page.evaluate(check)));
      // scroll each scroller in the panel a little, as a wheel would, and check again once it settles
      const n = await page.evaluate(() => { let n = 0; for (const s of document.querySelectorAll('#stage *')) { const o = getComputedStyle(s).overflowY; if (/(auto|scroll)/.test(o) && s.scrollHeight > s.clientHeight + 2 && s.closest('[data-fr]') && !s.closest('.cx-pane, .map-host, .dg')) { s.dataset.probe = ++n; } } return n; });
      for (let i = 1; i <= n; i++) {
        const box = await page.evaluate((i) => { const r = document.querySelector(`[data-probe="${i}"]`).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 20) }; }, i);
        await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, 70); await page.waitForTimeout(900);
        console.log(sz, theme, v, `after scrolling list ${i}`, JSON.stringify(await page.evaluate(check)));
      }
      await page.screenshot({ path: `/tmp/agcut2-${sz}-${v.replace(':', '_')}-${theme}${process.env.TAG || ''}.png` });
    }
    if (log.errors.length) console.log('errors', JSON.stringify(log.errors.slice(0, 3)));
    await browser.close();
  }
})();
