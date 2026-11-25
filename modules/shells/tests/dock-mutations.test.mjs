// @ts-check

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { deferred, dom } from "../../../tests/lib/dom.mjs";
import { stageFixture } from "../../../tests/lib/stage-fixture.mjs";
import replies from "../../../core/platform/tests/fixtures/terminal-responses.json" with { type: "json" };

const terminal = {
  ...replies.terminal, id: "shell", scope: "project", project: "review", name: "Existing shell", path: "/review/thread",
};
const terminalRoute = "/api/terminal/sessions";
const statusRoute = "/api/terminal/status";
const worktreeRoute = "/api/chat/worktrees";
const dockMarkup = '<button id="nv-shells"><span class="sh-n"></span></button><aside id="shd"></aside>';
const flush = () => new Promise(setImmediate);
await dom("");
const terminalHook = registerHooks({
  load(url, context, next) {
    if (!url.endsWith("/modules/shells/term.js")) return next(url, context);
    return {
      format: "module", shortCircuit: true,
      source: "export function mountShell() { return { focus() {}, refit() {}, dispose() {} }; }",
    };
  },
});
const { createShells } = await import("../dock.js");
const { createShellPanel } = await import("../panel.js");
terminalHook.deregister();

/** @param {Document} document @param {string} selector */
function press(document, selector) {
  const control = document.querySelector(selector);
  assert.ok(control instanceof HTMLElement, `the dock renders ${selector}`);
  control.click();
}

/** @param {Document} document @param {RequestInit["method"]} hold @param {string} target */
async function mount(document, hold, target) {
  const held = [], seen = [], notices = [];
  let changes = 0;
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url), "https://dock.test/").pathname;
    const method = options?.method;
    seen.push([method, path]);
    if (method === hold && path === target) {
      const pending = { response: deferred(), signal: options?.signal };
      held.push(pending);
      return pending.response.promise;
    }
    if (path === statusRoute) return Response.json(replies.status);
    if (path === terminalRoute) return Response.json({ terminals: [terminal] });
    assert.equal(path, `${terminalRoute}/shell`);
    assert.equal(method, "GET");
    return Response.json({ terminal });
  };
  const dock = createShells({ announce: (message) => notices.push(message), notify: (notice) => notices.push(notice.text), onChange: () => changes++ });
  await flush();
  const root = document.getElementById("shd");
  assert.ok(root);
  return {
    dock, root, held, seen, notices, changes: () => changes,
    get response() { return held.at(-1)?.response; },
    signal: () => held.at(-1)?.signal,
  };
}

const thread = { id: "thread", chatId: "room", project: "review", title: "Review" };
const stageShell = "[data-stg-shell]";
const matchingTree = () => Response.json({ worktrees: [{ thread_ts: thread.id, path: terminal.path }] });

async function mountStage(hold, target, view = "t:thread") {
  let panelShell;
  const { panel, document, window, visit } = await stageFixture({ shell: (...args) => panelShell(...args), place: () => true });
  document.body.insertAdjacentHTML("beforeend", dockMarkup);
  globalThis.MutationObserver = window.MutationObserver;
  const fx = await mount(document, hold, target);
  const relocation = createShellPanel({ view: () => view, STAGE: panel, SH: fx.dock,
    world: { thread: () => thread }, heraldShow() {},
  });
  panelShell = relocation.panelShell;
  visit(view);
  panel.toggle();
  return { fx, panel, document, relocation };
}

await test("the dock retires a pending terminal open", async () => {
  const { document } = await dom(dockMarkup);
  const fx = await mount(document, "POST", terminalRoute);
  press(document, "#nv-shells");
  await flush();
  press(document, "[data-sh-new]");
  assert.equal(fx.seen.filter(([method]) => method === "POST").length, 1, "New shell starts one POST");
  fx.dock.dispose();
  const changed = fx.changes();
  assert.equal(fx.signal()?.aborted, false, "an issued terminal POST can finish server-side");
  fx.response.resolve(Response.json({ terminal: { ...terminal, id: "late", name: "Late shell" }, ...replies.ticket }));
  await flush();
  assert.equal(Boolean(fx.root.querySelector("[data-pane]")), false, "a late terminal POST cannot attach after the dock disposes");
  assert.equal(fx.dock.countFor(), 1);
  assert.equal(fx.changes(), changed);
  assert.deepEqual(fx.notices, []);
});

