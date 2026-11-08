// Browser tests for Launchpad and the Shells dock: how each control answers, in the app itself.
// The rows they lock are listed in design-research/2026-11-lg/LAUNCHPAD-SHELL.md.
//   Launchpad: errors are whole · name taken · undo · stop window · copy is truthful · menu keys · ask pending
//   Shells: toggle · tab keys · rename in the tab · close asks in its row · new shell pending · retry counts ·
//           ended · terminal copy
//
// Self-contained: the app is served from this folder, every /api request is answered in the page by
// design-research/2026-11-lg/lp-shell/world.cjs (Launchpad's routes by design-research's mockspace, the shells'
// REST routes and WebSocket mocked). Nothing reaches a Space; nothing is written anywhere.
//   node tests/browser/lpshell.test.cjs [name-regex]
// Needs Playwright's core and a Chromium: PLAYWRIGHT_CORE (default /tmp/pw/node_modules/playwright-core).
// Without them it says so and exits 2: not run is not passed.
"use strict";
const assert = require("assert/strict");
let W;
try { W = require("../../design-research/2026-11-lg/lp-shell/world.cjs"); } catch (e) { console.error(`not run: ${e.message.split("\n")[0]}`); process.exit(2); }

let env, WIDTH = 1440, passed = 0, failed = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
const open = (o = {}) => W.open(env.browser, env.base, { width: WIDTH, height: WIDTH > 760 ? 900 : 844, motion: "reduce", ...o });
async function done(page) { const errs = page.errors; await page.context().close(); assert.deepEqual(errs, [], "page errors"); }
const live = (page) => page.locator("#live").innerText();
const json = (r, o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
const focused = (page) => page.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.lp || a.dataset.shName || a.dataset.shTab || a.dataset.shClose || a.dataset.shRename || a.getAttribute("role") || a.tagName) : null; });

// ── Launchpad ──
t("LP10: every hint and error is whole, under its field; an invalid field takes focus", async () => {
  const page = await open({ launchpad: "ready" });
  await W.openLaunchpad(page);
  await page.locator('[data-lp-f="name"]').fill("Bad Name!");
  await page.locator('[data-lp-f="port"]').fill("99999");
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('[data-lp-f="name"]').getAttribute("aria-invalid"), "true");
  assert.equal(await focused(page), "INPUT");
  const cut = await page.evaluate(() => [...document.querySelectorAll(".lp-hint")].filter((h) => h.scrollWidth > h.clientWidth + 1 || h.getClientRects().length === 0).map((h) => h.textContent));
  assert.deepEqual(cut, [], "no hint is cut off");
  assert.match(await page.locator("#lp-h-port").innerText(), /A port from 1 to 65535\./);
  // each hint sits under its own field
  const under = await page.evaluate(() => ["name", "port"].every((k) => { const i = document.querySelector(`[data-lp-f="${k}"]`).getBoundingClientRect(), h = document.querySelector(`#lp-h-${k}`).getBoundingClientRect(); return h.top >= i.bottom - 1 && Math.abs(h.left - i.left) < 2; }));
  assert.ok(under, "hints under their fields, on their edge");
  // every field and lit button is on the 24/32/40 scale
  const sizes = await page.evaluate(() => [...document.querySelectorAll(".lp .lp-in, .lp .lp-go, .lp .lp-b, .lp .lp-a, .lp .lp-ib")].filter((n) => n.offsetParent).map((n) => Math.round(n.getBoundingClientRect().height)));
  assert.ok(sizes.every((h) => [24, 32, 40].includes(h)), `heights ${[...new Set(sizes)]}`);
  await done(page);
});

t("LP11: name taken: Launchpad's free name is a button under the hint, and takes", async () => {
  const page = await open({ launchpad: "name-taken" });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForSelector('[data-lp="use-name"]', { timeout: 6000 });
  const pos = await page.evaluate(() => { const h = document.querySelector("#lp-h-name").getBoundingClientRect(), b = document.querySelector('[data-lp="use-name"]').getBoundingClientRect(); return { below: b.top >= h.bottom - 1, edge: Math.abs(b.left - h.left), h: b.height }; });
  assert.ok(pos.below && pos.edge < 2 && pos.h === 24, JSON.stringify(pos));
  await page.locator('[data-lp="use-name"]').click();
  await page.waitForFunction(() => document.querySelector('[data-lp-f="name"]')?.value === "xo-coworker-2");
  assert.equal(await page.locator('[data-lp="use-name"]').count(), 0, "the error and its fix go");
  await done(page);
});

