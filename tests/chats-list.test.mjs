import assert from "node:assert/strict";
import { sheet } from "./lib/cascade.mjs";
import { cliName, chatOrder, heldShort, heldBadge, dayGroup, rowTime } from "../core/services/world/timeline.js";
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
t("its look: tokens only, a list of titles with no tiles, rims or dividers, rows 48 whose hover reaches --halo-row past the words", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  const block = css.slice(css.indexOf(".cs-hi{"), css.indexOf(".chl-calm{"));
  assert.match(block, /\.chl-list\{list-style:none;display:flex;flex-direction:column;margin:0;padding:0\}/);
  assert.doesNotMatch(block, /\.chl-list>li\+li/, "no dividers");
  assert.match(block, /\.chl-row\{[^}]*height:var\(--h-row-act\);padding:0 var\(--halo-row\);margin:0 calc\(-1 \* var\(--halo-row\)\);border-radius:var\(--r-lg\)/);
  assert.match(block, /\.chl-tile\{[^}]*width:var\(--ic\);height:var\(--ic\);color:var\(--ink-3\)\}/, "the mark is bare: no fill, no rim");
  assert.match(block, /\.chl-t\{[^}]*font:var\(--fw-regular\) var\(--fs-read\)\/var\(--lh-read\)/, "titles at reading size");
  assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/1px solid|gap:2px/g, ""), /\b\d+px\b|#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /\n\.ch-(list|row|main|t|m|a)\{/, "no global ch- rules left to leak into the panel's Changes");
});
t("A project heading with no actions can use the full row", () => {
  assert.match(sheet(new URL("../css/app.css", import.meta.url)), /\.top\[data-kind="project"\]:has\(> \.top-end:empty\) \.top-who\{flex:1;max-width:none\}/);
});

t("Chats starts with its composer: under the greeting at the top, the dock back at the foot in a chat", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /\.dock\.is-top>\.herald\{top:calc\(100% \+ \(var\(--s-10\) - var\(--h-ctl\)\) \/ 2\);bottom:auto\}/, "a notice drops under the composer, never over the greeting or the box");
  assert.match(css, /\.main:has\(\.dock\.is-top\)\{--dock-h:0px\}/, "nothing reserves the foot's room on Chats");
  assert.match(css, /\.cs-hi\{[^}]*var\(--fs-display\)\/var\(--lh-display\)/, "the greeting is Home's display role");
});
t("Recent chats use the shared search style and align their controls with the composer", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /\.chl-more\{[^}]*padding:0 var\(--halo\);margin-right:calc\(-1 \* var\(--halo\)\);border-radius:var\(--r\)/);
  assert.match(css, /\.scroller:has\(\.chl-few,\.chl-calm\)>\.column\{height:0;margin-bottom:auto\}/);
  assert.doesNotMatch(sheet(new URL("../css/panel.css", import.meta.url)), /\.stage \.tg-qf/, "the search field is one shared look");
});
t("Chats has no bar over its greeting: the greeting is the title, a phone keeps its menu", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url)), ph = sheet(new URL("../shell/phone.css", import.meta.url));
  assert.match(css, /@media \(min-width:761px\)\{\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \.top\{display:none\}\}/);
  assert.match(ph, /\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \#top-who\{display:none\}/);
});
t("what it may do on its own reads as a choice you make about trust: a question, each mode its mark and sentence, careful first", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /\.cs-md\{font:var\(--fw-regular\) var\(--fs-meta\)\/var\(--lh-meta\) var\(--sans\);color:var\(--ink-3\);text-wrap:pretty\}/);
});
t("switching to All keeps the greeting where it stood: no recentring, no scroll", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /\.cs-hi\{[^}]*margin:var\(--cs-lead,auto\) /);
});
t("an open chat has no bar: its model and mode are fixed chips in its composer, its state in the composer's line", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /@media \(min-width:761px\)\{\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \.top\{display:none\}\}/);
  assert.match(css, /\.is-fixed:is\(\.target,\.iq\),\.is-fixed:is\(\.target,\.iq\):is\(:hover,:active\)\{cursor:default;background:none\}/);
});
t("a phone's composer row never pushes Send out: the model chip gives way, Send now is a filled capsule", () => {
  const css = sheet(new URL("../css/app.css", import.meta.url));
  assert.match(css, /\.iq\{flex:0 1 auto;/, "the model chip gives way last, ending in an ellipsis");
  assert.match(css, /\.tg-now\{[^}]*border-radius:var\(--r-pill\);background:var\(--btn-fill\);/);
  assert.doesNotMatch(css.match(/\.tg-now\{[^}]*\}/)[0], /border:/, "no rim of its own");
  assert.match(css, /@media \(max-width:760px\)\{\n  \.tg-now\{height:var\(--h-touch\)\}\n[^}]*\n  \.iq \.iq-sep,\.iq \.iq-e\{display:none\}\n  \.target:not\(\.cs-perm\):has\(~ \.tg-now:not\(\[hidden\]\)\)\{display:none\}\n\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
