// @ts-check

import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";
import { fakeApi, fakePersonaApi, fakeTimers, job, persona } from "./fakes.mjs";

const { window, document } = await dom(`<section id="auto"></section>`);
const { createAutomationsStore } = await import("../store.js");
const { createAutomationsPage } = await import("../page.js");
const { createSide } = await import("../side.js");
const { createAgentSide } = await import("../agent-side.js");
const { createAgentList } = await import("../agent-list.js");
const { createPersonasStore } = await import("../personas.js");

const now = () => Date.parse("2026-11-26T08:00:00Z");
const jobs = [
  job(),
  job({ id: "j2", name: "Nightly build", next_run: "2026-11-26T23:00:00Z" }),
  job({ id: "j3", name: "Old check", enabled: false, next_run: null, state: "cancelled",
    state_reason: "Its project was removed." }),
];
const fake = fakeApi(jobs), timers = fakeTimers();
const store = createAutomationsStore({ api: fake.api, report() {}, timeout: timers.timeout, now });
const projects = () => [{ chat: "chat_a", name: "Alpha", id: "alpha" }, { chat: "chat_b", name: "Beta", id: "beta" }];
let last = "alpha";
const here = () => projects().find((p) => p.id === last) ?? null;
/** @type {string[]} */
const said = [];
const deps = { projectName: () => "Alpha", projects, here, failed() {}, announce: (/** @type {string} */ w) => { said.push(w); }, now };
const agentLists = {
  "": [persona({ name: "helper", level: "space", path: "helper.md", description: "Helps anywhere." })],
  alpha: [persona(), persona({ name: "helper", level: "space", path: "helper.md" })],
};
const importable = [{ id: "space:reviewer", level: "space", name: "reviewer", adapter: "claude_code", from: "Claude Code",
  text: "---\nname: reviewer\ndescription: Reviews a diff.\n---\n", dropped: [], problems: [] }];
const people = fakePersonaApi(agentLists, importable);
const personas = createPersonasStore({ api: people.api, report() {} });
/** @type {string[]} */
const opened = [];
const catalog = [{ id: "claude-opus-5-5", name: "Opus 5.5", description: "For the hardest work" }, { id: "claude-sonnet-5-5", name: "Sonnet 5.5" }];
/** @type {Map<string, typeof catalog | null>} */
const modelLists = new Map();
/** @param {string} rt @param {() => void} loaded */
const models = (rt, loaded) => {
  if (!modelLists.has(rt)) { modelLists.set(rt, null); setTimeout(() => { modelLists.set(rt, catalog); loaded(); }, 0); }
  return modelLists.get(rt) ?? null;
};
const agentDeps = { ...deps, personas, find: personas.find, projectName: () => "Alpha", runtimes: () => ["claude_code"],
  mainRuntime: () => "claude_code", models,
  openThread: (/** @type {string} */ chat, /** @type {string} */ ts) => { opened.push(`${chat}/${ts}`); }, openFile() {} };
const page = createAutomationsPage({ ...deps, store,
  side: (hooks) => createSide({ ...deps, ...hooks, store, where: "page", openThread() {}, runtimes: () => ["claude_code"],
    mainRuntime: () => "claude_code", models,
    readReport: async () => "**3 commits** aren't live",
    openProject: (/** @type {string} */ chat) => { opened.push(`project ${chat}`); } }),
  agentSide: (hooks) => createAgentSide({ ...agentDeps, ...hooks, where: "page", project: () => "" }),
  agentList: (hooks) => createAgentList({ ...deps, personas, projectName: () => "Alpha", ...hooks }) });
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
  assert.match(host.querySelector(".au-row .au-n small")?.textContent ?? "", /project was removed/);
  assert.equal(host.querySelector('.au-row [role="switch"]')?.getAttribute("aria-checked"), "false", "with its switch, to turn it on");
  await click('[data-au-tab="upcoming"]');
});

await t("a row opens beside the list, and Esc closes it", async () => {
  await click('[data-au-act="open"][data-au-id="j2"]');
  assert.equal(aside().hidden, false);
  assert.equal(aside().querySelector("#au-det-h")?.textContent, "Nightly build");
  assert.ok(fake.calls.some((c) => c.name === "scheduleRuns" && c.args[0] === "j2"), "its past runs are read");
  assert.match(aside().querySelector(".au-next")?.textContent ?? "", /next /, "when it runs next, in words");
  await click('.au-side [data-au-act="project"]');
  assert.deepEqual(opened.splice(0), ["project chat_a"], "its project row opens the project");
  assert.equal(page.escape(), true);
  assert.equal(aside().hidden, true);
});

