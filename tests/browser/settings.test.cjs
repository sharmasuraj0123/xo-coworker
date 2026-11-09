// Browser tests for Settings (and Home's order), every case in the four contexts a row is graded in:
// 1440 × 900 and 390 × 844, dark and light. They exercise the rows Astra failed at d1c7cb9:
//   C098           the rail is a tablist: one tab in the Tab order, arrows/Home/End, tab ⇄ panel linked
//   bullets        Rules and Worktrees read as lists (no native bullets; title, details, action apart)
//   C109–C111      a routing choice sends once while it's out (two Enters, one PUT); focus stays; a failure retries
//   C113 S110      Connect: one POST for two Enters; success → Disconnect; failure keeps the key; Cancel → Connect
//   S111 S112      Disconnect: Keep it → Disconnect; one DELETE for two Enters; success → Connect; failure retries
//   S113           Use the Space's: one PATCH; a failure says so in its row, a retry clears it; focus lands
//   C116 S103 S104 Revoke: Keep first; Keep → Revoke; one DELETE; failure in the row, retry; success → next rule
//   S105–S108      Worktrees: Keep it first; Keep it → Remove; one DELETE; a failed one leaves a retry that works;
//                  work to lose: the hold, with Keep it focused; removed → the next row's Remove
//   C114 C115 S097 S098  Runtimes: focus stays on the default, the boxes and the switch through a save; one PUT;
//                  a refused preference keeps what was typed
//   C118 S022 S023 Keyboard: Esc keeps the key focused; a reset → its key; Reset all → the first key
//   H17 C010      Esc from Settings opened from a phone's drawer returns to the menu, not the inert sidebar
//   C099 C100      a General switch the shape refuses says why and never claims it changed
//   S114 S115      Shape JSON: Revert and Save → the text
//   S116 S117      the first-run question keeps Tab and Shift+Tab inside it
//   C012 C013      Home: a control in Handled or Recently made keeps focus through Home's redraws
//
// Self-contained (tests/browser/harness.cjs serves the app and answers /api from a mock world); nothing reaches
// a Space. Every write is answered here and counted.
//   node tests/browser/settings.test.cjs            (CONTEXTS=1440-dark,390-light … and ONLY=<a regexp of names> to narrow)
// Needs Playwright's core and a Chromium (PLAYWRIGHT_CORE, default /tmp/pw/node_modules/playwright-core).
// Without them it says so and exits 2: not run is not passed.
"use strict";
const assert = require("assert/strict");
const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require(PW)); } catch { console.error(`not run: Playwright core isn't at ${PW} (set PLAYWRIGHT_CORE)`); process.exit(2); }
const { serve, NOW, CHATS, openApp, launch } = require("./harness.cjs");

// a context: width-theme, and "-motion" for full motion (the default is reduced motion, as the harness opens it)
const CONTEXTS = (process.env.CONTEXTS || "1440-dark,1440-light,390-dark,390-light").split(",").map((c) => { const [w, theme, m] = c.split("-"); return { width: +w, theme, motion: m === "motion" }; });
let browser, server, BASE, passed = 0, failed = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));
const err = (code, message, extra = {}) => ({ status: code === "would_lose_work" ? 409 : code === "invalid_key" ? 422 : 503, body: { detail: { code, message, ...extra } } });

// ── the mock Space for Settings: every read from W, every write counted in W.writes ──────────────────────
function world(over = {}) {
  return {
    router: { mode: "agent", decision_model: null, abstain_below: 0.5 },
    // the router's decision models (W.models is the harness's runtime catalog)
    dms: [{ id: "levanto", label: "Levanto Sage", connected: true, model: "sage-1", docs_url: null }, { id: "quill", label: "Quill Route", connected: false, model: "q-2", docs_url: null }],
    rules: [
      { id: "r1", sentence: "Run `npm test` in this project", scope: "project", project_pid: "pid_demo", effect: "allow", uses: 3, created_at: NOW },
      { id: "r2", sentence: "Read files outside the project", scope: "space", effect: "allow", uses: 1, created_at: NOW },
      { id: "r3", sentence: "Push to a remote", scope: "space", effect: "deny", uses: 0, created_at: NOW },
    ],
    defaults: [{ id: "d1", sentence: "Read inside the project", effect: "allow" }, { id: "d2", sentence: "Read-only git", effect: "allow" }],
    trees: [
      { chat_id: "chat_demo", thread_ts: "t-clean", branch: "xo/thread-clean", path: "/demo/.xo/worktrees/clean", removable: true, would_lose: false, xo: true, exists: true, session_state: "cold", thread_state: "resolved" },
      { chat_id: "chat_demo", thread_ts: "t-dirty", branch: "xo/thread-dirty", path: "/demo/.xo/worktrees/dirty", removable: false, would_lose: true, xo: true, exists: true, session_state: "cold", thread_state: "resolved" },
      { chat_id: "chat_demo", thread_ts: "t-last", branch: "xo/thread-last", path: "/demo/.xo/worktrees/last", removable: true, would_lose: false, xo: true, exists: true, session_state: "cold", thread_state: "resolved" },
    ],
    runtimes: [{ name: "claude_code", default: true, health: { installed: true, logged_in: true, cli_version: "2.1" } }, { name: "codex", health: { installed: true, logged_in: true, cli_version: "0.9" } }],
    policy: { allowed: null, default: null, preferences: "Use Codex for the audit fixture.", fallback: false },
    chats: null, // routing overrides: CHATS with chat_demo routed by its coordinator
    shape: { shape: { shape: 1, preset: "everything" }, version: "test" },
    made: [],
    delay: 0, fail: {}, writes: [],
    ...over,
  };
}
/** Settings' routes, tried before the harness's (Playwright runs the last route added first); the rest falls through. */
function settingsApi(W) {
  return async (r) => {
    const q = r.request(), u = new URL(q.url()), m = q.method(), p = u.pathname;
    const json = (o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
    const write = async (kind, body = null) => {
      W.writes.push({ kind, path: p, body, query: u.search });
      if (W.delay) await wait(W.delay);
      // W.gates[kind]: each write of that kind waits for the next promise in the list (held until the case lets go)
      if (W.gates && W.gates[kind] && W.gates[kind].length) await W.gates[kind].shift();
      const f = W.fail[kind];
      if (f && f.length) { const e = f.shift(); if (e) { await json(e.body, e.status); return true; } }
      return null;
    };
    let k, failed;
    if (p === "/api/chat/router" && m === "GET") return json(W.router);
    if (p === "/api/chat/router" && m === "PUT") { const b = q.postDataJSON(); if ((failed = await write("router", b))) return failed; W.router = { ...b, decision_model: b.decision_model || null }; return json(W.router); }
    if (p === "/api/chat/router/models" && m === "GET") return json({ models: W.dms });
    if (p === "/api/chat/router/models" && m === "POST") { const b = q.postDataJSON(); if ((failed = await write("connect", b))) return failed; W.dms = W.dms.map((x) => (x.id === b.provider ? { ...x, connected: true } : x)); return json({ models: W.dms }); }
    if ((k = /^\/api\/chat\/router\/models\/([^/]+)$/.exec(p)) && m === "DELETE") { if ((failed = await write("disconnect"))) return failed; W.dms = W.dms.map((x) => (x.id === k[1] ? { ...x, connected: false } : x)); if (W.router.decision_model === k[1]) W.router = { ...W.router, mode: "agent", decision_model: null }; return json({ models: W.dms }); }
    if (p === "/api/chat/chats" && m === "GET" && W.chats) return json({ chats: W.chats });
    if ((k = /^\/api\/chat\/chats\/([^/]+)$/.exec(p)) && m === "PATCH") { const b = q.postDataJSON(); if ((failed = await write("patch", b))) return failed; const c = (W.chats || CHATS).find((x) => x.id === k[1]); if (c) c.routing = b.routing; return json({ ...c, routing: b.routing }); }
    if (p === "/api/chat/rules" && m === "GET") return json({ rules: W.rules, defaults: W.defaults, next_after_seq: null });
    if ((k = /^\/api\/chat\/rules\/([^/]+)$/.exec(p)) && m === "DELETE") { if ((failed = await write("revoke"))) return failed; const at = new Date().toISOString(); for (const x of [...W.rules, ...W.defaults]) if (x.id === k[1]) x.revoked_at = at; return json({ ok: true }); }
    if (p === "/api/chat/worktrees" && m === "GET") return json({ worktrees: W.trees.filter((w) => !w.gone), reported: [] });
    if ((k = /^\/api\/chat\/worktrees\/([^/]+)\/([^/]+)$/.exec(p)) && m === "DELETE") {
      const w = W.trees.find((x) => x.thread_ts === k[2]);
      if (w && w.would_lose && !u.searchParams.get("confirm")) { W.writes.push({ kind: "remove", path: p, query: u.search }); if (W.delay) await wait(W.delay); return json({ detail: { code: "would_lose_work", message: "It has work", what: { summary: "2 files changed", changed: { paths: ["a.js", "b.js"] }, commits: 1, branch: w.branch }, confirm: "tok-1" } }, 409); }
      if ((failed = await write("remove"))) return failed;
      if (w) w.gone = true;
      return json({ removed: true, forced: !!u.searchParams.get("confirm") });
    }
    if (p === "/api/chat/runtimes" && m === "GET") return json({ runtimes: W.runtimes });
    if (p === "/api/chat/runtime-policy" && m === "GET") return json({ space: W.policy, effective: { ...W.policy, fallback: !!W.policy.fallback } });
    if (p === "/api/chat/runtime-policy" && m === "PUT") { const b = q.postDataJSON(); if ((failed = await write("policy", b))) return failed; W.policy = b; return json({ space: W.policy, effective: { ...W.policy } }); }
    if (p === "/api/chat/shape" && m === "GET") return json(W.shape);
    if (p === "/api/chat/shape" && m === "PUT") { const b = q.postDataJSON(); if ((failed = await write("shape", b))) return failed; W.shape = { shape: b.shape, version: `v${W.writes.length}` }; return json(W.shape); }
    if ((k = /^\/api\/chat\/chats\/([^/]+)\/made$/.exec(p))) return json({ made: k[1] === "chat_demo" ? W.made : [], next_before: null });
    return r.fallback();
  };
}

/**
 * The app from the harness (its mock world, and its record of every time focus fell to the page), then this
 * world's Settings routes and the theme, and a reload so the app starts with both.
 */
async function open(W, { width, theme, motion = false }, { firstRun = false, device = null, fullStorage = false } = {}) {
  const page = await openApp(browser, BASE, W, { width, height: width < 600 ? 844 : 900, motion });
  await page.route("**/api/**", settingsApi(W));
  // a browser whose storage refuses the shape's keys (full, or switched off), from the reload on
  // (fullStorage: "unsynced" refuses only the note of a held change)
  if (fullStorage) await page.context().addInitScript((only) => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (only ? k === only : String(k).startsWith("cv-shape")) throw new DOMException("The quota has been exceeded.", "QuotaExceededError"); return set.call(this, k, v); }; }, fullStorage === "unsynced" ? "cv-shape-unsynced" : null);
  await page.evaluate(({ theme, firstRun, device }) => {
    localStorage.setItem("cv-theme", theme);
    if (firstRun) for (const k of ["cv-shape-mine", "cv-shape-device", "cv-shape-preset"]) localStorage.removeItem(k);
    if (device) localStorage.setItem("cv-shape-device", JSON.stringify(device));
  }, { theme, firstRun, device });
  W.writes.length = 0;
  await page.reload({ timeout: 30000 });
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached", timeout: 30000 });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme || "dark"), theme);
  page.width = width; page.theme = theme;
  return page;
}
// a test ends with no page errors and with focus never having fallen to the page (the harness records each drop)
// The record must be there and readable: a missing record or a failed read fails the case, never passes it.
const done = async (page) => {
  const errs = page.errors;
  let drops, unread = null;
  try { drops = await page.evaluate(() => window.__focusDrops); } catch (e) { unread = e; }
  await page.context().close();
  if (unread) throw new Error(`the focus-drop record couldn't be read: ${unread.message}`);
  assert.deepEqual(errs, [], "page errors");
  assert.ok(Array.isArray(drops), "the harness's focus-drop record is there (window.__focusDrops)");
  assert.deepEqual(drops, [], "focus fell to the page when its control went");
};
/** Settings, on one page. The opener is the rail's Settings, or on a phone the top bar's. */
async function settings(page, id) {
  await page.locator(page.width < 600 ? "#set-phone" : "#set-side").click();
  await page.waitForSelector("#settings:not([hidden])");
  if (id) { await page.locator(`[data-set="${id}"]`).click(); await page.waitForSelector(`[data-page="${id}"]:not([hidden])`); }
}
/** What has focus: its tag and its data-* hooks (or id), and whether it's the page itself. */
const focused = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  const d = [...a.attributes].filter((x) => x.name.startsWith("data-")).map((x) => (x.value ? `[${x.name}="${x.value}"]` : `[${x.name}]`)).join("");
  return a.tagName.toLowerCase() + (a.id ? `#${a.id}` : "") + d;
});
const writes = (page, kind) => page.W.writes.filter((w) => w.kind === kind).length;
async function settle(page, ms = 120) { await page.waitForTimeout(ms); }
/** Keyboard modality, then focus on it (as Tab would bring it). */
async function keyFocus(page, sel) { await page.keyboard.press("Shift"); await page.locator(sel).focus(); }
const busy = (page, sel) => page.locator(sel).getAttribute("aria-busy");
/** A picture of the state just reached (DPR 1, so the glass renders whole): /tmp/settings-work/shots. */
const shot = (page, name) => page.screenshot({ path: `/tmp/settings-work/shots/${page.width}-${page.theme}-${name}.png` });

