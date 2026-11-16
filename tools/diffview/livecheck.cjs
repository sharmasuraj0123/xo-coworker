// Pierre on the live app as Space is today (no /changes, no edit fields): the panel keeps today's list,
// Files draws whole files through Pierre, Ask about lines opens its composer (never sent: every non-GET is
// aborted in the browser, and this script closes the composer with Esc). Read-only.
//   FAKE=0 node tools/diffview/livecheck.cjs http://127.0.0.1:3000/
const H = require('./panel.cjs');
const num = (page, n) => page.evaluate((n) => { const r = document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector(`[data-column-number="${n}"]`)?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, n);
(async () => {
  for (const theme of ['dark', 'light']) {
    const { browser, page, log } = await H.open(theme, { dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
    await H.thread(page); await H.panel(page);
    const panel = await page.evaluate(() => ({ order: [...document.querySelectorAll('#stage .fr')].filter((f) => !f.hidden).map((f) => f.dataset.fr), oldRows: document.querySelectorAll('#stage .ch-old:not([hidden]) .ch-r').length, newRows: document.querySelectorAll('#stage .cx-host:not([hidden]) .cx-r').length, chipsWithCounts: document.querySelectorAll('.tb-cf .xd-n').length }));
    // a file through the old list (it opens in Files), then whole through Pierre
    // Files › All files › js › follow.js (a 3 KB file) and app.js (3,000+ lines)
    await page.evaluate(() => document.querySelector('[data-open-files]')?.click());
    await page.waitForTimeout(1500);
    await page.evaluate(() => document.querySelector('[data-fl-dir="js"]')?.click());
    await page.waitForTimeout(1200);
    const t = await page.evaluate(async () => {
      const row = document.querySelector('[data-fl-file="js/app.js"]');
      if (!row) return { none: true };
      const t0 = performance.now(); row.click();
      for (let i = 0; i < 600; i++) { await new Promise((r) => requestAnimationFrame(r)); if (document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-line]')) return { file: document.querySelector('.vw-top h2')?.textContent, rowsMs: Math.round(performance.now() - t0), edit: !!document.querySelector('[data-vw-edit]') }; if (document.querySelector('.vw-md, .vw-frame, .vw-img')) return { file: document.querySelector('.vw-top h2')?.textContent, preview: true }; }
      return { timeout: true };
    });
    let ask = null;
    if (t.rowsMs) {
      await page.waitForTimeout(800);
      // two lines on screen, whatever part of the file is in view
      const first = await page.evaluate(() => { const sc = document.querySelector('.vw-file').getBoundingClientRect(); const ns = [...(document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelectorAll('[data-column-number]') || [])].filter((n) => { const r = n.getBoundingClientRect(); return r.top > sc.top + 20 && r.bottom < sc.bottom - 200; }); return ns.length > 3 ? +ns[1].getAttribute('data-column-number') : null; });
      const a = first && await num(page, first), b = first && await num(page, first + 2);
      ask = { firstLineInView: await page.evaluate(() => document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-column-number]')?.getAttribute('data-column-number')) };
      if (a && b) {
        await page.mouse.click(a.x, a.y); await page.keyboard.down('Shift'); await page.mouse.click(b.x, b.y); await page.keyboard.up('Shift');
        await page.waitForTimeout(300);
        const capsule = await page.evaluate(() => document.querySelector('.xd-ask')?.innerText.replace(/\s+/g, ' '));
        await page.keyboard.press('Control+l'); await page.waitForTimeout(500);
        ask = { ...ask, ...(await page.evaluate(() => ({ composer: !!document.querySelector('.xd-q'), to: document.querySelector('.xd-q .xd-to')?.innerText, focused: document.activeElement?.className }))) };
        ask.capsule = capsule;
        await page.screenshot({ path: `/tmp/live-ask-${theme}.png` });
        await page.keyboard.press('Escape'); await page.waitForTimeout(200);
        ask.closed = await page.evaluate(() => !document.querySelector('.xd-q'));
      }
    }
    console.log(theme, JSON.stringify({ panel, file: t, ask, blocked: log.blocked, errors: log.errors }));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
