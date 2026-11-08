// Browser tests for the conversation's own controls (Astra's CONV-1…9, d1c7cb9 ledger), in a real Chromium at a
// desktop and a phone size, dark and light. Each case was shown failing on the commit before its fix.
//   CONV-1 S009  a refused rename keeps the name typed, in the field, with focus; Escape and success end on ⋯
//   CONV-2 S024  a swipe-resolve in All says Resolved only once Space did; a refusal says so where it happened
//   CONV-3 S020 S046  the All filter and a new chat's permission mode: arrows choose, focus stays on the choice
//   CONV-4 C042 C045 C057  the thread menu's arrows, the checklist toggle, Send's focus after a failure
//   CONV-5 C041  Resolve: one request while one is out, focus stays on the button through the outcome
//   CONV-6 S040  Edit on a failed thread message keeps the draft already in the box
//   CONV-7 S043 S048  a chat's Retry and the would-stop question hand focus to the composer
//   CONV-8 S170 S171  a phone long-press menu's Copy, Select text and Escape return focus to the message
//   CONV-9 C027  on a phone, a notice above the composer never covers Back to the latest
//
// Self-contained, like flows.test.cjs: the app is served from this folder and every /api request is answered
// in the page from the shared mock world (harness.cjs) plus a project with threads, a plain chat and a runtime
// (convApi below). Nothing reaches a Space; nothing is written anywhere.
//   node tests/browser/conversation.test.cjs [name regex]       COMBOS=1440-dark,390-light … to narrow
// Needs Playwright's core and a Chromium (PLAYWRIGHT_CORE); without them it says so and exits 2.
"use strict";
const assert = require("assert/strict");

const PW = process.env.PLAYWRIGHT_CORE || "/tmp/pw/node_modules/playwright-core";
let chromium;
try { ({ chromium } = require(PW)); } catch { console.error(`not run: Playwright core isn't at ${PW} (set PLAYWRIGHT_CORE)`); process.exit(2); }
const { serve, NOW, mockApi, hooks, launch } = require("./harness.cjs");

let browser, server, BASE, passed = 0, failed = 0;
let C = { width: 1440, height: 900, theme: "dark" };
const phone = () => C.width < 760;
const tests = [];
const t = (name, fn, { only } = {}) => tests.push({ name, fn, only });

// ── the world: the demo project with threads, a plain chat, a runtime that offers permission modes ──
const STATUS = "✓ Read the form\n✱ Fix validation\n○ Test it";
const TH = (ts, title, state, x = {}) => ({ ts, chat_id: "chat_demo", title, label: null, state, created_at: NOW, updated_at: NOW, status_md: STATUS, session_id: null, ...x });
const THREADS = () => [
  TH("t_login", "Fix the login form", "done"),
  TH("t_docs", "Write the docs", "working"),
  TH("t_api", "Rework the API", "failed"),
  TH("t_logo", "Draw the logo", "done"),
  TH("t_old", "Old migration", "resolved"),
];
const MSGS = (ts, n = 0) => Array.from({ length: n }, (_, i) => ({ id: `${ts}-m${i}`, seq: i + 1, chat_id: "chat_demo", thread_ts: ts, author_kind: i % 2 ? "owner" : "agent", author_id: i % 2 ? "owner" : "agent", author_session_id: null, text: i % 2 ? `My note number ${i}.` : `Agent line ${i}. ${"A sentence that fills the bubble so the thread is long enough to scroll. ".repeat(3)}`, reply_to: null, extra: {}, created_at: new Date(Date.now() - (n - i) * 60000).toISOString() }));
const RUNTIME = { name: "claude_code", status: "ready", default: true, cli: { logged_in: true }, features: { features: { "permissions.mode": { support: "native", values: ["auto", "ask", "accept_edits", "plan", "bypass"] }, send_while_running: { support: "native", behaviour: "steered" }, interrupt: { support: "native" } } } };
const CHAT = (x = {}) => ({ id: "cse_chat1", role: "plain", state: "idle", agent: "claude_code", model: null, effort: null, permission_mode: "auto", cwd: "", native_id: "nat1", created_at: NOW, updated_at: NOW, retired_at: null, seq: 1, ...x });
const fail = (r, code = "unavailable", message = "Fixture refused", status = 503, x = {}) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify({ detail: { code, message, ...x } }) });

function convApi(W) {
  return async (r) => {
    const req = r.request(), u = new URL(req.url()), m = req.method(), p = u.pathname;
    const json = (o, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(o) });
    let k;
    if (p === "/api/chat/chats/chat_demo/threads" && m === "GET") return json({ threads: W.threads });
    if ((k = /^\/api\/chat\/chats\/chat_demo\/threads\/([^/]+)$/.exec(p))) {
      const row = W.threads.find((x) => x.ts === k[1]);
      if (!row) return fail(r, "not_found", "No such thread", 404);
      if (m === "GET") return json(row);
      if (m === "PATCH") {
        const body = JSON.parse(req.postData() || "{}");
        W.patches.push(body);
        if (W.patchGate) await W.patchGate;
        if (W.patchFail) return fail(r);
        if ("resolved" in body) Object.assign(row, { state: body.resolved ? "resolved" : "working", resolved_at: body.resolved ? NOW : null });
        if (body.title) row.title = body.title;
        if ("label" in body) row.label = body.label;
        return json(row);
      }
    }
    // older pages, read on demand (DET-3): the first page names a cursor; the read below it can be held or fail
    const older = (o) => async () => {
      W.olderReads = (W.olderReads || 0) + 1;
      if (W.olderGate) await W.olderGate;
      if (W.olderFail) return fail(r, "unavailable", "Fixture: earlier messages didn't come", 500);
      return json({ messages: o.msgs || [], next_after_seq: null, next_before_seq: null });
    };
    // a long history, paged as storm pages it (newest first, `limit` at a time, a cursor while there's more)
    if (W.history && p === "/api/chat/chats/chat_demo/messages" && m === "GET" && u.searchParams.get("thread") === W.history.ts) {
      const before = +u.searchParams.get("before_seq"), limit = +u.searchParams.get("limit") || 40;
      const older = W.history.all.filter((x) => x.seq < before), page = older.slice(-limit);
      if (before < 1e15 && W.history.delay) await new Promise((ok) => setTimeout(ok, W.history.delay));
      return json({ messages: page, next_after_seq: null, next_before_seq: older.length > page.length ? page[0].seq : null });
    }
    if (p === "/api/chat/chats/chat_demo/messages" && m === "GET") {
      const ts = u.searchParams.get("thread"), before = u.searchParams.get("before_seq");
      const o = ts ? W.threadOlder && W.threadOlder.ts === ts && W.threadOlder : W.projOlder;
      if (o && before === String(o.before)) return older(o)();
      if (!ts && W.projMsgs) return json({ messages: W.projMsgs, next_after_seq: null, next_before_seq: o ? o.before : null });
      if (ts && o) return json({ messages: W.threadMsgs[ts] || [], next_after_seq: null, next_before_seq: o.before });
    }
    if (p === "/api/chat/chats/chat_demo/messages" && m === "GET" && u.searchParams.get("thread")) {
      // null: nothing older (a 0 would read as another page, and the history would be asked for again and again)
      return json({ messages: W.threadMsgs[u.searchParams.get("thread")] || [], next_after_seq: null, next_before_seq: null });
    }
    if (/^\/api\/chat\/chats\/[^/]+\/messages$/.test(p) && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      W.posts.push(body);
      if (W.postGate) await W.postGate;
      if (W.postFail) return fail(r, "unavailable", "Fixture: the message wasn't taken");
      return json({ id: `srv-${W.posts.length}`, seq: 100 + W.posts.length, chat_id: "chat_demo", thread_ts: body.thread_ts || null, author_kind: "owner", author_id: "owner", text: body.text, extra: {}, created_at: new Date().toISOString(), client_id: body.client_id });
    }
    if (/^\/api\/chat\/chats\/[^/]+\/attachments$/.test(p) && m === "POST") {
      W.uploads.push(u.searchParams.get("name"));
      if (W.uploadGate) await W.uploadGate;
      if (W.uploadFail) return fail(r, "unavailable", "Fixture: the upload wasn't taken");
      return json({ id: `att-${W.uploads.length}`, name: u.searchParams.get("name"), type: "text/plain", bytes: 10 });
    }
    if (/^\/api\/chat\/runtimes\/[^/]+\/models$/.test(p) && W.catalogs) {
      const agent = p.split("/")[4];
      W.modelReads = (W.modelReads || 0) + 1;
      if (W.modelsGate) await W.modelsGate;
      if (W.catalogFail) return fail(r, "unavailable", "Fixture: the catalog didn't come");
      return json({ name: agent, models: W.catalogs[agent] || [] });
    }
    if (p === "/api/chat/runtimes" && W.runtimes) return json({ runtimes: W.runtimes });
    if (p === "/api/chat/sessions" && m === "GET") return json({ sessions: W.sessions || [], next_after_seq: null });
    if ((k = /^\/api\/chat\/sessions\/([^/]+)$/.exec(p)) && m === "GET") { const s = (W.sessions || []).find((x) => x.id === k[1]); return s ? json(s) : fail(r, "not_found", "No such session", 404); }
    if (/^\/api\/messages\/[^/]+$/.test(p)) return json({ messages: W.observed || [] });
    if (p === "/api/chat/prompt" && m === "POST") {
      const body = JSON.parse(req.postData() || "{}");
      W.prompts.push(body);
      if (W.promptGate) await W.promptGate;
      const mode = typeof W.promptMode === "function" ? W.promptMode(body) : W.promptMode;
      if (mode === "fail") return fail(r, "unavailable", "Fixture: the chat didn't take it");
      if (mode === "would_stop") return fail(r, "would_stop_runs", "This would stop 2 background tasks", 409, { count: 2 });
      return json({ session_id: body.session_id || "cse_new", message_id: `p-${W.prompts.length}` });
    }
    return r.fallback();
  };
}

