import { createRequire } from 'module';
const require = createRequire(process.env.HOME + '/.cache/xo-test-deps/node_modules/');
const { chromium } = require('playwright-core');
const exe = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
let URL = 'http://127.0.0.1:3000/';
const out = {};
const init = () => {
  const ofw = window.fetch; window.fetch = function (u, o) { const m = ((o && o.method) || (u && u.method) || 'GET').toUpperCase(); if (m !== 'GET' && m !== 'HEAD') return Promise.reject(new TypeError('probe: writes blocked')); return ofw.apply(this, arguments); };
  const xo = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (m) { if (String(m).toUpperCase() !== 'GET') throw new Error('probe: writes blocked'); return xo.apply(this, arguments); };
  navigator.sendBeacon = () => true;
  window.__p = { fetch: [], lt: [], marks: {}, idle: [] };
  const t0 = performance.now.bind(performance);
  const of = window.fetch;
  window.fetch = async function (u, o) {
    const s = t0(); const url = String(u && u.url || u);
    try { const r = await of.apply(this, arguments); const h = t0();
      if (!/\/stream/.test(url)) r.clone().arrayBuffer().then(b => window.__p.fetch.push({ url, s, h, e: t0(), n: b.byteLength })).catch(()=>{});
      else window.__p.fetch.push({ url, s, h, e: h, n: -1 });
      return r; } catch (e) { window.__p.fetch.push({ url, s, err: String(e) }); throw e; }
  };
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__p.lt.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch {}
  const mark = (k, ok) => { if (!window.__p.marks[k] && ok()) window.__p.marks[k] = Math.round(t0()); };
  const tick = () => {
    mark('sidebarProjects', () => document.querySelectorAll('#projects [data-go^="p:"]').length > 0);
    mark('anyThreadLink', () => document.querySelector('[data-go^="t:"]'));
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  let n = 0; const ric = (d) => { window.__p.idle.push(Math.round(d.timeRemaining())); if (++n < 40) requestIdleCallback(ric); };
  addEventListener('load', () => setTimeout(() => requestIdleCallback(ric), 3000));
};
async function boot(ctx, label, { cpu = 1, net = null, warm = false } = {}) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  if (!warm) await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (net) await cdp.send('Network.emulateNetworkConditions', { offline: false, ...net });
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.addInitScript(init);
  if (warm) { await page.goto(URL, { waitUntil: 'load' }); await page.waitForTimeout(4000); }
  const T = Date.now();
  await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__p.marks.sidebarProjects, null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = Object.fromEntries(performance.getEntriesByType('paint').map(p => [p.name, Math.round(p.startTime)]));
    const res = performance.getEntriesByType('resource');
    const stat = res.filter(x => !x.name.includes('/api/'));
    const js = stat.filter(x => /\.m?js/.test(x.name));
    return {
      nav: { ttfb: Math.round(nav.responseStart), dcl: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd) },
      paint, marks: window.__p.marks,
      staticReq: stat.length, jsReq: js.length, staticBytes: stat.reduce((a, x) => a + (x.transferSize || 0), 0), staticDecoded: stat.reduce((a, x) => a + (x.decodedBodySize || 0), 0),
      lastJsEnd: Math.round(Math.max(...js.map(x => x.responseEnd))), lastStaticEnd: Math.round(Math.max(...stat.map(x => x.responseEnd))),
      jsDepthStarts: [...new Set(js.map(x => Math.round(x.startTime / 25) * 25))].slice(0, 30),
      transfer: stat.reduce((a, x) => a + (x.transferSize || 0), 0), n304ish: stat.filter(x => x.transferSize > 0 && x.transferSize < 1000).length, cached: stat.filter(x => x.transferSize === 0).length,
      api: window.__p.fetch.map(f => ({ u: f.url.replace(/^.*\/api/, '').replace(/[?].*$/, ''), s: Math.round(f.s), h: Math.round(f.h), e: Math.round(f.e), n: f.n })),
      longtasks: window.__p.lt, ltTotal: window.__p.lt.reduce((a, x) => a + x[1], 0), idle: window.__p.idle,
      big: res.filter(x => x.decodedBodySize > 60000).map(x => [x.name.replace(/^.*?3000/, ''), x.decodedBodySize, Math.round(x.startTime), Math.round(x.responseEnd)]),
    };
  });
  out[label] = r;
  return page;
}
async function openThread(page, label, where) {
  // click a thread link: where='panel' inside #stage, 'full' in the main chat (#msgs)
  const res = await page.evaluate(async (where) => {
    const t0 = performance.now();
    const sel = where === 'panel' ? '#stage [data-go^="t:"]' : '#msgs [data-go^="t:"], #main [data-go^="t:"]';
    const cands = [...document.querySelectorAll(sel)].filter(e => e.offsetParent);
    const seen = window.__seenT || (window.__seenT = new Set());
    const el = cands.find(e => !seen.has(e.dataset.go));
    if (!el) return { err: 'no link', n: cands.length, sel };
    seen.add(el.dataset.go);
    const f0 = window.__p.fetch.length;
    const loading = () => [...document.querySelectorAll('[data-k="note"]')].some(n => n.offsetParent && /Loading the thread/.test(n.textContent));
    let sawLoading = null, gone = null, rows = null;
    el.click();
    const t1 = performance.now();
    await new Promise(res => { const st = performance.now(); const f = () => {
      const now = performance.now();
      if (loading()) sawLoading ??= now - t1;
      const r = [...document.querySelectorAll('[data-k]:not([data-k=note]):not([data-k=hist])')].filter(e => e.offsetParent).length;
      if (sawLoading != null && !loading() && gone == null) gone = now - t1;
      if (gone != null && rows == null) rows = now - t1;
      if ((gone != null && now - t1 > gone + 300) || now - st > 20000) return res(); requestAnimationFrame(f); }; requestAnimationFrame(f); });
    const api = window.__p.fetch.slice(f0).map(f => ({ u: f.url.replace(/^.*\/api/, '').slice(0, 90), s: Math.round(f.s - t1), h: Math.round(f.h - t1), e: Math.round(f.e - t1), n: f.n }));
    const lt = window.__p.lt.filter(x => x[0] > t1 - 5).map(x => [Math.round(x[0] - t1), x[1]]);
    return { go: el.dataset.go, clickHandler: Math.round(t1 - t0), loadingShownAt: sawLoading && Math.round(sawLoading), loadingGoneAt: gone && Math.round(gone), api, longtasks: lt };
  }, where);
  out[label] = res;
}
const browser = await chromium.launch({ executablePath: exe, args: ['--force-device-scale-factor=1'] });
const REMOTE = { cpu: 4, net: { latency: 60, downloadThroughput: 3_000_000, uploadThroughput: 1_000_000 } };
try {
  for (const [name, port] of [['before', 3000], ['after', 5193]]) {
    URL = `http://127.0.0.1:${port}/`;
    for (const [lbl, opt] of [['local', {}], ['remote', REMOTE]]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      await ctx.addInitScript(() => { try { localStorage.setItem('cv-theme', 'dark'); } catch {} });
      const page = await boot(ctx, `${name}_cold_${lbl}`, opt);
      await page.click('[data-go="p:xo-coworker"]').catch(() => {});
      await page.waitForTimeout(2500);
      await openThread(page, `${name}_thread_full_${lbl}`, 'full');
      await page.close();
      await boot(ctx, `${name}_warm_${lbl}`, { ...opt, warm: true });
      await ctx.close();
    }
  }
} finally { await browser.close(); }
const fs = await import('fs'); fs.writeFileSync('/tmp/perfprobe/out2.json', JSON.stringify(out, null, 1));
console.log('done');
