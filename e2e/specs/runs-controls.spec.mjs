// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Seed, Tools} from "../lib/types.d.ts" */

/** @typedef {{request(): {url(): string}, fulfill(reply: {status?: number, json: unknown}): Promise<void>}} RunRoute */

const viewports = /** @type {const} */ (["desktop", "phone"]);
const alpha = { id: "alpha-run", title: "Alpha helper", state: "running", kind: "subagent", can_stop: true, depth: 1 };
const beta = { ...alpha, id: "beta-run", title: "Beta helper" };
const titles = { alpha: "Alpha thread", beta: "Beta thread" };

/** @param {string} thread */
const endpoint = (thread) => `/api/chat/sessions/s-${thread}/runs`;

/** @param {typeof alpha} run */
const reply = (run) => ({ runs: [run], counts: { running: Number(run.state === "running"), total: 1 }, next_after_seq: null });

const held = () => /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());

/** @type {Seed} */
const seed = {
  threads: { chat_demo: Object.entries(titles).map(([id, title]) => ({
    ts: id, title, state: "done", session_id: `s-${id}`, cwd: "/home/test/demo", runs: { total: 1 },
  })) },
  routes: {
    "GET /api/xo-projects/demo/github/issues": {
      project_id: "demo", repo: null, fetched_at: null, error: null, issues: [], untracked: 0, tracked: 0, state: "no_remote",
    },
    "GET /api/chat/runtimes": { runtimes: [{ name: "claude_code", default: true,
      features: { features: { "runs.stop": { support: "native" } } } }] },
    "GET /api/chat/runs/alpha-run": alpha,
    "GET /api/chat/runs/alpha-run/transcript": { items: [], next: null },
    "POST /api/chat/runs/alpha-run/stop": { stopping: true, run: alpha },
  },
};

/** @param {Tools['page']} page @param {string} selector */
const visible = (page, selector) => page.locator(selector).filter({ visible: true }).first();

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function boot(t, phone, theme) {
  const { page } = t;
  page.setDefaultTimeout(4500);
  await page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await visible(page, "#pb-menu, #top-menu").click();
  await visible(page, '[data-go="p:demo"]').click();
}

/** @param {Tools} t @param {keyof typeof titles} thread @param {boolean} [settle] */
async function openThread(t, thread, settle = true) {
  const { page } = t;
  const stage = page.locator("#stage");
  if (await stage.isHidden()) await visible(page, "[data-stage-toggle]").click();
  const row = visible(page, `#stage [data-go="t:${thread}"]`);
  const fold = visible(page, '#stage [data-tg-fold="done"][aria-expanded="false"]');
  if (await row.isHidden() && await fold.count()) await fold.click();
  await row.click();
  await page.getByRole("button", { name: "Open in main chat" }).click();
  const close = visible(page, "#stage [data-stg-close]");
  if (await close.count()) await close.click();
  if (settle) await t.settle();
}

/** @param {Tools['page']} page */
const banner = (page) => visible(page, "#thead [data-runs]");

/** @param {Tools['page']} page */
const runs = (page) => visible(page, "#runs-card");