/** The app at the current size and theme against the world W (threads, messages, chats …). */
async function app(W = {}, { touch = phone(), motion = false } = {}) {
  Object.assign(W, { base: BASE, files: {}, saves: [], patches: [], posts: [], prompts: [], uploads: [], threads: W.threads || THREADS(), threadMsgs: W.threadMsgs || {} });
  const ctx = await browser.newContext({ viewport: { width: C.width, height: C.height }, hasTouch: touch, isMobile: phone(), reducedMotion: motion ? "no-preference" : "reduce" });
  await ctx.addInitScript((theme) => { try { localStorage.setItem("cv-theme", theme); } catch { /* */ } }, C.theme);
  await ctx.addInitScript(watchFocus);
  if (W.storage) await ctx.addInitScript((st) => { if (!sessionStorage.getItem("__seeded")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__seeded", "1"); } }, W.storage);
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", mockApi(W));
  await hooks(page);
  await page.route("**/api/**", convApi(W)); // registered last, so asked first; anything else falls back to the mock world
  await page.goto(BASE + "/", { timeout: 30000 });
  await page.waitForSelector('[data-go="p:demo"]', { state: "attached", timeout: 30000 });
  await page.waitForFunction(() => window.__t && window.__t.world.state.threads.length > 0, null, { timeout: 15000 });
  page.errors = errors; page.W = W;
  return page;
}
// test-time only, as harness.cjs openApp's: each time focus falls to the page because the control that had it was
// removed or hidden is recorded, and done() fails the test on any (the app has no runtime focus restorer)
function watchFocus() {
  window.__focusDrops = [];
  let last = null;
  const name = (e) => `${e.tagName.toLowerCase()}${e.id ? "#" + e.id : ""}${[...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}${a.value ? "=" + a.value : ""}]`).join("")} "${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)}"`;
  addEventListener("DOMContentLoaded", () => {
    document.addEventListener("focusin", (e) => { if (e.target !== document.body) last = e.target; }, true);
    // judged a microtask later: Chrome fires focusout for a removed node while it's still connected (harness d88441d)
    document.addEventListener("focusout", (e) => { const t = e.target; queueMicrotask(() => { if (last === t && t.isConnected && t.getClientRects().length) last = null; }); }, true);
    const check = () => {
      const a = document.activeElement;
      if ((!a || a === document.body) && last && (!last.isConnected || !last.getClientRects().length)) { window.__focusDrops.push(name(last)); last = null; }
    };
    new MutationObserver(() => queueMicrotask(check)).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "class", "inert", "style"] });
  });
}
const done = async (page) => {
  const drops = await page.evaluate(() => window.__focusDrops).catch(() => []);
  const errs = page.errors;
  await page.context().close();
  assert.deepEqual(errs, [], "page errors");
  assert.deepEqual(drops, [], "focus fell to the page when its control went");
};
/** What has focus, in words a failure can be read by. */
const focusIs = (page) => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  const d = [...a.attributes].filter((x) => x.name.startsWith("data-") || x.name === "id" || x.name === "role").map((x) => `[${x.name}${x.value ? `=${x.value}` : ""}]`).join("");
  return `${a.tagName.toLowerCase()}${d} "${(a.innerText || a.value || "").trim().slice(0, 40)}"`;
});
const openThread = async (page, ts) => {
  await page.evaluate((ts) => window.__t.go("t:" + ts), ts);
  await page.waitForFunction((ts) => window.__t.S.view === "t:" + ts && document.querySelector("#conv-title, #tw-edit"), ts);
  await page.waitForTimeout(150);
};
const settle = (page, ms = 250) => page.waitForTimeout(ms);
/** The thread's ⋯ menu, opened from the keyboard. */
async function menuOpen(page) {
  await page.locator("[data-tmenu]").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".tw-menu [role=menuitem]");
  await settle(page, 80);
}
async function renameTo(page, text) {
  await menuOpen(page);
  await page.keyboard.press("Enter"); // Rename is the first item
  await page.waitForSelector("#tw-edit");
  await page.locator("#tw-edit").fill(text);
}

// ── CONV-1 · S009: rename ───────────────────────────────────────────────────
t("CONV-1 S009: a refused rename keeps the typed name in the field, with focus; the retry renames", async () => {
  const page = await app({ patchFail: true });
  await openThread(page, "t_login");
  await renameTo(page, "Keep this attempted name");
  await page.keyboard.press("Enter");
  await settle(page, 400);
  assert.equal(page.W.patches.length, 1);
  assert.equal(await page.locator("#tw-edit").inputValue().catch(() => null), "Keep this attempted name", "the typed name is still in the field");
  assert.match(await focusIs(page), /^input\[id=tw-edit\]/, "focus stays in the field");
  assert.match(await page.locator("#live").textContent() + (await page.locator("#herald").innerText()), /Couldn't rename it/);
  assert.equal(await page.evaluate(() => window.__t.world.thread("t_login").title), "Fix the login form", "nothing renamed");
  // the retry, from the same field
  page.W.patchFail = false;
  await page.keyboard.press("Enter");
  await settle(page, 400);
  assert.equal(page.W.patches.length, 2);
  assert.equal(await page.locator("#conv-title").innerText(), "Keep this attempted name");
  assert.match(await focusIs(page), /^button\[data-tmenu/, "focus back on the ⋯ button the rename came from");
  await done(page);
});

t("CONV-1 S009: Enter twice while the rename is out sends it once; the field waits, then closes on ⋯", async () => {
  let release;
  const page = await app({ patchGate: new Promise((ok) => (release = ok)) });
  await openThread(page, "t_login");
  await renameTo(page, "Renamed once");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await settle(page, 200);
  assert.equal(page.W.patches.length, 1, "one request");
  assert.equal(await page.locator("#tw-edit").getAttribute("aria-busy"), "true", "the field says it's saving");
  assert.match(await focusIs(page), /^input\[id=tw-edit\]/);
  release();
  await settle(page, 400);
  assert.equal(await page.locator("#conv-title").innerText(), "Renamed once");
  assert.match(await focusIs(page), /^button\[data-tmenu/);
  assert.equal(page.W.patches.length, 1);
  await done(page);
});

t("CONV-1 S009: Escape puts the name back and focus on ⋯", async () => {
  const page = await app();
  await openThread(page, "t_login");
  await renameTo(page, "Cancelled name");
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.locator("#conv-title").innerText(), "Fix the login form");
  assert.match(await focusIs(page), /^button\[data-tmenu/);
  assert.equal(page.W.patches.length, 0);
  assert.equal(await page.evaluate(() => window.__t.S.view), "t:t_login", "Escape didn't also leave the thread");
  await done(page);
});

t("CONV-1 S009: an IME's composing Enter or Escape in the rename field neither saves nor cancels", async () => {
  const page = await app();
  await openThread(page, "t_login");
  await renameTo(page, "名前の候補");
  for (const init of [{ key: "Enter", isComposing: true }, { key: "Enter", keyCode: 229 }, { key: "Escape", isComposing: true }, { key: "Escape", keyCode: 229 }]) {
    await page.evaluate((init) => document.querySelector("#tw-edit").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })), init);
  }
  await settle(page);
  assert.equal(page.W.patches.length, 0, "nothing saved");
  assert.equal(await page.locator("#tw-edit").inputValue(), "名前の候補", "the field is still open, as typed");
  assert.match(await focusIs(page), /^input\[id=tw-edit\]/);
  await page.keyboard.press("Enter");
  await settle(page, 400);
  assert.equal(page.W.patches.length, 1);
  assert.equal(await page.locator("#conv-title").innerText(), "名前の候補");
  await done(page);
});

// ── CONV-4 · C042: the thread menu ──────────────────────────────────────────
t("CONV-4 C042: ↓ ↑ Home End walk the thread menu; Escape returns to ⋯; Tab closes it and moves on", async () => {
  const page = await app();
  await openThread(page, "t_login");
  await menuOpen(page);
  const items = await page.locator(".tw-menu [role=menuitem]").allInnerTexts();
  assert.ok(items.length >= 2, "at least Rename and the label");
  assert.match(await focusIs(page), /Rename/);
  await page.keyboard.press("ArrowDown");
  assert.match(await focusIs(page), new RegExp(items[1]));
  await page.keyboard.press("ArrowUp");
  assert.match(await focusIs(page), /Rename/);
  await page.keyboard.press("ArrowUp");
  assert.match(await focusIs(page), new RegExp(items[items.length - 1].replace(/[…]/g, ".")), "wraps to the last");
  await page.keyboard.press("Home");
  assert.match(await focusIs(page), /Rename/);
  await page.keyboard.press("End");
  assert.match(await focusIs(page), new RegExp(items[items.length - 1].replace(/[…]/g, ".")));
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.locator(".tw-menu").count(), 0, "closed");
  assert.match(await focusIs(page), /^button\[data-tmenu/);
  assert.equal(await page.evaluate(() => window.__t.S.view), "t:t_login");
  await menuOpen(page);
  await page.keyboard.press("Tab");
  await settle(page);
  assert.equal(await page.locator(".tw-menu").count(), 0, "Tab closes it");
  const f = await focusIs(page);
  assert.notEqual(f, "BODY");
  assert.doesNotMatch(f, /menuitem/);
  await done(page);
});

// ── CONV-4 · C045: the checklist ────────────────────────────────────────────
t("CONV-4 C045: Enter on the checklist opens it and keeps focus on the same toggle; again closes it", async () => {
  const page = await app();
  await openThread(page, "t_docs");
  const tog = page.locator("[data-ck]");
  await tog.focus();
  await page.evaluate(() => { window.__ck = document.querySelector("[data-ck]"); });
  await page.keyboard.press("Enter");
  await settle(page);
  assert.equal(await tog.getAttribute("aria-expanded"), "true");
  assert.match(await focusIs(page), /^button\[data-ck\]/);
  assert.equal(await page.evaluate(() => document.activeElement === window.__ck), true, "the same button, not a copy drawn over it");
  await page.keyboard.press("Space");
  await settle(page);
  assert.equal(await tog.getAttribute("aria-expanded"), "false");
  assert.match(await focusIs(page), /^button\[data-ck\]/);
  await done(page);
});

// ── CONV-3 · S020: the All filter ───────────────────────────────────────────
async function openAllSheet(page) {
  await page.evaluate(() => window.__t.go("p:demo"));
  await page.waitForSelector("[data-switch]");
  await page.locator("[data-switch]").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#all:not([hidden]) #all-q");
  await settle(page, 120);
}
t("CONV-3 S020: the All filter is one Tab stop; arrows choose the next usable filter and focus stays on it", async () => {
  const page = await app();
  await openAllSheet(page);
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("#all-f [role=radio]")].filter((b) => b.tabIndex >= 0 && !b.disabled).map((b) => b.dataset.af).join()), "all", "only the chosen filter is in the Tab order");
  await page.locator('[data-af="all"]').focus();
  await page.keyboard.press("ArrowRight");
  await settle(page);
  // Needs you and Working have nothing: skipped. Waiting (the idle "working" thread) is next.
  assert.match(await focusIs(page), /\[data-af=waiting\]/);
  assert.equal(await page.locator('[data-af="waiting"]').getAttribute("aria-checked"), "true");
  assert.deepEqual(await page.locator("#all-list .ar-t").allInnerTexts(), ["Write the docs"]);
  await page.evaluate(() => { window.__af = document.activeElement; });
  await page.keyboard.press("ArrowRight");
  await settle(page);
  assert.match(await focusIs(page), /\[data-af=done\]/);
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement === window.__af), true, "the same button, kept in place");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  assert.match(await focusIs(page), /\[data-af=stopped\]/, "wraps from All to the last usable");
  // Space on a filter reached by Tab order (Shift+Tab back in lands on the choice)
  await page.locator('[data-af="done"]').click();
  await settle(page);
  assert.match(await focusIs(page), /\[data-af=done\]/, "a click keeps focus on what was clicked");
  await page.locator("#all-q").focus();
  await page.keyboard.type("logo");
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), "all-q", "typing a search keeps the field");
  await done(page);
});

// ── CONV-5 · C041: Resolve in the thread's header ───────────────────────────
t("CONV-5 C041: two presses while Resolve is out send one request; focus stays on the button, now Reopen", async () => {
  let release;
  const page = await app({ patchGate: new Promise((ok) => (release = ok)) });
  await openThread(page, "t_login");
  const b = page.locator("[data-resolve]");
  await b.focus();
  await page.evaluate(() => { window.__rb = document.querySelector("[data-resolve]"); });
  await page.keyboard.press("Enter");
  await settle(page, 60);
  await page.keyboard.press("Enter");
  await b.click({ force: true }).catch(() => {});
  await settle(page, 200);
  assert.equal(page.W.patches.length, 1, "one request while it's out");
  assert.equal(await page.locator("[data-resolve]").getAttribute("aria-busy"), "true", "it says it's waiting");
  assert.match(await focusIs(page), /\[data-resolve=/);
  release();
  await settle(page, 400);
  assert.match(await page.locator("[data-resolve]").textContent(), /Reopen/);
  assert.equal(await page.locator("[data-resolve]").getAttribute("aria-busy"), null);
  assert.match(await focusIs(page), /\[data-resolve=/, "focus stays on the button through the outcome");
  assert.equal(await page.evaluate(() => document.activeElement === window.__rb), true, "the same button, updated in place");
  await done(page);
});

t("CONV-5 C041: a refused Resolve says so, the button is Resolve again with focus; Enter tries again", async () => {
  const page = await app({ patchFail: true });
  await openThread(page, "t_login");
  await page.locator("[data-resolve]").focus();
  await page.keyboard.press("Enter");
  await settle(page, 400);
  assert.match(await page.locator("[data-resolve]").textContent(), /Resolve/);
  assert.match(await focusIs(page), /\[data-resolve=/);
  assert.match(await page.locator("#herald").innerText(), /Couldn't resolve it/);
  // trying again from Resolve itself (the herald's Retry, and where its focus goes, are the main build's)
  page.W.patchFail = false;
  await page.keyboard.press("Enter");
  await settle(page, 400);
  assert.equal(page.W.patches.length, 2);
  assert.match(await page.locator("[data-resolve]").textContent(), /Reopen/);
  await done(page);
});

// ── CONV-6 · S040: Edit on a failed thread message ──────────────────────────
async function failSend(page, text) {
  page.W.postFail = true;
  await page.locator("#say").fill(text);
  await page.locator("#send").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-retry]");
  await settle(page);
}
t("CONV-4 C057: a failed Send from the button leaves focus in the composer, not on the page", async () => {
  const page = await app();
  await openThread(page, "t_login");
  await failSend(page, "Message kept on failure");
  assert.match(await focusIs(page), /^textarea\[id=say\]/);
  assert.ok(await page.locator("[data-retry]").isVisible(), "Retry is on the failed message");
  await done(page);
});
t("CONV-6 S040: Edit on a failed message keeps the newer draft and puts the failed words with it", async () => {
  const page = await app();
  await openThread(page, "t_login");
  await failSend(page, "Message kept on failure");
  await page.locator("#say").fill("NEW draft must survive");
  await page.locator("[data-edit]").focus();
  await page.keyboard.press("Enter");
  await settle(page);
  const v = await page.locator("#say").inputValue();
  assert.ok(v.includes("Message kept on failure") && v.includes("NEW draft must survive"), `both texts kept: ${JSON.stringify(v)}`);
  assert.match(await focusIs(page), /^textarea\[id=say\]/);
  assert.equal(await page.locator("[data-edit]").count(), 0, "the failed message left the thread");
  await done(page);
});
t("CONV-4 S039: Retry on a failed message is one request while it's out, and focus goes to the composer", async () => {
  let release;
  const page = await app();
  await openThread(page, "t_login");
  await failSend(page, "Retry me");
  page.W.postFail = false;
  page.W.postGate = new Promise((ok) => (release = ok));
  await page.locator("[data-retry]").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await settle(page, 150);
  assert.equal(page.W.posts.length, 2, "the failed send and one retry");
  assert.match(await focusIs(page), /^textarea\[id=say\]/);
  release();
  await settle(page, 300);
  assert.equal(page.W.posts.length, 2);
  await done(page);
});

// ── CONV-3 · S046: a new chat's permission mode ─────────────────────────────
t("CONV-3 S046: a new chat's modes are one Tab stop; arrows and Space choose, and focus stays on the choice", async () => {
  const page = await app({ runtimes: [RUNTIME] });
  await page.evaluate(() => window.__t.go("chats"));
  await page.waitForFunction(() => window.__t.S.view === "chats" && window.__t.world.state.runtimes.length);
  await settle(page);
  await page.locator("#target").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#cs-pop:not([hidden]) [data-csmode]");
  assert.equal(await page.evaluate(() => [...document.querySelectorAll("#cs-pop [role=radio]")].filter((b) => b.tabIndex >= 0).map((b) => b.dataset.csmode).join()), "auto", "only the chosen mode is in the Tab order");
  await page.locator('[data-csmode="auto"]').focus();
  await page.evaluate(() => { window.__ask = document.querySelector('[data-csmode="ask"]'); });
  await page.keyboard.press("ArrowDown");
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement === window.__ask), true, "focus on Ask, the same element");
  assert.equal(await page.locator('[data-csmode="ask"]').getAttribute("aria-checked"), "true");
  assert.equal(await page.locator('[data-csmode="auto"]').getAttribute("aria-checked"), "false");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await settle(page);
  assert.match(await focusIs(page), /\[data-csmode=plan\]/);
  assert.match(await page.locator("#target").innerText(), /Plan only/, "the composer's line says the mode");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await settle(page);
  assert.match(await focusIs(page), /\[data-csmode=accept_edits\]/);
  assert.equal(await page.locator('[data-csmode="accept_edits"]').getAttribute("aria-checked"), "true");
  await page.locator('[data-csmode="ask"]').click();
  await settle(page);
  assert.match(await focusIs(page), /\[data-csmode=ask\]/, "a click keeps focus on what was clicked");
  await page.locator("[data-cs-done]").click();
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement.id), "target", "Done returns to the line it opened from");
  await done(page);
});

// ── CONV-7 · S043 S048: a plain chat's Retry and the would-stop question ────
async function chatOpen(W) {
  const page = await app({ runtimes: [RUNTIME], sessions: [CHAT()], ...W });
  await page.evaluate(() => window.__t.go("c:cse_chat1"));
  await page.waitForFunction(() => window.__t.S.view === "c:cse_chat1");
  await settle(page, 300);
  return page;
}
t("CONV-7 S043: a chat's Retry is one request while it's out, and focus goes to the composer", async () => {
  const page = await chatOpen({ promptMode: "fail" });
  await page.locator("#say").fill("Chat message kept");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-chat-retry]");
  let release;
  page.W.promptMode = "ok"; page.W.promptGate = new Promise((ok) => (release = ok));
  await page.locator("[data-chat-retry]").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await settle(page, 150);
  assert.equal(page.W.prompts.length, 2, "the failed send and one retry");
  assert.equal(page.W.prompts[1].client_id, page.W.prompts[0].client_id, "the retry is the same request");
  assert.match(await focusIs(page), /^textarea\[id=say\]/);
  release();
  await settle(page, 300);
  assert.equal(page.W.prompts.length, 2);
  assert.equal(await page.locator("[data-chat-retry]").count(), 0);
  await done(page);
});
t("CONV-7 S048: answering the would-stop question sends once, as chosen, and focus goes to the composer", async () => {
  const page = await chatOpen({ promptMode: (b) => (b.delivery ? "ok" : "would_stop") });
  await page.locator("#say").fill("Stop them or add");
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-chc=add]");
  await page.locator("[data-chc=add]").focus();
  await page.keyboard.press("Enter");
  await settle(page, 300);
  assert.equal(page.W.prompts.length, 2);
  assert.equal(page.W.prompts[1].delivery, "add");
  assert.match(await focusIs(page), /^textarea\[id=say\]/);
  assert.equal(await page.locator("[data-chc]").count(), 0);
  await done(page);
});

// ── CONV-2 · S024: a swipe in All resolves a row ────────────────────────────
async function swipeRow(page, ts) {
  const b = await page.locator(`#all-list .ar[data-go="t:${ts}"]`).boundingBox();
  const y = b.y + b.height / 2, x0 = b.x + b.width - 24;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 10; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 - (b.width * 0.7 * i) / 10, y }] }); await page.waitForTimeout(16); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await settle(page, 350);
}
const rowOf = (page, ts) => page.evaluate((ts) => { const li = [...document.querySelectorAll("#all-list li")].find((l) => l.querySelector(`[data-go="t:${ts}"]`) || l.querySelector(".ar-undo")); return li ? { text: li.innerText.replace(/\s+/g, " ").trim(), busy: li.querySelector(".ar-undo")?.getAttribute("aria-busy") || null, err: !!li.querySelector(".ar-undo.is-err") } : null; }, ts);
t("CONV-2 S024: a swiped resolve says Resolving until Space answers, then Resolved with Undo", async () => {
  let release;
  const page = await app({ patchGate: new Promise((ok) => (release = ok)) }, { touch: true });
  await openAllSheet(page);
  await swipeRow(page, "t_docs");
  let row = await rowOf(page, "t_docs");
  assert.match(row.text, /Resolving Write the docs/);
  assert.doesNotMatch(row.text, /Resolved/);
  assert.equal(row.busy, "true");
  release();
  await settle(page, 300);
  row = await rowOf(page, "t_docs");
  assert.match(row.text, /Resolved Write the docs Undo/);
  assert.match(await page.locator("#live").textContent(), /Resolved Write the docs/);
  assert.equal(page.W.patches.length, 1);
  await done(page);
});
t("CONV-2 S024: a refused swipe-resolve says so in the row with Retry; Retry, Undo and its refusal keep focus on one button", async () => {
  const page = await app({ patchFail: true }, { touch: true });
  await openAllSheet(page);
  await swipeRow(page, "t_docs");
  let row = await rowOf(page, "t_docs");
  assert.match(row.text, /Couldn't resolve Write the docs Retry/);
  assert.equal(row.err, true);
  assert.doesNotMatch(row.text, /Resolved/);
  assert.match(await page.locator("#live").textContent(), /Couldn't resolve Write the docs/);
  assert.equal(await page.evaluate(() => window.__t.world.thread("t_docs").state), "working", "the thread is as it was");
  // Retry from the keyboard: the same button becomes Undo
  page.W.patchFail = false;
  await page.locator("[data-ar-undo]").focus();
  await page.evaluate(() => { window.__u = document.querySelector("[data-ar-undo]"); });
  await page.keyboard.press("Enter");
  await settle(page, 350);
  assert.match((await rowOf(page, "t_docs")).text, /Resolved Write the docs Undo/);
  assert.equal(await page.evaluate(() => document.activeElement === window.__u), true, "focus stays on the row's button");
  // Undo refused: the same button offers Retry
  page.W.patchFail = true;
  await page.keyboard.press("Enter");
  await settle(page, 350);
  assert.match((await rowOf(page, "t_docs")).text, /Couldn't reopen Write the docs Retry/);
  assert.equal(await page.evaluate(() => document.activeElement === window.__u), true);
  // Undo works: the thread's row is back, with focus on it
  page.W.patchFail = false;
  await page.keyboard.press("Enter");
  await settle(page, 350);
  assert.match(await focusIs(page), /\[data-go=t:t_docs\]/);
  assert.equal(await page.evaluate(() => window.__t.world.thread("t_docs").state !== "resolved"), true);
  assert.equal(page.W.patches.length, 4);
  await done(page);
});

// ── CONV-8 · S170 S171: a phone's long-press menu on a message ──────────────
async function longPress(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const p = { x: b.x + Math.min(24, b.width / 3), y: b.y + Math.min(14, b.height / 2) };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [p] });
  await page.waitForTimeout(650);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.waitForSelector(".lp-menu");
}
const BUBBLE = "#msgs .m-you .bubble";
async function lpPage(clip) {
  const page = await app({ threadMsgs: { t_login: MSGS("t_login", 6) } });
  await page.evaluate((clip) => {
    window.__copied = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { if (clip === "refuse") throw new DOMException("No", "NotAllowedError"); window.__copied.push(t); } } });
    if (clip === "refuse") document.execCommand = () => false;
  }, clip);
  await openThread(page, "t_login");
  await page.waitForSelector(BUBBLE);
  await page.locator(BUBBLE).last().scrollIntoViewIfNeeded();
  await settle(page, 600); // the view done moving: a scroll closes the menu, by design
  return page;
}
const onBubble = (page) => page.evaluate((sel) => { const a = document.activeElement; return !!a && a.matches(sel) && a.isConnected; }, BUBBLE);
for (const clip of ["allow", "refuse"]) {
  t(`CONV-8 S170: long-press Copy (${clip === "allow" ? "allowed" : "refused"}) says what happened and returns focus to the message`, async () => {
    const page = await lpPage(clip);
    await longPress(page, `${BUBBLE} >> nth=-1`);
    assert.match(await focusIs(page), /\[data-lp=copy\]/);
    await page.locator("[data-lp=copy]").tap();
    await settle(page, 300);
    assert.equal(await page.locator(".lp-menu").count(), 0);
    assert.equal(await onBubble(page), true, `focus on the message, not ${await focusIs(page)}`);
    const said = (await page.locator("#live").textContent()) + (await page.locator("#herald").innerText());
    if (clip === "allow") { assert.match(said, /Copied/); assert.equal((await page.evaluate(() => window.__copied)).length, 1); }
    else { assert.match(said, /Couldn't copy/); assert.doesNotMatch(said, /Copied/); }
    await done(page);
  }, { only: (c) => c.width < 760 });
}
t("CONV-8 S171: long-press Select text selects the message and returns focus to it, the selection kept", async () => {
  const page = await lpPage("allow");
  await longPress(page, `${BUBBLE} >> nth=-1`);
  await page.locator("[data-lp=select]").tap();
  await settle(page, 300);
  assert.equal(await onBubble(page), true, `focus on the message, not ${await focusIs(page)}`);
  const sel = await page.evaluate(() => getSelection().toString().trim());
  assert.match(sel, /My note number/);
  await done(page);
}, { only: (c) => c.width < 760 });
t("CONV-8: Escape closes the long-press menu and returns focus to the message; ↓ moves in it", async () => {
  const page = await lpPage("allow");
  await longPress(page, `${BUBBLE} >> nth=-1`);
  await page.keyboard.press("ArrowDown");
  assert.match(await focusIs(page), /\[data-lp=select\]/);
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.locator(".lp-menu").count(), 0);
  assert.equal(await onBubble(page), true, `focus on the message, not ${await focusIs(page)}`);
  assert.equal(await page.evaluate(() => window.__t.S.view), "t:t_login", "Escape closed the menu only");
  await done(page);
}, { only: (c) => c.width < 760 });

// ── CONV-9 · C027: Back to the latest and a notice above the composer ───────
t("CONV-9 C027: a notice above the composer never covers Back to the latest; pressing it goes to the latest", async () => {
  const page = await app({ threadMsgs: { t_login: MSGS("t_login", 40) }, patchFail: true });
  await openThread(page, "t_login");
  await page.waitForFunction(() => document.querySelectorAll("#msgs .m").length > 30);
  await page.locator("[data-resolve]").click(); // refused: a failure notice with Retry, above the composer
  await page.waitForSelector("#herald .hr");
  await page.evaluate(() => { const s = document.querySelector("#scroller"); s.scrollTop = 0; s.dispatchEvent(new Event("scroll")); });
  await page.waitForSelector(".mx-down.is-on");
  await settle(page, 450);
  const hit = await page.evaluate(() => {
    const d = document.querySelector(".mx-down"), r = d.getBoundingClientRect(), h = document.querySelector("#herald .hr").getBoundingClientRect();
    const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const overlap = !(r.right <= h.left || r.left >= h.right || r.bottom <= h.top || r.top >= h.bottom);
    return { on: !!at && d.contains(at), overlap };
  });
  assert.equal(hit.overlap, false, "the button and the notice don't overlap");
  assert.equal(hit.on, true, "the button is what a press there reaches");
  await page.locator(".mx-down").click();
  await page.waitForFunction(() => { const s = document.querySelector("#scroller"); return s.scrollHeight - s.clientHeight - s.scrollTop < 4; }, null, { timeout: 4000 });
  assert.ok(await page.locator("[data-herald-undo]").isVisible(), "the notice's Retry is still there");
  await done(page);
});

// ── the thread switcher (Astra H30–H32: C025, S145) ─────────────────────────
t("H30 C025: Escape and Close return focus to the very button that opened the switcher", async () => {
  const page = await app();
  await page.evaluate(() => window.__t.go("p:demo"));
  await page.waitForSelector("[data-switch].all-btn");
  for (const how of ["Escape", "close"]) {
    await page.locator("[data-switch].all-btn").focus();
    await page.evaluate(() => { window.__op = document.activeElement; });
    await page.keyboard.press("Enter");
    await page.waitForSelector("#all:not([hidden])");
    await settle(page, 200);
    assert.equal(await page.evaluate(() => window.__op.isConnected), true, "the opener stays (it's updated, not replaced)");
    if (how === "Escape") await page.keyboard.press("Escape"); else await page.locator("#all [data-close]").click();
    await settle(page);
    assert.equal(await page.evaluate(() => document.activeElement === window.__op), true, `${how}: back on the opener, not ${await focusIs(page)}`);
  }
  await done(page);
});
t("H30 C025: the Now strip's +N opens the switcher and Escape comes back to the same +N", async () => {
  const many = Array.from({ length: 14 }, (_, i) => TH(`t_w${i}`, `A fairly long working thread title number ${i}`, "failed"));
  const page = await app({ threads: [...THREADS(), ...many] });
  await page.evaluate(() => window.__t.go("p:demo"));
  await settle(page, 300);
  const more = page.locator("#now-wrap .nw-more");
  await more.waitFor({ state: "visible" });
  await more.focus();
  await page.evaluate(() => { window.__op = document.activeElement; });
  await page.keyboard.press("Enter");
  await page.waitForSelector("#all:not([hidden])");
  await settle(page, 200);
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement === window.__op), true, `back on +N, not ${await focusIs(page)}`);
  await done(page);
}, { only: (c) => c.width >= 760 });
t("H31/H32 S145: ↓ from the search reaches the first thread, ↑ returns to the search; a composing Enter opens nothing", async () => {
  const page = await app();
  await openAllSheet(page);
  await page.keyboard.press("ArrowDown");
  const first = await page.evaluate(() => [...document.querySelectorAll("#all-list [data-go]")].filter((b) => b.offsetParent)[0].dataset.go);
  assert.match(await focusIs(page), new RegExp(`data-go=${first}`), "one step: the first thread");
  await page.keyboard.press("ArrowUp");
  assert.equal(await page.evaluate(() => document.activeElement.id), "all-q");
  await page.keyboard.type("docs");
  for (const init of [{ key: "Enter", isComposing: true }, { key: "Enter", keyCode: 229 }, { key: "Escape", isComposing: true }]) await page.evaluate((init) => document.querySelector("#all-q").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })), init);
  await settle(page);
  assert.equal(await page.locator("#all").isHidden(), false, "still in the switcher");
  assert.equal(await page.evaluate(() => window.__t.S.view), "p:demo");
  await page.keyboard.press("Enter");
  await settle(page);
  assert.equal(await page.evaluate(() => window.__t.S.view), "t:t_docs", "a plain Enter opens the match");
  await done(page);
});