// ── closing Settings, and General's switches ─────────────────────────────────────────────────
t("C097 Close settings (Enter, Space, a click, Esc) returns the keyboard to what opened Settings", async (ctx) => {
  const page = await open(world(), ctx);
  const opener = ctx.width < 600 ? "#set-phone" : "#set-side";
  const back = () => page.evaluate(() => { const a = document.activeElement; return a && a.id ? `#${a.id}` : a.tagName; });
  for (const how of ["Enter", "Space", "click", "Escape"]) {
    await keyFocus(page, opener);
    await page.keyboard.press("Enter");
    await page.waitForSelector("#settings:not([hidden])");
    if (how === "click") await page.locator("#set-x").click();
    else if (how === "Escape") await page.keyboard.press("Escape");
    else { await keyFocus(page, "#set-x"); await page.keyboard.press(how); }
    await page.waitForSelector("#settings", { state: "hidden" });
    assert.equal(await back(), opener, `${how} closes Settings back to ${opener}`);
  }
  await done(page);
});
t("H17 C010 Esc from Settings returns the keyboard to what opened it: the menu, when it came from a phone's drawer", async (ctx) => {
  const page = await open(world(), ctx);
  let opener;
  if (ctx.width < 600) {
    opener = await page.evaluate(() => { const m = [...document.querySelectorAll("#pb-menu, #top-menu")].find((b) => b.getClientRects().length); return m && `#${m.id}`; });
    assert.ok(opener, "a phone shows a menu");
    await keyFocus(page, opener);
    await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector("#app").classList.contains("drawer"));
    await keyFocus(page, "#set-side");
    await page.keyboard.press("Enter");
  } else {
    opener = "#set-side";
    await keyFocus(page, opener);
    await page.keyboard.press("Enter");
  }
  await page.waitForSelector("#settings:not([hidden])");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#settings", { state: "hidden" });
  assert.equal(await page.evaluate(() => { const a = document.activeElement; return a && a.id ? `#${a.id}` : a.tagName; }), opener);
  assert.equal(await page.evaluate(() => document.activeElement.matches(":focus-visible")), true, "with its ring");
  await done(page);
});
for (const [row, tog, words] of [["C099", "#hops-tog", /Showing how messages travel/], ["C100", "#webpics-tog", /Pictures from the web show in the conversation/]]) {
  t(`${row} ${tog}: refused (a newer XO saved this device's layer), it stays as it was and says why, never that it changed`, async (ctx) => {
    const page = await open(world(), ctx, { device: { shape: 99, surfaces: { "xo:thread/hops": { on: false }, "xo:conversation/webpics": { on: false } } } });
    await settings(page);
    await keyFocus(page, tog);
    assert.equal(await page.locator(tog).getAttribute("aria-checked"), "false");
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-page="general"] .set-err[role="alert"]');
    assert.equal(await page.locator(tog).getAttribute("aria-checked"), "false", "it didn't change");
    assert.match(await page.locator(tog).locator("xpath=ancestor::div[contains(@class,'set-row')]").locator(".set-err").innerText(), /newer XO/);
    await page.waitForTimeout(150);
    assert.doesNotMatch(await page.locator("#live").innerText(), words, "no claim that it changed");
    assert.equal(await focused(page), `button${tog}`);
    await shot(page, `${row}-refused`);
    await done(page);
  });
}

// ── C098: the rail is a tablist ───────────────────────────────────────────────────────────
t("C098 tabs: one in the Tab order, arrows and Home/End choose, each tab names its panel and back", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page);
  assert.equal(await focused(page), 'button#set-t-general[data-set="general"]');
  const rel = await page.evaluate(() => [...document.querySelectorAll("[data-set]")].map((b) => {
    const p = document.getElementById(b.getAttribute("aria-controls"));
    return { tab: b.dataset.set, tabIndex: b.tabIndex, panel: p && p.dataset.page, back: p && p.getAttribute("aria-labelledby") === b.id, role: p && p.getAttribute("role") };
  }));
  for (const r of rel) { assert.equal(r.panel, r.tab, `${r.tab} controls its own panel`); assert.ok(r.back, `${r.tab}'s panel is labelled by it`); assert.equal(r.role, "tabpanel"); }
  assert.deepEqual(rel.map((r) => r.tabIndex), [0, -1, -1, -1, -1, -1, -1, -1], "only the chosen tab is in the Tab order");
  assert.equal(await page.locator(".set-nav").getAttribute("aria-orientation"), ctx.width < 600 ? "horizontal" : "vertical");
  // Tab goes on into General's page, not to the next tab
  await page.keyboard.press("Tab");
  assert.equal(await focused(page), "button#hops-tog");
  assert.equal(await page.locator('[data-page="general"]').isVisible(), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(await focused(page), 'button#set-t-general[data-set="general"]');
  await page.keyboard.press(ctx.width < 600 ? "ArrowRight" : "ArrowDown");
  assert.equal(await focused(page), 'button#set-t-shape[data-set="shape"]');
  assert.equal(await page.locator('[data-page="shape"]').isVisible(), true);
  assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll("[data-set]")].map((b) => b.tabIndex)), [-1, 0, -1, -1, -1, -1, -1, -1]);
  await page.keyboard.press("End");
  assert.equal(await focused(page), 'button#set-t-keys[data-set="keys"]');
  assert.equal(await page.locator('[data-page="keys"]').isVisible(), true);
  await page.keyboard.press("ArrowRight"); // wraps
  assert.equal(await focused(page), 'button#set-t-general[data-set="general"]');
  await page.keyboard.press("Home");
  assert.equal(await focused(page), 'button#set-t-general[data-set="general"]');
  await page.keyboard.press("ArrowUp"); // wraps back
  assert.equal(await focused(page), 'button#set-t-keys[data-set="keys"]');
  await done(page);
});

