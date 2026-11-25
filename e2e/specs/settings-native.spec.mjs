// @ts-check

import assert from "node:assert/strict";

/** @import {Case, Tools} from "../lib/types.d.ts" */

/** @typedef {{method(): string, postDataJSON(): unknown}} Request */

/** @typedef {{fallback(): Promise<void>, abort(code: string): Promise<void>}} RouteControl */

/** @typedef {RouteControl & {request(): Request, fulfill(reply: {json: unknown}): Promise<void>}} Route */

const router = "/api/chat/router";
const routerModels = `${router}/models`;
const rules = "/api/chat/rules";
const worktrees = "/api/chat/worktrees";
const models = [
  { id: "levanto", label: "Levanto Sage", connected: true, model: "sage-1", docs_url: "https://example.invalid/levanto" },
  { id: "quill", label: "Quill Route", connected: false, model: "q-2", docs_url: "https://example.invalid/quill" },
];

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {string} [tab] */
async function openSettings(t, phone, theme, tab) {
  await t.page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  await t.page.locator(phone ? "#set-phone" : "#set-side").press("Enter");
  await t.page.locator("#settings").waitFor();
  if (tab) await t.page.getByRole("tab", { name: tab, exact: true }).click();
}

/** @param {Tools} t @param {string} selector */
async function focus(t, selector) {
  await t.page.waitForFunction((/** @type {string} */ target) => !!document.activeElement?.matches(target), selector);
}

/** @param {Tools} t @param {string} selector @param {string} attribute @param {string | null} value */
async function attr(t, selector, attribute, value) {
  await t.page.waitForFunction((/** @type {{selector: string, attr: string, value: string | null}} */ fields) => {
    const node = document.querySelector(fields.selector);
    return !!node && node.getAttribute(fields.attr) === fields.value;
  }, { selector, attr: attribute, value });
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function tabsAndKeyboard(t, phone, theme) {
  const { page } = t;
  await openSettings(t, phone, theme);
  await focus(t, '[data-set="general"]');
  const tabs = page.locator("#settings [data-set]");
  const links = await tabs.evaluateAll((/** @type {HTMLElement[]} */ nodes) => nodes.map((tab) => {
    const panel = document.getElementById(tab.getAttribute("aria-controls") || "");
    return { page: tab.dataset.set, stop: tab.tabIndex,
      labelled: panel?.getAttribute("aria-labelledby") === tab.id && panel?.dataset.page === tab.dataset.set,
      role: panel?.getAttribute("role") };
  }));
  const order = ["general", "appearance", "shape", "routing", "runtimes", "accounts", "rules", "worktrees", "sounds", "keys"];
  assert.deepEqual(links.map((/** @type {{page: string}} */ tab) => tab.page), order);

  assert.deepEqual(links.map((/** @type {{stop: number}} */ tab) => tab.stop), order.map((id) => id === "general" ? 0 : -1));
  for (const tab of links) assert.ok(tab.labelled && tab.role === "tabpanel");
  assert.equal(await page.getByRole("tablist").getAttribute("aria-orientation"), phone ? "horizontal" : "vertical");
  await page.keyboard.press("Tab");
  await focus(t, "#hops-tog");
  await page.keyboard.press("Shift+Tab");
  await focus(t, '[data-set="general"]');
  const forward = phone ? "ArrowRight" : "ArrowDown";
  await page.keyboard.press(forward);
  await focus(t, '[data-set="appearance"]');
  await page.locator('[data-page="appearance"]').waitFor();
  await page.keyboard.press(forward);
  await focus(t, '[data-set="shape"]');
  await page.locator('[data-page="shape"]').waitFor();
  assert.equal(await tabs.and(page.locator('[tabindex="0"]')).count(), 1);
  await page.keyboard.press("End");
  await focus(t, '[data-set="keys"]');
  await page.keyboard.press("ArrowRight");
  await focus(t, '[data-set="general"]');
  await page.keyboard.press("ArrowUp");
  await focus(t, '[data-set="keys"]');
  await page.keyboard.press("Home");
  await focus(t, '[data-set="general"]');
  await page.keyboard.press("End");
  await keyboard(t);
}

/** @param {Tools} t */
async function keyboard(t) {
  const { page } = t;
  const jump = '[data-rebind="jump"]';
  const button = page.locator(jump);
  await button.press("Enter");
  await button.getByText("Press a key…").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#settings").isVisible(), true);
  await focus(t, jump);
  await page.keyboard.press("Enter");
  await page.keyboard.press("ControlOrMeta+Shift+KeyK");
  await focus(t, jump);
  assert.match(await button.getAttribute("aria-label"), /⇧K/);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("cv-keys") || "{}").jump), "mod+shift+k");
  await page.locator('[data-kreset="jump"]').press("Enter");
  await focus(t, jump);
  assert.equal(await page.locator('[data-kreset="jump"]').count(), 0);
  await button.press("Enter");
  await page.keyboard.press("ControlOrMeta+Shift+KeyK");
  const reset = page.locator("#keys-reset-all");
  await reset.press("Enter");
  assert.equal(await reset.isDisabled(), true);
  const first = page.locator("#set-keys-list [data-rebind]").first();
  assert.equal(await first.evaluate((/** @type {Element} */ el) => el === document.activeElement), true);
  assert.equal(await page.evaluate(() => localStorage.getItem("cv-keys")), "{}");
}

