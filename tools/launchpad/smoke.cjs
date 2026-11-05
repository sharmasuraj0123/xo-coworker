// Plays the section's flows in the real app (preview stand-in) and reports each screen it lands on, and any page error.
const { chromium } = require('/tmp/pw/node_modules/playwright-core');
const { install } = require('./mockspace.cjs');
const EXE = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const FLOWS = {
  play: [['click', '[data-lp="deploy"]'], ['wait', 1000], ['screen'], ['wait', 3200], ['screen'], ['wait', 9000], ['screen'], ['head']],
  'play-build': [['click', '[data-lp="deploy"]'], ['wait', 9000], ['screen'], ['head']],
  'play-health': [['click', '[data-lp="deploy"]'], ['wait', 12500], ['screen'], ['click', '[data-lp="fix-port"]'], ['wait', 500], ['screen']],
  'name-taken': [['click', '[data-lp="deploy"]'], ['wait', 3800], ['screen'], ['text', '.lp-hint']],
  scope: [['wait', 800], ['click', '[data-lp="reconnect"]'], ['wait', 900], ['screen'], ['click', '[data-lp="device-cancel"]'], ['wait', 300], ['screen']],
  'needs-agent': [['click', '[data-lp="ask"]'], ['wait', 600], ['screen']],
  live: [['click', '[data-lp="menu"]'], ['wait', 300], ['click', '[data-lp="unlink"]'], ['wait', 300], ['screen']],
  undo: [['wait', 300], ['click', '[data-lp="undo"]'], ['wait', 300], ['screen']],
  'scope-enter': [['wait', 900], ['key', '[data-lp-f="name"]', 'Enter'], ['wait', 900], ['screen'], ['wait', 3000], ['screen']],
  'esc-field': [['wait', 600], ['key', '[data-lp-f="name"]', 'Escape'], ['wait', 400], ['open'], ['view']],
  pressed: [['pressed'], ['click', '[data-fr-fold="launch"]'], ['wait', 300], ['pressed'], ['click', '[data-fr-fold="launch"]'], ['wait', 300], ['pressed'], ['click', '[data-stg-close]'], ['wait', 300], ['pressed'], ['wait', 4500], ['pressed'], ['click', '[data-stage-toggle]'], ['wait', 400], ['pressed'], ['click', '[data-lp-open]'], ['wait', 400], ['pressed'], ['click', '[data-lp-open]'], ['wait', 400], ['pressed']],
  'deploy-esc': [['press', 'Escape'], ['wait', 400], ['open'], ['view']],
  'gh-import': [['wait', 1200], ['click', '[data-lp="reconnect"]'], ['wait', 1500], ['screen'], ['text', '.lp-foot .lp-go span']],
  'gh-scope': [['wait', 1200], ['text', '.lp-cmd code'], ['text', '.lp-foot .lp-go span']],
  'gh-scope-run': [['wait', 900], ['screen'], ['text', '.lp-cmd code']],
  'repo-taken': [['wait', 1200], ['click', '[data-lp="deploy"]'], ['wait', 3900], ['screen'], ['text', '.lp-f.is-bad .lp-hint'], ['value', '[data-lp-f="repo"]']],
  'link-existing': [['click', '[data-lp="deploy"]'], ['wait', 3900], ['screen'], ['text', '.lp-ask b'], ['text', '.lp-ask .lp-go span']],
  pull: [['wait', 900], ['screen'], ['text', '.lp-note'], ['count', '.lp-acts .lp-go'], ['text', '.lp-acts .lp-b span']],
  'tab-trap': [['wait', 800], ['click', '[data-ghost="agents"]'], ['wait', 400], ['open'], ['agents-open']],
  'tab-walk': [['wait', 900], ['focus', '[data-lp="pick"]'], ['walk', 5], ['walkback', 3]],
  'gh-import-slow': [['wait', 1500], ['click', '[data-lp="reconnect"]'], ['wait', 2500], ['screen'], ['text', '.lp-foot .lp-go span']],
  building: [['wait', 600], ['screen'], ['text', '[data-n="repo"] .lp-c > span'], ['click', '[data-lp="hide"]'], ['wait', 300], ['head'], ['click', '[data-lp-open]'], ['wait', 300], ['open']],
};
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const [sc, steps] of Object.entries(FLOWS).filter(([k]) => !process.env.ONLY || process.env.ONLY.split(',').includes(k))) {
    const ctx = await b.newContext({ viewport: process.env.PHONE ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: !!process.env.PHONE, hasTouch: !!process.env.PHONE });
    await ctx.addInitScript(() => { localStorage.removeItem('xo-stage'); localStorage.removeItem('xo-lp-state'); });
    // Astra's repro: frames 250 ms apart, so an import and its preflight both land before the next paint
    if (sc === 'gh-import-slow') await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => setTimeout(() => raf(f), 250); });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await install(page, { 'scope-enter': 'scope', 'esc-field': 'ready', pressed: 'ready', 'deploy-esc': 'ready', 'tab-trap': 'ready', 'tab-walk': 'ready', 'gh-import-slow': 'gh-import' }[sc] || sc);
    await page.goto('http://127.0.0.1:3466/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.prow[data-go="p:xo-coworker"]'), null, { timeout: 45000 });
    await page.evaluate(() => document.querySelector('.prow[data-go="p:xo-coworker"]').click());
    await page.waitForTimeout(800);
    await page.evaluate(() => { const n = [...document.querySelectorAll('#main .nw')].find((x) => x.textContent.includes('Deploy on Launchpad')); n && n.click(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('[data-lp-open]')?.click());
    await page.waitForTimeout(600);
    const out = [];
    for (const [k, a] of steps) {
      if (k === 'click') await page.evaluate((s) => document.querySelector(s)?.click(), a);
      else if (k === 'wait') await page.waitForTimeout(a);
      else if (k === 'key') { await page.focus(a); await page.keyboard.press(steps.find((x) => x[1] === a)[2]); }
      else if (k === 'pressed') out.push(await page.evaluate(() => { const b = document.querySelector('[data-lp-open]'); return `${b.getAttribute('aria-pressed')}/${b.classList.contains('is-on')}/${!document.querySelector('[data-fr="launch"]').classList.contains('is-folded') && document.body.classList.contains('stage-open')}`; }));
      else if (k === 'press') await page.keyboard.press(a);
      else if (k === 'value') out.push('value:' + await page.evaluate((s) => document.querySelector(s)?.value, a));
      else if (k === 'count') out.push('count:' + await page.evaluate((s) => document.querySelectorAll(s).length, a));
      else if (k === 'tabs') { for (let i = 0; i < a; i++) await page.keyboard.press('Tab'); }
      else if (k === 'inside') out.push('focus-in-launchpad:' + await page.evaluate(() => !!document.activeElement.closest('[data-fr="launch"]')));
      else if (k === 'agents-open') out.push('agents-open:' + await page.evaluate(() => !document.querySelector('[data-fr="agents"]').classList.contains('is-folded') && !document.querySelector('[data-fr="launch"]').classList.contains('is-open')));
      else if (k === 'focus') await page.focus(a);
      else if (k === 'walk' || k === 'walkback') {
        const seen = [];
        for (let i = 0; i < a; i++) {
          await page.keyboard.press(k === 'walk' ? 'Tab' : 'Shift+Tab');
          await page.waitForTimeout(60);
          seen.push(await page.evaluate(() => { const x = document.activeElement; if (!x || x === document.body) return 'body'; const g = x.closest('[data-ghost]'); if (g) return 'head:' + g.dataset.ghost; if (x.closest('[data-fr="launch"]')) return 'launchpad'; if (x.closest('#stage')) return 'panel:' + (x.closest('[data-fr]')?.dataset.fr || 'bar'); return 'out:' + (x.id || x.className || x.tagName).toString().slice(0, 24); }));
        }
        out.push(`${k}:` + seen.join(' > '));
      }
      else if (k === 'view') out.push('view:' + await page.evaluate(() => document.querySelector('#app').dataset.conv));
      else if (k === 'screen') out.push(await page.evaluate(() => document.querySelector('#fr-body-launch .lp')?.dataset.screen || '(none)'));
      else if (k === 'head') out.push('head:' + await page.evaluate(() => document.querySelector('.lp-hs')?.innerText.replace(/\s+/g, ' ')));
      else if (k === 'text') out.push('text:' + await page.evaluate((s) => document.querySelector(s)?.innerText, a));
      else if (k === 'open') out.push('open:' + await page.evaluate(() => !document.querySelector('[data-fr="launch"]').classList.contains('is-folded') + '/panel ' + document.body.classList.contains('stage-open')));
    }
    console.log(sc.padEnd(12), out.join(' → '), errs.length ? 'ERRORS: ' + errs.join(' | ') : '');
    await ctx.close();
  }
  await b.close();
})();
