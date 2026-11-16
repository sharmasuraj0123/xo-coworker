// Read-only check of the built A + B on a preview port. Usage: XO_URL=... node verify.cjs <outdir>
const L = require('../../../design-research/2026-11-vision/audit/tools/lib.cjs');
const out = process.argv[2];
(async () => {
  for (const s of ['dark', 'light']) {
    const { browser, page, blocked } = await L.open(s, { width: 1440, height: 900 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${out}/built-${s}.png` });
    const m = await page.evaluate(() => {
      const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(), c = getComputedStyle(e); return { x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height, rad: c.borderTopLeftRadius }; };
      return { plus: r('#side-add'), find: r('#side-find'), label: r('#projects-label'), create: r('#hm-head .create'), tile: r('#hm-head .create-ic'), name: document.querySelector('#side-add').getAttribute('aria-label') };
    });
    console.log(s, JSON.stringify(m));
    await page.hover('#side-add'); await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/built-${s}-plus-hover.png`, clip: { x: 0, y: 240, width: 260, height: 90 } });
    await page.hover('#hm-head .create'); await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/built-${s}-create-hover.png`, clip: { x: 900, y: 30, width: 260, height: 100 } });
    await page.mouse.move(700, 700);
    await page.focus('#side-add'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/built-${s}-plus-focus.png`, clip: { x: 0, y: 240, width: 260, height: 90 } });
    // the click opens the create dialog (no request is sent: the form is never submitted)
    await page.click('#side-add'); await page.waitForTimeout(300);
    const open1 = await page.evaluate(() => document.querySelector('#create-dlg').open); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.click('#hm-head .create'); await page.waitForTimeout(300);
    const open2 = await page.evaluate(() => document.querySelector('#create-dlg').open); await page.keyboard.press('Escape');
    console.log(s, 'dialog from + New:', open1, 'from Home:', open2, 'blocked', blocked.length);
    await browser.close();
    const ph = await L.open(s, { width: 390, height: 844, mobile: true });
    await ph.page.waitForTimeout(1200);
    await ph.page.screenshot({ path: `${out}/built-${s}-phone.png` });
    await ph.browser.close();
  }
})();
