// @ts-check

import assert from "node:assert/strict";
import { settle } from "../../../tests/lib/dom.mjs";
import { mountSettingsPage } from "../../../tests/lib/settings-page.mjs";
import { api } from "../../../core/platform/api.js";
import { createRoutingPage } from "../page.js";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const T = await import("../../../core/services/world/timeline.js");
const w = (router, own = null) => ({ loaded: true, runtimes: [], pools: {}, router, projects: [{ id: "workspace", routing: null }, { id: "alpha", routing: own }] });
const OFF = { mode: "off" }, AGENT = { mode: "agent" };

await t("routingOf: a chat's own routing wins over the Space's; without one, the Space's", () => {
  assert.equal(typeof T.routingOf, "function", "timeline.js has routingOf");
  assert.deepEqual(T.routingOf(w(OFF, AGENT), "alpha"), AGENT);
  assert.deepEqual(T.routingOf(w(OFF), "alpha"), OFF);
  assert.deepEqual(T.routingOf(w(AGENT, OFF), "alpha"), OFF);
  assert.deepEqual(T.routingOf(w(OFF, AGENT), "workspace"), OFF);
});
await t("the composer: Space Off refuses a new message only where the Space's routing applies; a chat with its own takes it", () => {
  assert.equal(T.sendBlock(w(OFF, AGENT), { timeline: true, pid: "alpha" }), "", "alpha routes itself: it takes new messages");
  assert.match(T.sendBlock(w(OFF), { timeline: true, pid: "alpha" }), /router is off/i, "alpha uses the Space's: refused, as the server would");
  assert.match(T.sendBlock(w(AGENT, OFF), { timeline: true, pid: "alpha" }), /off/i, "alpha's own Off refuses even with the Space's on");
  assert.equal(T.sendBlock(w(OFF), { timeline: false, pid: "alpha" }), "", "a reply in a thread is never refused (delivery.py's thread path checks no routing)");
});
await t("the line above the composer says Off only where it applies, in words true to the server", () => {
  assert.equal(T.connLine(w(OFF, AGENT), { pid: "alpha" }), null, "no Off line in a chat that routes itself");
  const l = T.connLine(w(OFF), { pid: "alpha" });
  assert.ok(l && /router is off/i.test(l.text), "Off where the Space's routing applies");
  assert.doesNotMatch(l.sub, /Workspace and projects are refused/, "never that every Workspace and project refuses");
  assert.match(l.sub, /using it|use it/, "the chats using it");
  assert.match(l.sub, /threads/, "and that replies in threads still go");
});
await t("Settings' Off explains when it applies and keeps its state inside Routing", async () => {
  const host = await mountSettingsPage("routing");
  api.router = async () => AGENT;
  api.routerModels = async () => ({ models: [] });
  const page = createRoutingPage(host, {
    world: { state: { router: null, projects: [] }, project: () => undefined },
    announce() {},
    PROJ: (id) => id,
    onChange() {},
  });
  try {
    await page.open();
    const words = document.querySelector('[role="radio"][data-route="off"] .sc-b span')?.textContent;
    assert.equal(words, "Chats using this setting refuse new messages; one with its own routing keeps it. Replies inside threads still work.");
  } finally {
    page.dispose();
  }
});
await t("reopening Routing replaces its pending read and keeps the last controls after a failed refresh", async () => {
  const host = await mountSettingsPage("routing");
  const failures = [];
  const original = Object.getOwnPropertyDescriptor(globalThis, "reportError");
  Object.defineProperty(globalThis, "reportError", { configurable: true, value: (error) => failures.push(error.message) });
  const stale = Promise.withResolvers();
  let firstSignal;
  let calls = 0;
  api.router = async ({ signal } = {}) => {
    calls++;
    if (calls === 1) {
      firstSignal = signal;
      return stale.promise;
    }
    if (calls === 2) return OFF;
    throw new Error("Routing store unavailable");
  };
  api.routerModels = async () => ({ models: [] });
  const page = createRoutingPage(host, {
    world: { state: { router: null, projects: [] }, project: () => undefined },
    announce() {},
    PROJ: (id) => id,
    onChange() {},
  });
  const opening = page.open();
  try {
    await settle();
    await page.open();
    assert.equal(firstSignal?.aborted, true);
    stale.resolve(AGENT);
    await opening;
    await page.open();
    assert.deepEqual(failures, ["Routing store unavailable"]);
    assert.equal(document.querySelector('[role="radio"][aria-checked="true"]')?.getAttribute("data-route"), "off");
  } finally {
    stale.resolve(AGENT);
    page.dispose();
    if (original) Object.defineProperty(globalThis, "reportError", original);
    else Reflect.deleteProperty(globalThis, "reportError");
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
