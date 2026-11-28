import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createComposerTarget } from "../modules/conversation/target.js";
import { workspaceRendererModule } from "../shell/render.js";
import { createRedrawFocus } from "../shell/redraw-focus.js";
import { dom, same } from "./lib/dom.mjs";
import { flattenStyles } from "../tools/conformance/css-flatten.mjs";
import { createKernel } from "../core/kernel/index.js";
import { definePlaces } from "../shell/places.js";

const { document } = await dom('<div id="app"><button id="pb-t"></button><main id="home"></main><main id="arts"></main><main id="lpp"></main><main id="auto"></main><div id="ws-head"></div>'
  + '<section id="conv" tabindex="-1"><div id="msgs"><div class="calm-act"><button data-go="home">Go to Home</button></div></div>'
  + '<div class="cbar"><div class="composer"><textarea id="say"></textarea><label for="say"></label></div></div></section></div>');
const { conversationContentModule } = await import("../modules/conversation/main-viewport.js");
globalThis.requestAnimationFrame = () => 1;
const say = document.getElementById("say");
const label = document.querySelector("label");
const region = document.getElementById("conv");
const msgsEl = document.getElementById("msgs");
const home = msgsEl.querySelector("[data-go=home]");
const app = document.getElementById("app");
const state = { view: "t:first" };
const redrawFocus = createRedrawFocus();
const noop = () => {};
const warnings = [];
const kernel = createKernel({ warn: (...details) => warnings.push(details) });
definePlaces(kernel);
const thread = { lastAt: 0 };
const threads = new Map([["t:first", { lastAt: 0 }], ["t:gone", thread]]);
const convThread = (view) => threads.get(view) ?? null;
const world = { state: { loaded: true, threads: [...threads.values()], projects: [] } };
const { syncPlaceholder } = createComposerTarget({
  MK: { get view() { return state.view; }, say, label }, world, CH: { isChats: () => false }, PHONE: { matches: false },
  PROJ: (id) => { assert.equal(id, "project"); return "Project"; }, convThread, convProject: (view) => convThread(view) ? "project" : null,
});
const services = {
  world, currentView: () => state.view, placeContext: { convThread, projects: () => [] }, redrawFocus,
  decisionPresentation: { D: { needItems: () => [] }, Kit: { titleFor: (_, title) => title }, pings: noop },
  threadPresentation: { isBusy: () => false }, rail: { rows: noop }, conversationHeader: noop,
  conversationSession: { main: { rendered: null }, composer: { say }, region: () => region }, mainViewport: { msgsEl, loadAhead: noop },
};
kernel.register({
  manifest: { id: "test.frame", version: "1.0.0", kernel: "^1.1.0", provides: Object.keys(services), contributes: ["workspace.paint:composer"] },
  activate(ctx) {
    for (const [name, service] of Object.entries(services)) ctx.provide(name, service);
    ctx.contribute("workspace.paint", { id: "composer", paint: () => syncPlaceholder() });
  },
});
kernel.register(conversationContentModule);
kernel.register(workspaceRendererModule);
assert.deepEqual((await kernel.start()).failed, []);
function render() {
  kernel.bus.emit("app:render");
  assert.deepEqual(warnings, []);
}

render();
assert.equal(app.hasAttribute("data-gone"), false);
assert.equal(say.placeholder, "Reply to the agent…");
const crumb = document.querySelector("#pb-t svg");
assert.ok(crumb);
state.view = "t:gone";
render();
assert.equal(app.dataset.conv, "t:gone");
same(document.querySelector("#pb-t svg"), crumb, "switching conversations preserves the breadcrumb icon");
const next = document.createElement("button");
next.id = "next-focus";
redrawFocus.request(["#missing", "#next-focus", () => say]);
msgsEl.append(next);
render();
same(document.activeElement, next, "redraw resolves the first usable control after it appears");
say.focus();
render();
same(document.activeElement, say, "a redraw consumes its focus request");
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

kernel.dispose();
const published = flattenStyles(fileURLToPath(new URL("../", import.meta.url)));
const declarations = (selector) => Object.fromEntries(published
  .filter((entry) => entry.property && entry.context.some((scope) => scope.selector === selector))
  .map(({ property, value }) => [property, value]));
assert.equal(declarations(".app[data-gone] .composer").display, "none");
const bar = declarations(".app[data-gone] .cbar");
assert.equal(bar.padding, "0");
assert.equal(bar.background, "none");
