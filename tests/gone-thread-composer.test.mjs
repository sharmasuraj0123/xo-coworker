import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createComposerTarget } from "../modules/conversation/target.js";
import { createShellRenderer } from "../shell/render.js";
import { dom, same } from "./lib/dom.mjs";
import { flattenStyles } from "../tools/conformance/css-flatten.mjs";

const { document } = await dom('<div id="app"><button id="pb-t"></button><main id="home"></main>'
  + '<section id="conv" tabindex="-1"><div id="msgs"><div class="calm-act"><button data-go="home">Go to Home</button></div></div>'
  + '<div class="cbar"><div class="composer"><textarea id="say"></textarea><label for="say"></label></div></div></section></div>');
globalThis.requestAnimationFrame = () => 1;
const say = document.getElementById("say");
const label = document.querySelector("label");
const region = document.getElementById("conv");
const msgsEl = document.getElementById("msgs");
const home = msgsEl.querySelector("[data-go=home]");
const app = document.getElementById("app");
const state = { view: "t:first" };
const noop = () => {};
const sync = { sync: noop };
const thread = { lastAt: 0 };
const threads = new Map([["t:first", { lastAt: 0 }], ["t:gone", thread]]);
const convThread = (view) => threads.get(view) ?? null;
const world = { state: { loaded: true, threads: [...threads.values()], projects: [] } };
const { syncPlaceholder } = createComposerTarget({
  MK: { get view() { return state.view; }, say, label }, world, CH: { isChats: () => false }, PHONE: { matches: false },
  PROJ: (id) => { assert.equal(id, "project"); return "Project"; }, convThread, convProject: (view) => convThread(view) ? "project" : null,
});
const render = createShellRenderer({
  world, D: { ...sync, needItems: () => [] }, S: state, PAGE_OF: { home: "#home" }, MAIN: { rendered: null },
  pings: noop, dockAtTop: noop, convThread, sideRender: noop, homeRender: noop,
  REC: { artifacts: { render: noop } }, LPP: { render: noop }, topRender: noop, wsHeadRender: noop, drawConv: noop,
  say, msgsEl, placeRegion: () => region, loadAhead: noop, TP: { C: null, tid: null }, STAGE: sync,
  drawThreadPage: noop, dockRender: noop, heraldRender: noop, chatTargetRender: () => true, targetLineRender: noop,
  syncPlaceholder, sendRender: noop, chipRender: noop, MAP: { render: noop }, VW: { notice: noop }, LW: sync, FP: sync,
  titleFor: (_, title) => title, isBusy: () => false,
});

render();
assert.equal(app.hasAttribute("data-gone"), false);
assert.equal(say.placeholder, "Reply to the agent…");
const crumb = document.querySelector("#pb-t svg");
assert.ok(crumb);
state.view = "t:gone";
render();
assert.equal(app.dataset.conv, "t:gone");
same(document.querySelector("#pb-t svg"), crumb, "switching conversations preserves the breadcrumb icon");
say.focus();
threads.delete(state.view);
render();
assert.equal(app.hasAttribute("data-gone"), true);
assert.equal(say.placeholder, "Message");
assert.equal(label.textContent, "Message");
same(document.activeElement, home);
home.hidden = true;
say.focus();
render();
same(document.activeElement, region, "if Go to Home is unavailable, focus the conversation");
threads.set(state.view, thread);
render();
assert.equal(app.hasAttribute("data-gone"), false);

const published = flattenStyles(fileURLToPath(new URL("../", import.meta.url)));
const declarations = (selector) => Object.fromEntries(published
  .filter((entry) => entry.property && entry.context.some((scope) => scope.selector === selector))
  .map(({ property, value }) => [property, value]));
assert.equal(declarations(".app[data-gone] .composer").display, "none");
const bar = declarations(".app[data-gone] .cbar");
assert.equal(bar.padding, "0");
assert.equal(bar.background, "none");
