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
  'lp-link': [['click', '[data-lp="deploy"]'], ['wait', 4200], ['screen'], ['href', '.lp-acts a.lp-b']],
  'lp-link-linked': [['wait', 1500], ['screen'], ['href', '.lp-acts a.lp-b']],
  'lp-link-slowpre': [['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['href', '.lp-acts a.lp-b'], ['wait', 1500], ['href', '.lp-acts a.lp-b']],
  'lp-link-watch-slowpre': [['wait', 2500], ['screen'], ['href', '.lp-acts a.lp-b']],
  // the environment, later: Change opens the app's settings (no Name, the hint for values set), Cancel goes back,
  // and a deploy with them shows the names it carried as set once it's live
  'edit-env': [['wait', 1200], ['text', '.lpm-env span:nth-child(2)'], ['click', '[data-lp="edit"]'], ['wait', 300], ['screen'], ['head'], ['count', '[data-lp-f="name"]'], ['text', '.lp-foot .lp-go span'], ['click', '[data-lp="edit-cancel"]'], ['wait', 300], ['screen'], ['click', '[data-lp="edit"]'], ['wait', 300], ['fill', '[data-lp-env="XO_SPACE_ID"]', 'space-prod-01'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['sent'], ['text', '.lpm-env span:nth-child(2)']],
  // Astra on 447edb6: settings on an app whose project has moved on still ask for a build (rebuild), and say the newer
  // commits go too; an ordinary Deploy again there pushes them without rebuild
  'edit-behind': [['wait', 1200], ['click', '[data-lp="edit"]'], ['wait', 300], ['text', '.lp-hd .lp-p'], ['fill', '[data-lp-env="XO_SPACE_ID"]', 'space-prod-01'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['sent']],
  'again-behind': [['wait', 1200], ['click', '[data-lp="again"]'], ['wait', 4500], ['screen'], ['sent']],
  // Astra on 447edb6: Change works after a deploy that went live in this tab; typed values don't outlive the section
  'live-change': [['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_test'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['click', '[data-lp="edit"]'], ['wait', 300], ['screen'], ['head'], ['text', '.lp-foot .lp-go span'], ['value', '[data-lp-env="XO_API_KEY"]'], ['click', '[data-lp="edit-cancel"]'], ['wait', 300], ['screen'], ['click', '[data-lp="edit"]'], ['wait', 300], ['screen'], ['count', '[data-lp-env]'], ['fill', '[data-lp-env="XO_SPACE_ID"]', 'space-prod-01'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['click', '[data-lp="edit"]'], ['wait', 300], ['screen'], ['count', '[data-lp-env]']],
  'secret-close': [['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_test'], ['click', '[data-stg-close]'], ['wait', 300], ['value', '[data-lp-env="XO_API_KEY"]'], ['click', '[data-lp-open]'], ['wait', 600], ['screen'], ['value', '[data-lp-env="XO_API_KEY"]']],
  'secret-fold': [['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_test'], ['click', '[data-fr-fold="launch"]'], ['wait', 300], ['value', '[data-lp-env="XO_API_KEY"]'], ['click', '[data-fr-fold="launch"]'], ['wait', 600], ['screen'], ['value', '[data-lp-env="XO_API_KEY"]']],
  'secret-undo-close': [['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_test'], ['click', '[data-lp="deploy"]'], ['wait', 300], ['click', '[data-stg-close]'], ['wait', 4200], ['sent']],
  'secret-project': [['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_test'], ['click', '.prow[data-go="p:launchpad-demo"]'], ['wait', 900], ['open'], ['value', '[data-lp-env="XO_API_KEY"]'], ['click', '.prow[data-go="p:xo-coworker"]'], ['wait', 900], ['open'], ['screen'], ['value', '[data-lp-env="XO_API_KEY"]']],
  'lost-still': [['wait', 21000], ['screen'], ['count', '.lpm .arc'], ['count', '.lpm-l.flow'], ['text', '.lpm-meta']],
  // Astra on 4026444: a validation redraw must not write a typed secret into markup, open or closed
  'secret-redraw': [['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_sentinel_42'], ['fill', '[data-lp-f="port"]', 'bad'], ['click', '[data-lp="deploy"]'], ['wait', 400], ['screen'], ['value', '[data-lp-env="XO_API_KEY"]'], ['leak', 'xo_sk_sentinel_42'], ['click', '[data-stg-close]'], ['wait', 300], ['leak', 'xo_sk_sentinel_42'], ['click', '[data-lp-open]'], ['wait', 600], ['leak', 'xo_sk_sentinel_42']],
  'secret-redraw-edit': [['wait', 1200], ['click', '[data-lp="edit"]'], ['wait', 300], ['fill', '[data-lp-env="XO_API_KEY"]', 'xo_sk_sentinel_42'], ['fill', '[data-lp-f="port"]', 'bad'], ['click', '[data-lp="deploy"]'], ['wait', 400], ['screen'], ['leak', 'xo_sk_sentinel_42'], ['click', '[data-stg-close]'], ['wait', 300], ['leak', 'xo_sk_sentinel_42']],
  // the machine (xo-space 3886701): a size from what the template allows, a disk at creation, what's sent
  'size-pick': [['wait', 1200], ['text', '.lp-set .lp-f:has([data-lp="machine-open"])'], ['click', '[data-lp="machine-open"]'], ['wait', 300], ['value', '[data-lp-f="size"]'], ['text', '#lp-h-size'], ['select', '[data-lp-f="size"]', 'xo.small'], ['text', '#lp-h-size'], ['click', '[data-lp="disk-add"]'], ['wait', 300], ['fill', '[data-lp-f="diskPath"]', '/data'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['sent'], ['text', '.lpm-env']],
  'size-default': [['wait', 1200], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['sent'], ['text', '.lpm-env']],
  'size-fallback': [['wait', 1200], ['click', '[data-lp="machine-open"]'], ['wait', 300], ['value', '[data-lp-f="size"]'], ['count', '[data-lp-f="size"] option'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['sent']],
  'disk-bad': [['wait', 1200], ['click', '[data-lp="machine-open"]'], ['wait', 300], ['click', '[data-lp="disk-add"]'], ['wait', 300], ['fill', '[data-lp-f="diskPath"]', 'data'], ['click', '[data-lp="deploy"]'], ['wait', 300], ['screen'], ['text', '#lp-h-disk'], ['fill', '[data-lp-f="diskPath"]', '/'], ['click', '[data-lp="deploy"]'], ['wait', 300], ['text', '#lp-h-disk'], ['fill', '[data-lp-f="diskPath"]', '/srv/../etc'], ['click', '[data-lp="deploy"]'], ['wait', 300], ['text', '#lp-h-disk'], ['fill', '[data-lp-f="diskPath"]', '/data'], ['fill', '[data-lp-f="diskGb"]', '30'], ['click', '[data-lp="deploy"]'], ['wait', 300], ['text', '#lp-h-disk'], ['click', '[data-lp="disk-remove"]'], ['wait', 300], ['count', '[data-lp-f="diskPath"]']],
  'size-refused': [['wait', 1200], ['click', '[data-lp="machine-open"]'], ['wait', 300], ['select', '[data-lp-f="size"]', 'xo.large'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['text', '#lp-h-size'], ['value', '[data-lp-f="size"]'], ['focused']],
  'grow-disk': [['wait', 1200], ['click', '[data-lp="edit"]'], ['wait', 300], ['text', '.lp-ro'], ['value', '[data-lp-f="diskGb"]'], ['fill', '[data-lp-f="diskGb"]', '1'], ['click', '[data-lp="deploy"]'], ['wait', 300], ['text', '#lp-h-disk'], ['fill', '[data-lp-f="diskGb"]', '5'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['screen'], ['sent'], ['text', '.lpm-env']],
  'nodisk-edit': [['wait', 1200], ['click', '[data-lp="edit"]'], ['wait', 300], ['text', '#lp-h-disk'], ['count', '[data-lp-f="diskGb"]'], ['click', '[data-lp="deploy"]'], ['wait', 4500], ['sent']],
  'old-space': [['wait', 1200], ['count', '.lpm-env'], ['click', '[data-lp="edit"]'], ['wait', 300], ['count', '.lp-ro'], ['count', '[data-lp-f="diskGb"]']],
  'live-domain': [['wait', 1500], ['head'], ['text', '.lpm-host']],
  'no-built-address': [['wait', 1200], ['fill', '[data-lp-f="name"]', 'my-shop'], ['wait', 200], ['text', '.lpm'], ['leak', 'my-shop-xo']],
  // Astra on b33d3eb: settings reachable without an environment; a long disk path wraps whole; Tab never lands
  // behind the sticky Deploy
  'disk-noenv': [['wait', 1500], ['count', '[data-lp="edit"]'], ['text', '.lpm-env'], ['click', '[data-lp="edit"]'], ['wait', 300], ['screen'], ['value', '[data-lp-f="diskGb"]'], ['text', '.lp-at'], ['overflow']],
  'tab-under-foot': [['wait', 1500], ['under-foot']],
  'tab-under-foot-edit': [['wait', 1500], ['click', '[data-lp="edit"]'], ['wait', 300], ['under-foot']],
  building: [['wait', 600], ['screen'], ['text', '.lpv-img .lpv-rel'], ['click', '[data-lp="hide"]'], ['wait', 300], ['head'], ['click', '[data-lp-open]'], ['wait', 300], ['open']],
};
(async () => {
  const b = await chromium.launch({ executablePath: EXE });
  for (const [sc, steps] of Object.entries(FLOWS).filter(([k]) => !process.env.ONLY || process.env.ONLY.split(',').includes(k))) {
    const ctx = await b.newContext({ viewport: process.env.PHONE ? { width: 390, height: 844 } : process.env.VP ? { width: +process.env.VP.split('x')[0], height: +process.env.VP.split('x')[1] } : { width: 1440, height: 900 }, isMobile: !!process.env.PHONE, hasTouch: !!process.env.PHONE });
    await ctx.addInitScript(() => { localStorage.removeItem('xo-stage'); localStorage.removeItem('xo-lp-state'); });
    // Astra's repro: frames 250 ms apart, so an import and its preflight both land before the next paint
    if (sc === 'gh-import-slow') await ctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (f) => setTimeout(() => raf(f), 250); });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    if (sc === 'lp-link-slowpre' || sc === 'lp-link-watch-slowpre') page.__slowPre = 500; // Astra's race: preflight answers half a second late
    await install(page, { 'scope-enter': 'scope', 'esc-field': 'ready', pressed: 'ready', 'deploy-esc': 'ready', 'tab-trap': 'ready', 'tab-walk': 'ready', 'gh-import-slow': 'gh-import', 'lp-link': 'play', 'lp-link-linked': 'live', 'lp-link-slowpre': 'play', 'lp-link-watch-slowpre': 'just-live', 'edit-env': 'live', 'edit-behind': 'live-behind', 'again-behind': 'live-behind', 'live-change': 'play', 'secret-close': 'ready', 'secret-fold': 'ready', 'secret-undo-close': 'play', 'secret-project': 'ready', 'lost-still': 'lost', 'size-pick': 'play', 'size-default': 'play', 'size-fallback': 'sizes-fallback', 'disk-bad': 'ready', 'grow-disk': 'live', 'nodisk-edit': 'live-nodisk', 'old-space': 'live-oldspace', 'no-built-address': 'ready', 'disk-noenv': 'live-noenv-disk', 'tab-under-foot': 'ready', 'tab-under-foot-edit': 'live', 'secret-redraw': 'ready', 'secret-redraw-edit': 'live' }[sc] || sc);
    await page.goto('http://127.0.0.1:3466/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.prow[data-go="p:xo-coworker"]'), null, { timeout: 45000 });
    await page.evaluate(() => document.querySelector('.prow[data-go="p:xo-coworker"]').click());
    await page.waitForTimeout(800);
    await page.evaluate(() => { const n = [...document.querySelectorAll('#main .nw')].find((x) => x.textContent.includes('Deploy on Launchpad')); n && n.click(); });
    await page.waitForTimeout(800);
    await page.evaluate(() => document.querySelector('[data-lp-open]')?.click());
    await page.waitForTimeout(600);
    const out = [];
    for (const [k, a, ...args] of steps) {
      if (k === 'click') await page.evaluate((s) => document.querySelector(s)?.click(), a);
      else if (k === 'wait') await page.waitForTimeout(a);
      else if (k === 'key') { await page.focus(a); await page.keyboard.press(steps.find((x) => x[1] === a)[2]); }
      else if (k === 'pressed') out.push(await page.evaluate(() => { const b = document.querySelector('[data-lp-open]'); return `${b.getAttribute('aria-pressed')}/${b.classList.contains('is-on')}/${!document.querySelector('[data-fr="launch"]').classList.contains('is-folded') && document.body.classList.contains('stage-open')}`; }));
      else if (k === 'press') await page.keyboard.press(a);
      else if (k === 'fill') await page.fill(a, args[0]);
      else if (k === 'sent') out.push('sent:' + JSON.stringify((({ rebuild = false, env = {}, size, storage_path, storage_size }) => ({ rebuild, env: Object.keys(env), ...(size ? { size } : {}), ...(storage_path ? { storage_path, storage_size } : {}) }))((page.__sent || []).at(-1) || {})));
      else if (k === 'select') await page.selectOption(a, args[0]);
      // where a string is found: the markup (attributes, outerHTML) or a live input's value
      else if (k === 'leak') out.push('leak:' + await page.evaluate((x) => [document.documentElement.outerHTML.includes(x) ? 'markup' : '', [...document.querySelectorAll('input')].some((i) => i.value === x || i.defaultValue === x) ? 'input' : ''].filter(Boolean).join('+') || 'none', a));
      else if (k === 'focused') out.push('focused:' + await page.evaluate(() => document.activeElement?.dataset?.lpF || document.activeElement?.dataset?.lp || document.activeElement?.tagName));
      // anything in the section wider than the pane (cut at its edge)
      else if (k === 'overflow') out.push('overflow:' + await page.evaluate(() => { const b = document.querySelector('#fr-body-launch'), R = b.getBoundingClientRect().right; return [...b.querySelectorAll('*')].filter((n) => n.offsetParent && n.getBoundingClientRect().right > R + 0.5).map((n) => n.className || n.tagName).slice(0, 3).join(',') || 'none'; }));
      // Tab and Shift+Tab through the section: which focused controls sit behind the sticky foot
      else if (k === 'under-foot') { const hid = new Set(); for (const key of ['Tab', 'Shift+Tab']) { await page.evaluate(() => document.querySelector(key === 'Tab' ? '#fr-body-launch' : '[data-lp="deploy"]')?.focus(), null).catch(() => {}); await page.evaluate((k) => (k === 'Tab' ? document.querySelector('#fr-body-launch .lp-set input, #fr-body-launch .lp-in') : document.querySelector('#fr-body-launch .lp-foot .lp-go'))?.focus(), key); for (let i = 0; i < 14; i++) { await page.keyboard.press(key); await page.waitForTimeout(60); const r = await page.evaluate(() => { const a = document.activeElement, f = document.querySelector('#fr-body-launch .lp-foot'); if (!a || !f || f.contains(a) || !document.querySelector('#fr-body-launch').contains(a)) return ''; const x = a.getBoundingClientRect(), y = f.getBoundingClientRect(); return x.bottom > y.top + 1 ? (a.dataset.lpEnv || a.dataset.lpF || a.dataset.lp || a.tagName) : ''; }); if (r) hid.add(r); } } out.push('under-foot:' + ([...hid].join(',') || 'none')); }
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
      else if (k === 'href') out.push('href:' + await page.evaluate((s) => [...document.querySelectorAll(s)].map((a) => a.href).find((h) => /launchpad/.test(h)) || '(none)', a));
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