// ── the composer's @ chooser (Astra H24–H27) ────────────────────────────────
const sayState = (page) => page.evaluate(() => { const s = document.querySelector("#say"), l = document.querySelector("#at-list"); return { value: s.value, expanded: s.getAttribute("aria-expanded"), active: s.getAttribute("aria-activedescendant"), open: !l.hidden, options: [...l.querySelectorAll("[role=option]")].map((o) => o.dataset.pid), selected: l.querySelector('[aria-selected="true"]')?.dataset.pid || null }; });
t("H24 C053/C058: Escape, or nothing matching, closes the @ list and says so: not expanded, no active option", async () => {
  const page = await app();
  await page.locator("#say").focus();
  await page.keyboard.type("@");
  let st = await sayState(page);
  assert.equal(st.open, true); assert.equal(st.expanded, "true"); assert.equal(st.active, "at-0");
  await page.keyboard.press("Escape");
  st = await sayState(page);
  assert.equal(st.open, false); assert.equal(st.expanded, "false"); assert.equal(st.active, null);
  assert.match(await focusIs(page), /^textarea\[id=say\]/, "Escape closed the list, not the composer");
  await page.keyboard.type("zzz");
  st = await sayState(page);
  assert.equal(st.open, false); assert.equal(st.expanded, "false"); assert.equal(st.active, null);
  await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace"); await page.keyboard.press("Backspace");
  st = await sayState(page);
  assert.equal(st.open, true, "typing again after the @ opens it again"); assert.equal(st.expanded, "true");
  await done(page);
});
t("H25: an IME's composing Enter, arrow or Escape never chooses a recipient, sends, or leaves the thread", async () => {
  const page = await app();
  await openThread(page, "t_login");
  await page.locator("#say").focus();
  await page.keyboard.type("@");
  for (const init of [{ key: "Enter", isComposing: true }, { key: "Enter", keyCode: 229 }, { key: "ArrowDown", isComposing: true }, { key: "Escape", isComposing: true }, { key: "Escape", keyCode: 229 }]) {
    await page.evaluate((init) => document.querySelector("#say").dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })), init);
  }
  const st = await sayState(page);
  assert.equal(st.value, "@", "nothing chosen");
  assert.equal(st.selected, "demo", "the active option didn't move");
  assert.equal(page.W.posts.length, 0);
  assert.equal(await page.evaluate(() => window.__t.S.view), "t:t_login", "still in the thread");
  assert.equal(st.open, true, "the list still open: the IME's Escape wasn't the list's");
  await done(page);
});
t("H26 C055: Aim at a project opens the chooser on the @recipient already in the draft, the rest kept", async () => {
  const page = await app();
  await page.evaluate(() => window.__t.go("ws"));
  await page.locator("#say").fill("Please ask @demo about this");
  await page.locator("#target").click();
  const st = await sayState(page);
  assert.equal(st.open, true, "the chooser opens"); assert.equal(st.selected, "demo", "on the recipient named");
  await page.keyboard.press("Enter");
  assert.equal((await sayState(page)).value, "Please ask @demo about this", "choosing it again keeps every other word");
  assert.equal((await sayState(page)).open, false);
  await done(page);
});
t("H27 C055/C058: a recipient chosen with the chooser is saved with the draft: a reload keeps who it goes to", async () => {
  const page = await app();
  await page.evaluate(() => window.__t.go("ws"));
  await page.locator("#say").fill("Keep this work");
  await page.locator("#target").click();
  await page.keyboard.press("Enter");
  assert.equal((await sayState(page)).value, "@demo Keep this work");
  await page.reload();
  await page.waitForFunction(() => window.__t && window.__t.world.state.threads.length > 0);
  await page.evaluate(() => window.__t.go("ws"));
  await settle(page);
  assert.equal((await sayState(page)).value, "@demo Keep this work");
  assert.match(await page.locator("#target").textContent(), /New work for\s*demo/i);
  await done(page);
});