t("LP17/LP20: Deploy starts a 3 s Undo, focused; Undo sends nothing", async () => {
  let posts = 0;
  const page = await open({ launchpad: "ready", onDeploy: (r, m, p) => { if (/\/api\/deploy\/[^/]+$/.test(p) && m === "POST") posts++; return r.fallback(); } });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForSelector('[data-lp="undo"]');
  await page.waitForTimeout(100);
  assert.equal(await focused(page), "undo");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3300);
  assert.equal(posts, 0, "nothing was sent");
  assert.equal(await page.locator(".lp").getAttribute("data-screen"), "setup");
  assert.match(await live(page), /Deploy undone/);
  await done(page);
});

t("LP21/LP22: Stop's 3 s are taken back in place (Keep deploying); then a stop waits for Space", async () => {
  const calls = [];
  const page = await open({ launchpad: "building", onDeploy: (r, m, p) => {
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE") { calls.push(m); return json(r, { stopped: true, run_id: "r1" }); }
    if (/\/check$/.test(p) && calls.length) return json(r, W.SCENARIOS.ready.check);
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "run");
  await page.locator('[data-lp="stop"]').click();
  await page.waitForSelector('[data-lp="stop-undo"]');
  await page.waitForTimeout(100);
  assert.equal(await focused(page), "stop-undo", "Keep deploying takes focus");
  assert.match(await page.locator(".lp-q").innerText(), /Stops in [123] s\./);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3400);
  assert.deepEqual(calls, [], "no stop was asked for");
  assert.equal(await focused(page), "stop", "focus back on Stop");
  assert.match(await live(page), /carries on/);
  // and now a real one: Stopping… until Space's receipt, then stopped
  await page.locator('[data-lp="stop"]').click();
  await page.waitForTimeout(3600);
  assert.deepEqual(calls, ["DELETE"]);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen !== "run");
  assert.match(await live(page), /Deploy stopped/);
  await done(page);
});