await test("the panel retires a pending worktree lookup", async () => {
  const { fx, document, relocation } = await mountStage("GET", worktreeRoute);
  press(document, stageShell);
  assert.ok(fx.signal(), "the Panel Shell button starts the worktree lookup");
  fx.dock.dispose();
  const aborted = fx.signal()?.aborted;
  fx.response.resolve(matchingTree());
  await flush();
  assert.equal(aborted, true, "disposing the dock aborts a pending worktree lookup");
  assert.equal(fx.seen.some(([method]) => method === "POST"), false, "a late worktree lookup cannot start a terminal POST");
  assert.equal(Boolean(fx.root.querySelector("[data-pane]")), false, "a late worktree lookup cannot attach an existing shell");
  assert.deepEqual(fx.notices, []);
  relocation.dispose();
});

for (const [behavior, result] of [
  ["attach a matching terminal", matchingTree],
  ["create a terminal when nothing matches", () => Response.json({ worktrees: [] })],
]) await test(`closing Stage Shells retires a lookup that would ${behavior}`, async (context) => {
  const { fx, panel, document, relocation } = await mountStage("GET", worktreeRoute);
  context.after(() => { relocation.dispose(); fx.dock.dispose(); });
  press(document, stageShell);
  assert.equal(fx.held.length, 1, "the first open reaches the real worktree transport");
  const first = fx.held[0];
  press(document, stageShell);
  assert.equal(panel.isShell, false);
  assert.equal(first.signal.aborted, true, "leaving Stage cancels the held lookup while the dock stays live");
  press(document, stageShell);
  assert.equal(fx.held.length, 2, "reopening uses a fresh worktree transport");
  const fresh = fx.held[1];
  assert.equal(fresh.signal.aborted, false);
  first.response.resolve(result());
  await flush();
  assert.equal(fx.root.hidden, true, "the retired lookup does not reopen the dock while the new lookup is pending");
  assert.equal(!!fx.root.querySelector("[data-pane]"), false, "the retired lookup does not attach a terminal");
  assert.equal(fx.seen.some(([method]) => method === "POST"), false, "the retired lookup does not issue a POST");
  assert.equal(panel.isShell, true, "the new Stage page is still active");
  fresh.response.resolve(matchingTree());
  await flush();
  assert.equal(fx.root.hidden, false);
  assert.ok(fx.root.querySelector('[data-pane="shell"]'), "the fresh lookup can attach normally");
});

await test("replacing Stage retires its worktree lookup while the dock stays live", async (context) => {
  const { fx, panel, document, relocation } = await mountStage("GET", worktreeRoute);
  context.after(() => { relocation.dispose(); fx.dock.dispose(); });
  press(document, stageShell);
  assert.equal(fx.held.length, 1);
  assert.equal(panel.show("shell", "t:thread"), true);
  assert.equal(fx.held.length, 2, "showing a new Shell page starts its own lookup");
  const [previous, current] = fx.held;
  assert.equal(previous.signal.aborted, true, "replacing the Shell page aborts its previous lookup");
  assert.equal(current.signal.aborted, false);
  previous.response.resolve(matchingTree());
  await flush();
  assert.equal(!!fx.root.querySelector("[data-pane]"), false, "a replaced lookup cannot attach through the live dock");
  current.response.resolve(matchingTree());
  await flush();
  assert.ok(fx.root.querySelector('[data-pane="shell"]'), "the replacement can attach normally");
});

