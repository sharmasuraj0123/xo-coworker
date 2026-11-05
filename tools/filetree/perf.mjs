// Files tree timings: see README.md. node tools/filetree/perf.mjs <port> [cpu throttle] [open rows, comma-separated]
// Files tree, before vs after: folder clicks, renders, search and scroll with thousands of rows open (real repo, 4× CPU)
import { loadSet, open } from "./lib.mjs";
const [port, thr = "4", targetsArg = "2000,6000"] = process.argv.slice(2);
const throttle = Number(thr);
const set = loadSet("real");
const out = { port, throttle };
const log = (k, v) => { out[k] = v; console.error(k, JSON.stringify(v)); };
async function scrollFrames(page) {
  const box = await page.evaluate(() => { const r = document.querySelector("#ours .fl-list").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.move(box.x, box.y);
  await page.evaluate(() => { window.FR = []; window.LT.length = 0; let last = performance.now(); window.FRon = true; const f = (t) => { window.FR.push(t - last); last = t; if (window.FRon) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  for (let i = 0; i < 60; i++) { await page.mouse.wheel(0, 140); await page.waitForTimeout(16); }
  await page.waitForTimeout(200);
  return page.evaluate(() => { window.FRon = false; const fr = window.FR.slice(2).sort((a, b) => a - b); const p = (q) => Math.round(fr[Math.floor(fr.length * q)] || 0); return { frames: fr.length, p50: p(.5), p95: p(.95), over50: fr.filter((x) => x > 50).length, maxLong: Math.round(Math.max(0, ...window.LT)) }; });
}
const { browser, page, cdp } = await open({ port, set, throttle });
if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS });
log("mount", await page.evaluate(() => timed(async () => { B.mountOurs(); await waitFor("#ours .fl-r"); })));
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
for (const target of targetsArg.split(",").map(Number)) {
  const got = await page.evaluate(async (target) => {
    const t0 = performance.now();
    while (document.querySelectorAll("#ours .fl-r").length < target && performance.now() - t0 < 240000) {
      const b = document.querySelector('#ours [data-fl-dir][aria-expanded="false"]');
      if (!b) break;
      b.click();
      await new Promise((r) => { const f = () => (document.querySelector("#ours .fl-note .spin") ? setTimeout(f, 0) : r()); setTimeout(f, 0); });
    }
    return document.querySelectorAll("#ours .fl-r").length;
  }, target);
  await page.waitForTimeout(500);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  const k = `at${got}`;
  log(`${k}_render_noChange`, await page.evaluate(() => timed(() => B.files.render("p:proj"))));
  // close and reopen the last open folder (deep in the list) and the first one (the top: everything below moves)
  for (const which of ["last", "first"]) {
    const pick = which === "last" ? "o[o.length - 1]" : "o[0]";
    log(`${k}_close_${which}`, await page.evaluate((pick) => timed(() => { const o = document.querySelectorAll('#ours [data-fl-dir][aria-expanded="true"]'); const b = eval(pick); window.__p = b.dataset.flDir; b.focus(); b.click(); }), pick));
    log(`${k}_reopen_${which}`, await page.evaluate(() => timed(() => { document.querySelector(`#ours [data-fl-dir="${CSS.escape(window.__p)}"]`).click(); })));
    log(`${k}_focusKept_${which}`, await page.evaluate(() => document.activeElement?.dataset?.flDir === window.__p));
  }
  log(`${k}_rows`, await page.evaluate(() => document.querySelectorAll("#ours .fl-r").length));
  log(`${k}_search_keystroke`, await page.evaluate(() => timed(() => { const q = document.querySelector("#ours [data-fl-q]"); q.focus(); q.value = "i"; q.dispatchEvent(new Event("input", { bubbles: true })); })));
  log(`${k}_search_clear`, await page.evaluate(() => timed(() => { const q = document.querySelector("#ours [data-fl-q]"); q.value = ""; q.dispatchEvent(new Event("input", { bubbles: true })); })));
  await page.evaluate(() => document.querySelector("#ours [data-fl-q]").blur());
  log(`${k}_scroll`, await scrollFrames(page));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
}
await browser.close();
console.log(JSON.stringify(out));
