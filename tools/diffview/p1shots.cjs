// P1's pictures, dark and light: the panel's Changes on a thread (a chip chosen, its diff below), Files ›
// Changes, and a phone. Real patches (fake-changes.cjs) on a thread's preview port, the app read-only.
//   THREAD=cmsg_5d3d55e99c1948b6 BASE='abb3844^' node tools/diffview/p1shots.cjs http://127.0.0.1:5262/ <dir>
const H = require('./panel.cjs');
const path = require('node:path');
const { mkdirSync } = require('node:fs');
const DIR = process.argv[3] || '/tmp/p1shots';
mkdirSync(DIR, { recursive: true });
const chip = (page, which = 'last') => page.evaluate((which) => { const cs = [...document.querySelectorAll('.tb-cf')].filter((x) => x.querySelector('.xd-n')); const c = which === 'last' ? cs.pop() : cs.find((x) => x.innerText.includes(which)); c.scrollIntoView({ block: 'center' }); return !!c; }, which);
(async () => {
  for (const theme of ['dark', 'light']) {
    // desktop: a chip's click opens its diff in the panel
    let { browser, page, log } = await H.open(theme, { dpr: 2, ls: { 'xo-stage': JSON.stringify({ open: false }) } });
    await H.thread(page);
    await chip(page); await page.waitForTimeout(800);
    await page.evaluate(() => { const cs = [...document.querySelectorAll('.tb-cf')].filter((x) => x.querySelector('.xd-n')); cs.find((x) => /app\.css/.test(x.innerText))?.click(); });
    await page.waitForTimeout(1800);
    await page.evaluate(() => { const c = document.querySelector('.tb-cf.is-on'); c && c.scrollIntoView({ block: 'center' }); });
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(DIR, `p1-panel-chip-${theme}.png`) });
    // Files › Changes: Open in Files from the panel
    await page.evaluate(() => document.querySelector('[data-cx-open]').click());
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(DIR, `p1-files-changes-${theme}.png`) });
    console.log(theme, 'desktop', JSON.stringify(log));
    await browser.close();
    // phone: chips with counts, then the panel as a sheet on a chip's click
    ({ browser, page, log } = await H.open(theme, { width: 390, height: 844, dpr: 3, mobile: true, ls: { 'xo-stage': JSON.stringify({ open: false }) } }));
    await H.thread(page);
    await chip(page); await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(DIR, `p1-phone-chips-${theme}.png`) });
    await page.evaluate(() => { const cs = [...document.querySelectorAll('.tb-cf')].filter((x) => x.querySelector('.xd-n')); cs.find((x) => /app\.css/.test(x.innerText))?.click(); });
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(DIR, `p1-phone-panel-${theme}.png`) });
    console.log(theme, 'phone', JSON.stringify(log));
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
