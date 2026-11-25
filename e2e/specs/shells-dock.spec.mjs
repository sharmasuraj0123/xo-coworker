// @ts-check

import assert from "node:assert/strict";

/** @import { Case, Tools } from "../lib/types.d.ts" */

/** @typedef {{id: string, name: string}} Terminal */

/** @typedef {{refuse: boolean, creates: number, closed: string[], mode: "ready" | "exit" | "retry", hold?: Promise<void>}} ShellState */

/** @typedef {{url(): string, method(): string, postDataJSON(): unknown}} Request */

/** @typedef {{status?: number, json?: unknown}} Reply */

/** @typedef {{request(): Request, fulfill(response: Reply): Promise<void>, abort(code: string): Promise<void>}} Route */

/** @typedef {{send(value: string | Buffer): void, close(options: {code: number, reason?: string}): void}} Socket */

/** @typedef {Socket & {onMessage(handler: (value: string | Buffer) => void): void}} WebSocketRoute */

const sessions = "/api/terminal/sessions";
const routePrefix = `**${sessions}`;
const first = "sh_1";
const second = "sh_2";
const tabList = '[data-sh-tab="list"]';
const confirmation = ".shd-confirm";

/** @param {Tools} t @param {ShellState} state @param {boolean} empty */
async function installShells(t, state, empty) {
  const { page, store } = t;
  const fixtures = ["demo", "api", "web"].map((name, index) => ({
    id: `sh_${index + 1}`, name, scope: "workspace", project: null, status: "running", viewers: 0,
    cwd: "/fixture", path: null, foreground: index === 0 ? "npm" : "bash", created_at: store.now,
    exit_code: null, ended_reason: null, size: { rows: 24, cols: 80 }, last_attached_at: null, last_output_at: null,
    detached_since: null, closes_at: null, ended_at: null,
  }));
  const rows = new Map(empty ? [] : fixtures.map((row) => [row.id, row]));
  store.routes["GET /api/terminal/status"] = {
    enabled: true, reason: null, max_sessions: 8, detached_ttl_seconds: 3600, running: rows.size, attached: 0,
  };
  await page.route(routePrefix, async (/** @type {Route} */ route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { terminals: [...rows.values()] } });
    state.creates++;
    await state.hold;
    if (state.refuse) return route.abort("connectionrefused");
    const terminal = fixtures[0];
    rows.set(terminal.id, terminal);
    return route.fulfill({ json: { terminal, ticket: "shell-fixture", ticket_expires_in: 30 } });
  });
  await page.route(`${routePrefix}/*`, (/** @type {Route} */ route) => {
    const request = route.request();
    const id = new URL(request.url()).pathname.split("/").at(-1) || "";
    const terminal = rows.get(id);
    if (!terminal) return route.fulfill({ status: 404 });
    if (request.method() === "GET") return route.fulfill({ json: { terminal } });
    if (state.refuse) return route.abort("connectionrefused");
    if (request.method() === "PATCH") {
      const body = request.postDataJSON();
      assert.ok(body && typeof body === "object" && "name" in body && typeof body.name === "string");
      terminal.name = body.name;
      return route.fulfill({ json: { terminal } });
    }
    assert.equal(request.method(), "DELETE");
    state.closed.push(id);
    rows.delete(id);
    return route.fulfill({ json: { ok: true, closed: id } });
  });
  await page.route(`${routePrefix}/*/attach`, (/** @type {Route} */ route) =>
    route.fulfill({ json: { ticket: "shell-fixture", ticket_expires_in: 30 } }));
  for (const terminal of fixtures) {
    await page.routeWebSocket(`${routePrefix}/${terminal.id}/ws`, (/** @type {WebSocketRoute} */ socket) => {
      socket.onMessage((message) => answerShell(socket, message, terminal, state.mode));
    });
  }
}

/** @param {Socket} socket @param {string | Buffer} message @param {Terminal} terminal @param {ShellState["mode"]} mode */
function answerShell(socket, message, terminal, mode) {
  if (typeof message !== "string") return;
  const { type } = JSON.parse(message);
  if (mode === "exit" && type === "resize") {
    socket.send(JSON.stringify({ type: "exit", code: 0 }));
    socket.close({ code: 1000, reason: "exited" });
  }
  if (type !== "auth") return;
  if (mode === "retry") return socket.close({ code: 1011 });
  socket.send(JSON.stringify({ type: "ready", terminal }));
  socket.send(Buffer.from("Fixture shell ready\r\n"));
}

/** @param {Tools} t @param {boolean} phone @param {string} theme */
async function openDock(t, phone, theme) {
  await t.page.addInitScript((/** @type {string} */ value) => localStorage.setItem("cv-theme", value), theme);
  await t.open();
  if (phone) await t.page.locator("#pb-menu, #top-menu").filter({ visible: true }).first().click();
  await t.page.locator("#nv-shells").click();
  await t.page.locator("#shd").waitFor();
}

/** @param {Tools} t @param {string} id */
async function attach(t, id) {
  await t.page.locator(`[data-sh-open="${id}"]`).click();
  await ready(t, id);
}

