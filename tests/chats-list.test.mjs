import assert from "node:assert/strict";
import { publishedRules } from "./lib/css-snapshot.mjs";
import { cliName } from "../core/services/world/conn.js";
import { chatOrder } from "../core/services/world/conversation.js";
import { heldShort, heldBadge } from "../core/services/world/held.js";
import { rowTime } from "../core/services/world/list-time.js";
import { threadsHtml } from "../shell/panel/lists.js";
import { dom, same } from "./lib/dom.mjs";
import { bootPage } from "./lib/page.mjs";
import { createChats as mountChats } from "../modules/chats/chats.js";
import { turnHtml, turnAv } from "../modules/conversation/blocks/turn.js";

const createChats = (deps) => mountChats(deps, { turnHtml, turnAv, cliName, chatOrder, heldShort, heldBadge, rowTime });

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const now = new Date(2026, 10, 20, 15, 0);
const at = (d, h = 10) => new Date(2026, 10, 20 - d, h, 30).toISOString();
const shell = (await bootPage()).document;
const greeting = shell.querySelector("#cs-hi"), subline = shell.querySelector("#cs-sub, .cs-sub");
await dom("");
t("a row's time: the clock for today and yesterday, the weekday this week, else the date", () => {
  assert.equal(rowTime(at(0), now), new Date(at(0)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  assert.equal(rowTime(at(1), now), new Date(at(1)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }));
  assert.equal(rowTime(at(4), now), new Date(at(4)).toLocaleDateString(undefined, { weekday: "short" }));
  assert.equal(rowTime(at(25), now), new Date(at(25)).toLocaleDateString(undefined, { month: "short", day: "numeric" }));
});
t("your chats are in the panel, grouped as threads are: needing you, working, then the rest, newest first", () => {
  const plain = { role: "plain", agent: "codex", created_at: at(0) };
  const sessions = {
    idle: { ...plain, id: "idle", state: "idle", permission_mode: "plan" },
    waiting: { ...plain, id: "waiting", state: "waiting_on_person", permission_mode: "auto" },
    old: { ...plain, id: "old", state: "idle", created_at: at(3) },
  };
  const chats = createChats({ world: { state: { sessions }, act: {}, onEvent() {} }, schedule() {} });
  const groups = chats.groups("c:idle");
  assert.deepEqual(groups.map((g) => [g.k, g.word, g.rows.map((r) => r.go)]), [["needs", "Needs you", ["c:waiting"]], ["recent", "Recent", ["c:idle", "c:old"]]]);
  const idle = groups[1].rows[0];
  assert.equal(idle.title, "A chat in your projects folder");
  assert.equal(idle.sub, "Plan only", "what isn't a new chat's default");
  assert.equal(groups[1].rows[1].sub, "Codex", "else its agent");
  assert.equal(idle.at, rowTime(plain.created_at));
  assert.equal(idle.on, true, "the open chat is marked");
  assert.match(idle.icon, /agm-openai/, "the agent's mark");
  const box = document.createElement("div");
  box.innerHTML = threadsHtml(groups, "plan only", { folds: {}, more: {}, noun: "chat" });
  assert.deepEqual([...box.querySelectorAll("[data-go]")].map((row) => row.dataset.go), ["c:idle"], "the panel's filter reads it");
  box.innerHTML = threadsHtml(groups, "nothing like it", { folds: {}, more: {}, noun: "chat" });
  assert.match(box.textContent, /^No chat matches/);
  assert.deepEqual(["chats", "c:idle", "ws", "p:xo"].map(chats.isChats), [true, true, false, false], "the Workspace's panel keeps its threads");
});
t("the Chats screen keeps only the Workspace under the composer: no Recent, no All chats", () => {
  const sessions = { one: { role: "plain", agent: "codex", id: "one", state: "idle", created_at: at(0) } };
  const workspace = { projects: 3, working: 2, coordinator: true };
  const chats = createChats({ world: { state: { sessions }, act: {}, onEvent() {} }, schedule() {}, workspace: () => workspace });
  const box = document.createElement("div");
  const paint = () => { box.innerHTML = chats.items("chats").map((row) => row.html).join(""); };
  paint();
  const rows = [...box.querySelectorAll(".chl-row")];
  assert.deepEqual(rows.map((row) => row.dataset.go), ["ws"]);
  assert.ok(rows[0].closest(".chl-pin"));
  assert.equal(box.textContent.includes("Recent"), false);
  assert.equal(box.querySelector("[data-chl-all]"), null);
  assert.equal(rows[0].querySelector(".chl-a").textContent, "2 working · 3 projects");
  assert.equal(rows[0].getAttribute("aria-label"), "Workspace: your coordinator across 3 projects, 2 working");
  workspace.working = 0;
  paint();
  assert.equal(box.querySelector('[data-go="ws"] .chl-a').textContent, "Working · 3 projects", "its own turn counts too");
  workspace.coordinator = false;
  paint();
  assert.equal(box.querySelector('[data-go="ws"] .chl-a').textContent, "3 projects");
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
  await chats.openSetup(anchor, "to");
  assert.equal(pop.hidden, false);
  assert.equal(anchor.getAttribute("aria-expanded"), "true");
  assert.deepEqual([...pop.querySelectorAll(".iq-row")].map((row) => row.textContent), ["ChatAsk anything", "WorkspaceAll 1 project"], "two places: a chat, or the Workspace");
  assert.equal(pop.querySelector("[data-cs-cwd]"), null, "no folder list: @ a project instead");
  const option = pop.querySelector("[data-cs-chat]");
  assert.equal(option.getAttribute("aria-current"), "true");
  option.focus();
  chats.renderSetup();
  same(document.activeElement, option, "redraw keeps the active option");
  chats.closeSetup();
  assert.equal(pop.hidden, true);
  same(document.activeElement, anchor, "closing returns focus to the chip");
  storage.set("cv-chat-prefs", JSON.stringify({ cwd: "demo" }));
  assert.match(makeChats().targetHtml("chats", "what is in here"), /<span>New chat<\/span>/, "a folder picked before no longer steers a new chat");
  assert.match(chats.targetHtml("chats", "look at @demo please"), /<span>New chat in Demo project<\/span>/, "@ a project and the chat works in it");
  assert.match(chats.targetHtml("chats", "mail me@demo or @nope"), /<span>New chat<\/span>/, "only a known project, and only as its own word");
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

t("The Workspace row is a bare mark beside a reading-size title with no divider", () => {
  style(".chl-list", { "list-style": "none", display: "flex", "flex-direction": "column", margin: "0", padding: "0" });
  assert.ok(!rules.some(({ sel }) => sel.includes(".chl-list>li+li")), "no dividers");
  style(".chl-row", { height: "var(--h-row-act)", padding: "0 var(--halo-row)", "border-radius": "var(--r-lg)" });
  const tile = declarations(".chl-tile");
  style(".chl-tile", { width: "var(--ic)", height: "var(--ic)", color: "var(--ink-3)" });
  assert.ok(Object.keys(tile).every((property) => !/^(background|border|box-shadow)/.test(property)), "the mark has no fill or rim");
  style(".chl-t", { font: "var(--fw-regular) var(--fs-read)/var(--lh-read) var(--sans)" });
  const start = rules.find(({ sel }) => sel === ".cs-hi").n;
  const end = rules.find(({ sel }) => sel === ".chl-a>.is-busy").n;
  const literals = rules.filter(({ n, declarations: rows }) => n >= start && n < end
    && rows.some(({ v }) => /\b\d+px\b|#[0-9a-f]{3,8}\b|rgba?\(/i.test(v)));
  assert.deepEqual(literals.map(({ sel }) => sel), []);
  assert.ok(!rules.some(({ sel, f }) => (f === "/css/app.css" || f.startsWith("/modules/chats/"))
    && /^\.ch-(list|row|main|t|m|a)$/.test(sel)), "no Chats selectors leak into Changes");
});

t("The Workspace row is exactly as wide as the composer, its hover fill too: both take the column's --col-w", () => {
  style(".composer", { width: "var(--col-w)", "margin-left": "var(--col-x)" });
  style(".column", { width: "var(--col-w)", "margin-left": "var(--col-x)" });
  style(".chl-row", { width: "100%", margin: undefined });
});

t("The Chats greeting is a set of lines that take turns in one cell, with no subline under it", () => {
  const lines = [...greeting.children];
  assert.ok(subline === null, "no \"For all your chat needs.\"");
  assert.ok(lines.length > 1 && !/What can I help with/.test(greeting.textContent), "lines, not one stock question");
  assert.deepEqual(lines.map((line) => line.getAttribute("aria-hidden")), [null, ...lines.slice(1).map(() => "true")], "a reader hears the first line once");
  style(".cs-hi", { display: "grid" });
  style(".cs-hi>span", { "grid-area": "1/1", opacity: "0" });
  for (let n = 2; n <= lines.length; n++) assert.ok(rules.some(({ sel }) => sel === `.cs-hi>:nth-child(${n})`), `line ${n} has its turn`);
  assert.ok(rules.some(({ sel, declarations: rows }) => sel === ".cs-hi>span"
    && rows.some(({ p, v }) => p === "animation" && v.startsWith(`cs-line calc(${lines.length} *`))), "one cycle holds every line");
  const still = "@media (prefers-reduced-motion:reduce)";
  style(".cs-hi>span", { animation: "none" }, still);
  style(".cs-hi>:first-child", { opacity: "1" }, still);
});

t("A project heading with no actions can use the full row", () => {
  style('.top[data-kind="project"]:has(>.top-end:empty) .top-who', { flex: "1", "max-width": "none" });
});

t("A notice on the Chats start screen rests at the page's foot, not between the composer and the Workspace", () => {
  style(".dock.is-top", { position: "static" });
  style(".dock.is-top>.herald", { bottom: "var(--dock-gap)", top: undefined });
});

t("The Chats greeting and composer lead the page without space reserved at the foot", () => {
  style(".main:has(.dock.is-top)", { "--dock-h": "0px" });
  style(".cs-hi", {
    font: "var(--fw-strong) var(--fs-display)/var(--lh-display) var(--sans)",
    margin: "auto 0 var(--s-6) var(--col-x)",
  });
});

t("The Chats greeting and composer stand in the middle, with nothing listed under them but the Workspace", () => {
  style('.app[data-conv="chats"] .scroller>.column', { height: "0", "margin-bottom": "auto" });
  assert.ok(!rules.some(({ sel }) => /\.chl-(more|top|q|few|calm|h)\b/.test(sel)), "no Recent or All chats left behind");
});

t("The Chats greeting replaces the desktop bar but for the panel's button, while the phone keeps its menu", () => {
  const chats = '.app:is([data-conv="chats"],[data-conv^="c:"])';
  style(chats + " .top", { position: "absolute", background: "none", "border-bottom": "0", "pointer-events": "none" }, "@media (min-width:761px)");
  style(chats + " .top>:not(.top-end)", { display: "none" }, "@media (min-width:761px)");
  style(chats + " .top-end", { "pointer-events": "auto" }, "@media (min-width:761px)");
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

t("The model chip gives way on a phone: it names the model, its thinking a tap away", () => {
  assert.ok(rules.some(({ sel, declarations: rows }) => sel === ".iq"
    && rows.some(({ p, v }) => p === "flex" && v === "0 1 auto")), "the model chip gives way");
  const phone = "@media (max-width:760px)";
  for (const selector of [".iq .iq-sep", ".iq .iq-e"]) style(selector, { display: "none" }, phone);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
