// @ts-check
import assert from "node:assert/strict";
import { clearTimeout, setImmediate, setInterval, setTimeout } from "node:timers";
import { dom, same } from "./lib/dom.mjs";
import { bootPage } from "./lib/page.mjs";
import { stageFixture } from "./lib/stage-fixture.mjs";
import { publishedRules } from "./lib/css-snapshot.mjs";
import { mediaHolds } from "./lib/cascade.mjs";
import { createShellPanel } from "../modules/shells/panel.js";
import { SHELL_DOCK } from "../shell/overlays.js";
const { stage: withoutShells } = await stageFixture({ shell: null });
assert.equal(Boolean(withoutShells.querySelector("[data-stg-shell]")), false);
const mounts = [];
const { stage, panel, window: panelWindow } = await stageFixture({ shell: (...args) => mounts.push(args) });
const shellButton = stage.querySelector("[data-stg-shell]");
assert.equal(shellButton.getAttribute("aria-pressed"), "false");
shellButton.dispatchEvent(new panelWindow.Event("click", { bubbles: true }));
assert.equal(panel.isShell, true);
assert.equal(shellButton.getAttribute("aria-pressed"), "true");
assert.equal(mounts[0][0], true);
assert.equal(mounts[0][2], "p:one");
const body = stage.querySelector(".stg-body");
assert.deepEqual([...body.children].map((el) => el.className), ["stg-frames", "stg-page"]);
same(mounts[0][1].closest(".stg-page"), body.lastElementChild);
shellButton.dispatchEvent(new panelWindow.Event("click", { bubbles: true }));
assert.equal(panel.isShell, false);
assert.equal(shellButton.getAttribute("aria-pressed"), "false");
assert.deepEqual(mounts.at(-1), [false]);

const { document: entry } = await bootPage();
const toggle = entry.getElementById("nv-shells");
assert.ok(toggle, "the sidebar has a Shells toggle");
assert.equal(toggle.tagName, "BUTTON");
assert.equal(toggle.getAttribute("aria-label"), "Shells");
assert.equal(toggle.getAttribute("aria-pressed"), "false");
assert.equal(toggle.hidden, true);
assert.deepEqual([...toggle.children].map((child) => child.className), ["gear-ic", "sh-n"]);