// ── files on the message: focus through an upload's changes (H28); a drop behind Settings (H29) ──
async function attach(page, name = "audit.txt") {
  await page.locator("#att-input").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from("audit only") });
  await page.waitForSelector(`#att-tray [data-lid]`);
  await settle(page, 120);
}
t("H28 S016: a focused Remove keeps focus when its upload finishes; Retry hands focus to the same chip's Remove", async () => {
  let release;
  const page = await app({ uploadGate: new Promise((ok) => (release = ok)) });
  await page.evaluate(() => window.__t.go("p:demo"));
  await settle(page);
  await attach(page);
  await page.locator("#att-tray [data-a=x]").focus();
  await page.evaluate(() => { window.__x = document.querySelector("#att-tray [data-a=x]"); });
  release();
  await page.waitForSelector("#att-tray .att.st-done");
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement === window.__x), true, "the same Remove, still focused");
  // a failed upload's Retry
  await page.locator("#att-tray [data-a=x]").press("Enter");
  page.W.uploadGate = null; page.W.uploadFail = true;
  await attach(page, "second.txt");
  await page.waitForSelector("#att-tray [data-a=retry]");
  page.W.uploadFail = false;
  let again; page.W.uploadGate = new Promise((ok) => (again = ok));
  await page.locator("#att-tray [data-a=retry]").focus();
  await page.keyboard.press("Enter");
  await settle(page);
  assert.match(await focusIs(page), /\[data-a=x\]/, "Retry gone: focus on the chip's Remove");
  again();
  await page.waitForSelector("#att-tray .att.st-done");
  assert.match(await focusIs(page), /\[data-a=x\]/);
  await done(page);
});
// ── a new chat's model: focus through a catalog arriving (S152), one truth for a model that's gone (S153) ──
const RT2 = (name) => ({ ...RUNTIME, name, default: name === "claude_code" });
const MODEL = (id, name) => ({ id, name, efforts: [], is_default: false, takes_effort: false, family: id, family_default: true, description: "" });
t("S152: a catalog arriving while Model has focus keeps focus on Model, with the new choices", async () => {
  let release;
  const page = await app({ runtimes: [RT2("claude_code"), RT2("codex")], catalogs: { claude_code: [MODEL("opus", "Opus")], codex: [MODEL("gpt", "GPT")] }, storage: { "cv-chat-prefs": JSON.stringify({ agent: "codex" }) } });
  page.W.modelsGate = new Promise((ok) => (release = ok));
  await page.evaluate(() => window.__t.go("chats"));
  await page.waitForFunction(() => window.__t.world.state.runtimes.length === 2);
  await page.locator("#target").click();
  await page.waitForSelector('#cs-pop xo-select[data-cs="model"]');
  await page.locator('#cs-pop xo-select[data-cs="model"] .dd-btn').focus();
  await page.evaluate(() => { window.__mb = document.activeElement; });
  release();
  await page.waitForFunction(() => [...document.querySelectorAll('#cs-pop xo-select[data-cs="model"] option')].some((o) => o.value === "gpt"));
  await settle(page);
  assert.equal(await page.evaluate(() => document.activeElement === window.__mb), true, "the same Model button keeps focus");
  await done(page);
});
t("S153: a saved model the agent no longer offers is said to be gone, shown as the default, and never sent", async () => {
  const page = await app({ runtimes: [RT2("claude_code")], catalogs: { claude_code: [MODEL("opus", "Opus")] }, storage: { "cv-chat-prefs": JSON.stringify({ agent: "claude_code", model: "retired-model" }) } });
  await page.evaluate(() => window.__t.go("chats"));
  await page.waitForFunction(() => window.__t.world.state.runtimes.length === 1);
  await page.locator("#target").click();
  await page.waitForFunction(() => [...document.querySelectorAll('#cs-pop xo-select[data-cs="model"] option')].some((o) => o.value === "opus"));
  await settle(page);
  assert.equal(await page.evaluate(() => document.querySelector('#cs-pop xo-select[data-cs="model"]').value), "", "the picker shows the default");
  assert.match(await page.locator("#cs-pop").innerText(), /retired-model.{0,4} isn't offered by Claude any more/);
  assert.match(await page.locator("#target").innerText(), /its default model \(retired-model is gone\)/);
  await page.locator("[data-cs-done]").click();
  await page.locator("#say").fill("Start a chat");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => true);
  await settle(page, 300);
  assert.equal(page.W.prompts.length, 1);
  assert.equal("model" in page.W.prompts[0], false, "no model sent: the agent's default");
  await done(page);
});

