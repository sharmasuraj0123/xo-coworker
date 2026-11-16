// Re-measures Astra's P1/P2 blockers (qa-reports/2026-11-05/astra-pierre-p1p2/report.md) on this branch:
// F2 the Changes | File switch at 390 (text inside each segment, the switch inside the head), F3 the Ask
// composer's Send at 390 with a long thread name (28 × 28, 8 px from the outer edge), F4 the panel card's
// button (4 px from the outer edge, top and right). Read-only harness.
//   THREAD=cmsg_deadce65e4fe4027 BASE='1088c48^' node tools/diffview/astra-recheck.cjs <base url>
const H = require('./panel.cjs');
const num = (page, n) => page.evaluate((n) => { const r = document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector(`[data-column-number="${n}"]`)?.getBoundingClientRect(); return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, n);
(async () => {
  for (const theme of ['dark', 'light']) {
    // desktop: F4
    let { browser, page } = await H.open(theme, { dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
    await H.thread(page); await H.panel(page);
    const f4 = await page.evaluate(() => { const card = document.querySelector('#stage .cx-pane').getBoundingClientRect(), b = document.querySelector('#stage .cx-ofi').getBoundingClientRect(); return { right: +(card.right - b.right).toFixed(2), top: +(b.top - card.top).toFixed(2), size: `${b.width}×${b.height}`, radius: getComputedStyle(document.querySelector('#stage .cx-ofi')).borderRadius, card: getComputedStyle(document.querySelector('#stage .cx-pane')).borderRadius }; });
    await browser.close();
    // phone: F2, F3
    ({ browser, page } = await H.open(theme, { width: 390, height: 844, dpr: 1, mobile: true, ls: { 'xo-stage': JSON.stringify({ open: true }) } }));
    await H.thread(page); await H.panel(page);
    await page.evaluate(() => [...document.querySelectorAll('.cx-r')].find((r) => /follow\.js/.test(r.innerText))?.click());
    await page.waitForTimeout(500);
    await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
    await page.waitForTimeout(1800);
    const f2 = await page.evaluate(() => {
      const head = document.querySelector('.vw-top').getBoundingClientRect(), seg = document.querySelector('.vw-seg.is-words').getBoundingClientRect();
      const words = [...document.querySelectorAll('.vw-seg.is-words button')].map((b) => { const r = document.createRange(); r.selectNodeContents(b); const t = r.getBoundingClientRect(), bb = b.getBoundingClientRect(); return { label: b.textContent, text: [Math.round(t.left), Math.round(t.right)], button: [Math.round(bb.left), Math.round(bb.right)], inside: t.left >= bb.left - 0.5 && t.right <= bb.right + 0.5 }; });
      return { words, overlap: Math.max(0, Math.round(words[0].text[1] - words[1].text[0])), segInHead: seg.top >= head.top - 0.5 && seg.bottom <= head.bottom + 0.5, seg: [Math.round(seg.top), Math.round(seg.bottom)], head: [Math.round(head.top), Math.round(head.bottom)] };
    });
    await page.evaluate(() => document.querySelector('[data-vw-show="file"]').click());
    await page.waitForTimeout(1800);
    await page.evaluate(() => document.querySelector('.vw-file diffs-container')?.shadowRoot?.querySelector('[data-column-number="10"]')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    const a = await num(page, 10), b = await num(page, 13);
    await page.mouse.click(a.x, a.y); await page.keyboard.down('Shift'); await page.mouse.click(b.x, b.y); await page.keyboard.up('Shift');
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('.xd-ask')?.click());
    await page.waitForTimeout(600);
    const f3 = await page.evaluate(() => { const q = document.querySelector('.xd-q').getBoundingClientRect(), s = document.querySelector('.xd-q .xd-send').getBoundingClientRect(); return { send: `${+s.width.toFixed(2)}×${+s.height.toFixed(2)}`, right: +(q.right - s.right).toFixed(2), bottom: +(q.bottom - s.bottom).toFixed(2), radius: getComputedStyle(document.querySelector('.xd-q')).borderRadius, to: document.querySelector('.xd-q .xd-to').innerText }; });
    await page.screenshot({ path: `/tmp/astra-recheck-390-${theme}.png` });
    console.log(theme, JSON.stringify({ f2, f3, f4 }));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