await t("a run opens its report in place, read from its thread, and Back returns", async () => {
  const api = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (fake.api)), was = api.scheduleRuns;
  api.scheduleRuns = async () => ({ job_id: "j1", log_path: null, runs: [{ fire_at: "2026-11-26T07:30:00Z", trigger: "schedule", status: "ok",
    found: true, summary: "3 commits aren't live", thread: { chat_id: "chat_a", ts: "171.5" } }] });
  await click('[data-au-act="open"][data-au-id="j1"]');
  await click('.au-side [data-au-act="report"]');
  assert.equal(aside().querySelector("#au-det-h")?.textContent, "Found something");
  assert.equal(aside().querySelector(".au-report strong")?.textContent, "3 commits", "its thread's last word, as markdown");
  assert.ok(aside().querySelector('[data-au-act="thread"][data-ts="171.5"]'), "with Open the run");
  await click('.au-side [data-au-act="report-back"]');
  assert.equal(aside().querySelector("#au-det-h")?.textContent, "Morning check");
  api.scheduleRuns = was;
  page.escape();
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

await t("New is one sentence in a dialog; it asks for what's missing, then saves and shows the new one", async () => {
  const cta = document.querySelector('.au-top [data-au-act="new"]');
  assert.equal(cta?.classList.contains("btn-pri"), true, "the page's one call to action, in the flavour's colour");
  assert.equal(cta?.textContent, "Create automation");
  last = "beta";
  await click('[data-au-act="new"]');
  last = "alpha";
  const box = /** @type {HTMLElement} */ (document.querySelector("dialog.au-dlg"));
  assert.ok(box?.hasAttribute("open") && box.querySelector("form[data-au-form] .au-say"), "the sentence opens over the page");
  assert.equal(box.querySelector('[name="persona"] option[selected]')?.getAttribute("value"), "rt:claude_code",
    "with no agent, the main runtime runs it");
  await settle();
  assert.deepEqual([...box.querySelectorAll('[name="model"] option')].map((o) => o.textContent), ["Default model", "Opus 5.5", "Sonnet 5.5"],
    "its own models, once they come");
  const send = () => box.querySelector("form[data-au-form]")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  send();
  await settle();
  assert.equal(box.querySelector(".au-problem")?.textContent, "Say what it should do each time.");
  /** @type {HTMLTextAreaElement} */ (box.querySelector('[name="prompt"]')).value = "Sum up the week";
  send();
  await settle();
  const made = fake.calls.find((c) => c.name === "createSchedule");
  assert.ok(made, "it was sent");
  const body = /** @type {Record<string, unknown>} */ (made.args[0]);
  assert.equal(body.name, "Sum up the week", "named from what it does");
  assert.equal(body.agent, "claude_code", "and saved with the runtime it showed");
  assert.equal(body.chat, "chat_b", "in the project the owner was last in, not the first one listed");
  assert.equal(box.hasAttribute("open"), false, "the dialog closes");
  assert.equal(aside().querySelector("#au-det-h")?.textContent, "Sum up the week");
  assert.ok(said.includes("Sum up the week is on"));
});

const agentAside = () => /** @type {HTMLElement} */ (host.querySelectorAll(".au-side")[1]);

await t("Agents lists the Space's agents, then each project's own, and offers Claude Code's", async () => {
  await click('[data-au-mode="agents"]');
  await settle();
  const groups = [...host.querySelectorAll(".au-main .au-day")].map((h) => h.textContent);
  assert.deepEqual(groups, ["Every project", "Alpha"]);
  const rows = [...host.querySelectorAll(".au-main .au-row .au-n b")].map((b) => b.textContent);
  assert.deepEqual(rows, ["Helper", "Release checker"]);
  assert.match(host.querySelector('[data-ag-act="bring"]')?.textContent ?? "", /Claude Code agents \(1\)/);
});

await t("Bring in copies one of Claude Code's agents in", async () => {
  await click('[data-ag-act="bring"]');
  await settle();
  assert.match(host.querySelector(".au-main .au-n small")?.textContent ?? "", /Reviews a diff/);
  await click('[data-ag-act="import"][data-ag-i="0"]');
  await settle();
  assert.deepEqual(people.calls.find((c) => c.name === "importPersona")?.args[0], { adapter: "claude_code", id: "space:reviewer" });
  assert.ok(said.includes("Reviewer brought in"));
  assert.equal(page.escape(), true);
});

await t("an agent opens beside the list with its instructions, and Try once opens its thread", async () => {
  await click('[data-ag-act="open"][data-ag-key="project:alpha:release-checker"]');
  await settle();
  assert.equal(agentAside().hidden, false);
  assert.equal(agentAside().querySelector("#ag-det-h")?.textContent, "Release checker");
  assert.match(agentAside().querySelector(".au-prompt")?.textContent ?? "", /Read what's live/);
  await click('[data-ag-act="try"]');
  agentAside().querySelector("form[data-ag-try]")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.deepEqual(people.calls.find((c) => c.name === "tryOnce")?.args[0],
    { persona: { name: "release-checker", level: "project" }, project: "alpha" });
  assert.deepEqual(opened, ["chat_a/1764000000.000100"]);
  await click('[data-ag-act="open"][data-ag-key="space::helper"]');
  await settle();
  const tries = () => people.calls.filter((c) => c.name === "tryOnce").map((c) => Object(c.args[0]).project);
  const pickTry = (id = "") => Object.defineProperty(agentAside().querySelector('xo-select[name="try-project"]'), "value", { value: id, configurable: true });
  await click('[data-ag-act="try"]');
  assert.equal(agentAside().querySelector('xo-select[name="try-project"] option[selected]')?.textContent, "Choose a project",
    "a Space agent's try starts in no project");
  agentAside().querySelector("form[data-ag-try]")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(tries().length, 1, "nor runs until one is chosen, never the first listed or the last visited");
  assert.equal(agentAside().querySelector(".au-try .au-problem")?.textContent, "Choose a project to try it on.");
  pickTry("beta");
  agentAside().querySelector("form[data-ag-try]")?.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  assert.equal(tries()[1], "beta", "it runs where the owner chose");
  await click('[data-au-act="new"]');
  await click('[data-ag-act="try-form"]');
  await settle();
  assert.equal(tries().length, 2, "a new agent tried from the editor waits for a project too");
  assert.equal(agentAside().querySelector("form[data-ag-form] .au-problem")?.textContent, "Choose a project to try it on.");
  pickTry("beta");
  await click('[data-ag-act="try-form"]');
  await settle();
  assert.equal(tries()[2], "beta");
  opened.splice(0);
  await click('[data-ag-act="open"][data-ag-key="project:alpha:release-checker"]');
  await settle();
});

await t("Edit saves the file over the version it read", async () => {
  await click('[data-ag-act="edit"]');
  const form = agentAside().querySelector("form[data-ag-form]");
  assert.ok(form, "the form opens");
  const model = () => agentAside().querySelector('xo-select[name="model"]');
  assert.equal(Boolean(model()), true, "the model is a choice from its runtime's list, never a text box");
  await settle();
  assert.deepEqual([...model()?.querySelectorAll("option") ?? []].map((o) => o.textContent), ["Default", "Opus 5.5", "Sonnet 5.5"]);
  assert.equal(model()?.hasAttribute("aria-busy"), false);
  assert.equal(agentAside().querySelector('xo-select[name="runtime"] option[value="claude_code"]')?.getAttribute("data-agm"), "claude",
    "each runtime with its mark");
  /** @type {HTMLTextAreaElement} */ (form.querySelector('[name="body"]')).value = "Read what's live, then say it.";
  form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  const saved = people.calls.find((c) => c.name === "saveProjectFile");
  assert.ok(saved, "it was written");
  assert.deepEqual(saved.args.slice(0, 2), ["alpha", ".xo/agents/release-checker.md"]);
  assert.match(String(saved.args[2]), /\n---\n\nRead what's live, then say it.\n$/);
  assert.equal(saved.args[3], "v1");
  assert.equal(agentAside().querySelector("#ag-det-h")?.textContent, "Release checker");
});

await t("a switch pressed in the panel can be pressed again once XO Space has answered", async () => {
  await click('[data-au-mode="automations"]');
  await click('.au-main [data-au-act="open"][data-au-id="j2"]');
  await click('.au-side .switch[data-au-act="toggle"]');
  await settle();
  const sw = aside().querySelector(".switch");
  assert.equal(sw?.getAttribute("aria-checked"), "false", "it turned off");
  assert.equal(sw?.hasAttribute("aria-busy") || sw?.hasAttribute("aria-disabled"), false, "and isn't left waiting");
});

page.dispose();
console.log(`\n${passed} passed`);
