// Settings draws the settings.section place: a tab and a page per entry, rendered when opened, let go when left or gone.
import assert from "node:assert/strict";
import { dom, settle, same } from "../../../tests/lib/dom.mjs";
import { createKernel } from "../../../core/kernel/index.js";
import { definePlaces } from "../../../shell/places.js";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const PAGE = `<section id="settings" hidden><nav class="set-nav" role="tablist"><button type="button" role="tab" data-set="general" aria-selected="true">General</button><button type="button" role="tab" data-set="routing" aria-selected="false" tabindex="-1">Routing</button></nav>` +
  `<div class="set-body"><div class="set-page" data-page="general"></div><div class="set-page" data-page="routing" hidden><div class="set-live"></div></div></div></section>`;

/** Each render and undo of the fake sections, in order. */
const log = [];
async function settings({ project = "demo", early = null } = {}) {
  await dom(PAGE);
  log.length = 0;
  const { createSettingsFrame } = await import("../frame.js");
  const { createSettingsSections } = await import("../sections.js");
  const kernel = createKernel();
  definePlaces(kernel);
  const places = kernel.places;
  const el = document.querySelector("#settings");
  const btn = () => document.createElement("button");
  if (early) places.contribute("settings.section", early(log), "xo.early");
  const sections = createSettingsSections({ places, nav: el.querySelector(".set-nav"), pages: el.querySelector(".set-body"), at: () => ({ project }), pick: (id) => frame.setPage(id), isOpen: () => !el.hidden });
  const frame = createSettingsFrame({ el, side: btn(), phoneButton: btn(), closeButton: btn(), onPage: (id) => sections.show(id), beforeOpen: () => sections.resume(), beforeClose: () => sections.hide(), onHidden: () => {}, focusIn: () => {}, fallback: () => null, phone: { matches: false, addEventListener() {} } });
  const entry = (id, label) => ({ id, label, icon: "plug", render: (live, at) => { log.push(["render", id, at.project]); live.innerHTML = `<div class="set-live">${label} for ${at.project}</div>`; return () => log.push(["undo", id]); } });
  return { places, frame, sections, el, log, entry };
}
const tab = (id) => document.querySelector(`[data-set="${id}"]`);
const page = (id) => document.querySelector(`[data-page="${id}"]`);

await t("an entry gets its own tab and page, with the settings page markup, and nothing is drawn until it opens", async () => {
  const S = await settings();
  S.places.contribute("settings.section", S.entry("apps", "Apps"), "xo.apps-host");
  assert.equal(tab("apps").textContent, "Apps");
  assert.equal(tab("apps").getAttribute("role"), "tab");
  assert.equal(tab("apps").getAttribute("aria-controls"), "set-p-apps");
  assert.equal(page("apps").className, "set-page");
  assert.equal(page("apps").hidden, true);
  assert.equal(page("apps").querySelector("h2").textContent, "Apps");
  assert.ok(page("apps").querySelector('[data-section="apps"]'), "the entry's host, under the title");
  same(page("apps").querySelector(".set-live"), null, "the entry draws its own .set-live, as built-in pages have one");
  assert.deepEqual(S.log, []);
});

await t("opening its tab renders it with the project; leaving for another page lets it go", async () => {
  const S = await settings();
  S.places.contribute("settings.section", S.entry("apps", "Apps"), "xo.apps-host");
  S.frame.open();
  tab("apps").dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(page("apps").hidden, false);
  assert.equal(tab("apps").getAttribute("aria-selected"), "true");
  assert.equal(page("apps").querySelector('[data-section="apps"] > .set-live').textContent, "Apps for demo");
  S.frame.setPage("routing");
  assert.deepEqual(S.log, [["render", "apps", "demo"], ["undo", "apps"]]);
});

await t("closing Settings lets it go; opening again on its page renders it anew", async () => {
  const S = await settings();
  S.places.contribute("settings.section", S.entry("apps", "Apps"), "xo.apps-host");
  S.frame.open(); S.frame.setPage("apps");
  S.frame.close({ restore: false });
  assert.deepEqual(S.log, [["render", "apps", "demo"], ["undo", "apps"]], "let go as Settings closes");
  S.frame.open();
  assert.deepEqual(S.log, [["render", "apps", "demo"], ["undo", "apps"], ["render", "apps", "demo"]]);
});

await t("an entry taken away (its app removed) takes its tab and page with it, and Settings goes to its first page", async () => {
  const S = await settings();
  const undo = S.places.contribute("settings.section", S.entry("apps", "Apps"), "xo.apps-host");
  S.frame.open(); S.frame.setPage("apps");
  undo(); await settle();
  same(tab("apps"), null);
  same(page("apps"), null);
  assert.deepEqual(S.log.at(-1), ["undo", "apps"]);
  assert.equal(page("general").hidden, false);
});

await t("an entry can't take a built-in page's id; two entries get two tabs, in the place's order", async () => {
  const S = await settings();
  const errs = []; const was = console.error; console.error = (m) => errs.push(String(m));
  try {
    S.places.contribute("settings.section", S.entry("routing", "Not routing"), "xo.app");
  assert.equal(document.querySelectorAll('[data-set="routing"]').length, 1);
  assert.match(errs[0], /already has that id/);
  S.places.contribute("settings.section", { ...S.entry("b", "Bee"), order: 2 }, "x");
  S.places.contribute("settings.section", { ...S.entry("a", "Ay"), order: 1 }, "y");
  const order = [...document.querySelectorAll(".set-nav [data-set]")].map((b) => b.dataset.set);
  assert.deepEqual(order, ["general", "routing", "a", "b"], "built-in pages first, then the place's order");
  assert.equal(errs.length, 1, "said once");
  } finally { console.error = was; }
});
await t("while Settings is closed, a change to the place draws nothing", async () => {
  const S = await settings();
  S.places.contribute("settings.section", S.entry("apps", "Apps"), "xo.apps-host");
  S.frame.open(); S.frame.setPage("apps"); S.frame.close({ restore: false });
  S.places.contribute("settings.section", S.entry("more", "More"), "xo.other");
  assert.deepEqual(S.log, [["render", "apps", "demo"], ["undo", "apps"]]);
});

await t("an entry whose render throws is said in the console, and Settings still opens and works", async () => {
  const S = await settings();
  const errs = []; const was = console.error; console.error = (m) => errs.push(String(m));
  try {
    S.places.contribute("settings.section", { id: "bad", label: "Bad", icon: "plug", render: () => { throw new Error("boom"); } }, "xo.bad");
    S.frame.open(); S.frame.setPage("bad"); S.frame.close({ restore: false });
    S.frame.open();
  } finally { console.error = was; }
  assert.equal(S.el.hidden, false, "Settings opened");
  assert.match(errs[0], /"bad": its render threw/);
  S.frame.setPage("routing");
  assert.equal(page("routing").hidden, false);
});

await t("focus in a section that goes lands on the tab Settings goes to, never on the page", async () => {
  const S = await settings();
  const undo = S.places.contribute("settings.section", S.entry("apps", "Apps"), "xo.apps-host");
  S.frame.open(); S.frame.setPage("apps");
  tab("apps").focus();
  undo();
  same(document.activeElement, tab("general"));
});

await t("an entry there before Settings is built renders once per click", async () => {
  const S = await settings({ early: (l) => ({ id: "apps", label: "Apps", icon: "plug", render: () => { l.push(["render", "apps"]); return () => l.push(["undo", "apps"]); } }) });
  S.frame.open();
  tab("apps").dispatchEvent(new Event("click", { bubbles: true }));
  assert.deepEqual(S.log, [["render", "apps"]]);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