// ── Rules and Worktrees read as lists ────────────────────────────────────────────────────
t("bullets: Rules and Worktrees are lists without native bullets, each row's parts apart", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "rules");
  await page.waitForSelector(".rl-row");
  const rules = await page.evaluate(() => {
    const ul = document.querySelector(".rl-list"), li = ul.querySelector(".rl-row");
    const s = li.querySelector(".rl-s").getBoundingClientRect(), m = li.querySelector(".rl-m").getBoundingClientRect(), b = li.querySelector("[data-rule-off]").getBoundingClientRect();
    return { list: getComputedStyle(ul).listStyleType, item: getComputedStyle(li).display, metaBelow: m.top >= s.bottom - 0.5, buttonApart: b.left >= Math.max(s.right, m.right) || b.top >= m.bottom, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  assert.deepEqual(rules, { list: "none", item: "flex", metaBelow: true, buttonApart: true, overflow: 0 });
  await page.screenshot({ path: `/tmp/settings-work/shots/${ctx.width}-${ctx.theme}-rules.png` });
  await page.locator('[data-set="worktrees"]').click();
  await page.waitForSelector(".wt-row");
  const trees = await page.evaluate(() => {
    const li = document.querySelector(".wt-row");
    const [b, c, s] = [li.querySelector(".wt-main b"), li.querySelector(".wt-main code"), li.querySelector(".wt-s")].map((x) => x.getBoundingClientRect());
    return { list: getComputedStyle(li.parentElement).listStyleType, item: getComputedStyle(li).display, stacked: c.top >= b.bottom - 0.5 && s.top >= c.bottom - 0.5, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  assert.deepEqual(trees, { list: "none", item: "flex", stacked: true, overflow: 0 });
  await page.screenshot({ path: `/tmp/settings-work/shots/${ctx.width}-${ctx.theme}-worktrees.png` });
  await done(page);
});

// ── Routing ──────────────────────────────────────────────────────────────────────────────
for (const [row, sel, mode] of [["C111", '[data-route="off"]', "off"], ["C110", '[data-route="decision"][data-dm="levanto"]', "decision"], ["C109", '[data-route="agent"]', "agent"]]) {
  t(`${row} routing: two Enters while it's out send one PUT; it says it's waiting; focus stays; a failure retries`, async (ctx) => {
    const W = world({ delay: 400, router: mode === "agent" ? { mode: "off", decision_model: null, abstain_below: 0.5 } : { mode: "agent", decision_model: null, abstain_below: 0.5 } });
    W.fail.router = [err("unavailable", "Router fixture unavailable")];
    const page = await open(W, ctx);
    await settings(page, "routing");
    await page.waitForSelector(sel);
    await keyFocus(page, sel);
    await page.keyboard.press("Enter");
    await settle(page, 60);
    assert.equal(await busy(page, sel), "true", "waiting, said");
    await page.keyboard.press("Enter");
    assert.equal(await focused(page), await page.locator(sel).evaluate((e) => e.tagName.toLowerCase() + [...e.attributes].filter((x) => x.name.startsWith("data-")).map((x) => (x.value ? `[${x.name}="${x.value}"]` : `[${x.name}]`)).join("")));
    await page.waitForSelector('[data-page="routing"] .set-err[role="alert"]');
    await shot(page, "routing-error");
    assert.equal(writes(page, "router"), 1, "one PUT for two Enters");
    assert.match(await focused(page), /data-route/, "focus stays on the choice after the failure");
    assert.equal(await page.locator(sel).getAttribute("aria-checked"), "false", "the server's choice still shows");
    assert.equal(await busy(page, sel), null);
    // the retry works, and clears the error
    await page.keyboard.press("Enter");
    await page.waitForFunction((s) => document.querySelector(s)?.getAttribute("aria-checked") === "true", sel);
    assert.equal(writes(page, "router"), 2);
    assert.equal(await page.locator('[data-page="routing"] .set-err').count(), 0, "the old error is gone");
    assert.match(await focused(page), /data-route/);
    // the chosen one is the group's one Tab stop
    assert.equal(await page.locator(sel).getAttribute("tabindex"), null);
    await done(page);
  });
}
t("routing radios: arrows move without choosing (each choice is a request), skipping the disconnected one", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "routing");
  await keyFocus(page, '[data-route="agent"]');
  await page.keyboard.press("ArrowDown");
  assert.equal(await focused(page), 'button[data-route="decision"][data-dm="levanto"]');
  await page.keyboard.press("ArrowDown"); // Quill isn't connected: skipped
  assert.equal(await focused(page), 'button[data-route="off"]');
  assert.equal(writes(page, "router"), 0, "moving chose nothing");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector('[data-route="off"]').getAttribute("aria-checked") === "true");
  assert.equal(writes(page, "router"), 1);
  assert.equal(await focused(page), 'button[data-route="off"]');
  await done(page);
});

// ── decision models: Connect, Cancel, Disconnect ───────────────────────────────────────────
t("C113 S110 Connect: key field first; Cancel → Connect; two Enters → one POST; failure keeps the key; success → Disconnect", async (ctx) => {
  const W = world({ delay: 400 });
  W.fail.connect = [err("unavailable", "Connect fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "routing");
  await keyFocus(page, '[data-dm-on="quill"]');
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), "input");
  assert.equal(await page.evaluate(() => document.activeElement.name), "key");
  await keyFocus(page, "[data-dm-cancel]");
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), 'button[data-dm-on="quill"]', "Cancel → its Connect");
  await page.keyboard.press("Enter");
  await page.keyboard.type("sk-fixture-key");
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await busy(page, "[data-dm-submit]"), "true");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-dm-form] .set-err[role=alert]");
  await shot(page, "connect-error");
  assert.equal(writes(page, "connect"), 1, "one POST for two Enters");
  assert.equal(await page.locator('[data-dm-form] input[name="key"]').inputValue(), "sk-fixture-key", "the key stays for the retry");
  assert.equal(await focused(page), "input", "focus stays in the key field");
  await page.keyboard.press("Enter"); // retry
  await page.waitForSelector('[data-dm-off="quill"]');
  assert.equal(writes(page, "connect"), 2);
  assert.equal(await focused(page), 'button[data-dm-off="quill"]', "connected → its Disconnect");
  assert.equal(await page.locator("[data-dm-form]").count(), 0, "the key left the page");
  await done(page);
});
t("C113 a key the server calls malformed is cleared, with focus back in its field", async (ctx) => {
  const W = world();
  W.fail.connect = [err("invalid_key", "bad key")];
  const page = await open(W, ctx);
  await settings(page, "routing");
  await page.locator('[data-dm-on="quill"]').click();
  await page.keyboard.type("not a key");
  await keyFocus(page, "[data-dm-submit]");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-dm-form] .set-err[role=alert]");
  assert.equal(await page.locator('[data-dm-form] input[name="key"]').inputValue(), "");
  assert.equal(await page.evaluate(() => document.activeElement.name), "key");
  await done(page);
});
t("S111 S112 Disconnect: Keep it first and back; two Enters → one DELETE; failure in the question, retry; success → Connect", async (ctx) => {
  const W = world({ delay: 400 });
  W.fail.disconnect = [err("unavailable", "Disconnect fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "routing");
  await keyFocus(page, '[data-dm-off="levanto"]');
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), "button[data-dm-no]", "the question opens on Keep it");
  await shot(page, "disconnect-question");
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), 'button[data-dm-off="levanto"]', "Keep it → Disconnect");
  await page.keyboard.press("Enter");
  await keyFocus(page, '[data-dm-yes="levanto"]');
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await busy(page, '[data-dm-yes="levanto"]'), "true");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".set-confirm .set-err[role=alert]");
  assert.equal(writes(page, "disconnect"), 1, "one DELETE for two Enters");
  assert.equal(await focused(page), 'button[data-dm-yes="levanto"]', "the retry is where you are");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-dm-on="levanto"]');
  assert.equal(writes(page, "disconnect"), 2);
  assert.equal(await focused(page), 'button[data-dm-on="levanto"]', "disconnected → its Connect");
  await done(page);
});

// the ring has room at a scroller's foot (the create-project grader on 65e84b7, S111/S112, native input: Disconnect's
// Keep it and Disconnect brought flush with Settings' foot, 3.56 px of the ring cut, by Tab and when focus landed by
// itself). Disconnect is put just under the foot; Tab reaches it (the browser brings it), Enter opens the question
// (focus lands on Keep it by itself), Tab to its Disconnect: each time the whole ring is inside the box it scrolls in.
// the ring as drawn: by the focused control, or by the box that draws it for it (a checkbox's label: C115)
const ringRoom = (page) => page.evaluate(() => {
  const a = document.activeElement;
  let o = a, ext = 0;
  for (let n = a, i = 0; n && i < 4; n = n.parentElement, i++) { const cs = getComputedStyle(n); if (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) { o = n; ext = Math.max(0, parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset)); break; } }
  let sc = a.parentElement;
  for (; sc && sc !== document.body; sc = sc.parentElement) { const ov = getComputedStyle(sc).overflowY; if (/(auto|scroll)/.test(ov) && sc.scrollHeight > sc.clientHeight + 1) break; }
  const r = o.getBoundingClientRect(), v = (sc && sc !== document.body ? sc : document.documentElement).getBoundingClientRect();
  const bottom = Math.min(v.bottom, innerHeight), top = Math.max(v.top, 0);
  return { who: (o.textContent || "").trim().slice(0, 40), drawnBy: o === a ? "itself" : o.tagName.toLowerCase(), ext, cut: +Math.max(top - (r.top - ext), (r.bottom + ext) - bottom, 0).toFixed(2) };
});
t("S111 S112 the ring has room at the foot: Disconnect by Tab, Keep it landed on, the question's Disconnect by Tab", async (ctx) => {
  const W = world();
  const page = await open(W, ctx);
  await settings(page, "routing");
  const off = '[data-dm-off="levanto"]';
  await page.waitForSelector(off);
  // Disconnect just under the foot of the box it scrolls in, and the keyboard on the control before it
  const prev = await page.evaluate((sel) => {
    const b = document.querySelector(sel);
    let sc = b.parentElement;
    for (; sc && sc !== document.body; sc = sc.parentElement) { const o = getComputedStyle(sc).overflowY; if (/(auto|scroll)/.test(o) && sc.scrollHeight > sc.clientHeight + 1) break; }
    const v = sc.getBoundingClientRect(), r = b.getBoundingClientRect();
    sc.scrollTop += r.top - Math.min(v.bottom, innerHeight) + 2;
    const all = [...document.querySelectorAll('#settings [data-page="routing"] :is(a[href],button,input,select,textarea,xo-select,[tabindex="0"]):not([disabled])')].filter((x) => x.getClientRects().length && x.tabIndex >= 0);
    const i = all.indexOf(b);
    all[i - 1].setAttribute("data-ring-prev", "");
    return i > 0;
  }, off);
  assert.ok(prev, "a control before Disconnect");
  await page.keyboard.press("Shift");
  await page.evaluate(() => document.querySelector("[data-ring-prev]").focus({ preventScroll: true }));
  await page.keyboard.press("Tab");
  assert.equal(await focused(page), `button${off}`, "Tab reaches Disconnect");
  let g = await ringRoom(page);
  assert.equal(g.cut, 0, `Disconnect by Tab: its whole ring inside (${JSON.stringify(g)})`);
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), "button[data-dm-no]", "the question opens on Keep it");
  g = await ringRoom(page);
  assert.equal(g.cut, 0, `Keep it, landed on: its whole ring inside (${JSON.stringify(g)})`);
  await page.keyboard.press("Tab");
  assert.equal(await focused(page), 'button[data-dm-yes="levanto"]');
  g = await ringRoom(page);
  assert.equal(g.cut, 0, `the question's Disconnect by Tab: its whole ring inside (${JSON.stringify(g)})`);
  await done(page);
});

