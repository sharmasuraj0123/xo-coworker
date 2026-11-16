// P2's flow on a thread's preview port (read-only: the send is aborted in the browser, so the bubble shows
// as not sent): Files › a whole file → select lines on the numbers → "Ask about lines" → ⌘L/Ctrl L → the
// composer under the lines → Enter → your bubble in the thread, led by the capsule → the capsule opens
// Files at those lines. Shots at each step, and the whole file's draw time.
//   THREAD=… BASE=… node tools/diffview/p2ask.cjs <base url> <dir>
const H = require('./panel.cjs');
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const DIR = process.argv[3] || '/tmp/p2';
mkdirSync(DIR, { recursive: true });
const num = (page, n) => page.evaluate((n) => { const r = document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector(`[data-column-number="${n}"]`)?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, n);
(async () => {
  for (const theme of (process.env.THEMES || 'dark,light').split(',')) {
    const { browser, page, log } = await H.open(theme, { dpr: 2, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
    await H.thread(page);
    await H.panel(page);
    await page.evaluate(() => [...document.querySelectorAll('.cx-r')].find((r) => /follow\.js/.test(r.innerText))?.click());
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
    await page.waitForTimeout(1500);
    const t = await page.evaluate(async () => {
      const t0 = performance.now();
      document.querySelector('[data-vw-show="file"]').click();
      for (let i = 0; i < 400; i++) { await new Promise((r) => requestAnimationFrame(r)); if (document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-line]')) return Math.round(performance.now() - t0); }
      return null;
    });
    await page.waitForTimeout(1200);
    await page.evaluate(() => document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-column-number="36"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(400);
    const a = await num(page, 36), b = await num(page, 43);
    await page.mouse.click(a.x, a.y);
    await page.keyboard.down('Shift'); await page.mouse.click(b.x, b.y); await page.keyboard.up('Shift');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(DIR, `p2-select-${theme}.png`) });
    const capsule = await page.evaluate(() => document.querySelector('.xd-ask')?.innerText.replace(/\n/g, ' '));
    await page.keyboard.press('Control+l');
    await page.waitForTimeout(500);
    await page.keyboard.type("Why only the real bottom? Couldn't a fast fling stop 1 px short");
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(DIR, `p2-ask-${theme}.png`) });
    const q = await page.evaluate(() => ({ ref: document.querySelector('.xd-q .xd-ref')?.innerText, to: document.querySelector('.xd-q .xd-to')?.innerText, focused: document.activeElement?.className }));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const herald = await page.evaluate(() => document.getElementById('herald')?.innerText.replace(/\n/g, ' '));
    await page.evaluate(() => document.querySelector('[data-fv-back]')?.click());
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(DIR, `p2-bubble-${theme}.png`) });
    const bubble = await page.evaluate(() => { const l = [...document.querySelectorAll('.m-you .bubble')].pop(); return l && { html: l.querySelector('[data-ref]')?.outerHTML.slice(0, 120), text: l.innerText.slice(0, 120) }; });
    // the capsule opens Files at those lines, selected
    await page.evaluate(() => [...document.querySelectorAll('.m-you .bubble [data-ref]')].pop()?.click());
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(DIR, `p2-ref-open-${theme}.png`) });
    const sel = await page.evaluate(() => [...(document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelectorAll('[data-selected-line]') || [])].map((x) => x.dataset.line || x.dataset.columnNumber).filter(Boolean).slice(0, 3));
    console.log(theme, JSON.stringify({ fileRowsMs: t, capsule, q, herald, bubble, selectedAfterRef: sel, blocked: log.blocked, errors: log.errors }));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
