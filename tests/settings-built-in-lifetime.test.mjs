import assert from "node:assert/strict";
import { test } from "node:test";
import { createTheme } from "../core/ui/theme.js";
import { createScope } from "../core/kernel/scope.js";
import { createKernel } from "../core/kernel/index.js";
import { createAppServices } from "../shell/app-services.js";
import { routingModule } from "../modules/routing/module.js";
import { rulesModule } from "../modules/rules/module.js";
import { worktreesModule } from "../modules/worktrees/module.js";
import { createSettingsModule } from "../modules/settings/module.js";
import { SETTINGS_PAGE_OPEN } from "../modules/settings/page-events.js";
import { definePlaces } from "../shell/places.js";
import { SETTINGS } from "../shell/overlays.js";
import { deferred, dom, same, settle } from "./lib/dom.mjs";

const settingsModule = createSettingsModule().module;

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
  kernel.register(createAppServices({ world, announce() {}, projectName: (id) => id, currentView: () => "home" }, () => {}));
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

test("the Settings surface retires focus, views and listeners and mounts one replacement", async () => {
  const { document } = await dom(`<button id="set-side">Settings</button><button id="set-phone">Phone Settings</button>${SETTINGS}`);
  const find = (selector) => document.querySelector(selector);
  const root = find("#settings"), opener = find("#set-side");
  const kernel = createKernel();
  definePlaces(kernel);
  kernel.register({
    manifest: {
      id: "test.host", version: "1.0.0", kernel: "^1.1.0", provides: ["announce"], contributes: ["settings.section:test-page"],
    },
    activate(ctx) {
      ctx.provide("announce", () => {});
      ctx.contribute("settings.section", {
        id: "test-page", label: "Test page", icon: "key",
        render(host) {
          const button = document.createElement("button");
          host.append(button);
          return () => button.remove();
        },
      });
    },
  });
  const settings = createSettingsModule({
    el: root, side: opener, phoneButton: find("#set-phone"), closeButton: find("#set-x"),
    phone: matchMedia("(max-width: 760px)"), focusIn: (node) => node.focus(), fallback: () => opener,
    preferences: { THEME: createTheme(createScope(), () => {}).THEME, webPictures: "xo:conversation/webpics",
      shape: { on: () => true, setDevice: () => ({ kept: true }), onChange: () => () => {} } },
    at: () => ({}), mountRuntimes: () => ({ open() {} }), shape: { mount: () => ({ apply() {}, open() {} }) }, beforeOpen() {}, onHidden() {},
  });
  const id = settings.module.manifest.id;
  kernel.register(settings.module);
  const opened = [];
  kernel.bus.on(SETTINGS_PAGE_OPEN, (page) => opened.push(page));
  await kernel.start();
  const keyRows = find("#set-keys-list").childElementCount;
  assert.ok(keyRows > 0);
  opener.focus();
  opener.click();
  find('[data-set="test-page"]').click();
  find('[data-section="test-page"] button').focus();
  await kernel.disable(id);
  assert.equal(kernel.live(id), 0);
  assert.equal(root.hidden, true);
  same(document.activeElement, opener);
  assert.equal(find('[data-set="test-page"]'), null);
  assert.equal(find("#set-keys-list").childElementCount, 0);
  opener.click();
  assert.equal(root.hidden, true);
  await kernel.enable(id);
  assert.equal(document.querySelectorAll('[data-set="test-page"]').length, 1);
  assert.equal(find("#set-keys-list").childElementCount, keyRows);
  opener.click();
  assert.equal(root.hidden, false);
  find('[data-set="keys"]').click();
  assert.deepEqual(opened.filter((page) => page === "keys"), ["keys"]);
  await kernel.disable(id);
});
