// Mock create-project placements on :3400 in a read-only browser (non-GET blocked). Nothing on disk changes.
// Usage: node variants.cjs <outdir> [variant...]
const L = require('/home/coder/xo-coworker/.xo/worktrees/thread-cmsg_c86b6e5b7af94752/design-research/2026-11-vision/audit/tools/lib.cjs');
const out = process.argv[2];
const only = process.argv.slice(3);
const CSS = `
/* A: Home header pill, always there */
/* B: the + on Projects grows a word */
.side-plus.v-new{width:auto;height:24px;margin-right:0;padding:0 9px 0 6px;gap:4px;display:flex;align-items:center;border-radius:var(--r);background:var(--g22);box-shadow:var(--hairline);color:var(--ink-2);font:500 var(--fs-sm)/1 var(--sans)}
.side-plus.v-new::before{display:none}
.side-plus.v-new svg{width:12px;height:12px;color:var(--accent-fill);stroke-width:2.4}
.side-plus.v-new:hover{color:var(--ink);background:var(--g26)}
:root[data-theme="light"] .side-plus.v-new{background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.1),var(--lift-1)}
:root[data-theme="light"] .side-plus.v-new svg{color:#3f7a14}
/* C: Find and Create side by side */
.v-findrow{display:flex;gap:8px;margin:0 12px 8px}
.v-findrow .side-find{flex:1;margin:0;min-width:0}
.v-sq{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--accent-fill);color:var(--accent-ink);box-shadow:0 1px 0 rgba(255,255,255,.25) inset,0 4px 12px rgb(0 0 0 / calc(.25 * var(--sha)))}
.v-sq svg{width:15px;height:15px;stroke-width:2.3}
/* D: Workspace header action */
.v-wsnew{height:34px;padding:0 13px 0 5px;gap:8px;border-radius:11px;font-size:var(--fs-sm)}
.v-wsnew .create-ic{width:24px;height:24px;border-radius:7px}
.v-wsnew .create-ic svg{width:13px;height:13px}
`;
const V = {
  A: { go: 'home', fn: (plus) => {
    const top = document.querySelector('#hm-head .hm-top');
    if (!top.querySelector('.create')) top.insertAdjacentHTML('beforeend', `<button type="button" class="create"><span class="create-ic">${plus}</span><span>Create XO Project</span></button>`);
  } },
  B: { go: 'home', fn: (plus) => {
    const b = document.querySelector('#side-add'); b.classList.add('v-new'); b.innerHTML = plus + '<span>New</span>';
  } },
  C: { go: 'home', fn: (plus) => {
    document.querySelector('#side-add').style.display = 'none';
    const f = document.querySelector('#side-find'); const w = document.createElement('div'); w.className = 'v-findrow';
    f.before(w); w.append(f); w.insertAdjacentHTML('beforeend', `<button type="button" class="v-sq" aria-label="Create XO Project">${plus}</button>`);
  } },
  D: { go: 'ws', fn: (plus) => {
    const e = document.querySelector('#top-end'); e.style.display = 'flex'; e.style.alignItems = 'center'; e.style.gap = '8px';
    e.insertAdjacentHTML('afterbegin', `<button type="button" class="create v-wsnew"><span class="create-ic">${plus}</span><span>New project</span></button>`);
  } },
};
(async () => {
  process.env.XO_URL = 'http://127.0.0.1:3400/';
  for (const s of ['dark', 'light']) {
    const { browser, page, blocked } = await L.open(s, { width: 1440, height: 900 });
    await page.addStyleTag({ content: CSS });
    const plus = await page.evaluate(() => document.querySelector('#sc-ic').innerHTML);
    for (const k of Object.keys(V)) {
      if (only.length && !only.includes(k)) continue;
      await page.evaluate((g) => document.querySelector(`.nrow[data-go="${g}"]`).click(), V[k].go);
      await page.waitForTimeout(900);
      await page.evaluate(`(${V[k].fn})(${JSON.stringify(plus)})`);
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/${k}-${s}.png` });
      await page.screenshot({ path: `${out}/${k}-${s}-side.png`, clip: { x: 0, y: 0, width: k === 'A' || k === 'D' ? 1440 : 260, height: k === 'A' || k === 'D' ? 220 : 380 } });
      // undo for the next variant
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); await page.addStyleTag({ content: CSS });
    }
    console.log(s, 'blocked', blocked.length);
    await browser.close();
  }
})();