// the allow/deny box's ring is drawn by its label (2 px at a 1 px gap): whole at the foot too (the create-project
// grader on e55c2d8, C115 on a phone: the label flush with the screen's foot, 3 px of its ring cut). The label just
// under the foot; Tab reaches its box (the browser brings the box, the focus rule the label's ring); then a refused
// save keeps focus there and the ring stays whole.
t("C115 the allow/deny label's ring is whole at the foot: by Tab, and through a refused save", async (ctx) => {
  const W = world({ delay: 200 });
  W.fail.policy = [err("unavailable", "Policy fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  const box = page.locator(".rt-check input").first();
  await box.waitFor();
  await page.keyboard.press("Shift"); // the keyboard's: a script's focus after it shows its ring
  const prev = await page.evaluate(() => {
    const b = document.querySelector(".rt-check input"), l = b.closest("label");
    let sc = b.parentElement;
    for (; sc && sc !== document.body; sc = sc.parentElement) { const o = getComputedStyle(sc).overflowY; if (/(auto|scroll)/.test(o) && sc.scrollHeight > sc.clientHeight + 1) break; }
    const v = sc.getBoundingClientRect(), r = l.getBoundingClientRect();
    sc.scrollTop += r.top - Math.min(v.bottom, innerHeight) + 2;
    const all = [...document.querySelectorAll('#settings [data-page="runtimes"] :is(a[href],button,input,select,textarea,xo-select,[tabindex="0"]):not([disabled])')].filter((x) => x.getClientRects().length && x.tabIndex >= 0);
    const i = all.indexOf(b);
    if (i > 0) all[i - 1].focus({ preventScroll: true }); // the control before it, now (a redraw may replace a marked one)
    return i > 0;
  });
  assert.ok(prev, "a control before the box");
  await page.keyboard.press("Tab");
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector(".rt-check input")), true, "Tab reaches the box");
  let g = await ringRoom(page);
  assert.equal(g.drawnBy, "label", `its label draws the ring (${JSON.stringify(g)})`);
  assert.equal(g.cut, 0, `by Tab: the label's whole ring inside (${JSON.stringify(g)})`);
  await page.keyboard.press("Space"); // a save, refused
  await page.waitForSelector(".rt-ferr[role=alert]");
  await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))));
  g = await ringRoom(page);
  assert.equal(g.cut, 0, `refused: the label's whole ring still inside (${JSON.stringify(g)})`);
  await done(page);
});

// a Disconnect whose chat cleanup is refused, then "Use the Space's" for that chat: the words about it go with it (the
// create-project grader on 65e84b7, S113: routing null and the row gone, yet "demo still names it" stayed, a
// Disconnect's own flag that nothing cleared). The words are the routing's, read from it each time it's drawn.
t("S113 a refused chat cleanup after Disconnect is said; once that chat uses the Space's routing, it isn't", async (ctx) => {
  const chats = JSON.parse(JSON.stringify(CHATS));
  chats.find((c) => c.id === "chat_demo").routing = { mode: "decision", decision_model: "levanto" };
  const W = world({ chats });
  W.fail.patch = [err("unavailable", "Patch fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "routing");
  await page.waitForSelector('[data-ov-clear="chat_demo"]');
  await keyFocus(page, '[data-dm-off="levanto"]');
  await page.keyboard.press("Enter");
  await keyFocus(page, '[data-dm-yes="levanto"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-dm-on="levanto"]');
  assert.equal(writes(page, "patch"), 1, "the chat's cleanup was tried, and refused");
  const said = () => page.evaluate(() => (document.querySelector('[data-page="routing"]').innerText.match(/still names?[^\n.]*/g) || []));
  assert.equal((await said()).length, 1, `the page says the chat still names it: ${JSON.stringify(await said())}`);
  await keyFocus(page, '[data-ov-clear="chat_demo"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-ov-clear="chat_demo"]'));
  assert.equal(writes(page, "patch"), 2);
  assert.deepEqual(await said(), [], "no chat names it now, and the page doesn't say one does");
  assert.equal(await page.locator('[data-page="routing"] .set-err').count(), 0, "no error left");
  await done(page);
});

// ── a chat's own routing ──────────────────────────────────────────────────────────────────
t("S113 Use the Space's: one PATCH for two Enters; the failure in its row; the retry clears it; focus lands", async (ctx) => {
  const chats = JSON.parse(JSON.stringify(CHATS));
  chats.find((c) => c.id === "chat_demo").routing = { mode: "agent" };
  const W = world({ delay: 400, chats });
  W.fail.patch = [err("unavailable", "Patch fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "routing");
  await page.waitForSelector('[data-ov-clear="chat_demo"]');
  await keyFocus(page, '[data-ov-clear="chat_demo"]');
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await busy(page, '[data-ov-clear="chat_demo"]'), "true");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-key="ov:chat_demo"] .set-err[role=alert]');
  assert.equal(writes(page, "patch"), 1);
  assert.equal(await focused(page), 'button[data-ov-clear="chat_demo"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-ov-clear="chat_demo"]'));
  assert.equal(writes(page, "patch"), 2);
  assert.equal(await page.locator('[data-page="routing"] .set-err').count(), 0, "no stale error");
  assert.equal(await focused(page), 'button[data-route="agent"]', "the Space's own choice");
  await done(page);
});

// ── Rules ────────────────────────────────────────────────────────────────────────────────
t("C116 S103 S104 Revoke: Keep first and back; one DELETE for two Enters; failure in the row, retry; success → the next rule", async (ctx) => {
  const W = world({ delay: 400 });
  W.fail.revoke = [err("unavailable", "Revoke fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "rules");
  await page.waitForSelector('[data-rule-off="r1"]');
  await keyFocus(page, '[data-rule-off="r1"]');
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), "button[data-rule-no]", "the question opens on Keep");
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), 'button[data-rule-off="r1"]', "Keep → Revoke");
  await page.keyboard.press("Enter");
  await keyFocus(page, '[data-rule-yes="r1"]');
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await busy(page, '[data-rule-yes="r1"]'), "true");
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-key="rule:r1"] .set-err[role=alert]');
  await shot(page, "rule-error");
  assert.equal(writes(page, "revoke"), 1);
  assert.equal(await focused(page), 'button[data-rule-yes="r1"]', "the retry is where you are");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-key="rule:r1"]'));
  assert.equal(writes(page, "revoke"), 2);
  assert.equal(await focused(page), 'button[data-rule-off="r2"]', "the next rule's Revoke");
  assert.equal(await page.locator('[data-page="rules"] .set-err').count(), 0);
  await done(page);
});
t("S104 the last rule in a list: focus goes to the one before it", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "rules");
  await page.locator('[data-rule-off="r3"]').click();
  await keyFocus(page, '[data-rule-yes="r3"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-key="rule:r3"]'));
  assert.equal(await focused(page), 'button[data-rule-off="r2"]');
  await done(page);
});