/** @param {Tools} t @param {string} id */
async function ready(t, id) {
  await t.page.locator(`.shd-term[data-pane="${id}"] .xterm-rows`).getByText("Fixture shell ready").waitFor();
}

/** @param {Tools} t @param {string} selector */
async function focus(t, selector) {
  await t.page.waitForFunction((/** @type {string} */ target) => !!document.activeElement?.matches(target), selector);
}

/** @param {Tools} t @param {RegExp} words */
async function announced(t, words) {
  await t.page.locator("#live").filter({ hasText: words }).waitFor({ state: "attached" });
}

/** @param {Tools} t @param {ShellState} state @param {boolean} phone */
async function tabsAndRename(t, state, phone) {
  const { page } = t;
  const sidebar = page.locator("#nv-shells");
  assert.equal(await sidebar.getAttribute("aria-pressed"), "true");
  assert.match(await sidebar.getAttribute("aria-label"), /Shells, 3 running/);

  /** @param {Element[]} nodes */
  const inspectDots = (nodes) => nodes.map((node) => {
    const color = getComputedStyle(node).backgroundColor;
    const parts = color.match(/[\d.]+/g)?.map(Number) || [];
    const [r, g, b, a = 1] = parts;
    const scale = color.startsWith("color(") ? 255 : 1;
    return { detached: node.classList.contains("d-away"), blue: a > 0 && (b - Math.max(r, g)) * scale > 30 };
  });

  /** @type {ReturnType<typeof inspectDots>} */
  const dots = await page.locator(".shl-row .shd-dot").evaluateAll(inspectDots);
  assert.ok(dots.some((dot) => dot.detached));
  assert.ok(dots.every((dot) => !dot.blue));
  await attach(t, first);
  const close = page.locator(`.shd-acts [data-sh-close="${first}"]`);
  assert.equal((await close.innerText()).trim(), phone ? "Close" : "Close shell");
  assert.equal(await page.locator(".shd-acts [data-sh-min]").isVisible(), !phone);
  await rename(t, state);
  await page.locator(tabList).click();
  await attach(t, second);
  await page.locator(tabList).focus();
  const targets = [["End", second], ["Home", "list"], ["ArrowRight", first], ["ArrowLeft", "list"]];
  for (const [key, id] of targets) {
    await page.keyboard.press(key);
    await focus(t, `[data-sh-tab="${id}"]`);
  }
}

