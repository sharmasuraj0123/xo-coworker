// The composer as liquid glass (css/glass.css, js/glass/), in all four cells (dark and light, 1440×900 and
// 390×844), on the mock world: it mounts as a refracting surface whose planes are decoration only; the conversation
// passes behind it and nothing shows through below it; it follows a theme switch and its own growth; and reduced
// transparency takes the material away. No page errors and no focus fallen to the page.
//   node tests/browser/glass-composer.test.cjs
"use strict";
const assert = require("assert/strict");
const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require(PW)); } catch { console.error(`not run: Playwright core isn't at ${PW}`); process.exit(2); }
const H = require("./harness.cjs");

let browser, BASE, WIDTH, THEME, passed = 0, failed = 0;
// a conversation long enough to scroll under the composer
const MSGS = Array.from({ length: 16 }, (_, i) => ({ id: "g" + i, seq: i + 1, chat_id: "chat_demo", thread_ts: null, author_kind: i % 3 ? "agent" : "owner", author_id: i % 3 ? "project-coordinator" : "owner", author_session_id: null, text: i % 3 ? "A reply long enough to wrap across the column, so its lines pass under the glass as the conversation scrolls: the shoulder bends them and the centre stays clear." : "Does the composer read well when text passes under it? " + i, reply_to: null, extra: {}, created_at: H.NOW }));
const app = () => H.openApp(browser, BASE, { messages: MSGS }, { width: WIDTH, height: WIDTH < 600 ? 844 : 900, theme: THEME });
const done = async (page) => {
  const errs = page.errors, drops = await page.evaluate(() => window.__focusDrops);
  await page.context().close();
  assert.deepEqual(errs, [], "page errors");
  assert.deepEqual(drops, [], "focus fell to the page");
};
const open = async (page) => {
  await page.waitForFunction(() => window.__t && window.__t.world.state.loaded);
  await page.evaluate(() => window.__t.go("p:demo"));
  await page.waitForFunction(() => document.querySelectorAll("#msgs .bubble, #msgs [data-id]").length > 3 && document.getElementById("composer").hasAttribute("data-surface-ready"), null, { timeout: 8000 });
};
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const steps = [
  ["mounts as a refracting surface, its planes decoration only", async (page) => {
    await open(page);
    const s = await page.evaluate(() => {
      const c = document.getElementById("composer"), o = c.querySelector(":scope > .surface-optics"), cs = getComputedStyle(c);
      return { surface: c.classList.contains("surface"), kind: c.dataset.surface, renderer: c.dataset.surfaceRenderer, disp: +c.dataset.surfaceDisplacement,
        hidden: o && o.getAttribute("aria-hidden"), warp: o && getComputedStyle(o.querySelector(".surface-warp")).backdropFilter, base: o && getComputedStyle(o.querySelector(".surface-base")).backdropFilter,
        bg: cs.backgroundColor, border: cs.borderTopColor, pe: o && getComputedStyle(o).pointerEvents,
        cover: o && (() => { const a = o.getBoundingClientRect(), b = c.getBoundingClientRect(); return Math.abs(a.left - b.left) + Math.abs(a.right - b.right) + Math.abs(a.top - b.top) + Math.abs(a.bottom - b.bottom); })(),
        focusable: o ? o.querySelectorAll("button, a, input, textarea, [tabindex]").length : -1 };
    });
    assert.ok(s.surface && s.kind === "composer", "the composer is a glass surface");
    assert.equal(s.renderer, "refractive", "Chromium refracts");
    assert.ok(s.disp > 0, `it bends what's behind it (${s.disp} px)`);
    assert.match(s.warp, /url\(/, "the warp plane carries the displacement filter");
    assert.match(s.base, /blur/, "the base plane diffuses");
    assert.equal(s.hidden, "true", "the planes are hidden from assistive tech");
    assert.equal(s.pe, "none", "the planes take no pointer");
    assert.equal(s.focusable, 0, "nothing focusable in the planes");
    assert.ok(s.cover < 0.5, `the planes cover the composer's border box exactly (off by ${s.cover})`);
    assert.equal(s.bg, "rgba(0, 0, 0, 0)", "no fill of its own: the glass is the fill");
    assert.equal(s.border, "rgba(0, 0, 0, 0)", "no drawn border");
  }],
  ["the conversation passes behind it, and nothing shows below it", async (page) => {
    await open(page);
    await page.evaluate(() => { const s = document.getElementById("scroller"); s.scrollTop = s.scrollHeight - s.clientHeight - 240; });
    await frames(page); await page.waitForTimeout(150);
    const g = await page.evaluate(() => {
      const c = document.getElementById("composer").getBoundingClientRect();
      const msgs = document.getElementById("msgs"), xs = [0.2, 0.35, 0.5, 0.65, 0.8].map((f) => c.left + c.width * f);
      const under = xs.some((x) => [c.top + 14, c.top + c.height / 2].some((y) => document.elementsFromPoint(x, y).some((e) => e !== msgs && msgs.contains(e))));
      return { under, x: c.left, w: c.width, bottom: c.bottom, vh: innerHeight };
    });
    assert.ok(g.under, "a message lies behind the composer");
    // the strip under the composer: its rows may carry the composer's shadow, but no text (a row of text varies along x)
    const top = Math.ceil(g.bottom) + 2, h = Math.floor(g.vh - top);
    if (h < 3) return "skip: no strip under the composer at this size";
    const px = H.pngPixels(await page.screenshot({ clip: { x: Math.round(g.x + 40), y: top, width: Math.round(g.w - 80), height: h } }));
    let worst = 0;
    for (let y = 0; y < px.h; y++) { let lo = 255, hi = 0; for (let x = 0; x < px.w; x++) { const i = (y * px.w + x) * px.bpp, v = (px.data[i] + px.data[i + 1] + px.data[i + 2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v); } worst = Math.max(worst, hi - lo); }
    assert.ok(worst < 6, `nothing of the conversation shows below the composer (a row varies by ${worst.toFixed(1)})`);
  }],
  ["follows a theme switch and its own growth", async (page) => {
    await open(page);
    const tint = () => page.evaluate(() => getComputedStyle(document.getElementById("composer")).getPropertyValue("--surface-tint").trim());
    const before = await tint();
    await page.evaluate(() => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "light" ? "dark" : "light"; });
    await frames(page);
    assert.notEqual(await tint(), before, "the other theme's material");
    await page.evaluate(() => { const r = document.documentElement; r.dataset.theme = r.dataset.theme === "light" ? "dark" : "light"; });
    await frames(page);
    assert.equal(await tint(), before, "and back");
    const h0 = await page.evaluate(() => document.getElementById("composer").offsetHeight);
    await page.locator("#say").click();
    await page.keyboard.type("one");
    for (const w of ["two", "three", "four"]) { await page.keyboard.press("Shift+Enter"); await page.keyboard.type(w); }
    await frames(page); await frames(page);
    const g = await page.evaluate(() => { const c = document.getElementById("composer"), cv = c.querySelector(".surface-reflection"); return { h: c.offsetHeight, w: c.offsetWidth, ch: cv.height, cw: cv.width, ready: c.hasAttribute("data-surface-ready") }; });
    assert.ok(g.h > h0 + 40, `it grew with four lines (${h0} → ${g.h})`);
    assert.ok(g.ready, "still refracting");
    assert.ok(Math.abs(g.ch / g.h - g.cw / g.w) < 0.02, `its light is drawn for its new size (${g.cw}×${g.ch} for ${g.w}×${g.h})`);
    await page.keyboard.press("Escape");
  }],
  ["reduced transparency: no material, an opaque fill", async (page) => {
    await open(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
    await frames(page);
    const r = await page.evaluate(() => { const o = document.querySelector("#composer > .surface-optics"); return { m: matchMedia("(prefers-reduced-transparency: reduce)").matches, base: getComputedStyle(o.querySelector(".surface-base")).backdropFilter, warp: getComputedStyle(o.querySelector(".surface-warp")).backdropFilter, tint: getComputedStyle(o.querySelector(".surface-tint")).backgroundImage, fill: getComputedStyle(o.querySelector(".surface-tint")).backgroundColor }; });
    if (!r.m) return "skip: this Chromium can't emulate prefers-reduced-transparency";
    assert.equal(r.base, "none", "no blur");
    assert.equal(r.warp, "none", "no refraction");
    assert.equal(r.tint, "none", "no gradient");
    assert.match(r.fill, /^rgb\(/, `an opaque fill (${r.fill})`);
  }],
  ["Settings › General › Chat bar: Stone glass gives back the composer as it was, Liquid glass brings the glass, and it holds a reload", async (page) => {
    await open(page);
    const look = () => page.evaluate(() => { const c = document.getElementById("composer"), cs = getComputedStyle(c), bar = c.parentElement;
      return { data: document.documentElement.dataset.bar, surface: c.classList.contains("surface"), optics: !!c.querySelector(".surface-optics"), bg: cs.backgroundColor, border: cs.borderTopColor, cbar: getComputedStyle(bar).backgroundImage, attrs: [...c.attributes].map((a) => a.name).filter((n) => n.startsWith("data-surface")), style: c.getAttribute("style") || "" }; });
    const glass = await look();
    assert.ok(glass.surface && glass.optics && glass.data === "glass", "liquid glass by default");
    if (WIDTH < 600) { await page.evaluate(() => window.__t.go("home")); await page.waitForTimeout(200); }
    await page.locator(WIDTH < 600 ? "#set-phone" : "#set-side").filter({ visible: true }).first().click();
    await page.waitForSelector("#settings:not([hidden])");
    const seg = page.locator("#bar-seg");
    assert.ok(await seg.isVisible(), "the Chat bar choice is on General");
    assert.equal(await seg.locator('[aria-checked="true"]').textContent(), "Liquid glass");
    await seg.locator('[data-bar="stone"]').click();
    assert.equal(await seg.locator('[aria-checked="true"]').textContent(), "Stone glass");
    const stone = await look();
    assert.equal(stone.data, "stone");
    assert.ok(!stone.surface && !stone.optics, "no glass left on the composer");
    assert.deepEqual(stone.attrs, [], "none of the renderer's attributes left");
    assert.equal(stone.style, "", "none of its styles left");
    assert.notEqual(stone.bg, "rgba(0, 0, 0, 0)", "the stone fill is back");
    assert.notEqual(stone.border, "rgba(0, 0, 0, 0)", "and its line");
    assert.notEqual(stone.cbar, glass.cbar, "the bar fades out above the composer again");
    // the keyboard: arrows move the choice, as a radio group's do
    await seg.locator('[data-bar="stone"]').focus();
    await page.keyboard.press("ArrowLeft");
    assert.equal((await look()).data, "glass", "ArrowLeft chooses Liquid glass");
    assert.ok((await look()).surface, "and the glass is back");
    await page.keyboard.press("ArrowRight");
    assert.equal((await look()).data, "stone");
    await page.keyboard.press("Escape");
    await page.reload();
    await page.waitForFunction(() => window.__t && window.__t.world.state.loaded);
    await page.evaluate(() => window.__t.go("p:demo"));
    await page.waitForTimeout(300);
    const after = await look();
    assert.ok(after.data === "stone" && !after.surface, "stone glass holds a reload");
    await page.evaluate(() => localStorage.removeItem("cv-bar"));
  }],
];
(async () => {
  browser = await H.launch(chromium);
  if (!browser) { console.error("not run: no Chromium starts here"); process.exit(2); }
  const server = await H.serve();
  BASE = `http://127.0.0.1:${server.address().port}`;
  for (const [w, th] of [[1440, "dark"], [1440, "light"], [390, "dark"], [390, "light"]]) {
    WIDTH = w; THEME = th;
    for (const [name, fn] of steps) {
      const label = `${name} [${w} ${th}]`;
      let page;
      try {
        page = await app();
        const theme = await page.evaluate(() => document.documentElement.dataset.theme);
        assert.equal(theme, th, "the cell's theme");
        const r = await fn(page);
        if (typeof r === "string" && r.startsWith("skip")) { await page.context().close(); console.log(`  skip ${label} (${r.slice(6)})`); continue; }
        await done(page); passed++; console.log("  ok  " + label);
      } catch (e) { failed++; console.error("  FAIL " + label + "\n" + String(e.stack || e).split("\n").slice(0, 4).join("\n")); try { await page?.context().close(); } catch { /* gone */ } }
    }
  }
  await browser.close(); server.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
