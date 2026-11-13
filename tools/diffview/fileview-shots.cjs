// The full-file view (Layout A) on a branch preview, live data, sends aborted: shots for the build log and
// Astra's audit, dark and light. Desktop 1440 (docked, tree folded; tree open; chat folded; put away), 1728
// (all three open), 1180 (compact: the chat on its rail, then open over the file), phone 390 (bar, sheet).
//   FAKE=0 node tools/diffview/fileview-shots.cjs <url> <out dir> [thread id]
const H = require('./panel.cjs');
const path = require('node:path');
const url = process.argv[2] || 'http://127.0.0.1:5262/';
const OUT = process.argv[3] || '/tmp/fv-shots';
const T = process.argv[4] || 'cmsg_bbc5871183bc4fff';
const wait = (p, ms) => p.waitForTimeout(ms);
async function openFile(page, phone) {
  await H.thread(page, T);
  await wait(page, 1200);
  if (phone || (await page.evaluate(() => document.getElementById('stage')?.hidden))) { await page.evaluate(() => document.querySelector('[data-stage-toggle]')?.click()); await wait(page, 1500); }
  await page.evaluate(() => document.querySelector('[data-cx-open]')?.click());
  await wait(page, 2500);
}
(async () => {
  for (const theme of (process.env.THEMES || 'dark,light').split(',')) {
    const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}-${theme}.png`) });
    { // 1440
      const { browser, page } = await H.open(theme, { width: 1440, height: 900, dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
      await openFile(page);
      await shot(page, 'fv-1440-docked');
      await page.evaluate(() => document.querySelector('[data-fv-tree]')?.click()); await wait(page, 500);
      await shot(page, 'fv-1440-tree');
      await page.evaluate(() => document.querySelector('[data-fv-tree]')?.click()); await wait(page, 300);
      await page.evaluate(() => document.querySelector('[data-chat-fold]')?.click()); await wait(page, 700);
      await shot(page, 'fv-1440-chatmin');
      await page.evaluate(() => document.querySelector('[data-crail]')?.click()); await wait(page, 700);
      await page.evaluate(() => document.querySelector('[data-fv-min]')?.click()); await wait(page, 1200);
      await shot(page, 'fv-1440-away');
      await browser.close();
    }
    { // 1728: all three open
      const { browser, page } = await H.open(theme, { width: 1728, height: 1000, dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
      await openFile(page);
      await shot(page, 'fv-1728-open');
      await browser.close();
    }
    { // 1180: compact
      const { browser, page } = await H.open(theme, { width: 1180, height: 800, dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: true }) } });
      await openFile(page);
      await shot(page, 'fv-1180-compact');
      await page.evaluate(() => document.querySelector('[data-crail]')?.click()); await wait(page, 700);
      await shot(page, 'fv-1180-over');
      await browser.close();
    }
    { // phone
      const { browser, page } = await H.open(theme, { width: 390, height: 844, dpr: 2, mobile: true });
      await openFile(page, true);
      await shot(page, 'fv-390-bar');
      await page.evaluate(() => document.querySelector('[data-crail]')?.click()); await wait(page, 700);
      await shot(page, 'fv-390-sheet');
      await browser.close();
    }
  }
})();
