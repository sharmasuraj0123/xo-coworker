// @ts-check

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test } from "node:test";
import { deferred, dom } from "../../../tests/lib/dom.mjs";
import { stageFixture } from "../../../tests/lib/stage-fixture.mjs";

const terminal = { id: "shell", project: "review", name: "Existing shell", status: "running", foreground: "sh", path: "/review/thread" };
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
  const response = deferred(), seen = [], notices = [];
  let transport;
  let changes = 0;
  globalThis.fetch = async (url, options) => {
    const path = new URL(String(url), "https://dock.test/").pathname;
    const method = options?.method;
    seen.push([method, path]);
    if (method === hold && path === target) {
      transport = options?.signal;
      return response.promise;
    }
    if (path === statusRoute) return Response.json({ enabled: true });
    if (path === terminalRoute) return Response.json({ terminals: [terminal] });
    assert.equal(path, `${terminalRoute}/shell`);
    assert.equal(method, "GET");
    return Response.json({ terminal });
  };
  const dock = createShells({ announce: (message) => notices.push(message), notify: (notice) => notices.push(notice.text), onChange: () => changes++ });
  await flush();
  const root = document.getElementById("shd");
  assert.ok(root);
  return { dock, root, response, seen, notices, signal: () => transport, changes: () => changes };
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
  fx.response.resolve(Response.json({ terminal: { ...terminal, id: "late", name: "Late shell" }, ticket: "ticket" }));
  await flush();
  assert.equal(Boolean(fx.root.querySelector("[data-pane]")), false, "a late terminal POST cannot attach after the dock disposes");
  assert.equal(fx.dock.countFor(), 1);
  assert.equal(fx.changes(), changed);
  assert.deepEqual(fx.notices, []);
});

await test("the panel retires a pending worktree lookup", async () => {
  let panelShell;
  const { panel, document, window, visit } = await stageFixture({ shell: (...args) => panelShell(...args), place: () => true });
  document.body.insertAdjacentHTML("beforeend", dockMarkup);
  globalThis.MutationObserver = window.MutationObserver;
  const fx = await mount(document, "GET", worktreeRoute);
  const thread = { id: "thread", chatId: "room", project: "review", title: "Review" };
  ({ panelShell } = createShellPanel({ S: { view: "t:thread" }, STAGE: panel, SH: fx.dock,
    world: { thread: () => thread }, heraldShow() {},
  }));
  visit("t:thread");
  panel.toggle();
  press(document, "[data-stg-shell]");
  assert.ok(fx.signal(), "the Panel Shell button starts the worktree lookup");
  fx.dock.dispose();
  const aborted = fx.signal()?.aborted;
  fx.response.resolve(Response.json({ worktrees: [{ thread_ts: thread.id, path: "/review/thread" }] }));
  await flush();
  assert.equal(aborted, true, "disposing the dock aborts a pending worktree lookup");
  assert.equal(fx.seen.some(([method]) => method === "POST"), false, "a late worktree lookup cannot start a terminal POST");
  assert.equal(Boolean(fx.root.querySelector("[data-pane]")), false, "a late worktree lookup cannot attach an existing shell");
  assert.deepEqual(fx.notices, []);
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
    fx.response.resolve(Response.json({ terminal: { ...terminal, name: "New name" } }));
    await flush();
    assert.equal(fx.changes(), changed, `late ${write} cannot draw the retired dock`);
    assert.equal(fx.root.querySelector(".shl-n")?.textContent, terminal.name);
    assert.deepEqual(fx.notices, []);
  });
}