t("S153: a catalog that fails to load leaves the saved model unconfirmed (never sent); opening setup again reads it again", async () => {
  const page = await app({ runtimes: [RT2("claude_code")], catalogs: { claude_code: [MODEL("opus", "Opus")] }, catalogFail: true, storage: { "cv-chat-prefs": JSON.stringify({ agent: "claude_code", model: "opus" }) } });
  await page.evaluate(() => window.__t.go("chats"));
  await page.waitForFunction(() => window.__t.world.state.runtimes.length === 1);
  await page.locator("#target").click();
  await page.waitForFunction(() => /Couldn't read Claude's models/.test(document.querySelector("#cs-pop").innerText));
  assert.match(await page.locator("#target").innerText(), /its default model \(opus unconfirmed\)/);
  await page.locator("[data-cs-done]").click();
  await page.locator("#say").fill("Unconfirmed: the default");
  await page.keyboard.press("Enter");
  await settle(page, 300);
  assert.equal("model" in page.W.prompts[0], false, "the unchecked model isn't sent");
  // setup again: the catalog is read again, confirms opus, and from then on it's what the line names and Send sends
  page.W.catalogFail = false;
  const reads = page.W.modelReads;
  await page.evaluate(() => window.__t.go("chats"));
  await settle(page);
  await page.locator("#target").click();
  await page.waitForFunction(() => /Opus/.test(document.querySelector("#target").innerText));
  assert.ok(page.W.modelReads > reads, "read again");
  await page.locator("[data-cs-done]").click();
  await page.locator("#say").fill("Confirmed: opus");
  await page.keyboard.press("Enter");
  await settle(page, 300);
  assert.equal(page.W.prompts[1].model, "opus");
  await done(page);
});

