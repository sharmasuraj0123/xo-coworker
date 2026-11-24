// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { sendBlock } from "../../../core/services/world/conn.js";
import { same, settle } from "../../../tests/lib/dom.mjs";
import { mountSettingsPage } from "../../../tests/lib/settings-page.mjs";
import { createRoutingPage } from "../page.js";

const model = { id: "provider", label: "Provider", model: "Test model" };
const catalog = (connected) => Response.json({ models: [{ ...model, connected }] });
const router = () => Response.json({ mode: "agent" });

async function fixture() {
  const host = await mountSettingsPage("routing");
  const project = { id: "demo", chatId: "chat_demo", routing: { mode: "decision", decision_model: model.id } };
  const notices = [];
  /** @type {import("../types").RoutingOptions["world"] & { state: {loaded: boolean} }} */
  const world = {
    state: { loaded: true, router: null, projects: [project] }, project: () => project,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
  /** @type {Set<() => void>} */
  const listeners = new Set();
  /** @param {import("../types").Router} next */
  function publishRouter(next) {
    world.state.router = next;
    for (const listener of listeners) listener();
  }
  let changes = 0;
  const page = createRoutingPage(host, {
    world, announce: (text) => notices.push(text), PROJ: (id) => id, onChange: () => { changes++; },
  });
  function click(selector, first = false) {
    const target = document.querySelector(selector);
    assert.ok(target, selector);
    target.focus();
    (first ? page.clickFirst : page.click)(target);
  }
  function connect() {
    click("[data-dm-on]", true);
    const input = document.querySelector('[data-dm-form] input[name="key"]');
    input.value = "test-key";
    document.querySelector("[data-dm-submit]").focus();
    page.submit({ target: input.closest("form"), preventDefault() {} });
  }
  return { page, project, world, publishRouter, notices, click, connect, changed: () => changes };
}

test("opening Routing cannot replace the live router with an older Settings snapshot", async () => {
  const { page, publishRouter, world } = await fixture();
  const read = Promise.withResolvers();
  globalThis.fetch = async (input) => String(input).endsWith("/models") ? catalog(false) : read.promise;
  const opening = page.open();
  await settle();
  publishRouter({ mode: "agent" });
  read.resolve(Response.json({ mode: "off" }));
  await opening;
  assert.equal(world.state.router.mode, "agent", "Storm still owns the live routing");
  assert.equal(sendBlock(world.state, { pid: "workspace" }), "", "An old Settings response cannot refuse a new message");
  assert.equal(document.querySelector('[data-route="agent"]').getAttribute("aria-checked"), "true");
  page.dispose();
});

test("a list started before connect cannot replace the connected model", async () => {
  const { page, connect, notices } = await fixture();
  const stale = Promise.withResolvers();
  const post = Promise.withResolvers();
  let listReads = 0, staleSignal;
  globalThis.fetch = async (input, init) => {
    if (init.method === "POST") return post.promise;
    if (!String(input).endsWith("/models")) return router();
    if (++listReads === 1) return catalog(false);
    staleSignal = init.signal;
    return stale.promise;
  };
  await page.open();
  const refresh = page.open();
  await settle();
  connect();
  await settle();
  post.resolve(catalog(true));
  await settle();
  const retired = staleSignal.aborted;
  stale.resolve(catalog(false));
  await refresh;
  await settle();
  assert.equal(retired, true, "connect retires the older list");
  assert.match(document.querySelector(".dm").textContent, /Connected · model Test model/);
  same(document.activeElement, document.querySelector("[data-dm-off]"));
  assert.deepEqual(notices, ["Connected. Its key is saved and won't be shown again."]);
  page.dispose();
});

test("disconnect retires the old list before updating chat overrides", async () => {
  const { page, click, project, notices } = await fixture();
  const stale = Promise.withResolvers();
  const removal = Promise.withResolvers();
  const override = Promise.withResolvers();
  let listReads = 0, staleSignal, patched = false;
  globalThis.fetch = async (input, init) => {
    if (init.method === "DELETE") return removal.promise;
    if (init.method === "PATCH") { patched = true; return override.promise; }
    if (!String(input).endsWith("/models")) return router();
    if (++listReads === 1) return catalog(true);
    staleSignal = init.signal;
    return stale.promise;
  };
  await page.open();
  const refresh = page.open();
  await settle();
  click("[data-dm-off]");
  click("[data-dm-yes]");
  removal.resolve(catalog(false));
  await settle();
  const retired = staleSignal.aborted;
  stale.resolve(catalog(true));
  await refresh;
  override.resolve(Response.json({ routing: null }));
  await settle();
  assert.equal(patched, true);
  assert.equal(retired, true, "disconnect retires the old list while an override is being updated");
  assert.match(document.querySelector(".dm").textContent, /Not connected/);
  assert.equal(project.routing, null);
  same(document.activeElement, document.querySelector("[data-dm-on]"));
  assert.deepEqual(notices, ["Disconnected. Its key is removed."]);
  page.dispose();
});

test("disposing during disconnect aborts the write and fences late effects", async () => {
  const { page, click, project, notices, changed } = await fixture();
  const removal = Promise.withResolvers();
  let writeSignal, patched = false;
  globalThis.fetch = async (input, init) => {
    if (init.method === "DELETE") { writeSignal = init.signal; return removal.promise; }
    if (init.method === "PATCH") { patched = true; return Response.json({ routing: null }); }
    return String(input).endsWith("/models") ? catalog(true) : router();
  };
  await page.open();
  click("[data-dm-off]");
  click("[data-dm-yes]");
  await settle();
  const shown = document.querySelector(".set-live").innerHTML;
  const focus = document.activeElement;
  page.dispose();
  assert.equal(writeSignal.aborted, true);
  removal.resolve(catalog(false));
  await settle();
  assert.equal(patched, false);
  assert.equal(project.routing.decision_model, model.id);
  assert.equal(changed(), 0);
  assert.deepEqual(notices, []);
  assert.equal(document.querySelector(".set-live").innerHTML, shown);
  same(document.activeElement, focus);
});

test("a disconnect refresh cannot roll back a newer Storm routing change", async () => {
  const { page, click, publishRouter, world } = await fixture();
  const refresh = Promise.withResolvers();
  let routerReads = 0;
  globalThis.fetch = async (input, init) => {
    if (init.method === "DELETE") return catalog(false);
    if (init.method === "PATCH") return Response.json({ routing: null });
    if (String(input).endsWith("/models")) return catalog(true);
    return ++routerReads === 1 ? router() : refresh.promise;
  };
  await page.open();
  publishRouter({ mode: "decision", decision_model: model.id });
  click("[data-dm-off]");
  click("[data-dm-yes]");
  await settle();
  assert.equal(routerReads, 2);
  publishRouter({ mode: "off" });
  refresh.resolve(router());
  await settle();
  assert.equal(world.state.router.mode, "off");
  assert.equal(document.querySelector('[data-route="off"]').getAttribute("aria-checked"), "true");
  page.dispose();
});