// the app: the dock itself moves (no second terminal), a shell opens where it was asked for, and it goes back home
const { document, window } = await dom(`<main><i id="before"></i>${SHELL_DOCK.trim()}<i id="after"></i></main><aside id="host"></aside>`);
const dock = document.getElementById("shd");
const dockHome = dock.parentNode;
const relocations = new Set();
globalThis.MutationObserver = class extends window.MutationObserver {
  observe(node, options) {
    if (node === dock) relocations.add(this);
    return super.observe(node, options);
  }
  disconnect() {
    relocations.delete(this);
    return super.disconnect();
  }
};
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
const { panelShell, dispose } = createShellPanel({ S: { view: "p:project" }, STAGE, SH,
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
assert.equal(dock.getAttribute("aria-label"), "Shells");

SH.enabled = true;
const opening = Array.from({ length: 4 }, () => Promise.withResolvers());
let openCount = 0;
SH.openProject = () => opening[openCount++].promise;
STAGE.isShell = true;
const retired = panelShell(true, host, "p:one");
await panelShell(false);
const active = panelShell(true, host, "p:two");
opening[0].resolve();
await retired;
assert.equal(STAGE.isShell, true, "an old open cannot close a newer shell page");
dock.hidden = false;
opening[1].resolve();
await active;
assert.equal(STAGE.isShell, true);

const showError = new Error("Cannot mount a terminal");
const reported = [];
const priorReporter = globalThis.reportError;
globalThis.reportError = (error) => reported.push(error);
try {
  const broken = panelShell(true, host, "p:three");
  opening[2].reject(showError);
  await broken;
  assert.deepEqual(reported, [showError], "an unexpected failure reaches the shared error reporter once");
  assert.equal(STAGE.isShell, false, "a failed current open closes its page");
} finally {
  globalThis.reportError = priorReporter;
}

STAGE.isShell = true;
const pending = panelShell(true, host, "p:four");
assert.equal(relocations.size, 1);
assert.ok(dock.parentNode === host);
const beforeDispose = calls.slice();
dispose();
assert.equal(relocations.size, 0, "disposing disconnects the relocation observer");
assert.ok(dock.parentNode === dockHome, "disposal restores the original parent");
assert.ok(dock.nextSibling === document.getElementById("after"), "disposal restores the original position");
assert.equal(dock.classList.contains("in-panel"), false);
dock.hidden = true;
opening[3].resolve();
await pending;
assert.deepEqual(calls, beforeDispose, "a retained dock and pending open cannot change the Stage after disposal");

const rules = publishedRules();
const propertiesFor = (selector) => Object.fromEntries(rules.filter(({ sel }) => sel === selector)
  .flatMap(({ declarations }) => declarations.map(({ p, v }) => [p, v])));
assert.deepEqual(propertiesFor(".stg-body>*"), { "grid-area": "1/1", "min-width": "0", "min-height": "0" });
assert.deepEqual(propertiesFor(".stage.is-covered .stg-frames"), { visibility: "hidden", "content-visibility": "hidden" });
const hidesShellButton = (width) => rules.some(({ sel, at, declarations }) => sel === ".stg-shell-b"
  && at.every((context) => mediaHolds(context, width) !== false)
  && declarations.some(({ p, v }) => p === "display" && v === "none"));
assert.equal(hidesShellButton(760), true);
assert.equal(hidesShellButton(761), false);

await checkAppShellDock();

async function checkAppShellDock() {
  const { document: app, window: browser } = await bootPage();
  const storage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const matches = browser.Element.prototype.matches;
  browser.Element.prototype.matches = function (selector) {
    if (selector === ":focus-within") return this.contains(app.activeElement);
    if (selector === ":focus-visible") return this === app.activeElement;
    return matches.call(this, selector);
  };
  browser.HTMLElement.prototype.scrollTo = function () {};
  Object.assign(globalThis, {
    location: new URL("http://localhost/"),
    history: { replaceState() {}, pushState() {} },
    sessionStorage: storage,
    localStorage: storage,
    MutationObserver: browser.MutationObserver,
    ResizeObserver: class { observe() {} disconnect() {} },
    customElements: browser.customElements,
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener: browser.addEventListener.bind(browser),
    removeEventListener: browser.removeEventListener.bind(browser),
    getComputedStyle: browser.getComputedStyle,
    requestAnimationFrame: (fn) => setTimeout(() => fn(performance.now()), 0),
    cancelAnimationFrame: clearTimeout,
    setInterval: (fn, ms) => setInterval(fn, ms).unref(),
    setTimeout: (fn, ms) => setTimeout(fn, ms).unref(),
    EventSource: class { addEventListener() {} close() {} },
    fetch: async (url) => {
      const path = new URL(String(url), "http://localhost/").pathname;
      if (path === "/api/terminal/status") return Response.json({ enabled: true });
      if (path === "/api/terminal/sessions") {
        return Response.json({ terminals: [{ id: "workspace-shell", name: "Workspace", scope: "workspace", status: "running" }] });
      }
      return Response.json({});
    },
  });
  await import("../boot.js");
  await new Promise(setImmediate);

  const press = (selector) => {
    const control = app.querySelector(selector);
    assert.ok(control, `boot renders ${selector}`);
    control.dispatchEvent(new browser.Event("click", { bubbles: true, cancelable: true }));
  };
  const appDock = app.getElementById("shd");
  assert.ok(appDock);
  const parent = appDock.parentNode, next = appDock.nextSibling;
  press("#nv-ws");
  await new Promise(setImmediate);
  press("[data-stage-toggle]");
  press("[data-stg-shell]");
  assert.ok(appDock.closest("#stage .stg-page"), "the app moves its existing Shells dock into the Stage page");
  assert.equal(appDock.hidden, false);
  assert.equal(app.querySelectorAll("#shd").length, 1);
  press("[data-stg-shell]");
  same(appDock.parentNode, parent, "closing the Stage Shells page restores the dock's parent");
  same(appDock.nextSibling, next, "closing the Stage Shells page restores the dock's position");
  assert.equal(appDock.hidden, true);

  press('[data-fr-fold="map"]');
  const map = app.getElementById("fr-body-map");
  for (const deadline = performance.now() + 1000; !map.querySelector(".dg-edges") && performance.now() < deadline;) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(map.querySelectorAll("svg.dg-edges").length, 1, "the open Map draws its edge layer");
  assert.equal(map.querySelectorAll('svg[stroke="currentColor"][fill="none"]').length, 0, "Map keeps the pen off SVG roots");
  press("[data-stage-toggle]");
}

console.log("panel-shell: ok");
