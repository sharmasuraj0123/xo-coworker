// Browser tests for Launchpad and the Shells dock: how each control answers, in the app itself.
// The rows they lock are listed in design-research/2026-11-lg/LAUNCHPAD-SHELL.md.
//   Launchpad: errors are whole · name taken · size dropdown · undo · stop window · copy is truthful · menu keys ·
//              ask pending
//   Shells: toggle · close says so · close all detached · tab keys · rename in the tab · close asks in its row · new shell pending · retry counts ·
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

let env, WIDTH = 1440, THEME = "dark", MOTION = "reduce", passed = 0, failed = 0;
const tests = [];
const t = (name, fn) => tests.push({ name, fn });
const open = (o = {}) => W.open(env.browser, env.base, { width: WIDTH, height: WIDTH > 760 ? 900 : 844, theme: THEME, motion: MOTION, ...o });
// every case ends with both focus checks: Launchpad's own (a redraw with no place named) and the main build's
// (window.__focusDrops: focus fell to the page because its control was removed or hidden)
// Missing instrumentation fails the check: it never reads as "no drops" (Astra on 93b99ca).
async function done(page) {
  const { lost, drops } = await page.evaluate(() => ({ lost: typeof window.__t?.LP?.lostFocus === "function" ? window.__t.LP.lostFocus() : null, drops: Array.isArray(window.__focusDrops) ? window.__focusDrops : null }));
  const errs = page.errors; await page.context().close();
  assert.ok(Array.isArray(lost), "Launchpad's focus record is there (LP.lostFocus)");
  assert.ok(Array.isArray(drops), "the BODY-drop check is installed (window.__focusDrops)");
  assert.deepEqual(errs, [], "page errors");
  assert.deepEqual(lost, [], "focus lost to the page by a redraw with no place named");
  assert.deepEqual(drops, [], "focus fell to the page: its control was removed or hidden (the main build's check)");
}
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
  // every field and lit button is on the 24/32/40 scale; on a phone at least the shared 36 px floor (32fa270, b7cf1ec:
  // every control and text field on a phone is 36 tall), so 36 or 40
  const sizes = await page.evaluate(() => [...document.querySelectorAll(".lp .lp-in, .lp .lp-go, .lp .lp-b, .lp .lp-a, .lp .lp-ib")].filter((n) => n.offsetParent).map((n) => Math.round(n.getBoundingClientRect().height)));
  assert.ok(sizes.every((h) => (WIDTH < 760 ? [36, 40] : [24, 32, 40]).includes(h)), `heights ${[...new Set(sizes)]}`);
  await done(page);
});

t("LP11: name taken: Launchpad's free name is a button under the hint, and takes", async () => {
  const page = await open({ launchpad: "name-taken" });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForSelector('[data-lp="use-name"]', { timeout: 6000 });
  const pos = await page.evaluate(() => { const h = document.querySelector("#lp-h-name").getBoundingClientRect(), b = document.querySelector('[data-lp="use-name"]').getBoundingClientRect(); return { below: b.top >= h.bottom - 1, edge: Math.abs(b.left - h.left), h: b.height }; });
  assert.ok(pos.below && pos.edge < 2 && pos.h === (WIDTH < 760 ? 36 : 24), JSON.stringify(pos)); // (a phone's 36 floor)
  await page.locator('[data-lp="use-name"]').click();
  await page.waitForFunction(() => document.querySelector('[data-lp-f="name"]')?.value === "xo-coworker-2");
  assert.equal(await page.locator('[data-lp="use-name"]').count(), 0, "the error and its fix go");
  await done(page);
});