// ── Worktrees ────────────────────────────────────────────────────────────────────────────
t("S105 S106 S108 Remove: Keep it first and back; one DELETE for two Enters; a failed one leaves a working retry; removed → the next row", async (ctx) => {
  const W = world({ delay: 400 });
  W.fail.remove = [err("unavailable", "Remove fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "worktrees");
  const k = '[data-wt="chat_demo/t-clean"]', yes = '[data-wt-yes="chat_demo/t-clean"]';
  await page.waitForSelector(k);
  await keyFocus(page, k);
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), "button[data-wt-no]");
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), `button${k}`, "Keep it → Remove");
  await page.keyboard.press("Enter");
  await keyFocus(page, yes);
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await busy(page, yes), "true");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".wt-confirm .set-err[role=alert]");
  assert.equal(writes(page, "remove"), 1, "one DELETE for two Enters");
  assert.equal(await busy(page, yes), null, "the retry isn't stuck waiting");
  assert.equal(await page.locator(yes).isDisabled(), false);
  assert.equal(await focused(page), `button${yes}`);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-key="wt:chat_demo/t-clean"]'));
  assert.equal(writes(page, "remove"), 2);
  assert.equal(await focused(page), 'button[data-wt="chat_demo/t-dirty"]', "the next row's Remove");
  await done(page);
});
t("S105 S107 work to lose: the server's list and the hold, on Keep it; held → removed once, focus on the next row", async (ctx) => {
  const W = world({ delay: 300 });
  const page = await open(W, ctx);
  await settings(page, "worktrees");
  const k = '[data-wt="chat_demo/t-dirty"]';
  await page.waitForSelector(k);
  await keyFocus(page, k);
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await busy(page, k), "true", "asking the server what would be lost");
  await page.waitForSelector("[data-wt-hold]");
  assert.equal(await focused(page), "button[data-wt-no]", "the loss question opens on Keep it");
  assert.match(await page.locator(".wt-loss").innerText(), /2 files changed/);
  await shot(page, "worktree-loss");
  await keyFocus(page, "[data-wt-hold]");
  await page.keyboard.down("Enter");
  await page.waitForTimeout(1450);
  await page.keyboard.up("Enter");
  await page.waitForFunction(() => !document.querySelector('[data-key="wt:chat_demo/t-dirty"]'));
  const rm = page.W.writes.filter((w) => w.kind === "remove");
  assert.equal(rm.length, 2, "the 409 ask, then one confirmed removal");
  assert.match(rm[1].query, /confirm=tok-1/);
  assert.equal(await focused(page), 'button[data-wt="chat_demo/t-last"]');
  await done(page);
});
t("S108 the only removable row left: removed → focus on Worktrees' tab, never the page", async (ctx) => {
  const W = world();
  W.trees = W.trees.filter((w) => w.thread_ts === "t-last");
  const page = await open(W, ctx);
  await settings(page, "worktrees");
  await page.locator('[data-wt="chat_demo/t-last"]').click();
  await keyFocus(page, '[data-wt-yes="chat_demo/t-last"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector('[data-page="worktrees"] .set-note');
  assert.equal(await focused(page), 'button#set-t-worktrees[data-set="worktrees"]');
  await done(page);
});

// ── Runtimes ─────────────────────────────────────────────────────────────────────────────
t("C114 S097 C115 Runtimes: focus stays on the default, the switch and a box through each save; one PUT for two presses", async (ctx) => {
  const W = world({ delay: 400 });
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  await page.waitForSelector('[data-rtd-default="codex"]');
  const d = '[data-rtd-default="codex"]';
  await keyFocus(page, d);
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await focused(page), `button${d}`, "while it saves");
  assert.equal(await busy(page, d), "true");
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(s).getAttribute("aria-checked") === "true" && !document.querySelector(s).hasAttribute("aria-busy"), d);
  assert.equal(writes(page, "policy"), 1, "one PUT for two Enters");
  assert.equal(await focused(page), `button${d}`, "after it saved");
  // the switch, failing first
  page.W.fail.policy = [err("unavailable", "Policy fixture unavailable")];
  await keyFocus(page, "[data-rtd-fallback]");
  await page.keyboard.press("Space");
  await settle(page, 60);
  assert.equal(await focused(page), "button[data-rtd-fallback]");
  await page.waitForSelector(".rt-ferr[role=alert]");
  await shot(page, "runtime-fallback-error");
  assert.equal(await focused(page), "button[data-rtd-fallback]", "after the refusal");
  assert.equal(await page.locator("[data-rtd-fallback]").getAttribute("aria-checked"), "false");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.querySelector("[data-rtd-fallback]").getAttribute("aria-checked") === "true" && !document.querySelector("[data-rtd-fallback]").hasAttribute("aria-busy"));
  assert.equal(await focused(page), "button[data-rtd-fallback]", "after the retry saved");
  // a box: Space saves, and a second Space while it's out changes nothing
  const box = 'input[data-rtd-allowed="codex"]';
  await keyFocus(page, box);
  const before = writes(page, "policy");
  await page.keyboard.press("Space");
  await settle(page, 60);
  assert.equal(await focused(page), `input${box.slice(5)}`);
  await page.keyboard.press("Space");
  assert.equal(await page.locator(box).isChecked(), false, "the second Space didn't flip it back");
  await page.waitForFunction((s) => !document.querySelector(s).hasAttribute("aria-busy"), box);
  assert.equal(writes(page, "policy"), before + 1);
  assert.equal(await focused(page), `input${box.slice(5)}`, "after it saved");
  assert.deepEqual(page.W.policy.allowed, ["claude_code"]);
  await done(page);
});
t("C115 a refused box shows what's saved again, says why, and Space tries again", async (ctx) => {
  const W = world({ delay: 300 });
  W.fail.policy = [err("unavailable", "Policy fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  const box = 'input[data-rtd-allowed="codex"]';
  await page.waitForSelector(box);
  await keyFocus(page, box);
  await page.keyboard.press("Space");
  await settle(page, 60);
  assert.equal(await page.locator(box).isChecked(), false, "while it saves: the change being saved");
  await page.waitForSelector('.rt-ferr[role="alert"]');
  assert.equal(await page.locator(box).isChecked(), true, "refused: the saved state again");
  assert.equal(await focused(page), `input${box.slice(5)}`);
  // the refusal, said above it, never pushes the box you're on out of sight; and on a phone its label is 36 tall
  // (the create-project/Launchpad grader on 9d1f71b, C115: below the screen, 34 px)
  await settle(page, 60);
  const g = await page.evaluate((s) => {
    const lab = document.querySelector(s).closest("label"), r = lab.getBoundingClientRect();
    let sc = lab.parentElement; while (sc && sc !== document.body) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 1) break; sc = sc.parentElement; }
    const v = sc && sc !== document.body ? sc.getBoundingClientRect() : { top: 0, bottom: innerHeight };
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vt: Math.round(v.top), vb: Math.round(Math.min(v.bottom, innerHeight)), h: Math.round(r.height) };
  }, box);
  assert.ok(g.top >= g.vt - 1 && g.bottom <= g.vb + 1, `the box's label in sight after the refusal (${g.top}–${g.bottom} in ${g.vt}–${g.vb})`);
  if (ctx.width < 600) assert.ok(g.h >= 36, `on a phone, 36 tall at least (${g.h})`);
  await page.keyboard.press("Space");
  await page.waitForFunction((s) => !document.querySelector(s).checked && !document.querySelector(s).hasAttribute("aria-busy") && !document.querySelector(".rt-ferr"), box);
  assert.deepEqual(page.W.policy.allowed, ["claude_code"]);
  assert.equal(writes(page, "policy"), 2);
  await done(page);
});
t("C106 C099 a change this browser can't keep applies and says so, under its switch, instead of claiming it's done", async (ctx) => {
  const page = await open(world(), ctx, { fullStorage: true });
  await settings(page, "shape");
  await keyFocus(page, "[data-shp-dense]");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.documentElement.dataset.density === "compact");
  await page.waitForSelector('[data-page="shape"] .set-err[role="alert"]');
  assert.match(await page.locator('[data-page="shape"] .set-err').innerText(), /won't keep it after a reload/);
  await page.waitForTimeout(150);
  assert.doesNotMatch(await page.locator("#live").innerText(), /Compact on this device/, "no claim that it's done");
  assert.equal(await focused(page), "button[data-shp-dense]");
  await page.locator('[data-set="general"]').click();
  await keyFocus(page, "#hops-tog");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#hops-tog").getAttribute("aria-checked"), "true", "it applies");
  await page.waitForSelector('[data-page="general"] .set-err[role="alert"]');
  assert.match(await page.locator('[data-page="general"] .set-err').innerText(), /won't keep it after a reload/);
  await page.waitForTimeout(150);
  assert.doesNotMatch(await page.locator("#live").innerText(), /Showing how messages travel/);
  await keyFocus(page, "#webpics-tog");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#webpics-tog").getAttribute("aria-checked"), "false", "pictures off: it applies");
  assert.match(await page.locator("#webpics-tog").locator("xpath=ancestor::div[contains(@class,'set-row')]").locator(".set-err").innerText(), /won't keep it after a reload/);
  assert.doesNotMatch(await page.locator("#live").innerText(), /Pictures from the web show as links/);
  await shot(page, "unkept");
  await done(page);
});
t("S115 C101 a save XO couldn't take is held: a reload keeps it on screen, and it's sent again", async (ctx) => {
  const W = world();
  W.fail.shape = [err("unavailable", "Shape fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "shape");
  await keyFocus(page, '[data-shp-preset="marketing"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-shp-preset="marketing"]').getAttribute("aria-checked") === "true");
  await page.waitForFunction(() => !!localStorage.getItem("cv-shape-unsynced"), null, { timeout: 8000 });
  assert.equal(writes(page, "shape"), 1, "one PUT, refused with a 503");
  assert.equal(W.shape.shape.preset, "everything", "XO still has the old one");
  // the reload reads XO's older shape, and doesn't take it over the change: it sends the change again
  await page.reload();
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached" });
  await page.waitForFunction(() => !localStorage.getItem("cv-shape-unsynced"), null, { timeout: 8000 });
  assert.equal(W.shape.shape.preset, "marketing", "it reached XO");
  await settings(page, "shape");
  assert.equal(await page.locator('[data-shp-preset="marketing"]').getAttribute("aria-checked"), "true", "and the page still shows it");
  await done(page);
});
t("S115 C101 a save XO refused (413) says so plainly and why, on the Shape page and after a reload; never saved, never quietly pending", async (ctx) => {
  const W = world();
  W.fail.shape = [{ status: 413, body: { detail: { code: "shape_too_large", message: "Too large" } } }];
  const page = await open(W, ctx);
  await settings(page, "shape");
  await keyFocus(page, '[data-shp-preset="marketing"]');
  await page.keyboard.press("Enter");
  const said = '[data-page="shape"] .set-err[role="alert"]';
  await page.waitForSelector(said);
  assert.match(await page.locator(said).innerText(), /XO refused your last shape change\. XO keeps a shape of up to 64 KB, and this one is larger\. It's kept on this device only/);
  assert.equal(await page.locator('[data-shp-preset="marketing"]').getAttribute("aria-checked"), "true", "it applies here");
  assert.equal(await focused(page), 'button[data-shp-preset="marketing"]');
  await shot(page, "shape-refused");
  // a reload: only a read (a refusal isn't sent again by itself), and it still says so
  const before = writes(page, "shape");
  await page.reload();
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached" });
  await settings(page, "shape");
  await page.waitForSelector(said);
  assert.match(await page.locator(said).innerText(), /XO refused your last shape change/);
  assert.equal(writes(page, "shape"), before, "nothing sent on the reload");
  // the next change goes, with it: the line stays while that PUT is out, and goes when XO has it
  W.delay = 600;
  await keyFocus(page, '[data-shp-preset="engineering"]');
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.equal(writes(page, "shape"), before + 1, "the replacement PUT is out");
  assert.equal(W.shape.shape.preset, "everything", "and not answered yet");
  assert.match(await page.locator(said).innerText(), /XO refused your last shape change/, "still said while it's out");
  await page.waitForFunction(() => !document.querySelector('[data-page="shape"] .set-err'));
  assert.equal(W.shape.shape.preset, "engineering");
  await done(page);
});
t("S115 C101 XO couldn't be reached and this browser couldn't keep the note of it: the Shape page says a reload loses it", async (ctx) => {
  const W = world();
  W.fail.shape = [err("unavailable", "Shape fixture unavailable")];
  const page = await open(W, ctx, { fullStorage: "unsynced" });
  await settings(page, "shape");
  await keyFocus(page, '[data-shp-preset="marketing"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /Not saved yet/.test(document.querySelector('[data-page="shape"]').innerText));
  const text = await page.locator('[data-page="shape"] .shp-top').innerText();
  assert.match(text, /XO couldn't be reached, and this browser can't keep it after a reload/);
  assert.doesNotMatch(text, /kept on this device/);
  await done(page);
});
t("S115 C101 refused by XO and not kept by this browser either: the Shape page never says \"kept on this device\"", async (ctx) => {
  const W = world();
  W.fail.shape = [{ status: 413, body: { detail: { code: "shape_too_large", message: "Too large" } } }];
  const page = await open(W, ctx, { fullStorage: true });
  await settings(page, "shape");
  await keyFocus(page, '[data-shp-preset="marketing"]');
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /XO refused your last shape change/.test(document.querySelector('[data-page="shape"]').innerText));
  const text = await page.locator('[data-page="shape"] .shp-top').innerText();
  assert.match(text, /This browser can't keep it after a reload either: it lasts only while this page is open/);
  assert.doesNotMatch(text, /kept on this device only/);
  await done(page);
});
t("C114 default:null with XO's own runtime turned off: the usual runtime shows the one XO uses, chosen and the group's Tab stop", async (ctx) => {
  const W = world();
  W.policy = { allowed: ["codex"], default: null, preferences: null, fallback: false };
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  const codex = '[data-rtd-default="codex"]';
  await page.waitForSelector(codex);
  assert.equal(await page.locator(codex).getAttribute("aria-checked"), "true", "XO uses Codex: it's shown chosen");
  assert.equal(await page.locator(codex).getAttribute("tabindex"), null, "and it's where Tab enters the group");
  assert.equal(await page.locator('[data-rtd-default="claude_code"]').count(), 0, "the excluded one isn't offered");
  // pressing it changes nothing: it's already what applies
  await keyFocus(page, codex);
  await page.keyboard.press("Enter");
  await settle(page, 150);
  assert.equal(writes(page, "policy"), 0);
  await done(page);
});
t("C114 a refused usual runtime: the saved one stays chosen, the reason shows under it, the keyboard stays, and Enter tries again", async (ctx) => {
  const W = world({ delay: 300 });
  W.fail.policy = [err("unavailable", "Policy fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  const codex = '[data-rtd-default="codex"]';
  await page.waitForSelector(codex);
  await keyFocus(page, codex);
  await page.keyboard.press("Enter");
  await page.waitForSelector('.rt-ferr[role="alert"]');
  assert.equal(await page.locator(codex).getAttribute("aria-checked"), "false", "refused: not chosen");
  assert.equal(await page.locator('[data-rtd-default="claude_code"]').getAttribute("aria-checked"), "true", "the saved one is");
  assert.equal(await focused(page), `button${codex}`);
  await page.keyboard.press("Enter");
  // while the retry is out the choice shows, said as "Saving…", never as saved; "Saved" only once XO has answered
  await page.waitForSelector(".rt-saved.is-saving");
  assert.equal(await busy(page, codex), "true");
  assert.notEqual(page.W.policy.default, "codex", "not saved yet");
  await page.waitForFunction((s) => document.querySelector(s).getAttribute("aria-checked") === "true" && !document.querySelector(s).hasAttribute("aria-busy") && document.querySelector(".rt-saved:not(.is-saving)"), codex);
  assert.equal(page.W.policy.default, "codex");
  assert.equal(await focused(page), `button${codex}`);
  await done(page);
});
t("C106 Compact: the switch stays the same node and says its state; its knob travels (full motion) or lands at once (reduced)", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "shape");
  const sw = "[data-shp-dense]";
  await keyFocus(page, sw);
  const node = await page.locator(sw).elementHandle(), knob = await page.locator(`${sw} .th-knob`).elementHandle();
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.documentElement.dataset.density === "compact");
  assert.equal(await page.locator(sw).getAttribute("aria-checked"), "true");
  assert.equal(await node.evaluate((e) => e === document.activeElement && e.isConnected), true, "the same switch keeps the keyboard");
  assert.equal(await knob.evaluate((e) => e.isConnected), true, "its knob wasn't redrawn, so it slides");
  await page.keyboard.press("Space");
  await page.waitForFunction(() => document.documentElement.dataset.density !== "compact");
  assert.equal(await page.locator(sw).getAttribute("aria-checked"), "false");
  // the knob's x, every frame for 450 ms after a press: with motion it passes through the middle, reduced it doesn't.
  // First it settles at the off end, so the trace can't catch the previous press's travel reversing.
  await page.waitForFunction((sel) => Math.abs(new DOMMatrix(getComputedStyle(document.querySelector(`${sel} .th-knob`)).transform).m41) < 0.5, sw);
  const xs = await page.evaluate(async (sel) => {
    const b = document.querySelector(sel), k = b.querySelector(".th-knob"), xs = [], t0 = performance.now();
    b.click();
    while (performance.now() - t0 < 450) { await new Promise((r) => requestAnimationFrame(r)); xs.push(new DOMMatrix(getComputedStyle(k).transform).m41); }
    return xs;
  }, sw);
  assert.ok(Math.abs(xs[xs.length - 1] - 18) < 0.5, `it ends on: ${xs[xs.length - 1]}`);
  const between = xs.filter((x) => x > 1 && x < 17);
  if (ctx.motion) assert.ok(between.length >= 2, `it travels: ${xs.map((x) => x.toFixed(1)).join(" ")}`);
  else assert.equal(between.length, 0, `reduced motion: no travel (${xs.map((x) => x.toFixed(1)).join(" ")})`);
  await done(page);
});
t("C112 a decision model's \"about it\" link opens its page in a new tab, by Enter as by a click", async (ctx) => {
  const W = world();
  W.dms = W.dms.map((m) => ({ ...m, docs_url: `https://example.invalid/${m.id}` }));
  const page = await open(W, ctx);
  await settings(page, "routing");
  // each one is a single piece of text, on one line, however its row's words wrap (a phone's connected model's
  // "Connected · model … · about it" wrapped it into "about" and "it" a line apart)
  for (const id of ["levanto", "quill"]) {
    const rects = await page.locator(`[data-key="dm:${id}"] a`).evaluate((e) => e.getClientRects().length);
    assert.equal(rects, 1, `${id}'s "about it" is on one line`);
  }
  const a = page.locator('[data-key="dm:quill"] a');
  assert.equal(await a.getAttribute("target"), "_blank");
  assert.match(await a.getAttribute("rel"), /noopener/);
  // the new tab's request is answered here and goes nowhere: what's checked is that a new tab asked for that page
  await page.context().route("https://example.invalid/**", (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<title>about</title>" }));
  for (const how of ["Enter", "click"]) {
    // the new tab itself (the context's new page), then the address it lands on: a request's frame isn't there yet
    // for a new tab's first navigation, so the tab is what's awaited
    const opened = page.context().waitForEvent("page");
    if (how === "click") await a.click(); else { await keyFocus(page, '[data-key="dm:quill"] a'); await page.keyboard.press("Enter"); }
    const tab = await opened;
    await tab.waitForURL("https://example.invalid/quill");
    assert.notEqual(tab, page, `${how}: a new tab, not this one`);
    assert.equal(page.url().startsWith(BASE), true, `${how}: this tab stays where it was`);
    await tab.close();
  }
  await done(page);
});
t("S098 a refused preference keeps what was typed, with the reason under it", async (ctx) => {
  const W = world({ delay: 300 });
  W.fail.policy = [err("unavailable", "Policy fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  await page.waitForSelector("#rtd-pref");
  await page.locator("#rtd-pref").click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Keep this unsaved preference after an error.");
  await page.keyboard.press("Tab");
  await page.waitForSelector(".rt-ferr[role=alert]");
  await shot(page, "runtime-pref-error");
  assert.equal(page.W.writes.filter((w) => w.kind === "policy")[0].body.preferences, "Keep this unsaved preference after an error.");
  assert.equal(await page.locator("#rtd-pref").inputValue(), "Keep this unsaved preference after an error.", "the draft stays");
  // leaving it again saves it
  await page.locator("#rtd-pref").focus();
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => document.querySelector(".rt-saved:not(.is-saving)"));
  assert.equal(page.W.policy.preferences, "Keep this unsaved preference after an error.");
  assert.equal(await page.locator("#rtd-pref").inputValue(), "Keep this unsaved preference after an error.");
  await done(page);
});
t("S098 a newer preference typed while one saves: Saved only beside what XO holds; the newer one saves in its turn", async (ctx) => {
  // the create-project/Launchpad grader on 9d1f71b: A saving, B typed, Runtimes left and opened again, A lands:
  // "Saved" stood beside B while XO held A
  const W = world();
  const rel = [];
  W.gates = { policy: [0, 1].map(() => new Promise((ok) => rel.push(ok))) };
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  await page.waitForSelector("#rtd-pref");
  const pref = page.locator("#rtd-pref");
  await pref.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Preference A");
  await page.keyboard.press("Tab"); // A goes, and is held
  await page.waitForSelector(".rt-saved.is-saving");
  await pref.focus();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Preference B");
  // Runtimes left, and opened again
  await page.locator('[data-set="keys"]').filter({ visible: true }).first().click();
  await page.waitForSelector('[data-page="keys"]:not([hidden])');
  await page.locator('[data-set="runtimes"]').filter({ visible: true }).first().click();
  await page.waitForSelector("#rtd-pref");
  assert.equal(await pref.inputValue(), "Preference B", "B is kept");
  rel[0](); // A lands
  await page.waitForTimeout(400); // A's answer arrives and is drawn
  assert.equal(page.W.policy.preferences, "Preference A", "XO holds A");
  const mid = await page.evaluate(() => [...document.querySelectorAll(".rt-saved")].map((x) => x.textContent));
  assert.ok(!mid.includes("Saved"), `no "Saved" beside B while XO holds A (${JSON.stringify(mid)})`);
  assert.equal(page.W.writes.filter((w) => w.kind === "policy").length, 2, "B goes in its turn, once A has landed (it was left while A was out)");
  rel[1](); // B lands
  await page.waitForFunction(() => [...document.querySelectorAll(".rt-saved")].some((x) => x.textContent === "Saved"));
  assert.equal(page.W.policy.preferences, "Preference B", "XO holds B");
  assert.equal(await pref.inputValue(), "Preference B", "and the field shows it: Saved is true");
  await done(page);
});

t("S098 A out, B left, A typed back and left, A refused: nothing is sent again by itself; A stays, with the reason", async (ctx) => {
  // the create-project grader's sequence on e55c2d8 (from the code): leaving B queued it with a flag; typing A back and
  // leaving didn't clear it; A's refusal then sent A again, a second send nobody asked for
  const W = world();
  let release;
  W.gates = { policy: [new Promise((ok) => (release = ok))] };
  W.fail.policy = [err("unavailable", "Policy fixture unavailable")];
  const page = await open(W, ctx);
  await settings(page, "runtimes");
  await page.waitForSelector("#rtd-pref");
  const pref = page.locator("#rtd-pref");
  const type = async (words) => { await pref.focus(); await page.keyboard.press("ControlOrMeta+a"); await page.keyboard.type(words); await page.keyboard.press("Tab"); };
  await type("Preference A"); // A goes, and is held
  await page.waitForSelector(".rt-saved.is-saving");
  await type("Preference B"); // B left while A is out
  await type("Preference A"); // A typed back, and left
  release(); // A is refused
  await page.waitForSelector(".rt-ferr[role=alert]");
  await page.waitForTimeout(800); // time for any send it would make by itself
  assert.equal(writes(page, "policy"), 1, "one send: A's; nothing sent again by itself");
  assert.equal(await pref.inputValue(), "Preference A", "A stays in the field, to try again");
  await done(page);
});
t("S209 a dropdown busy saving keeps focus but takes no new choice; when the save lands it shows what XO holds", async (ctx) => {
  // the create-project grader on 9d1f71b: while 70% saved, the busy threshold still opened, End then Enter showed 90%
  // and sent nothing, and the 70% answer put it back: the choice thrown away (dropdown.js ignored the host's busy state)
  const W = world({ router: { mode: "decision", decision_model: "levanto", abstain_below: 0.5 } });
  const rel = [];
  W.gates = { router: [0].map(() => new Promise((ok) => rel.push(ok))) };
  const page = await open(W, ctx);
  await settings(page, "routing");
  const sel = page.locator("xo-select[data-abstain]");
  await sel.waitFor();
  const btn = sel.locator(".dd-btn");
  await keyFocus(page, "xo-select[data-abstain] .dd-btn");
  await page.keyboard.press("Enter");
  await page.waitForSelector("xo-select[data-abstain].is-open");
  const pick = await page.evaluate(() => [...document.querySelectorAll("xo-select[data-abstain] option")].findIndex((o) => o.textContent.startsWith("70%")));
  for (let i = 0; i < 9 && (await page.evaluate(() => document.querySelector("xo-select[data-abstain] .dd-row.is-cur")?.textContent || "")).indexOf("70%") < 0; i++) await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter"); // 70% goes, and is held
  await page.waitForFunction(() => document.querySelector("xo-select[data-abstain]")?.getAttribute("aria-busy") === "true");
  assert.equal(writes(page, "router"), 1, "70% sent");
  // while it's out: the keys that open and choose do nothing; focus stays on it
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const mid = await page.evaluate(() => { const x = document.querySelector("xo-select[data-abstain]"); return { open: x.classList.contains("is-open"), shown: x.querySelector(".dd-v").textContent, focus: document.activeElement === x.querySelector(".dd-btn"), busy: x.querySelector(".dd-btn").getAttribute("aria-busy") }; });
  assert.deepEqual(mid, { open: false, shown: "70% sure", focus: true, busy: "true" }, `held: no list, no new choice, focus kept, said busy on the button (${JSON.stringify(mid)})`);
  assert.equal(writes(page, "router"), 1, "nothing more sent");
  rel[0](); // 70% lands
  await page.waitForFunction(() => document.querySelector("xo-select[data-abstain]")?.getAttribute("aria-busy") !== "true");
  assert.equal(await page.evaluate(() => document.querySelector("xo-select[data-abstain] .dd-v").textContent), "70% sure", "it shows what XO holds");
  assert.equal(page.W.router.abstain_below, 0.7);
  assert.ok(pick >= 0, "a 70% choice exists");
  // and once it's done, a choice goes again
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("xo-select[data-abstain]")?.getAttribute("aria-busy") === "true" || false, null, { timeout: 3000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector("xo-select[data-abstain]")?.getAttribute("aria-busy") !== "true");
  assert.equal(writes(page, "router"), 2, "the next choice is sent");
  await done(page);
});

// ── Keyboard ─────────────────────────────────────────────────────────────────────────────
t("C118 S022 S023 Keyboard: Esc keeps the key focused; a new key too; a reset → its key; Reset all → the first key", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "keys");
  const jump = '[data-rebind="jump"]';
  await keyFocus(page, jump);
  await page.keyboard.press("Enter");
  assert.match(await page.locator(jump).innerText(), /Press a key/);
  await shot(page, "key-recording");
  await page.keyboard.press("Escape");
  assert.equal(await focused(page), `button${jump}`, "Esc cancels, focus stays");
  assert.equal(await page.locator("#settings").isHidden(), false, "Esc cancelled the recording, not Settings");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+Shift+KeyK");
  assert.equal(await focused(page), `button${jump}`, "after a new key");
  assert.match(await page.locator(jump).innerText(), /⇧K/);
  await keyFocus(page, '[data-kreset="jump"]');
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), `button${jump}`, "a reset → its key");
  assert.equal(await page.locator('[data-kreset="jump"]').count(), 0);
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+Shift+KeyK");
  await keyFocus(page, "#keys-reset-all");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#keys-reset-all").isDisabled(), true);
  assert.equal(await focused(page), await page.locator("#set-keys-list [data-rebind]").first().evaluate((e) => `button[data-rebind="${e.dataset.rebind}"]`), "Reset all → the first key");
  assert.equal(await page.evaluate(() => localStorage.getItem("cv-keys")), "{}");
  await done(page);
});

// ── Shape ────────────────────────────────────────────────────────────────────────────────
t("S114 S115 Shape JSON: Revert and Save hand the keyboard back to the text", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "shape");
  await page.locator(".shp-json summary").click();
  const ta = "[data-shp-json]";
  await page.locator(ta).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText('{\n  "shape": 1,\n  "preset": "everything",\n  "density": "compact"\n}');
  await keyFocus(page, "[data-shp-revert]");
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), `textarea${ta}`, "Revert → the text");
  assert.equal(await page.locator("[data-shp-revert]").isDisabled(), true);
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.insertText('{\n  "shape": 1,\n  "preset": "everything",\n  "surfaces": { "xo:thread/hops": { "on": true } }\n}');
  await keyFocus(page, "[data-shp-save]");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector("[data-shp-save]").disabled);
  assert.equal(await focused(page), `textarea${ta}`, "Save → the text");
  await done(page);
});
t("C104 S118 S119 Shape presets: arrows move, Enter chooses in place; Reset → the chosen card; Keep mine and Switch → the card", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "shape");
  const card = (id) => `[data-shp-preset="${id}"]`;
  await page.waitForSelector(card("everything"));
  await keyFocus(page, card("everything"));
  await page.keyboard.press("ArrowUp");
  assert.equal(await focused(page), `button${card("marketing")}`);
  assert.equal(await page.locator(card("marketing")).getAttribute("aria-checked"), "false", "moving chose nothing");
  await page.keyboard.press("Enter");
  await page.waitForFunction((s) => document.querySelector(s).getAttribute("aria-checked") === "true" && !document.querySelector(s).hasAttribute("aria-busy"), card("marketing"));
  assert.equal(await focused(page), `button${card("marketing")}`, "the card chosen keeps the keyboard");
  // own changes on top: Reset disables itself and hands the keyboard to the preset it's back to
  await keyFocus(page, "[data-shp-all]");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector("[data-shp-reset]").disabled);
  await keyFocus(page, "[data-shp-reset]");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("[data-shp-reset]").isDisabled(), true);
  assert.equal(await focused(page), `button${card("marketing")}`);
  // a switch over own changes asks first: Keep mine → the chosen card; Switch → the new card
  await keyFocus(page, "[data-shp-all]");
  await page.keyboard.press("Enter");
  await keyFocus(page, card("engineering"));
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), `button[data-shp-switch="engineering"]`, "the question opens on Switch");
  await keyFocus(page, "[data-shp-keep]");
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), `button${card("marketing")}`, "Keep mine → the card still chosen");
  await keyFocus(page, card("engineering"));
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter"); // Switch
  await page.waitForFunction((s) => document.querySelector(s).getAttribute("aria-checked") === "true", card("engineering"));
  assert.equal(await focused(page), `button${card("engineering")}`, "Switch → the card now chosen");
  await done(page);
});
t("C104 S119 Switch while its preset is still reading: Keep mine waits with it (it can't take it back), then the card", async (ctx) => {
  const page = await open(world(), ctx);
  let release;
  const gate = new Promise((ok) => (release = ok));
  await page.route("**/presets/marketing.json", async (r) => { await gate; await r.fallback(); });
  await settings(page, "shape");
  await keyFocus(page, "[data-shp-all]");
  await page.keyboard.press("Enter"); // own changes on top, so a switch asks first
  await page.waitForFunction(() => !document.querySelector("[data-shp-reset]").disabled);
  await keyFocus(page, '[data-shp-preset="marketing"]');
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), 'button[data-shp-switch="marketing"]');
  await page.keyboard.press("Enter"); // Switch: the preset is still reading
  await settle(page, 80);
  assert.equal(await busy(page, "[data-shp-switch]"), "true");
  assert.equal(await page.locator("[data-shp-keep]").getAttribute("aria-disabled"), "true", "Keep mine says it can't now");
  await page.locator("[data-shp-keep]").click({ force: true });
  assert.equal(await page.locator(".shp-confirm").count(), 1, "the question stays while its answer is on its way");
  release();
  await page.waitForFunction(() => document.querySelector('[data-shp-preset="marketing"]').getAttribute("aria-checked") === "true" && !document.querySelector(".shp-confirm"));
  assert.equal(await focused(page), 'button[data-shp-preset="marketing"]');
  await done(page);
});
t("C104 S119 a refused Switch keeps its question and the keyboard, with the reason in it", async (ctx) => {
  const newer = { shape: 99, preset: "everything", surfaces: { "xo:thread/hops": { on: true } } };
  const page = await open(world({ shape: { shape: newer, version: "v99" } }), ctx);
  await page.evaluate((d) => localStorage.setItem("cv-shape-mine", JSON.stringify(d)), newer);
  await page.reload();
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached" });
  await settings(page, "shape");
  await keyFocus(page, '[data-shp-preset="marketing"]');
  await page.keyboard.press("Enter");
  assert.equal(await focused(page), 'button[data-shp-switch="marketing"]');
  await page.keyboard.press("Enter");
  await page.waitForSelector(".shp-confirm .set-err[role=alert]");
  assert.match(await page.locator(".shp-confirm .set-err").innerText(), /newer XO/);
  assert.equal(await focused(page), 'button[data-shp-switch="marketing"]', "the keyboard stays on Switch, beside the reason");
  assert.equal(await page.locator('[data-shp-preset="everything"]').getAttribute("aria-checked"), "true", "nothing changed");
  await keyFocus(page, "[data-shp-keep]");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(".shp-confirm").count(), 0);
  assert.equal(await page.locator('[data-page="shape"] .set-err').count(), 0, "the reason goes with its question");
  await done(page);
});
t("C113 S110 S111 S106 Cancel and Keep it wait while Connect, Disconnect and Remove are on their way", async (ctx) => {
  const page = await open(world({ delay: 500 }), ctx);
  await settings(page, "routing");
  // Connect: Cancel waits
  await page.locator('[data-dm-on="quill"]').click();
  await page.keyboard.type("sk-fixture-key");
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await page.locator("[data-dm-cancel]").getAttribute("aria-disabled"), "true");
  await page.locator("[data-dm-cancel]").click({ force: true });
  assert.equal(await page.locator("[data-dm-form]").count(), 1, "the form stays while Connect is out");
  await page.waitForSelector('[data-dm-off="quill"]');
  assert.equal(await focused(page), 'button[data-dm-off="quill"]');
  // Disconnect: Keep it waits
  await page.locator('[data-dm-off="levanto"]').click();
  await keyFocus(page, '[data-dm-yes="levanto"]');
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await page.locator("[data-dm-no]").getAttribute("aria-disabled"), "true");
  await page.locator("[data-dm-no]").click({ force: true });
  assert.equal(await page.locator('[data-dm-yes="levanto"]').count(), 1, "the question stays while Disconnect is out");
  await page.waitForSelector('[data-dm-on="levanto"]');
  assert.equal(await focused(page), 'button[data-dm-on="levanto"]');
  // Remove: Keep it waits
  await page.locator('[data-set="worktrees"]').click();
  await page.locator('[data-wt="chat_demo/t-clean"]').click();
  await keyFocus(page, '[data-wt-yes="chat_demo/t-clean"]');
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await page.locator("[data-wt-no]").getAttribute("aria-disabled"), "true");
  await page.locator("[data-wt-no]").click({ force: true });
  assert.equal(await page.locator('[data-wt-yes="chat_demo/t-clean"]').count(), 1, "the question stays while Remove is out");
  await page.waitForFunction(() => !document.querySelector('[data-key="wt:chat_demo/t-clean"]'));
  assert.equal(await focused(page), 'button[data-wt="chat_demo/t-dirty"]');
  assert.deepEqual([writes(page, "connect"), writes(page, "disconnect"), writes(page, "remove")], [1, 1, 1]);
  await done(page);
});
t("C116 S103 S104 Keep waits while Revoke is on its way: it can't take it back", async (ctx) => {
  const page = await open(world({ delay: 400 }), ctx);
  await settings(page, "rules");
  await page.locator('[data-rule-off="r1"]').click();
  await keyFocus(page, '[data-rule-yes="r1"]');
  await page.keyboard.press("Enter");
  await settle(page, 60);
  assert.equal(await page.locator("[data-rule-no]").getAttribute("aria-disabled"), "true");
  assert.ok(+(await page.locator("[data-rule-no]").evaluate((e) => getComputedStyle(e).opacity)) < 1, "and it looks it");
  await page.locator("[data-rule-no]").click({ force: true });
  assert.equal(await page.locator('[data-rule-yes="r1"]').count(), 1, "the question stays while Revoke is out");
  await page.waitForFunction(() => !document.querySelector('[data-key="rule:r1"]'));
  assert.equal(await focused(page), 'button[data-rule-off="r2"]');
  await done(page);
});
t("C107 C108 Edit as JSON: Tab from its summary reaches the text and Shift+Tab comes back (a phone's Settings is a sheet)", async (ctx) => {
  const page = await open(world(), ctx);
  await settings(page, "shape");
  await page.locator(".shp-json summary").click();
  await keyFocus(page, ".shp-json summary");
  await page.keyboard.press("Tab");
  assert.equal(await focused(page), "textarea[data-shp-json]");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "SUMMARY");
  // Tab in the text (unchanged, so Revert and Save are off and it's the sheet's last stop) indents and stays
  const ta = page.locator("[data-shp-json]");
  assert.equal(await page.locator("[data-shp-save]").isDisabled(), true);
  await ta.focus();
  await ta.evaluate((e) => e.setSelectionRange(0, 0));
  const before = await ta.inputValue();
  // the editor takes its Tab first: the keyboard never leaves it, not even for a moment (no blur, no trip to Close)
  await ta.evaluate((e) => { window.__taBlurs = 0; e.addEventListener("blur", () => window.__taBlurs++); });
  await page.keyboard.press("Tab");
  assert.equal(await focused(page), "textarea[data-shp-json]", "Tab stays in the text");
  assert.equal(await ta.inputValue(), "  " + before, "it wrote two spaces");
  assert.equal(await page.evaluate(() => window.__taBlurs), 0, "the text kept the keyboard throughout");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.evaluate(() => document.activeElement.tagName), "SUMMARY", "Shift+Tab still leaves");
  // on a phone Settings covers the screen, and its ends turn round: before its first control is its last
  if (ctx.width < 600) {
    await keyFocus(page, "#set-x");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await page.evaluate(() => !!document.activeElement.closest("#settings")), true, "Shift+Tab from the first stays in Settings");
  }
  await done(page);
});
t("S104 S108 S112 Revoke, Remove and Disconnect each answer a held press with a change of their own, not their hover", async (ctx) => {
  const page = await open(world(), ctx);
  /** Held on the button: does it look different from its hover? Let go away from it, so it isn't a click. */
  const held = async (sel) => {
    const b = page.locator(sel);
    const paint = () => b.evaluate((e) => { const c = getComputedStyle(e); return `${c.backgroundColor}|${c.borderColor}|${c.backgroundImage}|${c.transform}`; });
    await b.hover();
    await page.waitForTimeout(250);
    const hover = await paint();
    await page.mouse.down();
    await page.waitForTimeout(150);
    const press = await paint();
    const active = await b.evaluate((e) => e.matches(":active"));
    await page.mouse.move(2, 2);
    await page.mouse.up();
    assert.equal(active, true, `${sel} is held`);
    assert.notEqual(press, hover, `${sel}, held, looks pressed`);
  };
  await settings(page, "rules");
  await page.locator('[data-rule-off="r1"]').click();
  await held('[data-rule-yes="r1"]');
  await page.locator('[data-set="worktrees"]').click();
  await page.locator('[data-wt="chat_demo/t-clean"]').click();
  await held('[data-wt-yes="chat_demo/t-clean"]');
  await page.locator('[data-set="routing"]').click();
  await page.locator('[data-dm-off="levanto"]').click();
  await held('[data-dm-yes="levanto"]');
  assert.deepEqual([writes(page, "revoke"), writes(page, "remove"), writes(page, "disconnect")], [0, 0, 0], "nothing was done");
  await done(page);
});
t("S116 S117 the first-run question keeps Tab and Shift+Tab inside it", async (ctx) => {
  const W = world({ shape: { shape: null, version: "new" } });
  const page = await open(W, ctx, { firstRun: true });
  await page.waitForSelector("#shape-first");
  const where = () => page.evaluate(() => { const a = document.activeElement; return a.closest("#shape-first") ? (a.dataset.shf || (a.matches("[data-shf-close]") ? "close" : "sheet")) : `OUT:${a.tagName}`; });
  assert.equal(await where(), "sheet");
  const seen = [];
  for (let i = 0; i < 8; i++) { await page.keyboard.press("Tab"); seen.push(await where()); }
  assert.deepEqual(seen, ["close", "engineering", "marketing", "everything", "close", "engineering", "marketing", "everything"]);
  await page.locator("[data-shf-close]").focus();
  await page.keyboard.press("Shift+Tab");
  assert.equal(await where(), "everything", "Shift+Tab from the first goes to the last");
  await page.keyboard.press("Shift+Tab");
  assert.equal(await where(), "marketing");
  await page.screenshot({ path: `/tmp/settings-work/shots/${ctx.width}-${ctx.theme}-first-run.png` });
  await done(page);
});