t("S153: a catalog that can't be read says so, with why, even with no saved model", async () => {
  const page = await app({ runtimes: [RT2("claude_code")], catalogs: { claude_code: [MODEL("opus", "Opus")] }, catalogFail: true, storage: { "cv-chat-prefs": JSON.stringify({ agent: "claude_code" }) } });
  await page.evaluate(() => window.__t.go("chats"));
  await page.waitForFunction(() => window.__t.world.state.runtimes.length === 1);
  await page.locator("#target").click();
  await page.waitForFunction(() => /Couldn't read Claude's models/.test(document.querySelector("#cs-pop").innerText));
  assert.match(await page.locator("#cs-pop").innerText(), /Couldn't read Claude's models: Fixture: the catalog didn't come\. A new chat uses its default model\. Open this again to try again\./);
  assert.match(await page.locator("#target").innerText(), /its default model/);
  await done(page);
});

// ── replies (Astra RPL-1, -2, -3, -5) ───────────────────────────────────────
const AGENT_MD = (ts, text) => ({ id: `${ts}-md`, seq: 50, chat_id: "chat_demo", thread_ts: ts, author_kind: "agent", author_id: "agent", author_session_id: null, text, reply_to: null, extra: {}, created_at: NOW });
async function replyPage(text) {
  const page = await app({ threadMsgs: { t_login: [AGENT_MD("t_login", text)] } });
  await openThread(page, "t_login");
  await page.waitForSelector('#msgs [data-k="t_login-md"]');
  return page;
}
t("RPL-1 C051: Reply to a message of paragraphs and a list keeps its words apart; the quote sent keeps its lines", async () => {
  const page = await replyPage("First paragraph.\n\nSecond **bold** paragraph.\n\n- Red item\n- Blue item");
  const m = page.locator('#msgs [data-k="t_login-md"]');
  if (phone()) { await page.evaluate(() => { const el = document.querySelector('#msgs [data-k="t_login-md"] [data-mx-reply]'); el.click(); }); }
  else { await m.hover(); await m.locator("[data-mx-reply]").first().click(); }
  const chip = await page.locator(".mx-reply .mx-r-t > span").textContent();
  assert.equal(chip, "First paragraph. Second bold paragraph. Red item Blue item");
  await page.locator("#say").fill("My answer");
  await page.keyboard.press("Enter");
  await settle(page, 300);
  assert.equal(page.W.posts.length, 1);
  assert.match(page.W.posts[0].text, /^> \*\*.+\*\*\n> First paragraph\. Second bold paragraph\. Red item Blue item\n\nMy answer$/);
  await done(page);
});
t("C052: desktop Copy keeps a message's paragraphs and list items apart, as they read", async () => {
  const page = await replyPage("First paragraph.\n\nSecond **bold** paragraph.\n\n- Red item\n- Blue item");
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied.push(t); } } }); });
  const m = page.locator('#msgs [data-k="t_login-md"]');
  await m.hover();
  await m.locator("[data-mx-copy]").first().focus();
  await page.keyboard.press("Enter");
  await settle(page, 200);
  assert.deepEqual(await page.evaluate(() => window.__copied), ["First paragraph.\n\nSecond bold paragraph.\n\nRed item\nBlue item"]);
  assert.match(await focusIs(page), /\[data-mx-copy\]/, "focus stays on Copy");
  await done(page);
}, { only: (c) => c.width >= 760 });
t("C052/RPL-1: Copy keeps your own message's lines and indents, and a code block exactly as written", async () => {
  const mine = { id: "t_login-mine", seq: 60, chat_id: "chat_demo", thread_ts: "t_login", author_kind: "owner", author_id: "owner", author_session_id: null, text: "Line one\n  indented line\n\nLine three", reply_to: null, extra: {}, created_at: NOW };
  const code = AGENT_MD("t_login", "Intro.\n\n```\nfn  x\n\n\n  y  \n```\n\nOutro.");
  const page = await app({ threadMsgs: { t_login: [code, mine] } });
  await openThread(page, "t_login");
  await page.waitForSelector('#msgs [data-k="t_login-mine"] .bubble');
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied.push(t); } } }); });
  for (const k of ["t_login-mine", "t_login-md"]) { const m = page.locator(`#msgs [data-k="${k}"]`); await m.hover(); await m.locator("[data-mx-copy]").first().focus(); await page.keyboard.press("Enter"); await settle(page, 150); }
  const [a, b] = await page.evaluate(() => window.__copied);
  assert.equal(a, "Line one\n  indented line\n\nLine three", "your message as you wrote it");
  const raw = await page.evaluate(() => document.querySelector('#msgs [data-k="t_login-md"] pre code').textContent);
  assert.equal(b, `Intro.\n\n${raw.replace(/\n$/, "")}\n\nOutro.`, "the code block verbatim, no label, no Copy");
  assert.ok(b.includes("fn  x\n\n\n  y  "), "spaces and blank lines in the code kept");
  await done(page);
}, { only: (c) => c.width >= 760 });
t("C052: each Copy owns its acknowledgement: an earlier Copy's timer or late answer never undoes a newer one's check", async () => {
  const page = await replyPage("Copy me twice.");
  // the clipboard answers the first Copy late (after the second), the second at once
  await page.evaluate(() => {
    let n = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: (t) => { const i = ++n; return new Promise((ok) => setTimeout(ok, i === 1 ? 900 : 0)); } } });
  });
  const m = page.locator('#msgs [data-k="t_login-md"]');
  await m.hover();
  const b = m.locator("[data-mx-copy]").first();
  const checked = () => b.evaluate((el) => !!el.querySelector('path[d^="m5 12.5"]'));
  await b.focus();
  await page.keyboard.press("Enter");          // the first: answered at ~900 ms
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");          // the second: answered at once, its check holds 1200 ms
  await page.waitForTimeout(100);
  assert.equal(await checked(), true, "the second Copy's check");
  await page.waitForTimeout(700);              // the first answers meanwhile (~900 ms): it must not take over
  assert.equal(await checked(), true, "still the second's check after the first answered");
  await page.waitForTimeout(500);              // ~1300 ms after the second: its own timer has put Copy back
  assert.equal(await checked(), false, "back to Copy on the second's own timer");
  // the plain repeat Astra probed: Copy at 0 and 1000 ms, inspected at 1201 ms
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => {} } }));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1000);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(201);
  assert.equal(await checked(), true, "the second Copy's check isn't wiped by the first's timer");
  assert.match(await focusIs(page), /\[data-mx-copy\]/);
  // SRC-CONV-6: a success, then 20 ms later a refusal: only the refusal is announced (the success's "Copied" was
  // still due at 40 ms)
  const said = await page.evaluate(async () => {
    let n = 0;
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { if (++n === 2) throw new DOMException("No", "NotAllowedError"); } } });
    document.execCommand = () => false;
    const live = document.getElementById("live"), seen = [];
    new MutationObserver(() => { if (live.textContent) seen.push(live.textContent); }).observe(live, { childList: true, characterData: true, subtree: true });
    const b = document.querySelector('#msgs [data-k="t_login-md"] [data-mx-copy]');
    b.click(); await new Promise((ok) => setTimeout(ok, 20)); b.click();
    await new Promise((ok) => setTimeout(ok, 300));
    return seen;
  });
  assert.equal(said.length, 1, `one announcement: ${JSON.stringify(said)}`);
  assert.match(said[0], /Couldn't copy/);
  await done(page);
}, { only: (c) => c.width >= 760 });
t("C052: a code block or your own text at a message's very start or end is copied literally, blank lines and spaces too", async () => {
  const mine = { id: "t_login-edge", seq: 61, chat_id: "chat_demo", thread_ts: "t_login", author_kind: "owner", author_id: "owner", author_session_id: null, text: "\n  starts with a blank line, ends with spaces  ", reply_to: null, extra: {}, created_at: NOW };
  const code = AGENT_MD("t_login", "```\n\n\n  first  \nlast   \n```");
  const page = await app({ threadMsgs: { t_login: [code, mine] } });
  await openThread(page, "t_login");
  await page.waitForSelector('#msgs [data-k="t_login-edge"] .bubble');
  await page.evaluate(() => { window.__copied = []; Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { window.__copied.push(t); } } }); });
  for (const k of ["t_login-md", "t_login-edge"]) { const m = page.locator(`#msgs [data-k="${k}"]`); await m.hover(); await m.locator("[data-mx-copy]").first().focus(); await page.keyboard.press("Enter"); await settle(page, 150); }
  const [a, b] = await page.evaluate(() => window.__copied);
  const raw = await page.evaluate(() => document.querySelector('#msgs [data-k="t_login-md"] pre code').textContent);
  assert.ok(/^\n/.test(raw) && /last {3}/.test(raw), `fixture: the code block starts blank and ends with spaces (${JSON.stringify(raw)})`);
  assert.equal(a, raw, "the code block, exactly");
  assert.equal(b, "\n  starts with a blank line, ends with spaces  ", "your message, exactly");
  await done(page);
}, { only: (c) => c.width >= 760 });
t("RPL-3 S228: a long selection is quoted whole in what's sent; the chip only previews it", async () => {
  const words = Array.from({ length: 70 }, (_, i) => `word${i}`).join(" ");
  const page = await replyPage(`Intro line.\n\n${words}\n\nOutro.`);
  if (phone()) {
    // a phone selects a message's words its own way: long-press, Select text (the bubble's text isn't selectable otherwise)
    await settle(page, 600);
    await longPress(page, '#msgs [data-k="t_login-md"] .prose');
    await page.locator("[data-lp=select]").tap();
    await page.waitForSelector(".mx-qpop:not([hidden])");
    await page.locator(".mx-qpop").tap();
  } else {
    await page.evaluate(() => {
      const p = [...document.querySelectorAll('#msgs [data-k="t_login-md"] p')].find((x) => x.textContent.startsWith("word0"));
      const r = document.createRange(); r.selectNodeContents(p);
      getSelection().removeAllRanges(); getSelection().addRange(r);
      document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    });
    await page.waitForSelector(".mx-qpop:not([hidden])");
    await page.locator(".mx-qpop").click();
  }
  assert.match(await page.locator(".mx-reply .mx-r-t > span").textContent(), /…$/, "the chip previews");
  await page.locator("#say").fill("About these");
  await page.keyboard.press("Enter");
  await settle(page, 300);
  assert.ok(page.W.posts[0].text.includes(words), "every selected word is in the message sent");
  await done(page);
});
t("RPL-2 S227: Escape on the quote's × removes it, keeps the draft and returns to the composer", async () => {
  const page = await replyPage("Short line to answer.");
  await page.evaluate(() => document.querySelector('#msgs [data-k="t_login-md"] [data-mx-reply]').click());
  await page.locator("#say").fill("Draft stays");
  await page.locator(".mx-r-x").focus();
  await page.keyboard.press("Escape");
  await settle(page);
  assert.equal(await page.locator(".mx-reply").isHidden(), true);
  assert.equal(await page.locator("#say").inputValue(), "Draft stays");
  assert.match(await focusIs(page), /^textarea\[id=say\]/);
  assert.equal(await page.evaluate(() => window.__t.S.view), "t:t_login");
  await done(page);
});
t("RPL-5: a swipe-to-reply the system cancels never replies; released armed, it does", async () => {
  const page = await replyPage("Swipe me to answer.");
  const box = await page.locator('#msgs [data-k="t_login-md"] .prose').first().boundingBox();
  const y = box.y + box.height / 2, x = box.x + 20;
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (end) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let i = 1; i <= 9; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + i * 10, y }] }); await page.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: end, touchPoints: [] });
    await settle(page, 200);
  };
  await swipe("touchCancel");
  assert.equal(await page.locator(".mx-reply").isHidden(), true, "cancelled: no reply");
  await swipe("touchEnd");
  assert.equal(await page.locator(".mx-reply").isHidden(), false, "released armed: a reply");
  await cdp.detach();
  await done(page);
}, { only: (c) => c.width < 760 });