t("LP11: confirm repo: warning before Deploy; the decision names repo and origin; Deploy to <repo> redeploys with use_repo exactly; Not this repository closes it", async () => {
  for (const decline of [false, true]) {
    const page = await open({ launchpad: "confirm-repo" });
    await W.openLaunchpad(page);
    assert.match(await page.locator(".lp-note.t-need").first().innerText(), /Pushes to someone-else\/xo-coworker/, "Space's warning is read before Deploy is pressed");
    await page.locator('[data-lp="deploy"]').click();
    await page.waitForSelector('[data-lp="use-repo"]', { timeout: 9000 });
    const card = await page.locator(".lp-ask").innerText();
    assert.match(card, /launchpad\.json names someone-else\/xo-coworker/);
    assert.match(card, /git origin is [^.]*\//);
    assert.equal((await page.locator('[data-lp="use-repo"]').innerText()).trim(), "Deploy to someone-else/xo-coworker");
    if (decline) {
      await page.locator('[data-lp="decline-repo"]').click();
      await page.waitForSelector('[data-lp="use-repo"]', { state: "detached" });
      assert.equal(await page.locator('[data-lp="deploy"]').count(), 1, "Deploy is still there");
      assert.equal((page.__sent || []).length, 1, "nothing was sent again");
    } else {
      await page.locator('[data-lp="use-repo"]').click();
      for (let i = 0; i < 60 && (page.__sent || []).length < 2; i++) await page.waitForTimeout(150);
      const sent = page.__sent;
      assert.equal(sent[0].use_repo, undefined);
      assert.equal(sent[1].use_repo, "someone-else/xo-coworker");
      assert.equal(sent[1].name, sent[0].name);
    }
    await done(page);
  }
});

t("LP11: other apps: the decision lists each app and where the push goes; Push anyway redeploys with every id; Don't push closes it", async () => {
  for (const decline of [false, true]) {
    const page = await open({ launchpad: "other-apps" });
    await W.openLaunchpad(page);
    await page.locator('[data-lp="deploy"]').click();
    await page.waitForSelector('[data-lp="allow-apps"]', { timeout: 9000 });
    const card = await page.locator(".lp-ask").innerText();
    assert.match(card, /acme\/todo/);
    assert.match(card, /todo-xo-ab12cd3/);
    assert.match(card, /deploy-staging\.yml/, "an app with no slug is named by its workflow file");
    assert.equal((await page.locator('[data-lp="allow-apps"]').innerText()).trim(), "Push anyway");
    if (decline) {
      await page.locator('[data-lp="decline-apps"]').click();
      await page.waitForSelector('[data-lp="allow-apps"]', { state: "detached" });
      assert.equal(page.__sent.length, 1, "nothing was sent again");
    } else {
      await page.locator('[data-lp="allow-apps"]').click();
      for (let i = 0; i < 60 && page.__sent.length < 2; i++) await page.waitForTimeout(150);
      assert.equal(page.__sent.length, 2);
      assert.equal(page.__sent[0].allow_apps, undefined);
      assert.deepEqual(page.__sent[1].allow_apps, ["todo-xo-ab12cd3", "deploy-staging.yml"], "every id, exactly");
      assert.equal(page.__sent[1].name, page.__sent[0].name);
    }
    await done(page);
  }
});

for (const sc of ["live-machine", "live-machine-noenv"]) t(`LP45: Change sits on its line's first row, at the line's end, level with its label (${sc})`, async () => {
  const page = await open({ launchpad: sc });
  await W.openLaunchpad(page);
  await page.waitForSelector(".lpm-env .lp-a", { state: "attached", timeout: 9000 });
  const rows = await page.evaluate(() => [...document.querySelectorAll(".lpm-env")].filter((n) => n.offsetParent && n.querySelector(".lp-a")).map((n) => {
    const q = (s) => n.querySelector(s).getBoundingClientRect(), b = q(".lp-a"), k = q(".lpm-k"), v = q(".lpm-v");
    return { rowRight: n.getBoundingClientRect().right, bCenter: (b.top + b.bottom) / 2, kCenter: (k.top + k.bottom) / 2, bLeft: b.left, bRight: b.right, vRight: v.right, vLeft: v.left };
  }));
  assert.ok(rows.length, "a line with Change is drawn");
  for (const r of rows) {
    assert.ok(Math.abs(r.bCenter - r.kCenter) <= 1, `Change is level with its label's line ${JSON.stringify(r)}`);
    assert.ok(r.bLeft >= r.vRight - 1, `Change doesn't sit over its value ${JSON.stringify(r)}`);
    if (WIDTH < 760) assert.ok(r.rowRight - r.bRight <= 12, `Change ends the line (not a row of its own) ${JSON.stringify(r)}`);
  }
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
  await page.waitForTimeout(200);
  assert.equal(await focused(page), "deploy", "focus back on Deploy, not the page");
  await page.waitForTimeout(3100);
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

for (const answer of ["503", "{}"]) {
  t(`LP21: a stop that is ${answer === "503" ? "refused" : "never confirmed"} keeps focus on Stop (Stopping…, then Stop again)`, async () => {
    const page = await open({ launchpad: "building", onDeploy: (r, m, p) => (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE" ? (answer === "503" ? json(r, { detail: { code: "fixture_offline", message: "Fixture offline" } }, 503) : json(r, {})) : r.fallback()) });
    await W.openLaunchpad(page);
    await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "run");
    await page.locator('[data-lp="stop"]').focus();
    await page.keyboard.press("Enter");
    await page.waitForSelector('[data-lp="stop-undo"]');
    await page.waitForTimeout(3150);
    assert.equal(await focused(page), "stop", "the window ends: focus on Stop (Stopping…)");
    await page.waitForFunction(() => /Stop again/.test(document.querySelector('[data-lp="stop"]')?.innerText || ""));
    assert.equal(await focused(page), "stop", "Stop again has focus");
    assert.ok(await page.evaluate(() => document.activeElement !== document.body));
    await done(page);
  });
}

t("LP focus: Cancel (settings) goes back to Change; Cancel (GitHub's code) back to Reconnect; never the page", async () => {
  const page = await open({ launchpad: "live" });
  await W.openLaunchpad(page);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
  await page.locator('.lpm-env [data-lp="edit"], [data-lp="edit"]').first().click();
  await page.waitForSelector('[data-lp="edit-cancel"]');
  await page.locator('[data-lp="edit-cancel"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.equal(await focused(page), "edit", "back on Change");
  await page.context().close();
  const p2 = await open({ launchpad: "device" });
  await W.openLaunchpad(p2);
  await p2.locator('[data-lp="reconnect"]').click();
  await p2.waitForSelector('[data-lp="device-cancel"]');
  await p2.locator('[data-lp="device-cancel"]').focus();
  await p2.keyboard.press("Enter");
  await p2.waitForTimeout(200);
  assert.equal(await focused(p2), "reconnect", "back on Reconnect GitHub");
  await done(p2);
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
  // its laid-out height (offsetHeight): with motion on, the menu is still floating in (scale .98 → 1) when measured
  const item = await page.evaluate(() => { const b = document.querySelector('.lp-mn [role="menuitem"]'); const cs = getComputedStyle(b); return { h: b.offsetHeight, fs: cs.fontSize, pos: getComputedStyle(b.parentElement).position }; });
  assert.deepEqual(item, { h: WIDTH < 760 ? 36 : 32, fs: "13px", pos: "absolute" }); // (a phone's 36 floor)
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

// a Space that offers sizes: preflight carries the template's tiers
const PRE = { state: "ready", github: { connected: true, login: "octo", scopes: ["repo", "workflow"], scopes_known: true, workflow_scope: true }, repo: { branch: "main", origin: "o/demo", is_admin: true, default_branch: "main", mode: "origin", full_name: "o/demo" },
  launchpad: { key: true, cli: true, name_free: true, sizes: { tiers: [{ name: "xo.small", label: "Small", cpu: 1, memory_gb: 2 }, { name: "xo.medium", label: "Medium", cpu: 2, memory_gb: 4 }], default: "xo.small", source: "template" } } };
t("LP15: Size is the app's dropdown (xo-select), by keyboard, and the deploy carries the choice", async () => {
  let body = null;
  const page = await open({ launchpad: "ready", onDeploy: (r, m, p) => {
    if (/\/preflight$/.test(p)) return json(r, PRE);
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "POST") body = JSON.parse(r.request().postData() || "{}");
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="machine-open"]').click();
  await page.waitForSelector('xo-select[data-lp-f="size"]');
  await page.waitForTimeout(100);
  assert.equal(await page.locator(".fr-lp select").count(), 0, "no native select");
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('xo-select[data-lp-f="size"]')), "focus on Size");
  assert.equal(await page.evaluate(() => document.querySelector('xo-select[data-lp-f="size"] .dd-btn').getAttribute("aria-describedby")), "lp-h-size", "the hint describes it");
  await page.keyboard.press("ArrowDown");
  await page.waitForSelector('xo-select[data-lp-f="size"] .dd-menu:not([hidden])');
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => document.querySelector('xo-select[data-lp-f="size"]').value), "xo.medium");
  // Enter chose a size, and only that: no deploy started (the native select's Enter did start one)
  assert.equal(await page.locator(".lp").getAttribute("data-screen"), "setup");
  assert.equal(await page.locator('[data-lp="undo"]').count(), 0, "no deploy Undo");
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('xo-select[data-lp-f="size"]')), "focus stays on Size");
  assert.match(await page.locator("#lp-h-size").innerText(), /Fixed once it's created/);
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForTimeout(3500);
  assert.equal(body?.size, "xo.medium");
  await done(page);
});

// ── Astra on 10f2580 ──
const sse = (r, events) => r.fulfill({ status: 200, contentType: "text/event-stream", body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") });
t("LP15: Esc in the open Size list closes the list, not the panel; focus stays on Size", async () => {
  const page = await open({ launchpad: "ready", onDeploy: (r, m, p) => (/\/preflight$/.test(p) ? json(r, PRE) : r.fallback()) });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="machine-open"]').click();
  await page.waitForSelector('xo-select[data-lp-f="size"]');
  await page.keyboard.press(" ");
  await page.waitForSelector('xo-select[data-lp-f="size"].is-open');
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  assert.equal(await page.locator('xo-select[data-lp-f="size"].is-open').count(), 0, "the list closed");
  assert.equal(await page.locator(".fr-lp .lp").isVisible(), true, "the panel stays");
  assert.ok(await page.evaluate(() => !!document.activeElement.closest('xo-select[data-lp-f="size"]')), "focus on Size");
  // on a phone every field is 40, Size with them; on a desktop 32
  const hs = await page.evaluate(() => [...document.querySelectorAll(".lp .lp-in, .lp xo-select .dd-btn")].filter((n) => n.offsetParent).map((n) => Math.round(n.getBoundingClientRect().height)));
  assert.ok(hs.length && hs.every((h) => h === (WIDTH > 760 ? 32 : 40)), `field heights ${[...new Set(hs)]}`);
  await done(page);
});

for (const theme of ["dark", "light"]) {
  t(`LP15: a size Launchpad refuses is red (${theme}); choosing another drops the invalid state on the combobox`, async () => {
    const page = await open({ theme, launchpad: "ready", onDeploy: (r, m, p) => {
      if (/\/preflight$/.test(p)) return json(r, PRE);
      if (/\/api\/deploy\/[^/]+$/.test(p) && m === "POST") { const ts = new Date().toISOString(); return sse(r, [{ type: "run", ts, run_id: "r9", kind: "deploy", attached: false, started_at: ts }, { type: "error", ts, step: "app", code: "size_not_allowed", message: "Size not allowed", fix: "", data: {} }]); }
      return r.fallback();
    } });
    await W.openLaunchpad(page);
    await page.locator('[data-lp="machine-open"]').click();
    await page.locator('[data-lp="deploy"]').click();
    await page.waitForFunction(() => document.querySelector('xo-select[data-lp-f="size"] .dd-btn')?.getAttribute("aria-invalid") === "true", null, { timeout: 9000 });
    const edge = await page.evaluate(() => { const v = getComputedStyle(document.querySelector('xo-select[data-lp-f="size"] .dd-btn')).borderTopColor; const c = v.match(/[\d.]+/g).map(Number); const k = /^color\(/.test(v) ? 255 : 1; return (c[0] - Math.max(c[1], c[2])) * k; });
    assert.ok(edge > 40, `the invalid edge is red (${edge})`);
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('xo-select[data-lp-f="size"]')), "focus on Size");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => document.querySelector('xo-select[data-lp-f="size"] .dd-btn').hasAttribute("aria-invalid")), false, "the combobox is valid again");
    await done(page);
  });
}

const GHPRE = { ...PRE, github: { connected: true, login: "octo", scopes: ["repo"], scopes_known: true, workflow_scope: false, source: "gh", fix: "Run `gh auth refresh -h github.com -s workflow`, then check again." } };
t("LP1A: I ran it: check again says when the check fails; a second Copy keeps its own 1.5 s", async () => {
  let fail = true, armed = false;
  const page = await open({ launchpad: "ready", onDeploy: (r, m, p) => (/\/preflight$/.test(p) ? (fail && armed ? json(r, { detail: { code: "unavailable", message: "Fixture offline" } }, 503) : json(r, GHPRE)) : r.fallback()) });
  await W.openLaunchpad(page);
  await page.waitForSelector('[data-lp="recheck-gh"]');
  armed = true;
  await page.locator('[data-lp="recheck-gh"]').click();
  await page.waitForSelector(".lp-gh-err");
  assert.match(await page.locator(".lp-gh-err").innerText(), /Couldn't check GitHub: Fixture offline/);
  // announce() clears the live region and fills it 40 ms later: wait for the words, don't race them
  await page.waitForFunction(() => /Couldn't check GitHub/.test(document.querySelector("#live")?.innerText || ""));
  assert.equal(await focused(page), "recheck-gh");
  fail = false;
  await page.locator('[data-lp="recheck-gh"]').click();
  await page.waitForFunction(() => !document.querySelector(".lp-gh-err"));
  // the live region says it once the check is back (it first says Checking GitHub again)
  await page.waitForFunction(() => /still doesn't have the workflow permission/.test(document.querySelector("#live")?.innerText || ""));
  // Copy twice, 950 ms apart: 650 ms after the second it still says Copied
  const cp = page.locator('[data-lp="cmd-copy"]');
  await cp.click(); await page.waitForTimeout(950); await cp.click(); await page.waitForTimeout(650);
  assert.equal(await cp.getAttribute("title"), "Copied");
  // and it does come back (a loaded machine may run the timer late: wait for it, don't race it)
  await page.waitForFunction(() => document.querySelector('[data-lp="cmd-copy"]')?.title === "Copy the command", null, { timeout: 4000 });
  await done(page);
});

t("LP1A: a recheck pressed again while one is out joins it: one request, and its answer is the one said", async () => {
  let reqs = 0, release, armed = false;
  const okPre = { ...GHPRE, github: { ...GHPRE.github, workflow_scope: true } };
  const page = await open({ launchpad: "ready", onDeploy: async (r, m, p) => {
    if (!/\/preflight$/.test(p)) return r.fallback();
    if (!armed) return json(r, GHPRE);
    reqs++; await new Promise((ok) => (release = ok)); return json(r, okPre);
  } });
  await W.openLaunchpad(page);
  await page.waitForSelector('[data-lp="recheck-gh"]');
  armed = true;
  await page.locator('[data-lp="recheck-gh"]').click();
  await page.waitForFunction(() => document.querySelector('[data-lp="recheck-gh"]')?.getAttribute("aria-disabled") === "true");
  assert.match(await page.locator('[data-lp="recheck-gh"]').innerText(), /Checking GitHub…/);
  await page.evaluate(() => document.querySelector('[data-lp="recheck-gh"]').click()); // pressed again, pending
  await page.waitForTimeout(300);
  assert.equal(reqs, 1, "one request");
  release();
  await page.waitForFunction(() => /has the workflow permission now/.test(document.querySelector("#live")?.innerText || ""));
  await page.waitForSelector('[data-lp="deploy"]');
  assert.equal(reqs, 1);
  await done(page);
});

t("LP15: a size changed after a refusal stays valid through a redraw (the model forgets the old rejection)", async () => {
  const page = await open({ launchpad: "ready", onDeploy: (r, m, p) => {
    if (/\/preflight$/.test(p)) return json(r, PRE);
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "POST") { const ts = new Date().toISOString(); return sse(r, [{ type: "run", ts, run_id: "r9", kind: "deploy", attached: false, started_at: ts }, { type: "error", ts, step: "app", code: "size_not_allowed", message: "Size not allowed", fix: "", data: {} }]); }
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="machine-open"]').click();
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForFunction(() => document.querySelector('xo-select[data-lp-f="size"]')?.getAttribute("aria-invalid") === "true", null, { timeout: 9000 });
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  assert.match(await page.locator("#lp-h-size").innerText(), /Fixed once it's created\./, "the hint says what it says for a valid size");
  // a redraw (Add a disk redraws the form) must not bring the old rejection back
  await page.locator('[data-lp="disk-add"]').click();
  await page.waitForSelector('[data-lp-f="diskPath"]');
  const st = await page.evaluate(() => ({ bad: document.querySelectorAll(".lp-f.is-bad").length, inv: document.querySelectorAll('.fr-lp [aria-invalid="true"]').length, hint: document.querySelector("#lp-h-size")?.innerText, value: document.querySelector('xo-select[data-lp-f="size"]').value }));
  assert.deepEqual(st, { bad: 0, inv: 0, hint: "Fixed once it's created.", value: "xo.medium" });
  await done(page);
});

t("LP10: a repository name to choose keeps its field while you fix it, through a redraw", async () => {
  const page = await open({ launchpad: "ready", onDeploy: (r, m, p) => {
    if (/\/api\/deploy\/[^/]+$/.test(p) && m === "POST") { const ts = new Date().toISOString(); return sse(r, [{ type: "run", ts, run_id: "r8", kind: "deploy", attached: false, started_at: ts }, { type: "needs", ts, step: "repo", code: "repo_name_taken", message: "That name is taken on your GitHub.", fix: "", options: [], data: { suggestion: "xo-coworker-2" } }]); }
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="deploy"]').click();
  await page.waitForSelector('[data-lp-f="repo"]', { timeout: 9000 });
  assert.equal(await page.locator('[data-lp-f="repo"]').getAttribute("aria-invalid"), "true");
  await page.locator('[data-lp-f="repo"]').fill("my-billing-repo");
  assert.equal(await page.locator("#lp-h-repo").innerText(), "A new repository on your GitHub.");
  await page.locator('[data-lp="env-all"]').click(); // a redraw of the form
  await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ v: document.querySelector('[data-lp-f="repo"]')?.value, bad: document.querySelectorAll(".lp-f.is-bad").length }));
  assert.deepEqual(st, { v: "my-billing-repo", bad: 0 }, "the field stays, valid, with what was typed");
  await done(page);
});

// Astra on 6d0a428 (LP-READ-ERROR-OWNERSHIP): an older read's refusal never beats a newer answer
const gate = () => { let open; const p = new Promise((ok) => (open = ok)); return { p, open }; };
t("LP1A: an older check refused after a newer GitHub check answered: the screen stays, nothing says Couldn't check", async () => {
  const held = gate(); let holdCheck = false, checks = 0, armedOk = false;
  const okPre = { ...GHPRE, github: { ...GHPRE.github, workflow_scope: true } };
  const page = await open({ launchpad: "ready", onDeploy: async (r, m, p) => {
    if (/\/check$/.test(p) && holdCheck) { checks++; holdCheck = false; await held.p; return json(r, { detail: { code: "unavailable", message: "Old read refused" } }, 503); }
    if (/\/preflight$/.test(p)) return json(r, armedOk ? okPre : GHPRE);
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.waitForSelector('[data-lp="recheck-gh"]');
  holdCheck = true;
  await page.evaluate(() => { window.__lp.load("demo", true); }); // an older read, out and held
  armedOk = true;
  await page.locator('[data-lp="recheck-gh"]').click(); // the newer read, answered: workflow now granted
  await page.waitForFunction(() => /has the workflow permission now/.test(document.querySelector("#live")?.innerText || ""));
  held.open(); // the older read is refused now
  await page.waitForTimeout(400);
  // what a person sees: the same setup screen with Deploy, never Couldn't check
  const st = await page.evaluate(() => ({ screen: document.querySelector(".lp")?.dataset.screen, deploy: !!document.querySelector('[data-lp="deploy"]'), recheck: !!document.querySelector('[data-lp="recheck"]') }));
  assert.equal(checks, 1);
  assert.deepEqual(st, { screen: "setup", deploy: true, recheck: false }, "the old refusal doesn't flip the screen to Couldn't check");
  await done(page);
});
t("LP1A: an older GitHub check refused after a newer read answered: no stale 'Couldn't check GitHub'", async () => {
  const held = gate(); let holdPre = false, pres = 0;
  const page = await open({ launchpad: "ready", onDeploy: async (r, m, p) => {
    if (/\/preflight$/.test(p) && holdPre) { pres++; holdPre = false; await held.p; return json(r, { detail: { code: "unavailable", message: "Old GitHub check refused" } }, 503); }
    if (/\/preflight$/.test(p)) return json(r, GHPRE);
    return r.fallback();
  } });
  await W.openLaunchpad(page);
  await page.waitForSelector('[data-lp="recheck-gh"]');
  holdPre = true;
  await page.locator('[data-lp="recheck-gh"]').click(); // the recheck's own read, out and held
  await page.waitForFunction(() => document.querySelector('[data-lp="recheck-gh"]')?.getAttribute("aria-disabled") === "true");
  await page.evaluate(() => window.__lp.load("demo", true)); // a newer read (check + GitHub), answered
  await page.waitForTimeout(500);
  held.open(); // the older GitHub check is refused now
  await page.waitForFunction(() => /still doesn't have the workflow permission|Couldn't check GitHub/.test(document.querySelector("#live")?.innerText || ""), null, { timeout: 6000 });
  await page.waitForTimeout(300);
  // what a person sees and hears: no stale failure under the button, none in the live region
  assert.equal(pres, 1);
  assert.equal(await page.locator(".lp-gh-err").count(), 0, "no stale failure under the button");
  assert.doesNotMatch(await live(page), /Couldn't check GitHub/);
  assert.match(await live(page), /still doesn't have the workflow permission/, "the newer read's answer is the one said");
  await done(page);
});

// Astra on 6d0a428 (LP-ASK-EXACT-THREAD): the asked thread by its id, whatever its title, past older same-title ones
for (const kase of ["older same-title thread", "renamed", "resolved"]) {
  t(`LP40: the asked thread's state comes from that exact thread (${kase})`, async () => {
    const at = new Date().toISOString();
    const older = { ts: "t_old", chat_id: "chat_demo", title: "Deploy to Launchpad", state: "active", created_at: at, updated_at: at, status_md: "" };
    const asked = { ts: "t_ready", chat_id: "chat_demo", title: kase === "renamed" ? "Fix the npm ci peer conflict" : "Deploy to Launchpad", state: kase === "resolved" ? "resolved" : "done", created_at: at, updated_at: at, status_md: "" };
    const page = await open({ launchpad: "failed-build", threads: kase === "older same-title thread" ? [older, asked] : [asked] });
    await W.openLaunchpad(page);
    await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "failed");
    await page.locator('[data-lp="ask-fix"]').click();
    await page.waitForSelector('[data-lp="thread"]');
    const text = await page.locator(".lp-asked").innerText();
    assert.match(text, /Done: merge its work, then deploy/, "its own state, found by id");
    assert.doesNotMatch(text, /isn't reported/);
    await done(page);
  });
}

t("LP44: the code's Copy says Copied for 1.5 s, then Copy; a refused copy right after never keeps the earlier Copied", async () => {
  const page = await open({ launchpad: "device" });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="reconnect"]').click();
  await page.waitForSelector('[data-lp="code-copy"]');
  const words = () => page.evaluate(() => document.querySelector('[data-lp="code-copy"]')?.innerText.trim());
  await page.locator('[data-lp="code-copy"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-lp="code-copy"]')?.innerText.trim() === "Copied");
  await page.waitForTimeout(600);
  assert.equal(await words(), "Copied", "still Copied within its 1.5 s");
  await page.waitForFunction(() => document.querySelector('[data-lp="code-copy"]')?.innerText.trim() === "Copy", null, { timeout: 4000 });
  // a success, then at once a refusal: the refusal is said, and the button doesn't keep the success's Copied
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector('[data-lp="code-copy"]')?.innerText.trim() === "Copied");
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException("Write permission denied.", "NotAllowedError")); document.execCommand = () => false; });
  await page.locator('[data-lp="code-copy"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /Couldn't copy/.test(document.querySelector("#live")?.innerText || ""));
  await page.waitForTimeout(100);
  assert.equal(await words(), "Copy", "refused: no Copied left over from the copy before");
  assert.equal(await focused(page), "code-copy", "focus stays on Copy");
  await done(page);
});

t("LP44: a cancelled GitHub code's late answer doesn't clear the newer code", async () => {
  let n = 0, cancelled = 0;
  const page = await open({ launchpad: "scope", api: async (r, m, p, answer) => {
    if (p.endsWith("/connectors/github/cli/start")) { n++; return answer({ session_id: `s${n}`, user_code: `CODE-${n}`, verification_uri: "https://github.com/login/device", expires_in: 900 }); }
    if (p.endsWith("/connectors/github/cli/poll")) { const id = JSON.parse(r.request().postData() || "{}").session_id; if (id === "s1") { await new Promise((ok) => setTimeout(ok, 2500)); return answer({ status: "failed", error: "expired" }); } return answer({ status: "pending" }); }
    if (p.endsWith("/connectors/github/cli/cancel")) { cancelled++; return answer({}); }
    return undefined;
  } });
  await W.openLaunchpad(page);
  await page.locator('[data-lp="reconnect"]').click();
  await page.waitForFunction(() => /CODE-1/.test(document.querySelector(".lp-code")?.innerText || ""));
  await page.waitForTimeout(2700); // its first poll is out (it answers 2.5 s later, failed)
  await page.locator('[data-lp="device-cancel"]').click();
  await page.locator('[data-lp="reconnect"]').click();
  await page.waitForFunction(() => /CODE-2/.test(document.querySelector(".lp-code")?.innerText || ""));
  await page.waitForTimeout(3000); // the old poll's failure arrives
  assert.match(await page.locator(".lp-code").innerText(), /CODE-2/, "the newer code stays");
  assert.equal(cancelled, 1);
  await done(page);
});

t("LP21: the notice's Undo for Stop puts focus back on Stop; no stop is asked for", async () => {
  const calls = [];
  const page = await open({ launchpad: "building", onDeploy: (r, m, p) => { if (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE") { calls.push(m); return json(r, { stopped: true }); } return r.fallback(); } });
  await W.openLaunchpad(page);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "run");
  await page.locator('[data-lp="stop"]').click();
  await page.locator("[data-herald-undo]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3300);
  assert.deepEqual(calls, []);
  assert.equal(await focused(page), "stop", "focus on Stop");
  await done(page);
});

for (const where of ["section put away", "another place on screen"]) {
  t(`LP21: Stop's notice Undo with the ${where}: focus goes to ${where === "section put away" ? "Launchpad's own head in the panel" : "that page's work, or on a phone the panel's Close"}; no stop`, async () => {
    const calls = [];
    const page = await open({ launchpad: "building", onDeploy: (r, m, p) => { if (/\/api\/deploy\/[^/]+$/.test(p) && m === "DELETE") { calls.push(m); return json(r, { stopped: true }); } return r.fallback(); } });
    await W.openLaunchpad(page);
    await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "run");
    await page.locator('[data-lp="stop"]').click();
    if (where === "section put away") await page.locator('[data-lp="hide"]').click();
    // another place: the page changes by script (window.__t.go). A person changes place by pressing something, which
    // takes focus off Launchpad first, so the case lets go of it deliberately before the script moves the page (a
    // navigation by script with focus left in a section it hides is the test's own move, not a person's path)
    else { await page.evaluate(() => document.activeElement?.blur()); await page.waitForTimeout(50); await page.evaluate(() => window.__t.go("ws")); await page.waitForTimeout(400); }
    await page.locator("[data-herald-undo]").focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3300);
    assert.deepEqual(calls, [], "no stop was asked for");
    // what Undo kept is the run, in Launchpad's section: its head (folded, in the panel) has focus. With another place on
    // screen: that page's work, unless the open panel covers the page (a phone): then the panel's own Close
    const at = await page.evaluate(() => { const a = document.activeElement; return { fold: a.getAttribute("data-fr-fold"), close: a.hasAttribute("data-stg-close"), id: a.id, inPanel: !!a.closest("#stage"), drawn: a.getClientRects().length > 0 }; });
    if (where === "section put away") assert.deepEqual([at.fold, at.inPanel, at.drawn], ["launch", true, true], "Launchpad's head, in the panel");
    else if (WIDTH > 760) assert.equal(at.id, "scroller", "the Workspace's conversation");
    else assert.deepEqual([at.close, at.drawn], [true, true], "the covering panel's Close");
    await done(page);
  });
}

t("LP36: Unlink's Undo, and a refused Unlink, put focus back on More", async () => {
  let refuse = false;
  const page = await open({ launchpad: "live", onDeploy: (r, m, p) => (/\/link$/.test(p) && m === "DELETE" && refuse ? json(r, { detail: { code: "unavailable", message: "Fixture offline" } }, 503) : r.fallback()) });
  await W.openLaunchpad(page);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
  await page.locator('[data-lp="menu"]').click();
  await page.locator('.lp-mn [data-lp="unlink"]').click();
  await page.locator("[data-herald-undo]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
  await page.waitForTimeout(150);
  assert.equal(await focused(page), "menu", "Undo: back on More");
  refuse = true;
  await page.locator('[data-lp="menu"]').click();
  await page.locator('.lp-mn [data-lp="unlink"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3700);
  await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "live");
  await page.waitForTimeout(150);
  assert.equal(await focused(page), "menu", "refused: back on More");
  assert.match(await live(page), /Couldn't unlink: Fixture offline/);
  await done(page);
});

t("LP37: Undo after Create it again goes back to Create it again", async () => {
  const gone = JSON.parse(JSON.stringify(W.SCENARIOS.live.pre)); gone.launchpad.app.exists = false;
  const page = await open({ launchpad: "live", onDeploy: (r, m, p) => (/\/preflight$/.test(p) ? json(r, gone) : r.fallback()) });
  await W.openLaunchpad(page);
  await page.waitForSelector('[data-lp="recreate"]');
  await page.locator('[data-lp="recreate"]').first().click();
  await page.waitForSelector('[data-lp="undo"]');
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  assert.equal(await focused(page), "recreate");
  await done(page);
});

for (const reported of ["none", "done"]) {
  t(`LP40: Ask an agent to fix it shows its thread, saying only what's reported about it (${reported === "none" ? "nothing yet" : "done"})`, async () => {
    // xo-space answers the ask with thread t_ready; "done": the app's list has that very thread, done
    const page = await open({ launchpad: "failed-build", threads: reported === "done" ? [{ ts: "t_ready", chat_id: "chat_demo", title: "Deploy to Launchpad", state: "done", created_at: new Date().toISOString(), updated_at: new Date().toISOString(), status_md: "" }] : [] });
    await W.openLaunchpad(page);
    await page.waitForFunction(() => document.querySelector(".lp")?.dataset.screen === "failed");
    await page.locator('[data-lp="ask-fix"]').click();
    await page.waitForSelector('[data-lp="thread"]');
    await page.waitForTimeout(150);
    assert.equal(await focused(page), "thread");
    const row = await page.evaluate(() => ({ text: document.querySelector(".lp-asked").innerText, arc: !!document.querySelector(".lp-asked .arc"), clock: !!document.querySelector(".lp-asked .lp-tm") }));
    if (reported === "none") {
      assert.match(row.text, /A thread was started to fix it/);
      assert.match(row.text, /its status isn't reported yet/);
      assert.doesNotMatch(row.text, /Working|is fixing it/);
    } else {
      assert.match(row.text, /Its agent says it's done/);
      assert.match(row.text, /Done: merge its work, then deploy/);
      assert.doesNotMatch(row.text, /Working|is fixing it/);
    }
    assert.deepEqual([row.arc, row.clock], [false, false], "no arc or clock for a thread not reported at work");
    await done(page);
  });
}

// ── Shells ──
t("SH08/SH09/SH20/SH22/SH33: Minimise keeps focus on its button; Hide goes to the work; Show every shell and a refused New shell keep focus", async () => {
  // the dock as a reload finds it: open on the list, filtered to the project
  const page = await open({ terms: "some", createFail: "Fixture: too many shells", shellsSession: { tabs: [], active: "list", open: true, filter: "demo" } });
  await page.waitForSelector("[data-sh-filter]");
  await page.locator("[data-sh-filter]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-new")), true, "Show every shell → New shell");
  await page.keyboard.press("Enter"); // New shell, refused
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-new")), true, "refused: still on New shell");
  if (WIDTH > 760) {
    await page.locator("[data-sh-min]").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-min")), true, "minimised: focus on Show");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-min")), true, "shown again: still there");
  }
  await page.locator("[data-sh-hide]").focus();
  await page.keyboard.press("Enter");
  // put away on Home: Home itself (the page's work), drawn and focused
  assert.deepEqual(await page.evaluate(() => ({ id: document.activeElement.id, drawn: document.activeElement.getClientRects().length > 0 })), { id: "home", drawn: true });
  await done(page);
});

t("SH31: Retry now hands focus to the shell", async () => {
  let drops = 0;
  const page = await dock({ ws: (ws) => { if (drops++ < 1) { ws.close({ code: 1011, reason: "" }); return false; } } });
  await page.locator('[data-sh-open="sh_1"]').click();
  await page.waitForSelector(".shd-note [data-sh-retry]", { timeout: 9000 });
  await page.locator(".shd-note [data-sh-retry]").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => !!document.activeElement.closest("#shd .xterm")), "focus in the shell");
  await done(page);
});

// ── RINGCLIP · C076: no clipping box cuts a focused control's ring in Launchpad and Shells ──
// grader B on 24be023 (r23), 390 both themes: Launchpad's Deploy in its folded head ([data-lp="open"], 36 tall on a
// phone in the 40 px head of a frame that clips) showed its ring only left and right. The sweep (harness.cjs
// ringClips) focuses every control in view and checks every clipping box around it: Launchpad open, its section
// folded with Deploy in the head and unfolded again, and the Shells dock with a shell open.
const { ringClips } = require("./harness.cjs");
t("RINGCLIP C076: no clipping box cuts a focused control's ring: Launchpad open, folded (Deploy) and open again, the Shells dock", async () => {
  const cuts = [], counts = [], small = [];
  const wraps = [];
  const sweep = async (page, where) => { const r = await ringClips(page, where); counts.push(`${where} ${r.n}`); cuts.push(...r.cut); small.push(...r.floor); wraps.push(...r.wrapped); };
  let page = await open({ launchpad: "ready" });
  await page.keyboard.press("Shift"); // a keyboard's focus: the ring is drawn
  await W.openLaunchpad(page);
  await page.waitForTimeout(400);
  await sweep(page, "Launchpad open");
  await page.locator("[data-fr-fold=launch]").first().click();
  await page.waitForTimeout(400);
  const deploy = await page.locator('[data-lp="open"]').count();
  await sweep(page, `Launchpad folded${deploy ? " (Deploy)" : ""}`);
  await page.locator("[data-fr-fold=launch]").first().click();
  await page.waitForTimeout(400);
  await sweep(page, "Launchpad open again");
  await done(page);
  page = await dock();
  await page.keyboard.press("Shift");
  await attach(page);
  await sweep(page, "the Shells dock");
  console.log(`  RINGCLIP read ${counts.join(", ")}`);
  if (small.length) console.log(`  RINGCLIP under the floor (not this case's verdict): ${small.join("; ")}`);
  assert.ok(deploy, "Deploy was in the folded head");
  assert.deepEqual(cuts, [], `rings cut by a clipping box:\n  ${cuts.join("\n  ")}`);
  assert.deepEqual(wraps, [], `a button's label on two lines (S045's ruling: one line):\n  ${wraps.join("\n  ")}`);
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

t("SH27: a detached shell's dot is never blue, in either theme (no blue dots)", async () => {
  const page = await dock();
  const dots = await page.evaluate(() => [...document.querySelectorAll(".shl-row .shd-dot, .shd-tab .shd-dot")].map((d) => { const c = getComputedStyle(d).backgroundColor.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0]; const k = /^color\(/.test(getComputedStyle(d).backgroundColor) ? 255 : 1; const [r, g, b, a = 1] = c; return { cls: d.className, blue: a > 0 && b * k - Math.max(r, g) * k > 30 }; }));
  assert.ok(dots.some((d) => /d-away/.test(d.cls)), "a detached shell's dot is drawn");
  assert.deepEqual(dots.filter((d) => d.blue).map((d) => d.cls), [], "no blue dot");
  await done(page);
});

t("SH01: the sidebar's Shells shows the dock and says so", async () => {
  const page = await dock();
  assert.equal(await page.locator("#nv-shells").getAttribute("aria-pressed"), "true");
  assert.match(await page.locator("#nv-shells").getAttribute("aria-label"), /Shells, 3 running/);
  await done(page);
});

t("SH07: Close shell says so at every width (on a phone: × Close, with ↓ alone beside it)", async () => {
  const page = await dock();
  await attach(page, "sh_1");
  const words = (await page.locator('.shd-acts [data-sh-close="sh_1"]').innerText()).trim();
  assert.equal(words, WIDTH > 760 ? "Close shell" : "Close");
  assert.equal(await page.locator(".shd-acts [data-sh-min]").isVisible(), WIDTH > 760, "a phone has one way to put it away");
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

t("SH06: a shell is renamed in its tab: Enter keeps, Esc cancels, a refusal keeps what was typed in the field", async () => {
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
  await page.waitForTimeout(400);
  // refused: the field is back, holding what was typed, focused; nothing typed is lost
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.shName && document.activeElement.value), "web");
  assert.match(await live(page), /Couldn't rename the shell/);
  await page.keyboard.press("Escape");
  assert.equal((await page.locator('[data-sh-tab="sh_1"]').innerText()).trim(), "api", "Esc keeps the old name");
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
  await page.locator(".shl-row [data-sh-yes]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector('.shl-row [data-sh-close="sh_1"]'));
  assert.deepEqual(page.W.closed, ["sh_1"]);
  assert.equal(await focused(page), "sh_2", "focus on the × of the row that took its place");
  await done(page);
});

t("SH07/SH26: the bar's Close asks every time (Keep it, then Close again: the question is whole, not empty)", async () => {
  const page = await dock();
  await attach(page, "sh_1"); // npm runs in it: Close asks
  for (let i = 0; i < 2; i++) {
    await page.locator('.shd-acts [data-sh-close="sh_1"]').click();
    await page.waitForSelector(".shd-confirm:not([hidden])");
    assert.match(await page.locator(".shd-confirm").innerText(), /npm is running in demo/, `asked whole, time ${i + 1}`);
    assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-no")), true, "Keep it focused");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".shd-confirm").isHidden(), true);
    assert.equal(await focused(page), "sh_1", "back on Close shell");
  }
  assert.deepEqual(page.W.closed, []);
  await done(page);
});

t("SH07/SH25: a refused close keeps the shell: its tab, its socket, its row; focus back on Close", async () => {
  const page = await dock({ closeFail: "Fixture offline" });
  await attach(page, "sh_2"); // bash: closes without asking
  await page.locator('.shd-acts [data-sh-close="sh_2"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  assert.deepEqual(page.W.closed, []);
  assert.equal(await page.locator('.shd-term[data-pane="sh_2"]:not(.is-ended) .xterm').count(), 1, "the tab and its terminal stay");
  assert.equal(await page.locator('[data-sh-tab="sh_2"]').count(), 1);
  assert.equal(await focused(page), "sh_2", "focus back on Close shell");
  assert.match(await live(page), /Couldn't close .*still running/);
  await page.locator('[data-sh-tab="list"]').click();
  assert.equal(await page.locator('.shl-row [data-sh-close="sh_2"]').count(), 1, "its row stays");
  await done(page);
});

t("SH21/SH08/SH09: Close all detached asks and answers; minimise, show and hide keep focus off the page", async () => {
  const page = await dock();
  await page.locator("[data-sh-closedet]").focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector(".shd-confirm:not([hidden])");
  assert.match(await page.locator(".shd-confirm").innerText(), /Close 3 detached shells\?/);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.activeElement.hasAttribute("data-sh-closedet")), true, "Esc: back on Close all detached");
  await page.keyboard.press("Enter");
  await page.locator(".shd-confirm [data-sh-yes]").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelectorAll(".shl-row:not(.is-ended)").length === 0);
  assert.equal(page.W.closed.length, 3);
  assert.ok(await page.evaluate(() => document.querySelector("#shd").contains(document.activeElement)), "focus stays in the dock");
  if (WIDTH > 760) {
    await page.locator("[data-sh-min]").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.querySelector("#shd").classList.contains("is-min")), true);
    await page.locator("[data-sh-min]").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => document.querySelector("#shd").classList.contains("is-min")), false);
  }
  await page.evaluate(() => window.__t.go("p:demo")); // the dock stays across places
  await page.waitForTimeout(300);
  await page.locator("[data-sh-hide]").focus();
  await page.keyboard.press("Enter");
  assert.equal(await page.locator("#shd").isHidden(), true);
  // put away on a project: its conversation, drawn and focused
  assert.deepEqual(await page.evaluate(() => ({ id: document.activeElement.id, drawn: document.activeElement.getClientRects().length > 0 })), { id: "scroller", drawn: true });
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
  // every width in both themes and both motion settings: 1440 dark reduced, 1440 light full motion, 390 dark full
  // motion, 390 light reduced (a case that names its own theme keeps it)
  const MATRIX = [[1440, "dark", "reduce"], [1440, "light", "no-preference"], [390, "dark", "no-preference"], [390, "light", "reduce"]];
  for (const [width, theme, motion] of MATRIX) {
    WIDTH = width; THEME = theme; MOTION = motion;
    for (const { name, fn } of tests) {
      if (only && !only.test(name)) continue;
      const label = `${name} [${width} ${theme} ${motion === "reduce" ? "reduced" : "motion"}]`;
      try { await fn(); passed++; console.log("  ok  " + label); }
      catch (e) { failed++; console.error("  FAIL " + label + "\n" + (e.stack || e)); }
    }
  }
  await env.close();
  console.log(`${passed} passed${failed ? `, ${failed} failed` : ""}`);
  process.exitCode = failed ? 1 : 0;
})();
