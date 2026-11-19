// Mockups of "a thread as a page in the panel", built from the live app's own rendered thread (read-only).
// node tmock.cjs <outdir> <variant: beside|focus|files|phone> <theme>
const { chromium } = require(process.env.HOME + '/.cache/xo-test-deps/node_modules/playwright-core');
const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const [out, variant = 'beside', theme = 'dark'] = process.argv.slice(2);
const TID = 'cmsg_d1bb6487880a4733', PID = 'xo-coworker';
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const phone = variant === 'phone';
  const ctx = await b.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => localStorage.setItem('cv-theme', t), theme);
  const p = await ctx.newPage();
  await p.route('**/*', (r) => (r.request().method() !== 'GET' ? r.abort() : r.continue()));
  await p.goto('http://127.0.0.1:3611/', { waitUntil: 'domcontentloaded' });
  await p.waitForSelector('#nv-home', { timeout: 60000 }); await p.waitForTimeout(2500);
  const go = (v) => p.evaluate((v) => { const e = document.createElement('button'); e.dataset.go = v; e.hidden = true; document.querySelector('#main').append(e); e.click(); e.remove(); }, v);
  // 1. the thread, as the app draws it: its checklist bar, its last messages, its composer
  await go('t:' + TID); await p.waitForTimeout(3500);
  const T = await p.evaluate(() => {
    const msgs = document.querySelector('#msgs');
    const kids = [...msgs.children].slice(-7).map((c) => c.outerHTML).join('');
    return { title: document.querySelector('#conv-title')?.textContent || 'Thread', badge: document.querySelector('#top-who .badge')?.outerHTML || '', thead: document.querySelector('#thead .ckbar')?.outerHTML || '', msgs: kids, msgsClass: msgs.className, colClass: document.querySelector('#column').className, composer: document.querySelector('#composer').outerHTML, target: document.querySelector('#target')?.innerText || '' };
  });
  // 2. the coordinator's chat, and the panel showing the thread as its page
  await go('p:' + PID); await p.waitForTimeout(2500);
  if (!phone) await p.click('.th-ctl'); else { await p.evaluate(() => document.querySelector('[data-stage-toggle], .th-ctl')?.click()); }
  await p.waitForTimeout(1200);
  await p.evaluate(({ T, variant, phone }) => {
    const st = document.querySelector('#stage');
    if (!phone && variant !== 'focus') document.documentElement.style.setProperty('--sw', variant === 'files' ? '640px' : '560px');
    if (variant === 'focus') document.querySelector('[data-stg-full]')?.click();
    st.classList.add('is-shell', 'is-page');
    const ic = (name) => document.querySelector(`svg[data-xi="${name}"]`)?.outerHTML || '';
    const back = `<button type="button" class="stg-ic" title="Back to the panel's sections" aria-label="Sections">${ic('chevron-left')}</button>`;
    const tabs = variant === 'files'
      ? `<span class="pg-tabs"><button class="pg-tab is-on">${ic('thread') || ''}<span>${T.title.slice(0, 26)}…</span></button><button class="pg-tab"><span class="pg-fi">${document.querySelector('svg.fi')?.outerHTML || ''}</span><span>FILES-IN-PANEL.md</span></button></span>`
      : `<b class="stg-name" title="${T.title}">${T.title}</b>`;
    st.querySelector('.stg-t').innerHTML = back + tabs;
    const host = st.querySelector('.stg-shell');
    host.innerHTML = `<div class="tp-head">${T.badge}<span class="tp-sub">Claude Code · xo/thread-305201</span><button class="stg-ic tp-more">${ic('more')}</button></div>` +
      `<div class="tp-ck">${T.thead}</div><div class="tp-scroll"><div class="${T.colClass} tp-col"><div id="msgs" class="${T.msgsClass}">${T.msgs}</div></div></div>` +
      `<div class="tp-comp">${T.composer.replace(/id="[^"]*"/g, '')}</div>`;
    const css = document.createElement('style');
    css.textContent = `
      .stage.is-page .stg-t{display:flex;align-items:center;gap:var(--s-2);min-width:0}
      .stage.is-page .stg-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tp-head{display:flex;align-items:center;gap:var(--s-2);padding:var(--s-2) var(--s-4);border-bottom:1px solid var(--panel-line,var(--line-soft))}
      .tp-sub{font:var(--fw-regular) var(--fs-sm)/var(--lh-12) var(--mono);color:var(--ink-4);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
      .tp-more{margin-left:auto}
      .tp-ck .ckbar{border-radius:0}
      .tp-scroll{flex:1;min-height:0;overflow:auto;padding:var(--s-4) var(--s-5) 0}
      .tp-col{width:auto!important;max-width:none!important;margin:0!important;padding:0!important}
      .tp-comp{padding:var(--s-3) var(--s-4) var(--s-4)}
      .tp-comp .composer{width:auto;max-width:none;margin:0}
      body.stage-full .tp-col{max-width:768px!important;margin:0 auto!important} body.stage-full .tp-comp .composer{max-width:768px;margin:0 auto}
      .pg-tabs{display:flex;gap:var(--s-1);min-width:0}
      .pg-tab{display:inline-flex;align-items:center;gap:var(--s-2);height:var(--h-sm);padding:0 var(--s-2);border-radius:var(--r-sm);color:var(--ink-3);font:var(--fw-medium) var(--fs-sm)/var(--lh-12) var(--sans);white-space:nowrap;max-width:200px;overflow:hidden}
      .pg-tab.is-on{background:var(--fill-2);color:var(--ink)}
      .pg-tab svg{width:14px;height:14px;flex:none}
    `;
    document.head.append(css);
    const s = host.querySelector('.tp-scroll'); s.scrollTop = s.scrollHeight;
    if (variant === 'focus') {
      // the coordinator's chat folds to a thin bar at the panel's edge
    }
  }, { T, variant, phone });
  await p.waitForTimeout(800);
  await p.mouse.move(phone ? 200 : 700, phone ? 830 : 880);
  await p.screenshot({ path: `${out}/${variant}-${theme}.png` });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
