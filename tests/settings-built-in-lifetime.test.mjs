import assert from "node:assert/strict";
import { test } from "node:test";
import { createKernel } from "../core/kernel/index.js";
import { createAppServices } from "../shell/app-services.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { SETTINGS_PAGE_OPEN, settingsModule } from "../modules/settings/module.js";
import { deferred, dom, same, settle } from "./lib/dom.mjs";

test("Settings retires each built-in read and its keyboard controls together", async (t) => {
  const ids = ["routing", "rules", "worktrees"];
  const pages = ids.map((id) => `<section data-page="${id}"><div class="set-live"></div></section>`).join("");
  const { document, window } = await dom(`<div id="settings">${pages}
    <div role="radiogroup"><button role="radio" aria-checked="true">First</button>
    <button role="radio" aria-checked="false">Second</button></div></div>`);
  const reads = new Map();
  let requestCount = 0;
  t.mock.method(globalThis, "fetch", (url, init) => {
    requestCount++;
    const route = new URL(url, "http://local").pathname;
    const reply = deferred();
    reads.set(route, { signal: init.signal, reply });
    return reply.promise;
  });
  let subscribers = 0;
  const world = {
    state: { projects: [] },
    act: {},
    thread: () => undefined,
    project: () => null,
    subscribe() { subscribers++; return () => { subscribers--; }; },
  };
  const kernel = createKernel();
  kernel.register(createAppServices({ world, announce() {}, projectName: (id) => id }, () => {}));
  for (const module of [settingsModule, routingModule, rulesModule, worktreesModule]) kernel.register(module);
  await kernel.start();
  t.after(async () => {
    await kernel.disable(settingsModule.manifest.id);
    for (const { reply } of reads.values()) reply.resolve(Response.json({ mode: "off" }));
  });
  const open = (id) => kernel.bus.emit(SETTINGS_PAGE_OPEN, id);
  for (const id of ids) open(id);
  await settle();
  const routes = ["/api/chat/router", "/api/chat/router/models", "/api/chat/rules", "/api/chat/worktrees"];
  assert.deepEqual([...reads.keys()].sort(), [...routes].sort());
  assert.equal(subscribers, 1);
  const [first, second] = document.querySelectorAll('[role="radio"]');
  const right = () => first.dispatchEvent(Object.assign(
    new window.Event("keydown", { bubbles: true, cancelable: true }), { key: "ArrowRight" },
  ));
  first.focus();
  assert.equal(right(), false);
  same(document.activeElement, second);

  const root = document.getElementById("settings");
  const painted = root.innerHTML;
  await kernel.disable(settingsModule.manifest.id);
  assert.equal(subscribers, 0, "disposing Settings removes Routing's subscription");
  for (const path of routes) assert.equal(reads.get(path).signal.aborted, true, `disposing Settings aborts ${path}`);
  first.focus();
  assert.equal(right(), true, "disposed radio controls no longer intercept the key");
  same(document.activeElement, first);
  for (const { reply } of reads.values()) reply.resolve(Response.json({ mode: "off" }));
  for (const id of ids) open(id);
  await settle();
  assert.equal(requestCount, routes.length);
  assert.equal(root.innerHTML, painted, "retired pages ignore late results");
});
