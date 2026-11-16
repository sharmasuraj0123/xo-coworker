// Read-only audit against :3400; optionally overlay this worktree's app.css.
const fs = require('node:fs');
const path = require('node:path');
const L = require('../../../design-research/2026-11-vision/audit/tools/lib.cjs');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
(async () => {
  const results = [];
  for (const theme of ['dark', 'light']) for (const width of [1440, 390, 320]) {
    const { browser, page, blocked } = await L.open(theme, { width, height: 900, mobile: width < 600 });
    if (process.env.OVERLAY) {
      // Replace the original sheet to preserve cascade ordering.
      await page.evaluate(css => {
        const link = document.querySelector('link[href="./css/app.css"]');
        const style = document.createElement('style'); style.textContent = css; link.replaceWith(style);
      }, fs.readFileSync(path.resolve(__dirname, '../../../css/app.css'), 'utf8'));
    }
    await page.waitForTimeout(400);
    const row = { theme, width, states: {} };
    row.gap = await page.evaluate(() => document.querySelector('.hm-h').getBoundingClientRect().top - document.querySelector('#hm-head .create').getBoundingClientRect().bottom);
    await page.screenshot({ path: `${out}/${theme}-${width}-home.png` });
    for (const [name, selector] of [['home', '#hm-head .create'], ['side', '#side-add']]) {
      if (name === 'side' && width < 600) { await page.click('#pb-menu'); await page.waitForTimeout(400); }
      row.states[name] = {};
      for (const state of ['rest', 'hover', 'focus', 'active']) {
        await page.mouse.move(width - 1, 899);
        await page.evaluate(() => document.activeElement.blur());
        if (state === 'hover' || state === 'active') await page.hover(selector);
        if (state === 'focus') { await page.focus(selector); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab'); }
        if (state === 'active') await page.mouse.down();
        await page.waitForTimeout(250);
        row.states[name][state] = await page.$eval(selector, el => {
          const c = getComputedStyle(el); return { background: c.background, border: c.border, shadow: c.boxShadow, outline: c.outline, focus: el.matches(':focus-visible'), active: el.matches(':active'), transform: c.transform };
        });
        const b = await page.locator(selector).boundingBox();
        await page.screenshot({ path: `${out}/${theme}-${width}-${name}-${state}.png`, clip: { x: b.x - 5, y: b.y - 5, width: b.width + 10, height: b.height + 10 } });
        if (state === 'active') { await page.mouse.move(width - 1, 899); await page.mouse.up(); }
      }
    }
    row.alignment = await page.evaluate(() => {
      const p = document.querySelector('#side-add').getBoundingClientRect(), l = document.querySelector('#projects-label').getBoundingClientRect(), f = document.querySelector('#side-find').getBoundingClientRect();
      const c = getComputedStyle(document.querySelector('#side-find'));
      return { centreDelta: (p.top + p.bottom - l.top - l.bottom) / 2, rightDelta: p.right - f.right, findBorder: c.border };
    });
    await page.screenshot({ path: `${out}/${theme}-${width}-sidebar.png` });
    row.blocked = blocked; results.push(row); await browser.close();
  }
  fs.writeFileSync(`${out}/measurements.json`, JSON.stringify(results, null, 2));
  console.log(results.map(r => ({theme:r.theme,width:r.width,gap:r.gap,...r.alignment,blocked:r.blocked})));
  if (process.env.OVERLAY) {
    const assert = require('node:assert/strict');
    for (const r of results) {
      assert.equal(r.alignment.centreDelta, 0);
      assert.equal(r.alignment.rightDelta, 0);
      if (r.width < 600) assert.equal(r.gap, 12);
      assert.equal(r.blocked.length, 0);
      for (const s of Object.values(r.states)) {
        assert(s.focus.focus);
        assert(s.active.active);
        assert(s.focus.outline.endsWith('solid 2px'));
        assert.notEqual(s.hover.background, s.rest.background);
      }
      assert.notEqual(r.states.home.active.shadow, r.states.home.hover.shadow);
      assert.notEqual(r.states.side.active.transform, 'none');
    }
    console.log('Six layouts and 48 control states passed.');
  }
})();