await test("disposing Stage retires its worktree lookup while the dock stays live", async (context) => {
  const { fx, document, relocation } = await mountStage("GET", worktreeRoute);
  context.after(() => { relocation.dispose(); fx.dock.dispose(); });
  press(document, stageShell);
  assert.equal(fx.held.length, 1);
  const [current] = fx.held;
  relocation.dispose();
  assert.equal(current.signal.aborted, true, "disposing Stage's relocation aborts its latest lookup");
  current.response.resolve(matchingTree());
  await flush();
  assert.equal(fx.dock.enabled, true);
  assert.equal(!!fx.root.querySelector("[data-pane]"), false, "a disposed Stage lookup cannot attach through the live dock");
  assert.equal(fx.seen.some(([method]) => method === "POST"), false);
});

await test("closing Stage Shells retires the UI result of an issued terminal POST", async (context) => {
  const { fx, panel, document, relocation } = await mountStage("POST", terminalRoute, "p:new");
  context.after(() => { relocation.dispose(); fx.dock.dispose(); });
  press(document, stageShell);
  assert.equal(fx.held.length, 1, "the first open issues a POST");
  const first = fx.held[0];
  press(document, stageShell);
  assert.equal(first.signal.aborted, false, "a sent POST remains live server-side");
  press(document, stageShell);
  assert.equal(fx.held.length, 2, "closing a pending open frees the dock to open the new view");
  first.response.resolve(Response.json({ terminal: { ...terminal, id: "retired", project: "new" }, ...replies.ticket }));
  await flush();
  assert.equal(fx.dock.countFor("new"), 0, "the retired POST does not upsert a tab or change the last known list");
  assert.equal(!!fx.root.querySelector("[data-pane]"), false, "the retired POST does not attach");
  assert.deepEqual(fx.notices, []);
  assert.equal(panel.isShell, true);
  fx.held[1].response.resolve(Response.json({ terminal: { ...terminal, id: "fresh", project: "new" }, ...replies.ticket }));
  await flush();
  assert.ok(fx.root.querySelector('[data-pane="fresh"]'), "the fresh POST can attach normally");
  assert.equal(fx.dock.countFor("new"), 1);
  assert.equal(fx.notices.length, 1);
});

await test("the dock retires the Close preflight read", async () => {
  const { document } = await dom(dockMarkup);
  const fx = await mount(document, "GET", `${terminalRoute}/shell`);
  press(document, "#nv-shells");
  await flush();
  press(document, "[data-sh-close]");
  assert.ok(fx.signal(), "Close starts a fresh terminal read");
  fx.dock.dispose();
  const aborted = fx.signal()?.aborted;
  fx.response.resolve(Response.json({ terminal }));
  await flush();
  assert.equal(aborted, true, "disposing the dock aborts the Close preflight read");
  assert.equal(fx.seen.some(([method]) => method === "DELETE"), false, "a late Close preflight cannot issue a write");
  assert.equal(Boolean(fx.root.querySelector("[data-sh-yes]")), false);
});

for (const write of ["PATCH", "DELETE"]) {
  await test(`the dock retires a pending ${write}`, async () => {
    const { document, window } = await dom(dockMarkup);
    window.HTMLElement.prototype.select = () => {};
    const fx = await mount(document, write, `${terminalRoute}/shell`);
    press(document, "#nv-shells");
    await flush();
    if (write === "PATCH") {
      press(document, "[data-sh-rename]");
      const name = document.querySelector("[data-sh-name]");
      assert.equal(name?.localName, "input");
      name.value = "New name";
      name.dispatchEvent(Object.assign(new window.Event("keydown", { bubbles: true, cancelable: true }), { key: "Enter" }));
    } else press(document, "[data-sh-close]");
    await flush();
    assert.equal(fx.seen.some(([method]) => method === write), true);
    fx.dock.dispose();
    const changed = fx.changes();
    assert.equal(fx.signal()?.aborted, false);
    const reply = write === "PATCH" ? { terminal: { ...terminal, name: "New name" } } : { ok: true, closed: terminal.id };
    fx.response.resolve(Response.json(reply));
    await flush();
    assert.equal(fx.changes(), changed, `late ${write} cannot draw the retired dock`);
    assert.equal(fx.root.querySelector(".shl-n")?.textContent, terminal.name);
    assert.deepEqual(fx.notices, []);
  });
}