/** @param {Tools} t @param {ShellState} state */
async function rename(t, state) {
  const { page } = t;
  const edit = page.locator(`.shd-acts [data-sh-rename="${first}"]`);
  const tab = `[data-sh-tab="${first}"]`;
  const input = page.locator(".shd-tabw.is-edit [data-sh-name]");
  for (const [name, key, expected] of [["cancelled", "Escape", "demo"], ["saved", "Enter", "saved"]]) {
    await edit.click();
    await focus(t, ".shd-tabw.is-edit [data-sh-name]");
    assert.equal(await input.inputValue(), "demo");
    await input.fill(name);
    await page.keyboard.press(key);
    await page.locator(tab).getByText(expected, { exact: true }).waitFor();
    await focus(t, tab);
  }
  state.refuse = true;
  await edit.click();
  await input.fill("retained");
  await page.keyboard.press("Enter");
  await announced(t, /Couldn't rename the shell/);
  await focus(t, ".shd-tabw.is-edit [data-sh-name]");
  assert.equal(await input.inputValue(), "retained");
  await page.keyboard.press("Escape");
  await page.locator(tab).getByText("saved", { exact: true }).waitFor();
}

/** @param {Tools} t @param {ShellState} state */
async function closeShells(t, state) {
  const { page } = t;
  const row = `.shl-row [data-sh-close="${first}"]`;
  const next = `.shl-row [data-sh-close="${second}"]`;
  const asking = page.locator(".shl-row.is-asking");
  await page.locator(row).click();
  await asking.getByText(/npm is running in it/).waitFor();
  assert.equal(await page.locator(confirmation).isHidden(), true);
  await focus(t, ".shl-row [data-sh-no]");
  await page.keyboard.press("Escape");
  await asking.waitFor({ state: "hidden" });
  await focus(t, row);
  await attach(t, first);
  const bar = `.shd-acts [data-sh-close="${first}"]`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.locator(bar).click();
    await page.locator(confirmation).getByText(/npm is running in demo/).waitFor();
    await focus(t, `${confirmation} [data-sh-no]`);
    await page.keyboard.press("Enter");
    await page.locator(confirmation).waitFor({ state: "hidden" });
    await focus(t, bar);
  }
  assert.deepEqual(state.closed, []);
  await page.locator(tabList).click();
  await page.locator(row).click();
  await asking.locator("[data-sh-yes]").press("Enter");
  await page.locator(row).waitFor({ state: "detached" });
  await focus(t, next);
  assert.deepEqual(state.closed, [first]);
  await attach(t, second);
  state.refuse = true;
  const refused = `.shd-acts [data-sh-close="${second}"]`;
  await page.locator(refused).press("Enter");
  await announced(t, /Couldn't close .*still running/);
  await focus(t, refused);
  await ready(t, second);
  await page.locator(tabList).click();
  assert.equal(await page.locator(next).count(), 1);
  assert.deepEqual(state.closed, [first]);
}

/** @param {Tools} t @param {ShellState} state */
async function createShell(t, state) {
  const { page } = t;
  const control = page.locator("[data-sh-new]");
  const pending = /** @type {ReturnType<typeof Promise.withResolvers<void>>} */ (Promise.withResolvers());
  state.hold = pending.promise;
  try {
    await control.click();
    await control.getByText("Opening…").waitFor();
    assert.equal(await control.getAttribute("aria-disabled"), "true");
    await control.press("Enter");
  } finally {
    pending.resolve();
  }
  await ready(t, first);
  assert.equal(state.creates, 1);
  await page.locator(tabList).click();
  state.refuse = true;
  await control.press("Enter");
  await announced(t, /Couldn't open/);
  await focus(t, "[data-sh-new]");
  assert.equal(state.creates, 2);
}

/** @param {Tools} t @param {ShellState} state */
async function retryAndExit(t, state) {
  const { page } = t;
  state.mode = "retry";
  await page.locator(`[data-sh-open="${first}"]`).click();
  const countdown = await page.waitForFunction(() => {
    const current = Number(document.querySelector(".shd-note [data-left]")?.textContent);
    return current >= 3 && current;
  });
  const initial = await countdown.jsonValue();
  await page.clock.setFixedTime(new Date(Date.parse(t.store.now) + 1000));
  await page.waitForFunction((/** @type {number} */ before) => {
    const current = Number(document.querySelector(".shd-note [data-left]")?.textContent);
    return current > 0 && current < before;
  }, initial);
  state.mode = "ready";
  await page.locator("[data-sh-retry]").press("Enter");
  await ready(t, first);
  await focus(t, ".xterm-helper-textarea");
  await page.locator(tabList).click();
  state.mode = "exit";
  await page.locator(`[data-sh-open="${second}"]`).click();
  const pane = page.locator(`.shd-term[data-pane="${second}"].is-ended`);
  await pane.waitFor();
  await page.locator(".shd-note").getByText("This shell exited.").waitFor();
  await page.waitForFunction(() => !document.querySelector(".shd-term.is-ended .xterm-cursor"));
  await page.locator(".shd-note").getByRole("button", { name: "Close tab" }).click();
  await pane.waitFor({ state: "detached" });
}

/** @param {Tools} t @param {ShellState} state @param {boolean} phone */
async function closeDetached(t, state, phone) {
  const { page } = t;
  const button = "[data-sh-closedet]";
  const confirm = page.locator(confirmation);
  await page.locator(button).press("Enter");
  await confirm.getByText(/Close 3 detached shells\?/).waitFor();
  await focus(t, `${confirmation} [data-sh-no]`);
  await page.keyboard.press("Escape");
  await focus(t, button);
  assert.deepEqual(state.closed, []);
  await page.keyboard.press("Enter");
  await confirm.getByRole("button", { name: "Close 3" }).press("Enter");
  await page.locator(".shl-row").first().waitFor({ state: "detached" });
  assert.deepEqual([...state.closed].sort(), ["sh_1", "sh_2", "sh_3"]);
  await page.waitForFunction(() => !!document.activeElement?.closest("#shd"));
  if (!phone) {
    const min = "[data-sh-min]";
    await page.locator(min).press("Enter");
    await page.locator("#shd.is-min").waitFor();
    await focus(t, min);
    await page.keyboard.press("Enter");
    await page.locator("#shd.is-min").waitFor({ state: "detached" });
    await focus(t, min);
  }
  await page.locator("[data-sh-hide]").press("Enter");
  await page.locator("#shd").waitFor({ state: "hidden" });
  await focus(t, "#home");
  assert.equal(await page.locator("#home").isVisible(), true);
}

const scenarios = [
  { name: "dock navigation, status dots, tab keys and rename recovery", run: tabsAndRename },
  { name: "busy Shells confirm and refused close recovery", run: closeShells },
  { name: "pending and refused New shell", run: createShell, empty: true },
  { name: "terminal retry, focus and exit", run: retryAndExit },
  { name: "close detached shells and move focus through minimise and hide", run: closeDetached },
];

const viewports = /** @type {const} */ (["desktop", "phone"]);

/** @type {Omit<Case, "file">[]} */
export const cases = viewports.flatMap((viewport) => ["dark", "light"].flatMap((theme) =>
  scenarios.map((scenario) => ({
    name: `${scenario.name} at ${viewport} ${theme}`, viewport, seed: "basic",
    async run(/** @type {Tools} */ t) {

      /** @type {ShellState} */
      const state = { refuse: false, creates: 0, closed: [], mode: "ready" };
      await installShells(t, state, !!scenario.empty);
      await openDock(t, viewport === "phone", theme);
      await scenario.run(t, state, viewport === "phone");
    },
  }))
));