// ── Home ─────────────────────────────────────────────────────────────────────────────────
t("H1 C012 C013 Home: Handled and a Recently made file keep focus through Home's redraws (and a second)", async (ctx) => {
  const made = [{ id: "artifact-note", name: "artifact.txt", path: "artifact.txt", relative_path: "artifact.txt", project_id: "demo", thread_ts: null, kind: "file", created_at: NOW, exists: true }];
  const page = await open(world({ made }), ctx);
  await page.evaluate(() => window.__t.go("home"));
  await page.waitForSelector("#hm-made [data-made-file]", { timeout: 15000 });
  for (const sel of ["#hm-end [data-handled]", "#hm-made [data-made-file]"]) {
    await keyFocus(page, sel);
    const node = await page.locator(sel).elementHandle();
    await page.evaluate(() => { window.__t.render(); window.__t.render(); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__t.render());
    assert.equal(await node.evaluate((e) => e === document.activeElement && e.isConnected), true, `${sel} keeps focus, the same node`);
    assert.equal(await node.evaluate((e) => e.matches(":focus-visible")), true, `${sel} still shows its ring`);
  }
  // and Home's parts keep the shape's order, with the "since" line first
  assert.deepEqual(await page.evaluate(() => [...document.querySelector("#hm-body").children].map((e) => e.id)), ["hm-since", "hm-next", "hm-then", "hm-end", "hm-made"]);
  await done(page);
});

// ── run ──────────────────────────────────────────────────────────────────────────────────
(async () => {
  require("fs").mkdirSync("/tmp/settings-work/shots", { recursive: true });
  browser = await launch(chromium);
  if (!browser) { console.error("not run: no Chromium starts here (set CHROMIUM_PATH)"); process.exit(2); }
  server = await serve();
  BASE = `http://127.0.0.1:${server.address().port}`;
  for (const c of tests) {
    if (process.env.ONLY && !new RegExp(process.env.ONLY).test(c.name)) continue;
    for (const ctx of CONTEXTS) {
      const name = `${c.name} [${ctx.width} ${ctx.theme}${ctx.motion ? " motion" : ""}]`;
      try { await c.fn(ctx); passed++; console.log("  ok  " + name); }
      catch (e) { failed++; console.error("  FAIL " + name + "\n" + (e.stack || e.message).split("\n").slice(0, 6).join("\n")); }
      // whatever a case left open, however early it threw (in the harness's boot, a reload, a wait): the browser's own
      // list of contexts, so nothing has to have been registered first (one browser's memory, not many)
      finally { for (const x of browser.contexts()) await x.close().catch(() => {}); }
    }
  }
  await browser.close(); server.close();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
})();
