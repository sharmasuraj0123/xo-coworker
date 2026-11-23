import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dayGroup, rowTime } from "../js/timeline.js";
import { dom, same } from "./lib/dom.mjs";
import { createChats } from "../js/chats.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
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
  assert.equal(idle.querySelector(".chl-tile [data-xi]"), null);
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
  assert.deepEqual(modes.map((row) => row.dataset.csmode), ["plan", "auto"]);
  assert.deepEqual(modes.map((row) => row.getAttribute("aria-checked")), ["false", "true"]);
  assert.deepEqual(modes.map((row) => row.getAttribute("tabindex")), ["-1", null]);
}
t("its look: tokens only, a list of titles with no tiles, rims or dividers, rows 48 whose hover reaches --halo-row past the words", () => {
  const css = read("css/app.css");
  const block = css.slice(css.indexOf(".cs-hi{"), css.indexOf(".chl-calm{"));
  assert.match(block, /\.chl-list\{list-style:none;display:flex;flex-direction:column;margin:0;padding:0\}/);
  assert.doesNotMatch(block, /\.chl-list>li\+li/, "no dividers");
  assert.match(block, /\.chl-row\{[^}]*height:var\(--h-row-act\);padding:0 var\(--halo-row\);margin:0 calc\(-1 \* var\(--halo-row\)\);border-radius:var\(--r-lg\)/);
  assert.match(block, /\.chl-tile\{[^}]*width:var\(--ic\);height:var\(--ic\);color:var\(--ink-3\)\}/, "the mark is bare: no fill, no rim");
  assert.match(block, /\.chl-t\{[^}]*font:var\(--fw-regular\) var\(--fs-read\)\/var\(--lh-read\)/, "titles at reading size");
  assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/1px solid|gap:2px/g, ""), /\b\d+px\b|#[0-9a-f]{3,8}\b|rgba?\(/i);
  assert.doesNotMatch(css, /\n\.ch-(list|row|main|t|m|a)\{/, "no global ch- rules left to leak into the panel's Changes");
});
t("Chats opens at its top, the newest first; a chat still opens at its latest", () => {
  const app = read("js/app.js"), fo = read("modules/conversation/follow.js");
  assert.match(app, /if \(opening\) \{ C\.rendered = v; if \(v === "chats"\) C\.follow\.toTop\(\); else C\.follow\.toLatest\(false\); \}/);
  assert.match(fo, /function toTop\(\) \{\n\s*pinned = false; held = false;\n\s*sc\(\)\.scrollTop = 0; lastTop = 0;/);
  assert.match(app, /follow: \{ toLatest, toTop, unpin/, "the main chat's follower has it too");
});
t("the agent is its mark, its name only on hover and for screen readers: the header, the composer's line, replies", () => {
  const src = read("modules/chats/chats.js").replace(/\/\*\* @type \{string\} \*\/ \((agent|s\.agent)\)/g, "$1");
  assert.match(src, /const agentMark = \(agent, lead = true\) => rtMark\(agent, \{ lead \}\) \|\| /);
  assert.match(src, /<span class="pj-s">\$\{metaHtml\(s\)\}<\/span>/);
  assert.match(src, /return `<span class="iq-l">\$\{rtMark\(st\.agent, \{ lead: true \}\) \|\| ""\}/, "the chip: the mark beside the model");
  assert.match(src, /`<div class="av av-t">\$\{rtMark\(s\.agent\) \|\| ICON\.thread\}<\/div>`/);
  assert.doesNotMatch(src, /\$\{esc\(cliName\(st\.agent\)\)\} · /);
});
t("the New chat picker is the shared picker's look: the chip opens it, agents as a segment with their marks, models and folders as rows, thinking as the depth segment", () => {
  const src = read("modules/chats/setup.js"), app = read("js/app.js"), css = read("css/app.css");
  assert.match(src, /<div class="iq-route" role="radiogroup" aria-labelledby="cs-agent-l">/);
  assert.match(src, /data-cs-agent="\$\{esc\(r\.name\)\}">\$\{rtMark\(r\.name, \{ withName: true \}\)/);
  assert.match(src, /<div class="iq-list" role="radiogroup" aria-labelledby="cs-model-l">/);
  assert.match(src, /<div class="iq-route iq-depth" role="radiogroup" aria-labelledby="cs-e-l">/);
  assert.match(src, /toggleSetup\(anchor, part\) \{ if \(C\.pop\.open && C\.pop\.part === part\) closeSetup\(\); else openSetup\(anchor, part\); \}/, "each chip opens its own list");
  assert.match(src, /const x = part === "model" \? r\.right - w \+ gap : r\.left - gap;/, "the model list by the chip's right edge, folder and permission by their left");
  assert.match(app, /\$\("#cs-perm"\)\.addEventListener\("click", \(\) => \{ if \(S\.view !== "chats"\) return; CH\.toggleSetup\(\$\("#cs-perm"\), "mode"\);/);
  assert.match(read("index.html"), /<button type="button" class="target cs-perm" id="cs-perm" aria-haspopup="dialog" aria-expanded="false" aria-controls="cs-pop" hidden><\/button>/);
  assert.match(src, /import \{ EFFORT_WORD, EFFORT_HINT \} from "\.\/effort\.js";/, "one set of thinking words");
  assert.match(app, /if \(S\.view === "chats"\) \{ CH\.toggleSetup\(\$\("#iq"\), "model"\);/);
  assert.match(app, /const html = chat \? CH\.chipHtml\(K\.view\) : IQ\.chipHtml/);
  assert.doesNotMatch(src + css, /cs-grid|class="cs-mode|xo-select data-cs|tg-ch/, "the form of dropdowns is gone");
  assert.match(app, /const ag = e\.target\.closest\("\[data-cs-agent\]"\);/);
});
t("Chats' header line runs the row's width: the project cap only shares a row with something in .top-end; the folder chip is the folder's name alone", () => {
  assert.match(read("css/app.css"), /\.top\[data-kind="project"\]:has\(> \.top-end:empty\) \.top-who\{flex:1;max-width:none\}/);
  assert.match(read("modules/chats/chats.js"), /return `\$\{ICON\.folder\}<span>\$\{esc\(capFirst\(folderName\(st\.cwd\)\.replace\(\/\^your \/, ""\)\)\)\}<\/span>`;/);
});

t("Chats starts with its composer: under the greeting at the top, the dock back at the foot in a chat", () => {
  const app = read("js/app.js"), html = read("index.html"), css = read("css/app.css");
  assert.match(html, /id="scroller"[^>]*>\s*<h1 class="cs-hi" id="cs-hi" hidden>What can I help with\?<\/h1>\s*<p class="cs-sub" id="cs-sub" hidden>[^<]+<\/p>/);
  assert.match(app, /dockAtTop\(v === "chats"\);/);
  assert.match(app, /if \(top\) \$\("#cs-sub"\)\.after\(dock\); else \$\("#drop-veil"\)\.after\(dock\);/);
  assert.match(app, /had\?\.focus\(\{ preventScroll: true \}\)/, "focus in the composer survives the move");
  assert.match(css, /\.dock\.is-top>\.herald\{top:calc\(100% \+ \(var\(--s-10\) - var\(--h-ctl\)\) \/ 2\);bottom:auto\}/, "a notice drops under the composer, never over the greeting or the box");
  assert.match(css, /\.main:has\(\.dock\.is-top\)\{--dock-h:0px\}/, "nothing reserves the foot's room on Chats");
  assert.match(css, /\.cs-hi\{[^}]*var\(--fs-display\)\/var\(--lh-display\)/, "the greeting is Home's display role");
});
t("Recent: the three latest under the composer, all of them a click away with a search over titles and lines, second lines only for what isn't the default", () => {
  const src = read("modules/chats/list.js"), app = read("js/app.js");
  assert.match(src, /<button type="button" class="chl-more" data-chl-all="1">All chats<span class="chl-n"> · \$\{rows\.length\}<\/span><\/button>/, "a link, not a switch");
  assert.match(src, /<h2 class="chl-k">All chats<\/h2><label class="tg-qf chl-q">\$\{ICON\.search\}<input type="search" data-chl-q[^`]*<button type="button" class="chl-more" data-chl-all="0">Show less<\/button>/);
  assert.doesNotMatch(src, /chl-seg/);
  assert.match(read("css/app.css"), /\.chl-more\{[^}]*padding:0 var\(--halo\);margin-right:calc\(-1 \* var\(--halo\)\);border-radius:var\(--r\)/, "a text control: its fill reaches --halo past its words");
  assert.match(src, /const RECENT = 3;/);
  assert.match(src, /few \? rows\.slice\(0, RECENT\) : q \? rows\.filter\(\(s\) => `\$\{titleFor\(s\)\} \$\{rowLine\(s\)\}`\.toLowerCase\(\)\.includes\(q\)\)/);
  assert.match(read("css/app.css"), /\.scroller:has\(\.chl-few,\.chl-calm\)>\.column\{height:0;margin-bottom:auto\}/, "at rest the composer stands in the middle");
  assert.match(src, /No chats match/);
  const chats = read("modules/chats/chats.js");
  assert.doesNotMatch(chats.slice(chats.indexOf("const rowLine"), chats.indexOf("const waiting")), /Default model/);
  assert.match(app, /e\.target\.matches\?\.\("\[data-chl-q\]"\)\) CH\.search\(e\.target\.value\)/);
  assert.doesNotMatch(read("css/panel.css"), /\.stage \.tg-qf/, "the search field is one shared look");
});
t("Chats has no bar over its greeting: the greeting is the title, a phone keeps its menu", () => {
  const css = read("css/app.css"), ph = read("shell/phone.css"), src = read("modules/chats/chats.js");
  assert.match(css, /@media \(min-width:761px\)\{\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \.top\{display:none\}\}/);
  assert.match(ph, /\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \#top-who\{display:none\}/);
  assert.match(src, /v === "chats" \? "Ask anything to start a chat…"/);
});
t("what it may do on its own reads as a choice you make about trust: a question, each mode its mark and sentence, careful first", () => {
  const src = read("modules/chats/setup.js"), css = read("css/app.css");
  assert.match(src, /How much should it do on its own\?/);
  assert.match(src, /plan: \["Plan only", "[^"]+", "lightbulb"\],\n  ask: \["Ask first", "[^"]+", "question"\],\n  accept_edits: \["Edits", "[^"]+", "edit"\],\n  auto: \["Auto", "[^"]+", "shield-check"\]/);
  assert.match(src, /\$\{xi\(ic, "cs-mi"\)\}<span class="cs-mt"><span class="iq-n">/);
  assert.match(read("modules/chats/chats.js"), /xi\(MODE_WORDS\[st\.mode\]\?\.\[2\] \|\| "lock"\)/, "the chip wears the chosen mode's mark");
  assert.match(css, /\.cs-md\{font:var\(--fw-regular\) var\(--fs-meta\)\/var\(--lh-meta\) var\(--sans\);color:var\(--ink-3\);text-wrap:pretty\}/);
});
t("switching to All keeps the greeting where it stood: no recentring, no scroll", () => {
  const app = read("js/app.js"), css = read("css/app.css");
  const h = app.slice(app.indexOf('closest?.("[data-chl-all]")'), app.indexOf('$("#top").addEventListener("input"'));
  assert.match(h, /setProperty\("--cs-lead", getComputedStyle\(\$\("#cs-hi"\)\)\.marginTop\)/);
  assert.ok(!/scrollIntoView|scrollTo\(/.test(h), "the click never scrolls the page");
  assert.match(css, /\.cs-hi\{[^}]*margin:var\(--cs-lead,auto\) /);
});
t("an open chat has no bar: its model and mode are fixed chips in its composer, its state in the composer's line", () => {
  const app = read("js/app.js"), src = read("modules/chats/chats.js"), css = read("css/app.css"), phone = read("shell/phone.css");
  assert.match(css, /@media \(min-width:761px\)\{\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \.top\{display:none\}\}/);
  assert.match(phone, /\.app:is\(\[data-conv="chats"\],\[data-conv\^="c:"\]\) \#top-who\{display:none\}/, "a phone keeps only its way back");
  assert.match(src, /const st = own \|\| setup\(\);/, "the chips read the chat's own model and mode");
  assert.match(app, /const chat = CH\.isChats\(K\.view\) && K === MK, fixed = chat && K\.view !== "chats";/);
  assert.match(app, /fixChip\(perm, S\.view !== "chats"\)/);
  assert.match(app, /if \(CH\.isChats\(S\.view\)\) return;/, "a fixed chip opens nothing");
  assert.match(src, /return ""; \/\/ the box's own "Reply in this chat…" says it/, "an idle chat's line says nothing the box doesn't");
  assert.match(app, /\$\("#target"\)\.hidden = !html;/);
  assert.match(app, /if \(!CH\.isChats\(S\.view\)\) \{ \$\("#target"\)\.hidden = false; return false; \}/, "every other place keeps its line");
  assert.match(css, /\.is-fixed:is\(\.target,\.iq\),\.is-fixed:is\(\.target,\.iq\):is\(:hover,:active\)\{cursor:default;background:none\}/);
});
t("a phone's composer row never pushes Send out: the model chip gives way, Send now is a filled capsule", () => {
  const css = read("css/app.css");
  assert.match(css, /\.iq\{flex:0 1 auto;/, "the model chip gives way last, ending in an ellipsis");
  assert.match(css, /\.tg-now\{[^}]*border-radius:var\(--r-pill\);background:var\(--btn-fill\);/);
  assert.doesNotMatch(css.match(/\.tg-now\{[^}]*\}/)[0], /border:/, "no rim of its own");
  assert.match(css, /@media \(max-width:760px\)\{\n  \.tg-now\{height:var\(--h-touch\)\}\n[^}]*\n  \.iq \.iq-sep,\.iq \.iq-e\{display:none\}\n  \.target:not\(\.cs-perm\):has\(~ \.tg-now:not\(\[hidden\]\)\)\{display:none\}\n\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