for (const mode of ["ok", "deny"]) {
  t(`LP30/LP1A/LP44: copy is truthful (${mode === "ok" ? "allowed" : "refused"})`, async () => {
    const page = await open({ launchpad: "live", clip: mode });
    if (mode === "deny") await page.evaluate(() => { document.execCommand = () => false; });
    await W.openLaunchpad(page);
    await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
    const btn = page.locator('.lpm-addr [data-lp="copy"]');
    await btn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(250);
    const clip = await page.evaluate(() => window.__clip);
    if (mode === "ok") {
      assert.deepEqual(clip, ["https://xo-coworker-xo-4f1c2a9.apps.xo.builders"]);
      assert.equal(await page.locator('.lpm-addr [data-lp="copy"]').getAttribute("title"), "Copied");
      assert.match(await live(page), /Copied the address\./);
    } else {
      assert.deepEqual(clip, []);
      assert.equal(await page.locator('.lpm-addr [data-lp="copy"]').getAttribute("title"), "Copy the address", "never says Copied");
      assert.match(await live(page), /Couldn't copy/);
      assert.equal(await focused(page), "copy", "focus stays on the button");
    }
    await done(page);
  });
}

t("LP35: the ⋯ menu answers the keyboard: focus in, Esc back to More, Tab out closes", async () => {
  const page = await open({ launchpad: "live" });
  await W.openLaunchpad(page);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
  await page.locator('[data-lp="menu"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".lp-mn");
  await page.waitForTimeout(80);
  assert.equal(await focused(page), "unlink", "focus on its first item");
  assert.equal(await page.locator('[data-lp="menu"]').getAttribute("aria-expanded"), "true");
  // not the long-press menu's look (app.css .lp-menu): a 32 px item at 13 px
  const item = await page.evaluate(() => { const b = document.querySelector('.lp-mn [role="menuitem"]'); const cs = getComputedStyle(b); return { h: b.getBoundingClientRect().height, fs: cs.fontSize, pos: getComputedStyle(b.parentElement).position }; });
  assert.deepEqual(item, { h: 32, fs: "13px", pos: "absolute" });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(80);
  assert.equal(await page.locator(".lp-mn").count(), 0);
  assert.equal(await focused(page), "menu", "back on More");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".lp-mn");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(80);
  assert.equal(await page.locator(".lp-mn").count(), 0, "Tab out closes it");
  assert.equal(await page.locator(".fr-lp").isVisible(), true, "the panel stays");
  await done(page);
});

t("LP40: Ask an agent waits for Space (one thread per ask); a failure is said in place, with Try again", async () => {
  let posts = 0, release, fail = true;
  const page = await open({ launchpad: "needs-agent", onDeploy: async (r, m, p) => {
    if (/\/agent$/.test(p) && m === "POST") {
      posts++;
      await new Promise((ok) => (release = ok));
      return fail ? json(r, { detail: { code: "unavailable", message: "Fixture offline" } }, 503) : json(r, { chat_id: "chat_demo", thread_ts: "t_ready", already: false, state: "needs-agent" });
    }
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="ask"]').click();
  await page.waitForFunction(() => document.querySelector('[data-lp="ask"]')?.getAttribute("aria-disabled") === "true");
  assert.match(await page.locator('[data-lp="ask"]').innerText(), /Starting a thread…/);
  await page.evaluate(() => document.querySelector('[data-lp="ask"]').click());
  await page.waitForTimeout(150);
  assert.equal(posts, 1, "a second click starts nothing");
  release();
  await page.waitForSelector(".lp-err");
  assert.match(await page.locator(".lp-err").innerText(), /Couldn't start the thread: Fixture offline/);
  assert.equal((await page.locator('[data-lp="ask"]').innerText()).trim(), "Try again");
  assert.equal(await focused(page), "ask");
  fail = false;
  await page.locator('[data-lp="ask"]').click();
  await page.waitForTimeout(100);
  release();
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "getting");
  assert.equal(posts, 2);
  await done(page);
});

// ── Shells ──
// the sidebar's Shells: on a phone, from the drawer the menu button opens (it steps aside for the sheet)
const dock = async (o = {}) => {
  const page = await open({ terms: "some", ...o });
  if (WIDTH <= 760) { await page.locator("#pb-menu:visible, #top-menu:visible").first().click(); await page.waitForTimeout(350); }
  await page.locator("#nv-shells").click();
  await page.waitForSelector(".shl-head");
  return page;
};
const attach = async (page, id = "sh_1") => { await page.locator(`[data-sh-open="${id}"]`).click(); await page.waitForSelector(`.shd-term[data-pane="${id}"] .xterm`); await page.waitForTimeout(300); };

t("SH01: the sidebar's Shells shows the dock and says so", async () => {
  const page = await dock();
  assert.equal(await page.locator("#nv-shells").getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#nv-shells").getAttribute("aria-label"), /Shells, 3 running/);
  await done(page);
});

t("SH04: ← → move between tabs, Home and End go to the ends", async () => {
  const page = await dock();
  await attach(page, "sh_1");
  await page.locator('[data-sh-tab="list"]').click();
  await attach(page, "sh_2");
  await page.locator('[data-sh-tab="list"]').focus();
  await page.keyboard.press("End");
  assert.equal(await focused(page), "sh_2");
  await page.keyboard.press("Home");
  assert.equal(await focused(page), "list");
  await page.keyboard.press("ArrowRight");
  assert.equal(await focused(page), "sh_1");
  await done(page);
});

t("SH06: a shell is renamed in its tab: Enter keeps, Esc cancels, a failure keeps the old name", async () => {
  const W2 = {};
  const page = await dock({ api: (r, m, p, answer) => (W2.fail && m === "PATCH" ? answer({ detail: { code: "unavailable", message: "Fixture offline" } }, 503) : undefined) });
  await attach(page, "sh_1");
  await page.locator('.shd-acts [data-sh-rename="sh_1"]').click();
  const inTab = await page.evaluate(() => !!document.activeElement.closest(".shd-tabw.is-edit") && document.activeElement.value);
  assert.equal(inTab, "demo", "the field is the tab, holding its name");
  await page.keyboard.type("api");
  await page.keyboard.press("Escape");
  assert.equal((await page.locator('[data-sh-tab="sh_1"]').innerText()).trim(), "demo", "Esc cancels");
  await page.locator('.shd-acts [data-sh-rename="sh_1"]').click();
  await page.keyboard.type("api");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-sh-tab="sh_1"]')?.innerText.trim() === "api");
  assert.equal(await focused(page), "sh_1", "focus back on the tab");
  W2.fail = true;
  await page.locator('.shd-acts [data-sh-rename="sh_1"]').click();
  await page.keyboard.type("web");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  assert.equal((await page.locator('[data-sh-tab="sh_1"]').innerText()).trim(), "api", "the old name stays");
  assert.match(await live(page), /Couldn't rename the shell/);
  await done(page);
});

t("SH25/SH26: Close on a busy row asks in that row; Esc keeps it and goes back to Close; Close shell closes", async () => {
  const page = await dock();
  await page.locator('.shl-row [data-sh-close="sh_1"]').click();
  await page.waitForSelector(".shl-row.is-asking");
  assert.equal(await page.locator(".shd-confirm").isHidden(), true, "not at the dock's top");
  assert.match(await page.locator(".shl-row.is-asking").innerText(), /npm is running in it/);
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-no") && !!document.activeElement.closest(".shl-row")), true, "Keep it is focused, in the row");
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".shl-row.is-asking").count(), 0);
  assert.equal(await focused(page), "sh_1", "back on the row's Close");
  await page.locator('.shl-row [data-sh-close="sh_1"]').click();
  await page.locator(".shl-row [data-sh-yes]").click();
  await page.waitForFunction(() => !document.querySelector('.shl-row [data-sh-close="sh_1"]'));
  assert.deepEqual(page.W.closed, ["sh_1"]);
  assert.ok(await page.evaluate(() => document.querySelector("#shd").contains(document.activeElement)), "focus stays in the dock");
  await done(page);
});

t("SH20: New shell waits for the backend: one shell per press", async () => {
  let release;
  const page = await dock({ terms: "none", api: async (r, m, p) => { if (p === "/api/terminal/sessions" && m === "POST" && !release) { await new Promise((ok) => (release = ok)); } return undefined; } });
  await page.locator("[data-sh-new]").click();
  await page.waitForFunction(() => document.querySelector("[data-sh-new]")?.getAttribute("aria-disabled") === "true");
  assert.match(await page.locator("[data-sh-new]").innerText(), /Opening…/);
  await page.locator("[data-sh-new]").click({ force: true });
  release();
  await page.waitForSelector(".shd-term .xterm");
  await page.waitForTimeout(300);
  assert.equal(page.W.terms.length, 1, "one shell");
  await done(page);
});

t("SH31: reconnecting counts its seconds down", async () => {
  const page = await dock({ ws: (ws) => { ws.close({ code: 1011, reason: "" }); return false; } });
  await page.locator('[data-sh-open="sh_1"]').click();
  const first = await page.waitForFunction(() => { const n = document.querySelector(".shd-note [data-left]"); return n && +n.textContent >= 3 ? +n.textContent : 0; }, null, { timeout: 12000 });
  const a = await first.jsonValue();
  await page.waitForTimeout(1100);
  const b = await page.evaluate(() => +(document.querySelector(".shd-note [data-left]")?.textContent || 0));
  assert.ok(b < a, `counts down: ${a} → ${b}`);
  await done(page);
});

t("SH32: an ended shell says so, offers Close tab, and its cursor goes", async () => {
  const page = await dock({ ws: (ws) => { ws.onMessage((m) => { if (typeof m === "string" && JSON.parse(m).type === "auth") { ws.send(JSON.stringify({ type: "ready", terminal: {} })); ws.send(Buffer.from("$ exit\r\n")); ws.send(JSON.stringify({ type: "exit", code: 0 })); setTimeout(() => ws.close({ code: 1000, reason: "exited" }), 100); } }); return false; } });
  await page.locator('[data-sh-open="sh_1"]').click();
  await page.waitForSelector(".shd-term.is-ended");
  assert.match(await page.locator(".shd-note").innerText(), /This shell exited\./);
  await page.waitForTimeout(200);
  assert.equal(await page.locator("#shd .xterm-rows .xterm-cursor").count(), 0, "no cursor in an ended shell");
  await page.locator('.shd-note [data-sh-detach]').click();
  assert.equal(await page.locator(".shd-term").count(), 0);
  await done(page);
});

for (const mode of ["ok", "deny"]) {
  t(`SH30: Ctrl+Shift+C in a shell is truthful (${mode === "ok" ? "allowed" : "refused"})`, async () => {
    const page = await dock({ clip: mode });
    if (mode === "deny") await page.evaluate(() => { document.execCommand = () => false; });
    await attach(page, "sh_1");
    const box = await page.locator('.shd-term[data-pane="sh_1"] .xterm-screen').boundingBox();
    await page.mouse.move(box.x + 4, box.y + 6);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 6, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.press("Control+Shift+C");
    await page.waitForTimeout(250);
    const clip = await page.evaluate(() => window.__clip);
    if (mode === "ok") { assert.equal(clip.length, 1); assert.match(clip[0], /replayed/); assert.match(await live(page), /Copied the selection/); }
    else { assert.deepEqual(clip, []); assert.match(await live(page), /Couldn't copy/); assert.ok(await page.evaluate(() => !!document.activeElement.closest("#shd .xterm")), "focus stays in the shell"); }
    await done(page);
  });
}

(async () => {
  try { env = await W.start(); }
  catch (e) { console.error(`not run: Chromium didn't start (${e.message.split("\n")[0]})`); process.exit(2); }
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  for (const width of [1440, 390]) {
    WIDTH = width;
    for (const { name, fn } of tests) {
      if (only && !only.test(name)) continue;
      const label = `${name} [${width}]`;
      try { await fn(); passed++; console.log("  ok  " + label); }
      catch (e) { failed++; console.error("  FAIL " + label + "\n" + (e.stack || e)); }
    }
  }
  await env.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
