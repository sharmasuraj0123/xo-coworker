// The smoke gate (the owner's choice, 9 Nov): before a head goes to the graders, the few things everyone does, in all
// four cells (dark and light, 1440×900 and 390×844), on the mock world: type and send in the message box; open and
// close the panel; switch the theme; fold and unfold the chat beside a file; on a phone, open a file, Back to chat, and
// type. A head is published only when this passes. No page errors and no focus fallen to the page, ever.
//   node tests/browser/smoke.test.cjs
"use strict";
const assert = require("assert/strict");
const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require(PW)); } catch { console.error(`not run: Playwright core isn't at ${PW}`); process.exit(2); }
const H = require("./harness.cjs");
let browser, BASE, WIDTH, THEME, passed = 0, failed = 0;
const FILE = { content: "one\ntwo\nthree\n", version: "sha256:A" };
const app = (W = {}) => H.openApp(browser, BASE, { files: { "note.md": FILE }, ...W }, { width: WIDTH, height: WIDTH < 600 ? 844 : 900, theme: THEME });
const done = async (page) => {
  const errs = page.errors, drops = await page.evaluate(() => window.__focusDrops);
  await page.context().close();
  assert.deepEqual(errs, [], "page errors");
  assert.deepEqual(drops, [], "focus fell to the page");
};
const live = (page) => page.evaluate(() => { const st = window.__t.world.state; st.conn = "live"; st.error = null; st.statusError = null; window.__t.render(); });
// the composer's row whole: Send and the model chip on screen, Send not under the chip (the grader's C111 on a phone)
const rowWhole = (page) => page.evaluate(() => { const vw = innerWidth, b = (id) => { const e = document.getElementById(id); return e && e.getClientRects().length ? e.getBoundingClientRect() : null; }; const s = b("send"), q = b("iq"); return { ok: !!s && s.right <= vw && s.width >= 30 && (!q || (q.right <= s.left + 1 && q.width >= 24)), s: s && [Math.round(s.left), Math.round(s.right)], q: q && [Math.round(q.left), Math.round(q.right)], vw }; });
const typeAndSend = async (page, text) => {
  await live(page);
  const r = await rowWhole(page);
  assert.ok(r.ok, `the composer's row is whole: Send and the chip on screen (${JSON.stringify(r)})`);
  await page.locator("#say").click();
  await page.keyboard.type(text);
  assert.equal(await page.locator("#say").inputValue(), text, "the box takes typing");
  await page.keyboard.press("Enter");
  await page.waitForFunction((text) => Object.values(window.__t.S.local || {}).flat().some((m) => m.text === text), text, { timeout: 5000 });
  assert.equal(await page.locator("#say").inputValue(), "", "sent: the box is empty again");
};
const steps = [
  ["type and send in the message box", async (page) => { await page.evaluate(() => window.__t.go("p:demo")); await page.waitForTimeout(200); await typeAndSend(page, "smoke: hello"); }],
  ["open and close the panel", async (page) => {
    await page.evaluate(() => window.__t.go("p:demo"));
    const toggle = page.locator("[data-stage-toggle]").filter({ visible: true }).first();
    await toggle.click();
    await page.waitForFunction(() => !document.querySelector("#stage").hidden);
    await page.locator("[data-stg-close]").filter({ visible: true }).first().click();
    await page.waitForFunction(() => document.querySelector("#stage").hidden);
    assert.equal(await page.evaluate(() => document.querySelectorAll("[data-stage-inert]").length), 0, "nothing left inert");
    await typeAndSend(page, "smoke: after the panel");
  }],
  ["switch the theme, and back", async (page) => {
    const before = await page.evaluate(() => document.documentElement.dataset.theme || "dark");
    const flip = () => page.evaluate(() => { const b = document.getElementById("theme"); if (b && b.getClientRects().length) { b.click(); return true; } return false; });
    if (!(await flip())) { await page.locator("#top-menu, #pb-menu").filter({ visible: true }).first().click(); await page.waitForTimeout(250); await page.locator("#theme").click(); await page.keyboard.press("Escape"); }
    await page.waitForFunction((b) => (document.documentElement.dataset.theme || "dark") !== b, before);
    if (!(await flip())) { await page.locator("#top-menu, #pb-menu").filter({ visible: true }).first().click(); await page.waitForTimeout(250); await page.locator("#theme").click(); await page.keyboard.press("Escape"); }
    await page.waitForFunction((b) => (document.documentElement.dataset.theme || "dark") === b, before);
  }],
  ["beside a file: fold and unfold the chat, then type", async (page) => {
    await page.evaluate(() => window.__t.go("p:demo"));
    await page.evaluate(() => window.__t.VW.open({ project: "demo", rel: "note.md", path: "note.md", name: "note.md" }));
    await page.waitForFunction(() => document.body.classList.contains("chat-docked") || document.body.classList.contains("chat-sheet"), null, { timeout: 8000 });
    // fold and unfold from however it starts (a desktop's chat starts open beside the file, a phone's sheet folded),
    // and end with it open, to type in
    const open = () => page.evaluate(() => { const c = document.body.classList; return c.contains("chat-sheet") ? c.contains("sheet-up") : !c.contains("chat-min"); });
    const flip = async () => { const was = await open(); await page.keyboard.press("ControlOrMeta+j"); await page.waitForFunction((was) => { const c = document.body.classList; return (c.contains("chat-sheet") ? c.contains("sheet-up") : !c.contains("chat-min")) !== was; }, was); };
    await flip(); await flip();
    if (!(await open())) await flip();
    await typeAndSend(page, "smoke: beside a file");
  }],
  ["a long page scrolls to its foot (Settings › Keyboard), and the main area itself never scrolls", async (page) => {
    if (WIDTH < 600) { await page.evaluate(() => window.__t.go("home")); await page.waitForTimeout(200); }
    await page.locator(WIDTH < 600 ? "#set-phone" : "#set-side").filter({ visible: true }).first().click();
    await page.waitForSelector("#settings:not([hidden])");
    await page.locator('[data-set="keys"]').filter({ visible: true }).first().click();
    await page.waitForSelector('[data-page="keys"]:not([hidden])');
    // its foot, Reset all, reached by the wheel as a person scrolls, over the page's middle
    await page.mouse.move(WIDTH / 2, 400);
    for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 600);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => { const b = document.getElementById("keys-reset-all").getBoundingClientRect(); return { top: b.top, bottom: b.bottom, vh: innerHeight, main: document.getElementById("main").scrollTop }; });
    assert.ok(r.bottom > 0 && r.top < r.vh, `the foot of a long page is reached by scrolling (${JSON.stringify(r)})`);
    assert.equal(r.main, 0, "the main area itself didn't scroll");
    await page.keyboard.press("Escape");
  }],
  ["a phone: a file from the panel, Back to chat, and type", async (page) => {
    if (WIDTH >= 600) return "skip: a phone's";
    await page.evaluate(() => window.__t.go("p:demo"));
    await page.locator("[data-stage-toggle]").filter({ visible: true }).first().click();
    await page.waitForFunction(() => !document.querySelector("#stage").hidden);
    if (await page.locator('[data-ghost="changes"]').filter({ visible: true }).count()) await page.locator('[data-ghost="changes"]').filter({ visible: true }).first().click();
    await page.locator("[data-open-files]").filter({ visible: true }).first().click();
    await page.locator('[data-fl-file="note.md"]').filter({ visible: true }).first().click();
    await page.waitForFunction(() => document.body.classList.contains("chat-sheet"));
    await page.locator("[data-fv-min]").filter({ visible: true }).first().click();
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => !!document.querySelector("#say").closest("[inert]")), false, "the box is in reach");
    await typeAndSend(page, "smoke: back to chat");
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