// ── S150: a thread's own decision notice opens its folded dock ───────────────
t("S150: the notice for this thread's own decision unfolds its folded card and focuses it", async () => {
  const threads = [...THREADS(), TH("t_ask", "Pick a database", "needs_reply", { card: { needs_you: "Which database should it use?" } })];
  const page = await app({ threads });
  await openThread(page, "t_ask");
  await page.waitForSelector("#tdock .card [data-fold]");
  await page.locator("#tdock [data-fold]").click();
  await page.waitForSelector("#tdock [data-unfold]");
  assert.equal(await page.locator("#tdock .card").count(), 0, "folded");
  const k = await page.evaluate(() => document.querySelector("#tdock [data-unfold]").dataset.unfold);
  // its notice (the line above the composer), as a new ask raises it
  await page.evaluate((k) => { window.__t.S.herald = { kind: "ping", text: "Needs you", sub: "Pick a database", decide: k, until: Date.now() + 9000, n: 99 }; window.__t.render(); }, k);
  await page.locator("#herald [data-decide]").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector("#tdock .card", { timeout: 3000 });
  await settle(page, 200);
  assert.equal(await page.locator("#tdock [data-unfold]").count(), 0, "unfolded");
  assert.equal(await page.evaluate(() => !!document.activeElement.closest("#tdock .card")), true, `focus on the card, not ${await focusIs(page)}`);
  await done(page);
});

// ── DET-3 · S003: Try again on a failed history read ────────────────────────
for (const where of ["project", "thread"]) {
  t(`DET-3 S003: Try again on earlier messages (${where}) keeps focus on the conversation while it reads, then on Try again`, async () => {
    const W = { olderFail: true };
    if (where === "project") { W.projMsgs = MSGS(null, 4).map((x, i) => ({ ...x, id: `p-${i}`, seq: 200 + i, thread_ts: null })); W.projOlder = { before: 100 }; }
    else { W.threadMsgs = { t_login: MSGS("t_login", 4).map((x, i) => ({ ...x, seq: 200 + i })) }; W.threadOlder = { ts: "t_login", before: 100 }; }
    const page = await app(W);
    if (where === "project") await page.evaluate(() => window.__t.go("p:demo")); else await openThread(page, "t_login");
    await page.waitForSelector("#msgs [data-older]", { timeout: 8000 }); // the first automatic read failed: Try again
    let release;
    page.W.olderGate = new Promise((ok) => (release = ok));
    await page.locator("#msgs [data-older]").focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector("#msgs .hist-skel");
    assert.equal(await page.evaluate(() => document.activeElement.id), "scroller", "while it reads: the conversation");
    release();
    await page.waitForSelector("#msgs [data-older]");
    await settle(page, 150);
    assert.match(await focusIs(page), /\[data-older\]/, "failed again: on Try again");
    await done(page);
  });
}

