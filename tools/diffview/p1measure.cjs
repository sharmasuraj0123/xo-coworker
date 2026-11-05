// P1's numbers: a chip's click in the chat → its diff drawn in the panel (time, long tasks), and whether
// anything in the conversation moved (the row you clicked in, measured before and after), with the panel
// open and with it closed (it opens). 1× and 4× CPU. Real patches (fake-changes.cjs), the app read-only.
//
//   THREAD=cmsg_5d3d55e99c1948b6 BASE='abb3844^' node tools/diffview/p1measure.cjs http://127.0.0.1:5262/ out.json
const H = require('./panel.cjs');
const { writeFileSync } = require('node:fs');
const OUT = process.argv[3];

async function scene(cpu, panelOpen, rest) {
  const { browser, page, log } = await H.open('dark', { dpr: 1, ls: { 'xo-stage': JSON.stringify({ open: panelOpen }) } });
  await H.thread(page);
  if (panelOpen) await H.panel(page);
  // bring a chip with counts into the middle of the conversation (paging back as a person would)
  await page.mouse.move(700, 500);
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => { const c = [...document.querySelectorAll('.tb-cf')].filter((x) => x.querySelector('.xd-n')).pop(); if (c) { c.scrollIntoView({ block: 'center' }); return true; } return false; });
    if (ok) break;
    await page.mouse.wheel(0, -2500); await page.waitForTimeout(350);
  }
  await page.waitForTimeout(1500); // the idle warm-up (prefetch) has run
  const cdp = await page.context().newCDPSession(page);
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  // a person's pointer rests on the chip before the click (rest ms), as a hand does
  const box = await page.evaluate(() => { const c = [...document.querySelectorAll('.tb-cf')].filter((x) => x.querySelector('.xd-n') && !x.classList.contains('is-on')).pop(); const r = c.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (rest) { await page.mouse.move(box.x, box.y); await page.waitForTimeout(rest); }
  const r = await page.evaluate(async () => {
    const lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }).observe({ type: 'longtask' });
    const chips = [...document.querySelectorAll('.tb-cf')].filter((x) => x.querySelector('.xd-n') && !x.classList.contains('is-on'));
    const chip = chips.pop();
    const row = chip.closest('[data-k]'), key = row.dataset.k;
    const before = row.getBoundingClientRect().top;
    const name = chip.querySelector('.tb-cfn').textContent;
    const t0 = performance.now();
    chip.click();
    let t = null;
    for (let i = 0; i < 600; i++) {
      await new Promise((res) => requestAnimationFrame(res));
      const r = document.querySelector('#stage .cx-pd diffs-container')?.shadowRoot;
      const sel = document.querySelector('#stage .cx-r.is-on .cx-n')?.textContent;
      if (r && r.querySelector('[data-line]') && sel === name) { t = performance.now() - t0; break; }
    }
    await new Promise((res) => setTimeout(res, 400));
    const after = document.querySelector(`[data-k="${CSS.escape(key)}"]`)?.getBoundingClientRect().top;
    return { file: name, drawMs: t && Math.round(t), longTasks: lt, rowMovedPx: after == null ? 'gone' : Math.round(after - before), chipOn: !!document.querySelector('.tb-cf.is-on'), panelWidth: Math.round(document.getElementById('stage').getBoundingClientRect().width) };
  });
  await browser.close();
  return { cpu, panelOpen, restMs: rest, ...r, errors: log.errors, blocked: log.blocked.length };
}

(async () => {
  const all = [];
  for (const cpu of [1, 4]) for (const open of [true, false]) for (const rest of [0, 300]) { const r = await scene(cpu, open, rest); console.log(JSON.stringify(r)); all.push(r); }
  if (OUT) writeFileSync(OUT, JSON.stringify(all, null, 1) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
