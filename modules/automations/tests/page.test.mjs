// @ts-check

import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";
import { fakeApi, fakeTimers, job } from "./fakes.mjs";

const { window, document } = await dom(`<section id="auto"></section>`);
const { createAutomationsStore } = await import("../store.js");
const { createAutomationsPage } = await import("../page.js");
const { createSide } = await import("../side.js");

const now = () => Date.parse("2026-11-26T08:00:00Z");
const jobs = [
  job(),
  job({ id: "j2", name: "Nightly build", next_run: "2026-11-26T23:00:00Z" }),
  job({ id: "j3", name: "Old check", enabled: false, next_run: null, state: "cancelled",
    state_reason: "Its project was removed." }),
];
const fake = fakeApi(jobs), timers = fakeTimers();
const store = createAutomationsStore({ api: fake.api, report() {}, timeout: timers.timeout, now });
const projects = () => [{ chat: "chat_a", name: "Alpha" }];
/** @type {string[]} */
const said = [];
const deps = { projectName: () => "Alpha", projects, failed() {}, announce: (/** @type {string} */ w) => { said.push(w); }, now };
const page = createAutomationsPage({ ...deps, store,
  side: ({ shown }) => createSide({ ...deps, store, where: "page", shown, openThread() {} }) });
const host = /** @type {HTMLElement} */ (document.getElementById("auto"));
page.mount(host);
page.render();
await settle();

let passed = 0;
/** @param {string} name @param {() => Promise<void> | void} fn */
const t = async (name, fn) => {
  try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e); process.exitCode = 1; }
};
/** @param {string} selector */
const click = async (selector) => {
  const el = host.querySelector(selector);
  assert.ok(el, `nothing matches ${selector}`);
  el.dispatchEvent(new window.Event("click", { bubbles: true }));
  await settle();
};
const names = () => [...host.querySelectorAll(".au-main .au-list:first-of-type .au-row .au-n b")].map((b) => b.textContent);
const aside = () => /** @type {HTMLElement} */ (host.querySelector(".au-side"));

await t("Upcoming lists what's on by day; Off lists what's off with why", async () => {
  assert.deepEqual(names(), ["Morning check", "Nightly build"]);
  assert.equal(host.querySelector(".au-day")?.textContent?.startsWith("Today"), true);
  await click('[data-au-tab="off"]');
  assert.deepEqual(names(), ["Old check"]);
  assert.match(host.querySelector(".au-row .au-r")?.textContent ?? "", /project was removed/);
  await click('[data-au-tab="upcoming"]');
});

await t("a row opens beside the list, and Esc closes it", async () => {
  await click('[data-au-act="open"][data-au-id="j2"]');
  assert.equal(aside().hidden, false);
  assert.equal(aside().querySelector("#au-det-h")?.textContent, "Nightly build");
  assert.ok(fake.calls.some((c) => c.name === "scheduleRuns" && c.args[0] === "j2"), "its past runs are read");
  assert.equal(page.escape(), true);
  assert.equal(aside().hidden, true);
});

await t("Delete asks first, then leaves an Undo in the row; Undo keeps it", async () => {
  await click('[data-au-act="menu"][data-au-id="j1"]');
  assert.ok(host.querySelector(".au-row .au-menu"), "the menu opens");
  await click('.au-menu [data-au-act="delete"]');
  assert.ok(host.querySelector(".au-confirm"), "it asks");
  await click('[data-au-act="delete-now"][data-au-id="j1"]');
  assert.ok(host.querySelector('.au-gone [data-au-act="undo"]'), "an Undo stands in the row");
  await click('[data-au-act="undo"][data-au-id="j1"]');
  assert.deepEqual(names(), ["Morning check", "Nightly build"]);
  timers.fire();
  await settle();
  assert.ok(!fake.calls.some((c) => c.name === "deleteSchedule"), "nothing was deleted");
});

await t("New asks for what's missing, then saves and shows the new one", async () => {
  await click('[data-au-act="new"]');
  const form = aside().querySelector("form[data-au-form]");
  assert.ok(form, "the form opens beside the list");
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(aside().querySelector(".au-problem")?.textContent, "Give it a name.");
  const field = (/** @type {string} */ name) => /** @type {HTMLInputElement} */ (aside().querySelector(`[name="${name}"]`));
  field("name").value = "Weekly notes";
  field("prompt").value = "Sum up the week";
  aside().querySelector("form[data-au-form]")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  const made = fake.calls.find((c) => c.name === "createSchedule");
  assert.ok(made, "it was sent");
  assert.equal(/** @type {Record<string, unknown>} */ (made.args[0]).name, "Weekly notes");
  assert.equal(aside().querySelector("#au-det-h")?.textContent, "Weekly notes");
  assert.ok(said.includes("Weekly notes is on"));
});

page.dispose();
console.log(`\n${passed} passed`);
