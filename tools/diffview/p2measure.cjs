// P2's numbers: Files › a whole 3,155-line file (js/app.js) through Pierre: rows drawn, colour arrived, long
// tasks, at 1× and 4×; then scrolling through it (frames over 50 ms). Read-only, real worktree.
//   THREAD=cmsg_deadce65e4fe4027 BASE='1088c48^' node tools/diffview/p2measure.cjs <base url> [out.json]
const H = require('./panel.cjs');
const { writeFileSync } = require('node:fs');
(async () => {
  const all = [];
  for (const cpu of [1, 4]) {
    const { browser, page, log } = await H.open('dark', { dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
    await H.thread(page); await H.panel(page);
    await page.evaluate(() => [...document.querySelectorAll('.cx-r')].find((r) => /^app\.js/.test(r.innerText.trim()))?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
    await page.waitForTimeout(2500);
    const cdp = await page.context().newCDPSession(page);
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    const r = await page.evaluate(async () => {
      const lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' });
      const t0 = performance.now();
      document.querySelector('[data-vw-show="file"]').click();
      const root = () => document.querySelector('.vw-file diffs-container')?.shadowRoot;
      let rows = null, colour = null;
      for (let i = 0; i < 3000 && (rows == null || colour == null); i++) {
        if (rows == null && root()?.querySelector('[data-line]')) rows = performance.now() - t0;
        if (colour == null && [...(root()?.querySelectorAll('[data-line] span[style]') || [])].slice(0, 40).some((s) => /--diffs-token-/.test(s.getAttribute('style')))) colour = performance.now() - t0;
        if (rows == null || colour == null) await new Promise((r) => setTimeout(r, 4));
      }
      const drawn = { rows: rows && Math.round(rows), colour: colour && Math.round(colour), longTasks: [...lt], lines: root()?.querySelectorAll('[data-line]').length };
      // scroll through it, a wheel's worth per frame, and count slow frames
      lt.length = 0;
      const sc = document.querySelector('.vw-file'); const gaps = []; let last = performance.now();
      for (let i = 0; i < 240; i++) { sc.scrollTop += 120; await new Promise((r) => requestAnimationFrame(r)); const now = performance.now(); if (now - last > 50) gaps.push(Math.round(now - last)); last = now; }
      return { ...drawn, scroll: { frames: 240, over50ms: gaps.length, worst: Math.max(0, ...gaps), longTasks: lt } };
    });
    console.log(`${cpu}x`, JSON.stringify(r), JSON.stringify(log.errors));
    all.push({ cpu, ...r });
    await browser.close();
  }
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(all, null, 1) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
