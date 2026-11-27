// @ts-check

import assert from "node:assert/strict";
import test from "node:test";
import { dom, settle } from "../../../tests/lib/dom.mjs";
import { fakeApi, fakeTimers, job } from "./fakes.mjs";

const { window, document } = await dom(`<div id="fr"></div>`);
const { createAutomationsStore } = await import("../store.js");
const { createAutomationsFrame } = await import("../frame.js");
const { tile } = await import("../views.js");

const now = () => Date.parse("2026-11-26T08:00:00Z");
const jobs = [
  job({ id: "late", name: "Late check", next_run: "2026-11-26T23:00:00Z" }),
  job({ id: "soon", name: "Soon check", next_run: "2026-11-26T09:00:00Z" }),
  job({ id: "off", name: "Off check", enabled: false, next_run: null, state: "cancelled", state_reason: "Saved turned off." }),
  job({ id: "other", name: "Elsewhere", chat: "chat_b" }),
];
const fake = fakeApi(jobs);
const store = createAutomationsStore({ api: fake.api, report() {}, timeout: fakeTimers().timeout, now });
/** @type {string[]} */
const opened = [], made = [];
let changed = 0;
const frame = createAutomationsFrame({
  store, now, chatOf: (v) => v === "p:a" ? "chat_a" : v === "p:b" ? "chat_b" : null,
  open: (id) => { opened.push(id); }, create: (chat) => { made.push(chat); }, changed: () => { changed++; },
});
const host = /** @type {HTMLElement} */ (document.getElementById("fr"));
const panel = frame.mount(host);

test("a project's automations: its own only, on ones soonest first, off ones last", async () => {
  assert.equal(panel.count("p:a"), 0, "nothing read yet");
  await settle();
  assert.ok(changed > 0, "the panel is asked to redraw once they're read");
  assert.equal(panel.count("p:a"), 3);
  assert.equal(panel.count("p:b"), 1);
  assert.equal(panel.count("home"), 0, "no project, no automations");
  panel.paint("p:a");
  const names = Array.from(host.querySelectorAll(".ag-t b"), (b) => b.textContent);
  assert.deepEqual(names, ["Soon check", "Late check", "Off check"]);
  assert.match(host.querySelector('[data-au-id="off"]')?.textContent ?? "", /Turned off by you.*Off$/);
  assert.equal(fake.calls.filter((c) => c.name === "schedules").length, 1, "read once a minute, not on every draw");
});

test("a row opens its automation; + makes one in this project", () => {
  host.querySelector('[data-au-id="late"]')?.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(opened, ["late"]);
  panel.create("p:b");
  assert.deepEqual(made, ["chat_b"]);
});

test("one being deleted leaves the panel's count at once", () => {
  store.removeLater("soon");
  assert.equal(panel.count("p:a"), 2);
  store.undoRemove("soon");
});

test("a tile's colour key is its own attribute, not the data-k keyed lists use", () => {
  assert.doesNotMatch(tile("nightly"), /\sdata-k=/);
  assert.match(tile("nightly"), /data-au-k="nightly"/);
});

test("disposed, it stops listening", () => {
  panel.dispose();
  host.querySelector('[data-au-id="late"]')?.dispatchEvent(new window.Event("click", { bubbles: true }));
  assert.deepEqual(opened, ["late"]);
});

test("a project's agents: its own first, then the Space's it still sees; one opens as the panel's page", async () => {
  const { createAgentsFrame } = await import("../agent-frame.js");
  const { createPersonasStore } = await import("../personas.js");
  const { fakePersonaApi, persona } = await import("./fakes.mjs");
  const people = fakePersonaApi({ alpha: [persona({ name: "zed" }), persona({ name: "helper", level: "space", path: "helper.md" }),
    persona({ name: "zed", level: "space", path: "zed.md", shadowed: { name: "zed", level: "project" } })] });
  const personas = createPersonasStore({ api: people.api, report() {} });
  /** @type {string[]} */
  const keys = [], news = [];
  const agentsHost = document.createElement("div");
  const agents = createAgentsFrame({ personas, projectOf: (v) => v === "p:a" ? "alpha" : null, changed() {},
    open: (key) => { keys.push(key); }, create: (project) => { news.push(project); } }).mount(agentsHost);
  assert.equal(agents.count("p:a"), 0, "nothing read yet");
  await settle();
  assert.equal(agents.count("p:a"), 2);
  assert.equal(agents.count("home"), 0);
  agents.paint("p:a");
  assert.deepEqual(Array.from(agentsHost.querySelectorAll(".ag-t b"), (b) => b.textContent), ["Zed", "Helper"]);
  agentsHost.querySelector('[data-ag-act="open"]')?.dispatchEvent(new window.Event("click", { bubbles: true }));
  agents.create("p:a");
  assert.deepEqual([keys, news], [["project:alpha:zed"], ["alpha"]]);
  agents.dispose();
});