// ── DET-1 · S002 and DET-2 · C121/C050: a live turn's output and its working line ──
const SID = "cse_th1", TURN = "turn_det1";
const env = (type, data, x = {}) => ({ type, envelope: { type, id: null, seq: null, ts: new Date().toISOString(), chat_id: "chat_demo", session_id: SID, thread_ts: "t_live", turn_id: TURN, run_id: null, data, ...x } });
const ROW = (x) => ({ call_id: "call-det", kind: "command", tool: "Bash", line: "Run the tests", status: "running", target: "npm test", summary: null, ...x });
async function liveTurn() {
  const threads = [...THREADS(), TH("t_live", "A thread at work", "working", { session_id: SID })];
  const page = await app({ threads, threadMsgs: { t_live: MSGS("t_live", 2) } });
  await openThread(page, "t_live");
  await page.evaluate(([a, b, c]) => { for (const f of [a, b, c]) window.__storm.apply(f); }, [
    env("session", { status: "running", role: "thread", agent: "claude_code" }, { turn_id: null }),
    env("turn.started", { origin: "person", wakes: [] }),
    env("block.started", { block: { id: `${TURN}:g0`, type: "activity", index: 0, header: "Running the tests", rows: [ROW()] } }),
  ]);
  await page.waitForSelector(`#msgs .m-turn`);
  await settle(page, 300);
  return page;
}
t("DET-1 S002: a running step's output arriving keeps focus on its open disclosure", async () => {
  const page = await liveTurn();
  // open the turn's work, its block of steps, then the step (its command shows; its output is still to come)
  await page.evaluate(() => { const w = document.querySelector("#msgs .mx-work"); if (w && w.getClientRects().length) w.click(); });
  await settle(page, 300);
  await page.locator(`#msgs [data-tb="${TURN}:g0"]`).click();
  await settle(page, 300);
  const row = page.locator('#msgs [data-tb="row:call-det"]');
  await row.focus();
  await page.keyboard.press("Enter");
  await settle(page, 300);
  assert.equal(await row.getAttribute("aria-expanded"), "true");
  await page.evaluate(() => { window.__row = document.querySelector('#msgs [data-tb="row:call-det"]'); window.__row.focus(); });
  await page.evaluate((f) => window.__storm.apply(f), env("block.updated", { block_id: `${TURN}:g0`, type: "activity", rows: [ROW({ status: "ok", line: "Run the tests · done", output: "12 passed" })], header: "Ran the tests" }));
  await page.waitForFunction(() => /12 passed/.test(document.querySelector("#msgs").innerText));
  await settle(page, 200);
  assert.equal(await page.evaluate(() => document.activeElement === window.__row), true, `focus on the same disclosure, not ${await focusIs(page)}`);
  assert.equal(await page.locator('#msgs [data-tb="row:call-det"]').getAttribute("aria-expanded"), "true");
  await done(page);
});
t("DET: Copy on an answer that's still streaming keeps focus through every update (the row's own controls stay)", async () => {
  const page = await liveTurn();
  await page.evaluate((f) => window.__storm.apply(f), env("block.started", { block: { id: `${TURN}:t1`, type: "text", index: null, text: "First words of the answer." } }));
  const copy = page.locator(`#msgs [data-k^="turn:${TURN}"] .tb-text [data-mx-copy]`).first();
  await copy.waitFor({ state: "attached" });
  await page.locator(`#msgs [data-k^="turn:${TURN}"] .tb-text`).first().hover();
  await copy.focus();
  await page.evaluate(() => { window.__cp = document.activeElement; });
  for (let i = 1; i <= 4; i++) {
    await page.evaluate((f) => window.__storm.apply(f), env("block.updated", { block_id: `${TURN}:t1`, type: "text", append: ` More words, part ${i}.` }));
    await settle(page, 150);
  }
  assert.match(await page.locator(`#msgs [data-k^="turn:${TURN}"] .tb-text`).first().innerText(), /part 4/, "the answer streamed in");
  assert.equal(await page.evaluate(() => document.activeElement === window.__cp), true, `focus on the same Copy, not ${await focusIs(page)}`);
  await done(page);
}, { only: (c) => c.width >= 760 });
t("DET-2 C121/C050: the working line opens the work with focus on its header; folding it hands focus back to the line", async () => {
  const page = await liveTurn();
  const w = page.locator("#msgs .mx-work");
  await w.waitFor({ state: "visible" });
  await w.focus();
  await page.keyboard.press("Enter");
  await settle(page, 400);
  const f = await focusIs(page);
  assert.match(f, /\[data-tb=/, `on the work's header, not ${f}`);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute("aria-expanded")), "true");
  await page.keyboard.press("Space");
  await settle(page, 400);
  assert.equal(await page.evaluate(() => document.activeElement.classList.contains("mx-work")), true, `folded: on the working line, not ${await focusIs(page)}`);
  await done(page);
});

// ── DET: no bumps from rows updated in place (bumps.cjs's frame analysis, on a long paged fixture thread) ──
// Wheel up through older pages while a live turn keeps updating with focus held inside it (so its row takes
// reconcile's in-place path on every frame); what you're reading may move only by your own wheel. At 1× and 4× CPU.
for (const cpu of [1, 4]) {
  t(`DET bumps: older pages landing while a focused live row updates in place move nothing you read (CPU ${cpu}×)`, async () => {
    const all = Array.from({ length: 240 }, (_, i) => ({ id: `t_live-h${i}`, seq: i + 1, chat_id: "chat_demo", thread_ts: "t_live", author_kind: i % 3 ? "agent" : "owner", author_id: i % 3 ? "agent" : "owner", author_session_id: null, text: `${i % 3 ? "Agent" : "My"} message ${i}. ${"Words that make the bubble wrap onto a few lines, as real replies do. ".repeat(1 + (i % 4))}`, reply_to: null, extra: {}, created_at: new Date(Date.now() - (240 - i) * 60000).toISOString() }));
    const threads = [...THREADS(), TH("t_live", "A thread at work", "working", { session_id: SID })];
    const page = await app({ threads, history: { ts: "t_live", all, delay: 120 } });
    await openThread(page, "t_live");
    // the turn's frames carry seqs after the history's (as the stream's would), so the turn is the newest thing
    // in the thread and draws live at its end
    await page.evaluate(([a, b, c]) => { for (const f of [a, b, c]) window.__storm.apply(f); }, [
      env("session", { status: "running", role: "thread", agent: "claude_code" }, { turn_id: null, seq: 9001 }),
      env("turn.started", { origin: "person", wakes: [] }, { seq: 9002 }),
      env("block.started", { block: { id: `${TURN}:g0`, type: "activity", index: 0, header: "Running the tests", rows: [ROW()] } }, { seq: 9003 }),
    ]);
    await page.waitForSelector("#msgs .m-turn.is-live");
    await settle(page, 600);
    // focus inside the live turn: its work's header (opened from the working line), then keep the turn updating
    const w = page.locator("#msgs .mx-work");
    await w.waitFor({ state: "visible" });
    await w.focus();
    await page.keyboard.press("Enter");
    await settle(page, 400);
    assert.ok(await page.evaluate(() => !!document.activeElement.closest("#msgs .m-turn")), `focus inside the live turn, not ${await focusIs(page)}`);
    await page.evaluate(([TURN, ROWX]) => {
      let n = 0;
      window.__tick = setInterval(() => { n++; window.__storm.apply({ type: "block.updated", envelope: { type: "block.updated", id: null, seq: null, ts: new Date().toISOString(), chat_id: "chat_demo", session_id: "cse_th1", thread_ts: "t_live", turn_id: TURN, run_id: null, data: { block_id: `${TURN}:g0`, type: "activity", rows: [{ ...ROWX, line: `Run the tests · ${n} so far` }], header: "Running the tests" } } }); }, 250);
    }, [TURN, ROW()]);
    const cdp = await page.context().newCDPSession(page);
    if (cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: cpu });
    // the sampler: the row nearest the middle each frame, and where it is the next frame (bumps.cjs)
    await page.evaluate(() => {
      const sc = document.getElementById("scroller"), ms = document.getElementById("msgs");
      const R = (window.__b = { f: [], wheel: 0 });
      sc.addEventListener("wheel", (e) => { R.wheel += e.deltaY; }, { passive: true });
      let prev = null;
      const f = () => {
        const box = sc.getBoundingClientRect(), mid = box.top + sc.clientHeight / 2;
        let pick = null, best = 1e9;
        for (const el of ms.children) { if (!el.dataset.k) continue; const r = el.getBoundingClientRect(); if (!r.height) continue; const d = Math.abs(r.top - mid); if (d < best) { best = d; pick = { k: el.dataset.k, top: r.top }; } }
        const now = { t: performance.now(), ft: sc.scrollTop, sh: sc.scrollHeight, n: ms.children.length, wheel: R.wheel, pick };
        if (prev && prev.pick && pick) { const el = [...ms.children].find((e) => e.dataset.k === prev.pick.k); now.prevTopNow = el ? el.getBoundingClientRect().top : null; }
        R.f.push(now); prev = now;
        if (R.f.length < 3000) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    const STEP = 60;
    const box = await page.locator("#scroller").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const t0 = Date.now();
    while (Date.now() - t0 < 9000) { await page.mouse.wheel(0, -STEP); await page.waitForTimeout(16); }
    await settle(page, 1200);
    const F = await page.evaluate(() => { clearInterval(window.__tick); return window.__b.f; });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    let bumps = [], pages = 0;
    for (let i = 1; i < F.length; i++) {
      const a = F[i - 1], c = F[i];
      if (c.n !== a.n) pages++;
      if (!a.pick || c.prevTopNow == null) continue;
      const moved = c.prevTopNow - a.pick.top, wheel = -(c.wheel - a.wheel);
      const atTop = c.ft <= 1 && a.ft <= 1, expect = atTop ? 0 : wheel;
      const topClamp = c.ft <= 1 && c.sh === a.sh && Math.abs(moved - a.ft) <= 8 && a.ft <= STEP;
      if (topClamp) continue;
      if (Math.abs(moved - expect) > 8 && Math.abs(moved - (expect + STEP)) > 8 && Math.abs(moved - Math.max(0, expect - STEP)) > 8) bumps.push({ moved: Math.round(moved), wheel: Math.round(wheel), n: `${a.n}→${c.n}` });
    }
    console.log(`    CPU ${cpu}×: ${F.length} frames, ${pages} list changes, rows ${F[0].n}→${F[F.length - 1].n}, bumps ${bumps.length}`);
    assert.ok(pages > 0 && F[F.length - 1].n > F[0].n, "older pages landed during the wheel");
    assert.deepEqual(bumps, [], "nothing you read moved but by your wheel");
    assert.ok(await page.evaluate(() => !!document.activeElement.closest("#msgs .m-turn")), "focus still inside the live turn");
    await done(page);
  }, { only: (c) => c.theme === "dark" });
}

// ── run ─────────────────────────────────────────────────────────────────────
(async () => {
  server = await serve();
  BASE = `http://127.0.0.1:${server.address().port}`;
  browser = await launch(chromium);
  if (!browser) { console.error("not run: no Chromium would start"); server.close(); process.exit(2); }
  const only = process.argv[2] ? new RegExp(process.argv[2]) : null;
  const combos = (process.env.COMBOS || "1440-dark,1440-light,390-dark,390-light").split(",").map((c) => { const [w, theme] = c.split("-"); return { width: +w, height: +w < 760 ? 844 : 900, theme }; });
  for (const combo of combos) {
    C = combo;
    for (const { name, fn, only: o } of tests) {
      if (only && !only.test(name)) continue;
      if (o && !o(C)) continue;
      const label = `${name} [${C.width} ${C.theme}]`;
      try { await fn(); passed++; console.log("  ok  " + label); }
      catch (e) { failed++; console.error("  FAIL " + label + "\n" + (e.stack || e).toString().split("\n").slice(0, 6).join("\n")); }
    }
  }
  await browser.close(); server.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
