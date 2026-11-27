// @ts-check

// Project settings writes what the picker writes: the routing on the chat, the new threads' policy on its runtime policy.
import assert from "node:assert/strict";
import { dom } from "../../../tests/lib/dom.mjs";

const { window, document } = await dom('<div id="iq-pop" hidden></div>');
const g = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (globalThis));
g.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
const dialog = Object.getPrototypeOf(document.createElement("dialog"));
if (!dialog.showModal) {
  dialog.showModal = function () { this.open = true; };
  dialog.close = function () { if (!this.open) return; this.open = false; this.dispatchEvent(new window.Event("close")); };
}

const { createIntel } = await import("../intel.js");
const { createProjectSettings } = await import("../project-settings.js");
const runtimes = ["claude_code", "codex"].map((name) => ({ name, health: { installed: true, logged_in: true } }));
const project = { chatId: "chat_p", pin: { agent: "claude_code" }, routing: null };
const policies = { space: { allowed: null, default: null, preferences: null, fallback: false }, project: {}, effective: {} };
/** @type {{ chat: string, policy: object }[]} */
const policyWrites = [];
const world = {
  state: { runtimes, router: { mode: "agent" }, policy: { effective: {} }, chatPolicy: { chat_p: policies } },
  project: () => project, thread: () => null,
  act: {
    loadChatPolicy() {}, refresh() {}, fetchThread: async () => null,
    setPolicy: async (/** @type {string} */ chat, /** @type {object} */ policy) => { policyWrites.push({ chat, policy }); return policy; },
  },
};
/** @type {object[]} */
const patches = [];
let holdModels = false;
g.fetch = async (/** @type {string} */ url, /** @type {RequestInit | undefined} */ options) => {
  if (options?.method === "PATCH") { patches.push(JSON.parse(String(options.body))); return Response.json({}); }
  if (String(url).includes("/router/models")) return Response.json({ models: [] });
  if (holdModels) return new Promise(() => {});
  return Response.json({ models: [{ id: "m1", name: "Model one" }] });
};
const intel = createIntel({ world, PROJ: (p) => p, record() {}, onChange() {} });
const settings = createProjectSettings({ world, writes: intel.writes, PROJ: (p) => p, iconOf: () => "" });
const box = /** @type {HTMLElement} */ (document.querySelector("dialog.ps"));
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
/** @param {string} selector */
const click = (selector) => {
  const target = box.querySelector(selector);
  assert.ok(target, selector);
  target.dispatchEvent(new window.Event("click", { bubbles: true }));
};

try {
  await intel.writes.catalog.catalog("claude_code", { signal: new AbortController().signal });
  holdModels = true;
  settings.open("work");
  const models = [...box.querySelectorAll("[data-ps-model] option")].map((o) => o.getAttribute("value"));
  assert.deepEqual(models, ["", "m1"], "it opens with the models it already read, while it reads them again");
  assert.equal(box.querySelector(".ps-body .spin"), null, "nothing says Reading… when the models are known");
  holdModels = false;
  await settle();
  assert.ok(settings.isOpen, "it opens");
  assert.equal(box.querySelector("#ps-title")?.textContent, "Coordinator");
  assert.ok(box.querySelector('[data-ps-route="space"][aria-checked="true"]'), "it follows the Space's routing");

  click('[data-ps-route="off"]');
  await settle(); await settle();
  assert.deepEqual(patches.at(-1), { routing: { mode: "off" } }, "routing is written on the chat");

  click('[data-ps-page="threads"]');
  await settle();
  assert.equal(box.querySelector("#ps-title")?.textContent, "New threads");
  assert.equal(box.querySelector('[data-ps-page="threads"]')?.getAttribute("aria-current"), "page");
  assert.ok(box.querySelector('[data-ps-page="threads"]')?.classList.contains("is-on"), "the shared selected row");

  click('[data-ps-fallback="on"]');
  await settle();
  assert.deepEqual(policyWrites.at(-1), { chat: "chat_p", policy: { allowed: null, default: null, preferences: null, fallback: true } });

  const codex = /** @type {HTMLInputElement} */ (box.querySelector('[data-ps-allowed="codex"]'));
  codex.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
  assert.deepEqual(policyWrites.at(-1)?.policy, { allowed: ["claude_code"], default: null, preferences: null, fallback: null },
    "turning one off keeps the others, as this project's own list");

  const writes = policyWrites.length;
  policies.effective = { allowed: ["claude_code"] };
  settings.sync();
  const last = /** @type {HTMLInputElement} */ (box.querySelector('[data-ps-allowed="claude_code"]'));
  last.dispatchEvent(new window.Event("change", { bubbles: true }));
  await settle();
  assert.equal(policyWrites.length, writes, "the last runtime can't be turned off");
  assert.match(box.querySelector(".rt-ferr")?.textContent || "", /at least one/);

  settings.close();
  assert.equal(settings.isOpen, false, "it closes");
} finally {
  settings.dispose();
  intel.dispose();
}

const { threadsHtml } = await import("../project-settings-view.js");
const reading = document.createElement("div");
reading.innerHTML = threadsHtml(/** @type {import("../project-settings-types.js").PsThreads} */ (/** @type {unknown} */ ({ ready: false })));
assert.ok(reading.querySelector('.m-load[role="status"] > .spin.is-load'), "while it reads, it shows the threads' loader");
assert.equal(reading.querySelector(".set-note"), null, "not a line of words with a small spinner");