/** @param {Tools['page']} page @param {string} selector */
async function focus(page, selector) {
  await page.waitForFunction((/** @type {string} */ hook) => !!document.activeElement?.matches(hook), selector);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {boolean} warm */
async function retryList(t, phone, theme, warm) {
  const { page } = t;
  let refuses = !warm;
  let reads = 0;
  await page.route((/** @type {URL} */ url) => url.pathname === endpoint("alpha"), async (/** @type {RunRoute} */ route) => {
    reads++;
    if (refuses) return route.fulfill({ status: 503, json: { detail: { code: "network", message: "Fixture offline" } } });
    return route.fulfill({ json: reply({ ...alpha, state: "finished", can_stop: false }) });
  });
  await boot(t, phone, theme);
  await openThread(t, "alpha");
  const panel = runs(page);
  const row = panel.getByRole("button", { name: alpha.title });
  if (warm) {
    await banner(page).press("Enter");
    await row.waitFor();
    await focus(page, '#runs-card .rn-open[data-run="alpha-run"]');
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    refuses = true;
  }
  await banner(page).press("Enter");
  const fail = panel.getByRole("alert").filter({ hasText: /Couldn't read its sub-agents.*Fixture offline/ });
  const retry = fail.getByRole("button", { name: "Try again" });
  await retry.waitFor();
  await focus(page, "[data-runs-retry]");
  assert.equal(await row.isVisible(), warm);
  if (warm) {
    const previous = reads;
    await retry.press("Enter");
    await retry.waitFor();
    await focus(page, "[data-runs-retry]");
    assert.equal(reads, previous + 1);
    const shape = await retry.evaluate((/** @type {HTMLElement} */ button) => {
      const range = document.createRange();
      range.selectNodeContents(button);
      const lines = new Set([...range.getClientRects()].map((part) => Math.round(part.top))).size;
      const { width, height } = button.getBoundingClientRect();
      return { lines, width, height, squeezed: button.scrollWidth > button.clientWidth + 1 };
    });
    assert.ok(shape.lines === 1 && shape.width >= 44 && shape.height >= 32 && !shape.squeezed, JSON.stringify(shape));
    assert.equal(await row.isVisible(), true);
  }
  refuses = false;
  const previous = reads;
  await retry.press("Enter");
  await row.waitFor();
  await focus(page, '#runs-card .rn-open[data-run="alpha-run"]');
  assert.equal(await fail.count(), 0);
  assert.equal(reads, previous + 1);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function staleList(t, phone, theme) {
  const { page } = t;
  const old = held();
  await page.route((/** @type {URL} */ url) => url.pathname === endpoint("alpha"), async (/** @type {RunRoute} */ route) => {
    await old.promise;
    await route.fulfill({ json: reply(alpha) });
  });
  await page.route((/** @type {URL} */ url) => url.pathname === endpoint("beta"), (/** @type {RunRoute} */ route) =>
    route.fulfill({ json: reply(beta) }));
  try {
    await boot(t, phone, theme);
    await openThread(t, "alpha");
    await Promise.all([
      page.waitForRequest((/** @type {{url(): string}} */ request) => new URL(request.url()).pathname === endpoint("alpha")),
      banner(page).press("Enter"),
    ]);
    const panel = runs(page);
    await panel.getByRole("status").filter({ hasText: /Reading its sub-agents/ }).waitFor();
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    if (phone) {
      await visible(page, "#top-back").click();
      await page.locator('#app[data-view="project"]').waitFor();
    } else await visible(page, '[data-go="p:demo"]').click();
    await openThread(t, "beta", false);
    await banner(page).press("Enter");
    await panel.getByRole("button", { name: beta.title }).waitFor();
    old.resolve();
    await t.settle();
    assert.equal(await panel.getByRole("button", { name: beta.title }).count(), 1);
    assert.equal(await panel.getByRole("button", { name: alpha.title }).count(), 0);
  } finally {
    old.resolve();
  }
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function openLiveDetail(t, phone, theme) {
  const { page, space } = t;
  await page.route((/** @type {URL} */ url) => url.pathname === endpoint("alpha"), (/** @type {RunRoute} */ route) =>
    route.fulfill({ json: reply(alpha) }));
  await boot(t, phone, theme);
  await openThread(t, "alpha");
  space.push("run.started", { run_id: alpha.id, state: "running", info: alpha },
    { chat_id: "chat_demo", thread_ts: "alpha", session_id: "s-alpha" });
  const panel = runs(page);
  const head = page.locator("#thead");
  const count = head.getByRole("button", { name: "1 sub-agent working", exact: true });
  if (phone) {
    await count.waitFor();
    assert.equal(await head.getByRole("list", { name: "Sub-agents working now" }).count(), 0);
    await count.press("Enter");
    await panel.getByRole("button", { name: alpha.title }).press("Enter");
  } else {
    const list = head.getByRole("list", { name: "Sub-agents working now" });
    const chip = list.getByRole("listitem").getByRole("button", { name: alpha.title });
    await chip.waitFor();
    assert.equal(await list.getByRole("listitem").count(), 1);
    await chip.press("Enter");
  }
  const stop = panel.locator(".rn-hero").getByRole("button", { name: "Stop", exact: true });
  await stop.waitFor();
  const shown = await stop.evaluate((/** @type {Element} */ button) => {
    const icon = button.querySelector("svg")?.getBoundingClientRect();
    const word = button.querySelector("span")?.getBoundingClientRect();
    return { icon: (icon?.width ?? 0) > 2 && (icon?.height ?? 0) > 0, word: (word?.width ?? 0) > 2 };
  });
  assert.deepEqual(shown, { icon: true, word: !phone });
  return panel;
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function liveControls(t, phone, theme) {
  const { page } = t;
  const panel = await openLiveDetail(t, phone, theme);
  await page.locator("#stage").getByRole("button", { name: "Back to Sub-agents", exact: true }).press("Enter");
  await panel.getByRole("button", { name: alpha.title }).waitFor();
  await focus(page, '#runs-card .rn-open[data-run="alpha-run"]');
  await page.locator("#stage").getByRole("button", { name: "Back to the thread", exact: true }).press("Enter");
  await panel.waitFor({ state: "hidden" });
  await focus(page, phone ? "#thead [data-runs]" : '#thead .rn-chip[data-run="alpha-run"]');
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function undoStop(t, phone, theme) {
  const { page, store } = t;
  await page.route((/** @type {URL} */ url) => url.pathname === endpoint("alpha"), (/** @type {RunRoute} */ route) =>
    route.fulfill({ json: reply(alpha) }));
  await boot(t, phone, theme);
  await openThread(t, "alpha");
  await banner(page).press("Enter");
  const panel = runs(page);
  const stop = panel.locator(".rn-list").getByRole("button", { name: "Stop", exact: true });
  await stop.press("Enter");
  await stop.press("Enter");
  const undo = panel.getByRole("button", { name: "Undo", exact: true });
  await undo.waitFor();
  assert.equal(await undo.count(), 1);
  await undo.press("Enter");
  await undo.waitFor({ state: "hidden" });
  await focus(page, '[data-run-stop="alpha-run"]');
  await page.locator("#live").filter({ hasText: /Not stopped.*keeps working/ }).waitFor({ state: "attached" });
  await page.waitForTimeout(3200);
  assert.equal(store.writes.some(({ method, path }) => method === "POST" && path.endsWith("/alpha-run/stop")), false);
}

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => {
  const phone = viewport === "phone";
  return [
    ...[false, true].map((warm) => ({
      name: `Runs read refusal and keyboard recovery ${warm ? "with cached rows" : "on first open"} at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => retryList(t, phone, theme, warm),
    })),
    { name: `Runs ignores a late list from the previous thread at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => staleList(t, phone, theme) },
    { name: `Runs live opener, named detail Stop and focus restoration at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => liveControls(t, phone, theme) },
    { name: `Runs deduplicates Stop and Undo cancels the request at ${viewport} ${theme}`, viewport, seed,
      run: (/** @type {Tools} */ t) => undoStop(t, phone, theme) },
  ];
}));
