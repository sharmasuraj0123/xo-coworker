import assert from "node:assert/strict";
import { publishedRules } from "./lib/css-snapshot.mjs";
import { cliName } from "../core/services/world/conn.js";
import { chatOrder } from "../core/services/world/conversation.js";
import { heldShort, heldBadge } from "../core/services/world/held.js";
import { dayGroup, rowTime } from "../core/services/world/list-time.js";
import { dom, same } from "./lib/dom.mjs";
import { createChats as mountChats } from "../modules/chats/chats.js";
import { turnHtml, turnAv } from "../modules/conversation/blocks/turn.js";

const createChats = (deps) => mountChats(deps, { turnHtml, turnAv, cliName, chatOrder, heldShort, heldBadge, dayGroup, rowTime });

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const now = new Date(2026, 10, 20, 15, 0);
const at = (d, h = 10) => new Date(2026, 10, 20 - d, h, 30).toISOString();
await dom("");
t("day groups: Today, Yesterday, This week, then the month (its year when not this one)", () => {
  assert.equal(dayGroup(at(0), now), "Today");
  assert.equal(dayGroup(at(1), now), "Yesterday");
  assert.equal(dayGroup(at(4), now), "This week");
  assert.equal(dayGroup(at(25), now), new Date(2026, 9, 26).toLocaleDateString(undefined, { month: "long" }));
  assert.match(dayGroup(new Date(2025, 2, 1).toISOString(), now), /2025/);
  assert.equal(dayGroup("nonsense", now), "Earlier");
});
t("a row's time: the clock for today and yesterday, the weekday this week, else the date", () => {
  assert.equal(rowTime(at(0), now), new Date(at(0)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  assert.equal(rowTime(at(1), now), new Date(at(1)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  assert.equal(rowTime(at(4), now), new Date(at(4)).toLocaleDateString(undefined, { weekday: "short" }));
  assert.equal(rowTime(at(25), now), new Date(at(25)).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
});
t("a row: the agent's mark, its state as a badge on it (none when idle), the title and the time, one line", () => {
  const plain = { role: "plain", agent: "codex", created_at: at(0) };
  const sessions = {
    idle: { ...plain, id: "idle", state: "idle", permission_mode: "plan" },
    waiting: { ...plain, id: "waiting", state: "waiting_on_person", permission_mode: "auto" },
  };
  const chats = createChats({ world: { state: { sessions }, act: {}, onEvent() {} }, schedule() {} });
  chats.showAll(true);
  const box = document.createElement("div");
  const paint = () => { box.innerHTML = chats.items("chats").map((row) => row.html).join(""); };
  paint();
  const group = box.querySelector(".chl-g");
  assert.equal(group.querySelector(".chl-h").id, group.getAttribute("aria-labelledby"));
  const idle = box.querySelector('[data-go="c:idle"]');
  assert.ok(idle.querySelector(".chl-tile .agm-openai"));
  assert.ok(idle.querySelector(".chl-tile [data-xi]") === null, "idle tiles have no icon badge");
  assert.equal(idle.querySelector(".chl-t").textContent, "A chat in your projects folder");
  assert.equal(idle.querySelector(".chl-a").textContent, rowTime(plain.created_at));
  assert.ok(box.querySelector('[data-go="c:waiting"] .chl-tile [data-xi="state-needs-you"]'));
  sessions.idle.updated_at = at(0, 11);
  sessions.waiting.updated_at = at(0, 12);
  paint();
  assert.deepEqual([...box.querySelectorAll(".chl-row")].map((row) => row.dataset.go), ["c:waiting", "c:idle"]);
  chats.search("plan only");
  paint();
  assert.deepEqual([...box.querySelectorAll(".chl-row")].map((row) => row.dataset.go), ["c:idle"]);
});

{
  const { document } = await dom('<button id="setup" aria-expanded="false">Folder</button><div id="cs-pop" tabindex="-1" hidden></div>');
  const storage = new Map();
  globalThis.localStorage = { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) };
  globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  globalThis.fetch = async () => Response.json({ models: [] });
  const makeChats = () => createChats({
    world: {
      state: {
        runtimes: [{ name: "codex", features: { features: { "permissions.mode": { values: ["plan", "auto"] } } } }],
        projects: [{ id: "demo", name: "Demo project", kind: "project" }],
      },
      act: {},
      onEvent() {},
    },
    schedule() {},
  });
  const anchor = document.getElementById("setup"), pop = document.getElementById("cs-pop");
  const chats = makeChats();
  await chats.openSetup(anchor, "cwd");
  assert.equal(pop.hidden, false);
  assert.equal(anchor.getAttribute("aria-expanded"), "true");
  const option = pop.querySelector('[data-cs-cwd="demo"]');
  assert.equal(option.getAttribute("aria-checked"), "false");
  option.focus();
  chats.setPref("cwd", "demo");
  chats.renderSetup();
  same(document.activeElement, option, "redraw keeps the active folder option");
  assert.equal(option.getAttribute("aria-checked"), "true");
  assert.equal(JSON.parse(storage.get("cv-chat-prefs")).cwd, "demo");
  chats.closeSetup();
  assert.equal(pop.hidden, true);
  same(document.activeElement, anchor, "closing returns focus to the folder chip");
  await makeChats().openSetup(anchor, "cwd");
  assert.equal(pop.querySelector('[data-cs-cwd="demo"]').getAttribute("aria-checked"), "true");
  await chats.openSetup(anchor, "mode");
  const modes = [...pop.querySelectorAll("[data-csmode]")];
  assert.equal(pop.querySelector("h2").textContent, "How much should it do on its own?");
  assert.deepEqual(modes.map((row) => row.dataset.csmode), ["plan", "auto"]);
  assert.deepEqual(modes.map((row) => row.querySelector(".iq-n").textContent), ["Plan only", "Auto"]);
  assert.equal(modes.every((row) => row.querySelector(".cs-mi") && row.querySelector(".cs-md")?.textContent), true);
  assert.deepEqual(modes.map((row) => row.getAttribute("aria-checked")), ["false", "true"]);
  assert.deepEqual(modes.map((row) => row.getAttribute("tabindex")), ["-1", "0"]);
}
const rules = publishedRules();
const declarations = (selector, condition = "") => {
  const selected = rules.filter((rule) => rule.sel === selector && rule.at.join(" ") === condition);
  assert.ok(selected.length, `Missing ${selector} in ${condition || "the base styles"}`);
  return Object.fromEntries(selected.flatMap((rule) => rule.declarations).map(({ p, v }) => [p, v]));
};
const style = (selector, expected, condition = "") => {
  const found = declarations(selector, condition);
  const actual = Object.fromEntries(Object.keys(expected).map((property) => [property, found[property]]));
  assert.deepEqual(actual, expected, `${selector} ${condition}`);
};

t("Chats lists bare marks beside reading-size titles with no row dividers", () => {
  style(".chl-list", { "list-style": "none", display: "flex", "flex-direction": "column", margin: "0", padding: "0" });
  assert.ok(!rules.some(({ sel }) => sel.includes(".chl-list>li+li")), "no dividers");
  style(".chl-row", {
    height: "var(--h-row-act)", padding: "0 var(--halo-row)", margin: "0 calc(-1 * var(--halo-row))",
    "border-radius": "var(--r-lg)",
  });
  const tile = declarations(".chl-tile");
  style(".chl-tile", { width: "var(--ic)", height: "var(--ic)", color: "var(--ink-3)" });
  assert.ok(Object.keys(tile).every((property) => !/^(background|border|box-shadow)/.test(property)), "the mark has no fill or rim");
  style(".chl-t", { font: "var(--fw-regular) var(--fs-read)/var(--lh-read) var(--sans)" });
  const start = rules.find(({ sel }) => sel === ".cs-hi").n;
  const end = rules.find(({ sel }) => sel === ".chl-calm").n;
  const literals = rules.filter(({ n, declarations: rows }) => n >= start && n < end
    && rows.some(({ v }) => /\b\d+px\b|#[0-9a-f]{3,8}\b|rgba?\(/i.test(v)));
  assert.deepEqual(literals.map(({ sel }) => sel), []);
  assert.ok(!rules.some(({ sel, f }) => (f === "/css/app.css" || f.startsWith("/modules/chats/"))
    && /^\.ch-(list|row|main|t|m|a)$/.test(sel)), "no Chats selectors leak into Changes");
});

t("A project heading with no actions can use the full row", () => {
  style('.top[data-kind="project"]:has(>.top-end:empty) .top-who', { flex: "1", "max-width": "none" });
});

t("The Chats greeting and composer lead the page without space reserved at the foot", () => {
  style(".dock.is-top>.herald", { top: "calc(100% + (var(--s-10) - var(--h-ctl)) / 2)", bottom: "auto" });
  style(".main:has(.dock.is-top)", { "--dock-h": "0px" });
  style(".cs-hi", {
    font: "var(--fw-strong) var(--fs-display)/var(--lh-display) var(--sans)",
    margin: "var(--cs-lead,auto) 0 var(--s-2) var(--col-x)",
  });
});

t("Recent chats share the search style and align controls with the composer", () => {
  style(".chl-more", { padding: "0 var(--halo)", "margin-right": "calc(-1 * var(--halo))", "border-radius": "var(--r)" });
  style('.app[data-conv="chats"] .scroller:has(.chl-few,.chl-calm)>.column', { height: "0", "margin-bottom": "auto" });
  assert.ok(!rules.some(({ sel }) => sel.startsWith(".stage .tg-qf")), "the search field is one shared look");
});

t("The Chats greeting replaces the desktop bar while the phone keeps its menu", () => {
  const chats = '.app:is([data-conv="chats"],[data-conv^="c:"])';
  style(chats + " .top", { display: "none" }, "@media (min-width:761px)");
  style(":root:root " + chats + " #top-who", { display: "none" }, "@media (max-width:760px)");
});

t("Permission choices have readable explanations and fixed model and mode chips stay quiet", () => {
  style(".cs-md", {
    font: "var(--fw-regular) var(--fs-meta)/var(--lh-meta) var(--sans)", color: "var(--ink-3)", "text-wrap": "pretty",
  });
  for (const selector of [".is-fixed:is(.target,.iq)", ".is-fixed:is(.target,.iq):is(:hover,:active)"]) {
    style(selector, { cursor: "default", background: "none" });
  }
});

t("Send now is a filled capsule and can fit next to the phone composer", () => {
  assert.ok(rules.some(({ sel, declarations: rows }) => sel === ".iq"
    && rows.some(({ p, v }) => p === "flex" && v === "0 1 auto")), "the model chip gives way");
  style(".tg-now", { "border-radius": "var(--r-pill)", background: "var(--btn-fill)" });
  assert.ok(!Object.hasOwn(declarations(".tg-now"), "border"), "no rim of its own");
  const phone = "@media (max-width:760px)";
  style(".tg-now", { height: "var(--h-touch)" }, phone);
  for (const selector of [".iq .iq-sep", ".iq .iq-e", ".target:not(.cs-perm):has(~.tg-now:not([hidden]))"]) {
    style(selector, { display: "none" }, phone);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
