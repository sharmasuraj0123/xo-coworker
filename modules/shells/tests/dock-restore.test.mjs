// @ts-check

import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";
import { deferred, dom } from "../../../tests/lib/dom.mjs";

await dom("");
const hook = registerHooks({
  load(url, context, next) {
    if (!url.endsWith("/modules/shells/term.js")) return next(url, context);
    const source = "export function mountShell() { return { focus() {}, refit() {}, dispose() {} }; }";
    return { format: "module", shortCircuit: true, source };
  },
});
const { createShells } = await import("../dock.js");
hook.deregister();
const flush = () => new Promise(setImmediate);
const old = { id: "old", project: "saved", status: "running", name: "Saved" };
const fresh = { id: "fresh", status: "running", name: "Fresh" };
const snapshot = { tabs: [old.id], active: old.id, filter: old.project, open: true };

async function mount() {
  const markup = '<button id="nv-shells"><span class="sh-n"></span></button><aside id="shd"></aside>';
  const { document } = await dom(markup);
  const root = document.getElementById("shd");
  const storage = new Map([["xo-shells", JSON.stringify(snapshot)]]);
  globalThis.sessionStorage = { getItem: storage.get.bind(storage), setItem: storage.set.bind(storage) };
  globalThis.reportError = () => {};
  const listing = deferred(), opening = deferred();
  let reads = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).endsWith("/status")) return Response.json({ enabled: true });
    if (options?.method === "POST") return opening.promise;
    if (++reads === 1) return Response.json({ error: "list unavailable" }, { status: 500 });
    return listing.promise;
  };
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 100 });
  const dock = createShells();
  await flush();
  const active = () => root.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-sh-tab");
  function saved() { return JSON.parse(storage.get("xo-shells")); }
  async function recover() {
    listing.resolve(Response.json({ terminals: [old, fresh] }));
    await flush();
  }
  return { dock, document, root, active, saved, recover, opening, dispose() { dock.dispose(); mock.timers.reset(); } };
}

await test("an untouched dock restores the saved tabs after the first successful retry", async () => {
  const fx = await mount();
  try {
    assert.equal(fx.dock.available, true, "status enables controls despite the first list failure");
    assert.equal(fx.root.hidden, true, "a failed list leaves the saved view pending");
    assert.deepEqual(fx.saved(), snapshot);
    mock.timers.tick(60_000);
    await fx.recover();
    assert.equal(fx.root.hidden, false);
    assert.equal(fx.active(), old.id);
    assert.deepEqual(fx.saved(), snapshot);
  } finally { fx.dispose(); }
});

await test("opening the dock while reads are failing replaces the saved view", async () => {
  const fx = await mount();
  try {
    fx.document.getElementById("nv-shells").click();
    assert.equal(fx.active(), "list");
    await fx.recover();
    assert.equal(fx.active(), "list", "the retry cannot select the saved tab over the current list");
    assert.equal(Boolean(fx.root.querySelector('[data-pane="old"]')), false);
    assert.equal(fx.saved().filter, null);
    assert.equal(fx.saved().open, true);
  } finally { fx.dispose(); }
});

await test("an accepted fresh-shell request supersedes restore before its POST completes", async () => {
  const fx = await mount();
  try {
    mock.timers.tick(60_000);
    await flush();
    const opened = fx.dock.openWorkspace({ fresh: true });
    await fx.recover();
    assert.equal(fx.root.hidden, true, "the retry cannot reopen a saved dock during a fresh request");
    fx.opening.resolve(Response.json({ terminal: fresh, ticket: "test-ticket" }));
    await opened;
    assert.equal(fx.active(), fresh.id);
    assert.deepEqual(fx.saved(), { tabs: [fresh.id], active: fresh.id, filter: null, open: true });
  } finally { fx.dispose(); }
});