/** @param {Tools} t @param {string} path @param {string} method @param {(body: unknown) => unknown} accept */
async function refuseOnce(t, path, method, accept) {
  const release = /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());

  /** @type {unknown[]} */
  const writes = [];
  await t.page.route(`**${path}`, async (/** @type {Route} */ route) => {
    const request = route.request();
    if (request.method() !== method) return route.fallback();
    const body = request.postDataJSON();
    writes.push(body);
    if (writes.length === 1) {
      await release.promise;
      return route.abort("connectionrefused");
    }
    return route.fulfill({ json: accept(body) });
  });
  return { writes, release: release.resolve };
}

/** @param {Tools} t @param {string} selector @param {{release(): void}} request */
async function doublePress(t, selector, request) {
  try {
    await t.page.locator(selector).press("Enter");
    await attr(t, selector, "aria-disabled", "true");
    await t.page.keyboard.press("Enter");
    await focus(t, selector);
  } finally {
    request.release();
  }
}

/** @param {Tools} t @param {boolean} phone @param {string} theme @param {"agent" | "decision" | "off"} mode */
async function routing(t, phone, theme, mode) {
  const { page, store } = t;
  const current = { mode: mode === "agent" ? "off" : "agent", decision_model: null, abstain_below: 0.5 };
  const routeKey = `GET ${router}`;
  store.routes[routeKey] = current;
  store.routes[`GET ${routerModels}`] = { models };
  const request = await refuseOnce(t, router, "PUT", (body) => {
    store.routes[routeKey] = body;
    return body;
  });
  await openSettings(t, phone, theme, "Routing");
  const selector = `[data-route="${mode}"]` + (mode === "decision" ? '[data-dm="levanto"]' : "");
  await page.locator(selector).waitFor();
  if (mode === "off") {
    await page.locator('[data-route="agent"]').focus();
    await page.keyboard.press("ArrowDown");
    await focus(t, '[data-route="decision"][data-dm="levanto"]');
    await page.keyboard.press("ArrowDown");
    await focus(t, selector);
    assert.deepEqual(request.writes, []);
  }
  await doublePress(t, selector, request);
  const error = page.locator('[data-page="routing"] .set-err[role="alert"]');
  await error.waitFor();
  await focus(t, selector);
  assert.equal(request.writes.length, 1);
  assert.equal(await page.locator(selector).getAttribute("aria-checked"), "false");
  await page.keyboard.press(mode === "off" ? "Space" : "Enter");
  await attr(t, selector, "aria-checked", "true");
  await focus(t, selector);
  const expected = { mode, abstain_below: current.abstain_below, ...(mode === "decision" ? { decision_model: "levanto" } : {}) };
  assert.deepEqual(request.writes, [expected, expected]);
  assert.equal(await error.count(), 0);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function connectModel(t, phone, theme) {
  const { page, store } = t;
  const provider = "quill";
  const key = "sk-fixture-key";
  const modelsKey = `GET ${routerModels}`;
  store.routes[modelsKey] = { models };
  const request = await refuseOnce(t, routerModels, "POST", () => {
    const reply = { models: models.map((model) => model.id === provider ? { ...model, connected: true } : model) };
    store.routes[modelsKey] = reply;
    return reply;
  });
  await openSettings(t, phone, theme, "Routing");
  const connect = `[data-dm-on="${provider}"]`;
  const disconnect = `[data-dm-off="${provider}"]`;
  const input = `[data-dm-form="${provider}"] input[name="key"]`;
  const error = page.locator("[data-dm-form] .set-err[role=alert]");
  await page.locator(connect).press("Enter");
  await focus(t, input);
  await page.locator("[data-dm-cancel]").press("Enter");
  await focus(t, connect);
  await page.keyboard.press("Enter");
  await focus(t, input);
  await page.locator(input).fill(key);
  try {
    await page.keyboard.press("Enter");
    await attr(t, "[data-dm-submit]", "aria-busy", "true");
    await page.keyboard.press("Enter");
    await focus(t, input);
  } finally {
    request.release();
  }
  await error.waitFor();
  await focus(t, input);
  assert.equal(request.writes.length, 1);
  assert.equal(await page.locator(input).inputValue(), key);
  await page.keyboard.press("Enter");
  await focus(t, disconnect);
  await page.locator("[data-dm-form]").waitFor({ state: "detached" });
  assert.equal(request.writes.length, 2);
  assert.deepEqual(request.writes[1], request.writes[0]);
  assert.equal(/** @type {{provider: string, api_key: string}} */ (request.writes[0]).api_key, key);
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function disconnectModel(t, phone, theme) {
  const provider = "levanto";
  const modelsKey = `GET ${routerModels}`;
  t.store.routes[modelsKey] = { models };
  const request = await refuseOnce(t, `${routerModels}/${provider}`, "DELETE", () => {
    const reply = { models: models.map((model) => model.id === provider ? { ...model, connected: false } : model) };
    t.store.routes[modelsKey] = reply;
    return reply;
  });
  await openSettings(t, phone, theme, "Routing");
  await confirmRemoval(t, request, {
    button: `[data-dm-off="${provider}"]`, keep: "[data-dm-no]", confirm: `[data-dm-yes="${provider}"]`,
    row: ".set-confirm", next: `[data-dm-on="${provider}"]`, error: ".set-confirm .set-err[role=alert]",
  });
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function revokeRule(t, phone, theme) {
  const { store } = t;
  const rows = ["Keep test output", "Read local configuration"].map((sentence, index) => ({
    id: `r${index + 1}`, sentence, scope: "space", effect: "allow", uses: 0, created_at: store.now,
  }));
  const list = { rules: rows, defaults: [], next_after_seq: null };
  store.routes[`GET ${rules}`] = list;
  const request = await refuseOnce(t, `${rules}/r1`, "DELETE", () => {
    rows.shift();
    return { ok: true };
  });
  await openSettings(t, phone, theme, "Rules");
  await confirmRemoval(t, request, {
    button: '[data-rule-off="r1"]', keep: "[data-rule-no]", confirm: '[data-rule-yes="r1"]',
    row: '[data-key="rule:r1"]', next: '[data-rule-off="r2"]', error: '[data-key="rule:r1"] .set-err[role="alert"]',
  });
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function removeWorktree(t, phone, theme) {
  const { store } = t;
  const rows = ["clean", "last"].map((name) => ({
    chat_id: "chat_demo", thread_ts: `t-${name}`, branch: `xo/thread-${name}`, path: `/demo/.xo/worktrees/${name}`,
    removable: true, would_lose: false, xo: true, exists: true, session_state: "cold", thread_state: "resolved",
  }));
  store.routes[`GET ${worktrees}`] = { worktrees: rows, reported: [] };
  const request = await refuseOnce(t, `${worktrees}/chat_demo/t-clean`, "DELETE", () => {
    rows.shift();
    return { removed: true, forced: false };
  });
  await openSettings(t, phone, theme, "Worktrees");
  await confirmRemoval(t, request, {
    button: '[data-wt="chat_demo/t-clean"]', keep: "[data-wt-no]", confirm: '[data-wt-yes="chat_demo/t-clean"]',
    row: '[data-key="wt:chat_demo/t-clean"]', next: '[data-wt="chat_demo/t-last"]', error: '.wt-confirm .set-err[role="alert"]',
  });
}

/** @typedef {{button: string, keep: string, confirm: string, row: string, next: string, error: string}} Removal */

/** @param {Tools} t @param {{release(): void, writes: unknown[]}} request @param {Removal} selectors */
async function confirmRemoval(t, request, { button, keep, confirm, row, next, error }) {
  const { page } = t;
  await page.locator(button).press("Enter");
  await focus(t, keep);
  await page.keyboard.press("Enter");
  await focus(t, button);
  assert.equal(request.writes.length, 0);
  await page.keyboard.press("Enter");
  await doublePress(t, confirm, request);
  await page.locator(error).waitFor();
  await focus(t, confirm);
  assert.equal(request.writes.length, 1);
  assert.equal(await page.locator(confirm).getAttribute("aria-disabled"), null);
  await page.keyboard.press("Enter");
  await page.locator(row).waitFor({ state: "detached" });
  await focus(t, next);
  assert.equal(request.writes.length, 2);
}

const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) => [
  {
    name: `Settings tab and keybinding keyboard order at ${viewport} ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => tabsAndKeyboard(t, viewport === "phone", theme),
  },
  .../** @type {const} */ (["agent", "decision", "off"]).map((mode) => ({
    name: `Settings routing ${mode} keyboard and refusal at ${viewport} ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => routing(t, viewport === "phone", theme, mode),
  })),
  ...[
    { name: "Rules revoke", run: revokeRule },
    { name: "Worktrees remove", run: removeWorktree },
    { name: "decision model connect", run: connectModel },
    { name: "decision model disconnect", run: disconnectModel },
  ].map((scenario) => ({
    name: `Settings ${scenario.name} confirmation and refusal at ${viewport} ${theme}`, viewport, seed: "basic",
    run: (/** @type {Tools} */ t) => scenario.run(t, viewport === "phone", theme),
  })),
]));
