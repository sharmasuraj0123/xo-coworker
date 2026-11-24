// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { panelSrc } from "./lib/panel-src.mjs";
import { dom } from "./lib/dom.mjs";
import { createShellPanel } from "../modules/shells/panel.js";
const stage = panelSrc;
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

// the panel: a Shell button (only when the app gives it a shell), and one host for every page, over the frames
assert.match(stage, /\$\{shell \? `<button type="button" class="stg-ic stg-shell-b" data-stg-shell aria-pressed="false"/);
assert.match(stage, /`<div class="stg-body"><div class="stg-frames">`/);
assert.match(stage, /`<\/div><div class="stg-page"><\/div><\/div>`;/, "the page host sits over the frames, in the same cell");
assert.match(stage, /if \(t\.closest\("\[data-stg-shell\]"\)\) \{ setShell\(S\.page\?\.name !== "shell"\); return; \}/);

// the app: the dock itself moves (no second terminal), a shell opens where it was asked for, and it goes back home
const { document, window } = await dom('<main><i id="before"></i><section id="shd" hidden></section><i id="after"></i></main><aside id="host"></aside>');
globalThis.MutationObserver = window.MutationObserver;
const dock = document.getElementById("shd");
const host = document.getElementById("host");
const calls = [];
const STAGE = { isShell: true, shellOff() { this.isShell = false; calls.push("off"); } };
const SH = {
  enabled: true,
  hide() { dock.hidden = true; calls.push("hide"); },
  openWorkspace() { calls.push("workspace"); },
  openProject(project) { dock.hidden = false; calls.push(project); },
  openThread(thread) { dock.hidden = false; calls.push(thread); },
};
const { panelShell } = createShellPanel({ S: { view: "p:project" }, STAGE, SH,
  world: { thread: (id) => ({ project: "project", chatId: "chat", id, title: "Review" }) },
  heraldShow: (notice) => calls.push(notice.text),
});
panelShell(true, host, "t:thread");
await Promise.resolve();
assert.ok(host.firstElementChild === dock, "mount the existing dock");
assert.ok(dock.classList.contains("in-panel"));
assert.deepEqual(calls, [{ project: "project", chatId: "chat", ts: "thread", title: "Review" }]);
dock.hidden = true;
await Promise.resolve();
assert.deepEqual(calls.slice(-1), ["off"], "hiding the dock closes the panel page");
STAGE.isShell = true;
panelShell(true, host);
await Promise.resolve();
assert.deepEqual(calls.slice(-1), ["project"], "use the current view when no opener provided one");
STAGE.isShell = false;
panelShell(false, host);
assert.ok(dock.nextSibling === document.getElementById("after"), "restore the original sibling");
assert.equal(dock.classList.contains("in-panel"), false);
assert.deepEqual(calls.slice(-1), ["hide"]);
STAGE.isShell = true;
panelShell(true, host, "home");
await Promise.resolve();
assert.deepEqual(calls.slice(-2), ["workspace", "off"], "close the page when the shell never appeared");
SH.enabled = false;
STAGE.isShell = true;
panelShell(true, host);
assert.deepEqual(calls.slice(-2), ["off", "Shells aren't on here"]);
assert.match(app, /shell: \(on, host, where\) => panelShell\(on, host, where\)/);

// the left panel's Shells stay: its toggle and the dock under the page are untouched
assert.match(html, /<button type="button" class="gear is-ic sh-tog" id="nv-shells" aria-pressed="false" aria-label="Shells" hidden><span class="gear-ic" id="ic-shells"><\/span><span class="sh-n"><\/span><\/button>/);
assert.match(html, /<section class="shd" id="shd" aria-label="Shells" hidden><\/section>/);

// CSS: tokens only; the page over the frames in one cell; a phone keeps its own shells sheet
const block = css.slice(css.indexOf("── Shell mode"), ((css.indexOf("/* ──", css.indexOf("── Shell mode") + 4) + 1) || css.length + 1) - 1);
assert.match(block, /\.stg-body>\*\{grid-area:1\/1;min-width:0;min-height:0\}/);
assert.match(block, /\.stage\.is-covered \.stg-frames\{visibility:hidden;content-visibility:hidden\}/);
assert.match(block, /@media \(max-width:760px\)\{\.stg-shell-b\{display:none\}\}/);
assert.doesNotMatch(block.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\b1px solid\b/g, "").replace(/@media \([^)]*\)/g, ""), /\b\d+(\.\d+)?(px|rem|ms)\b/);

console.log("panel-shell: ok");
