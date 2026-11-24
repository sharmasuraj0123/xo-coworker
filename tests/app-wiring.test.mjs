// @ts-check
import assert from "node:assert/strict";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { STONE, FLAVOURS } from "../core/ui/flavours.js";
import { xi } from "../core/ui/icons/icon.js";
import { ICON } from "../core/ui/icons/names.js";
import { appDocument } from "../tools/conformance/templates.mjs";
import { dom } from "./lib/dom.mjs";

const markup = appDocument(fileURLToPath(new URL("../", import.meta.url)));
const { window, document } = await dom(markup.documentElement.outerHTML);
const storage = new Map([["cv-theme", "light"], ["cv-flavour", "onyx"]]);
const blockedStorage = new Set();
let phone = false;
/** @type {string[]} */
const clipboard = [];
/** @type {FrameRequestCallback[]} */
const frames = [];
const matches = window.Element.prototype.matches;
window.HTMLElement.prototype.scrollTo = function () {};
window.Element.prototype.matches = function (/** @type {string} */ selector) {
  if (selector === ":focus-within") return this.contains(document.activeElement);
  if (selector === ":focus-visible") return this === document.activeElement;
  return matches.call(this, selector);
};
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  history: { replaceState() {}, pushState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: {
    getItem: (/** @type {string} */ key) => storage.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => {
      if (blockedStorage.has(key)) throw new DOMException("QuotaExceededError");
      storage.set(key, value);
    },
  },
  MutationObserver: window.MutationObserver,
  ResizeObserver: class { observe() {} disconnect() {} },
  customElements: window.customElements,
  isSecureContext: true,
  matchMedia: (/** @type {string} */ query) => ({ get matches() { return query === "(max-width: 760px)" && phone; }, addEventListener() {}, removeEventListener() {} }),
  getComputedStyle: window.getComputedStyle,
  requestAnimationFrame: (/** @type {FrameRequestCallback} */ fn) => frames.push(fn),
  setInterval: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setInterval(fn, ms).unref(),
  setTimeout: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setTimeout(fn, ms).unref(),
  fetch: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
  EventSource: class { addEventListener() {} close() {} },
});
Object.defineProperty(navigator, "clipboard", { value: { writeText: async (/** @type {string} */ text) => { clipboard.push(text); } } });

await import("../boot.js");
await new Promise((resolve) => setImmediate(resolve));
for (const frame of frames.splice(0)) frame(performance.now());

const ringFixture = document.createElement("section");
ringFixture.innerHTML = '<div class="vw-body vw-diff" tabindex="0"></div>';
document.body.append(ringFixture);
const ringRegion = ringFixture.firstElementChild;
Object.defineProperty(ringRegion, "offsetParent", { value: ringFixture });
ringRegion.focus();
for (const frame of frames.splice(0)) frame(performance.now());
assert.equal(ringFixture.querySelectorAll(".region-ring").length, 1, "boot installs one keyboard region ring");
ringRegion.blur();
assert.ok(!ringFixture.querySelector(".region-ring"), "boot clears the region ring when focus leaves");
ringFixture.remove();

const recipients = document.querySelector("#at-list");
recipients.innerHTML = '<li id="at-0" role="option" aria-selected="true">First</li>'
  + '<li id="at-1" role="option" aria-selected="false">Second</li>';
recipients.lastElementChild.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
assert.equal(document.querySelector("#say").getAttribute("aria-activedescendant"), "at-1");
assert.deepEqual(Array.from(recipients.querySelectorAll('[aria-selected="true"]'), (node) => node.id), ["at-1"]);
recipients.firstElementChild.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
recipients.replaceChildren();
document.querySelector("#say").removeAttribute("aria-activedescendant");

for (const id of ["arts", "lpp", "panel", "pn-h", "pn-count", "pn-x", "pn-rail", "pn-stage", "pn-foot", "viewer", "toast", "shd"]) {
  assert.equal(document.querySelectorAll(`#${id}`).length, 1, `boot mounts exactly one #${id}`);
}
assert.deepEqual(
  [...document.querySelector("main").children].map((node) => node.id || node.className),
  ["phonebar", "home", "arts", "lpp", "conv", "drop-veil", "dock", "panel", "viewer", "toast-wrap", "settings", "stage"],
  "boot preserves the main landmark's region order",
);
assert.ok(document.querySelector("#main").nextElementSibling === document.querySelector("#shd"), "Shells follows the main landmark in the app");
assert.equal(document.querySelector("#main").tagName, "MAIN");
assert.equal(document.querySelector("#side").getAttribute("aria-label"), "Navigation");
assert.equal(document.querySelector("#panel").getAttribute("aria-labelledby"), "pn-h");
assert.equal(document.querySelector("#pn-h").textContent, "Needs you");
assert.equal(document.querySelector("#shd").getAttribute("aria-label"), "Shells");
assert.equal(document.querySelector("#toast").getAttribute("role"), "status");

assert.ok(document.querySelector("#brand-mark svg"), "boot installs the visible brand icon");
assert.ok(document.querySelector("#side-fold svg"), "boot installs the sidebar fold icon");
const expectedIcon = document.createElement("span");
expectedIcon.innerHTML = xi("dashboard");
assert.equal(document.querySelector("#ic-more").innerHTML, expectedIcon.innerHTML, "More uses the dashboard icon");
expectedIcon.innerHTML = ICON.right;
assert.equal(document.querySelector("#nv-more .nr-chev").innerHTML, expectedIcon.innerHTML, "More shows the right chevron");
assert.equal(document.querySelector("#home").hidden, false, "boot starts on Home");
assert.equal(document.documentElement.dataset.theme, "light", "boot restores the stored mode");
assert.equal(document.documentElement.dataset.flavour, "onyx", "boot restores the stored flavour");

const press = (/** @type {string} */ selector, detail = 0) => {
  const button = document.querySelector(selector);
  assert.ok(button, selector);
  button.dispatchEvent(Object.assign(new window.Event("click", { bubbles: true, cancelable: true }), { detail }));
};
const fold = document.querySelector("#side-fold");
fold.focus();
assert.ok(document.activeElement === fold, "the sidebar toolbar still has a focusable fold control");
fold.blur();
const sidebarMore = document.querySelector("#side-more");
press("#nv-more", 1);
assert.ok(document.activeElement === sidebarMore, "a pointer opens More with focus on the menu");
const moreItem = sidebarMore.querySelector("[role=menuitem]");
moreItem.dispatchEvent(new window.Event("pointermove", { bubbles: true }));
assert.ok(document.activeElement === moreItem, "moving onto a More item focuses it");
press("#nv-more");
press("#nv-more");
assert.ok(document.activeElement === sidebarMore.querySelector("[role=menuitem]"), "keyboard opening focuses the first More item");
press("#nv-more");

const threadActions = document.createElement("div");
threadActions.innerHTML = '<button data-tmenu="fixture-thread">Actions</button>'
  + '<div role="menu" class="tw-menu"><button role="menuitem">Move thread</button></div>';
document.querySelector("#app").append(threadActions);
press("[data-tmenu=fixture-thread]", 1);
assert.ok(document.activeElement === threadActions.lastElementChild, "a pointer opens thread actions with focus on the menu");
press("[data-tmenu=fixture-thread]");
press("[data-tmenu=fixture-thread]");
assert.ok(document.activeElement === threadActions.querySelector("[role=menuitem]"), "keyboard opening focuses the first thread action");
press("[data-tmenu=fixture-thread]");
threadActions.remove();

press("#nv-ws");
assert.equal(document.querySelector("#nv-ws").getAttribute("aria-current"), "page", "Workspace replaces Home");
assert.equal(document.querySelector("#app").dataset.conv, "ws", "the shell tracks the active conversation");
assert.match(document.querySelector("#ws-head").textContent, /Your coordinator, across all 0 projects/);
const message = document.createElement("div");
message.className = "m-them";
message.innerHTML = '<div class="mb"><div class="prose"><p>Run this:</p><div class="md-code"><div class="md-code-head">JavaScript <button>Copy</button></div><pre><code>const answer = 42;</code></pre></div><p>Then check it.</p></div></div>';
document.querySelector("#msgs").append(message);
const touch = Object.assign(new window.Event("touchstart", { bubbles: true }), { touches: [{ clientX: 50, clientY: 50 }] });
const realTimeout = globalThis.setTimeout;
/** @type {(() => void)[]} */
const pressTimers = [];
try {
  globalThis.setTimeout = (callback) => pressTimers.push(callback);
  message.querySelector("p").dispatchEvent(touch);
} finally {
  globalThis.setTimeout = realTimeout;
}
for (const callback of pressTimers) callback();
press('.lp-menu [data-lp="copy"]');
assert.deepEqual(clipboard, ["Run this:\n\nconst answer = 42;\n\nThen check it."], "long-press copies only the message text through boot's gesture wiring");
message.remove();
press("#nv-home");
assert.equal(document.querySelector("#nv-home").getAttribute("aria-current"), "page", "Home navigation restores Home");
assert.equal(document.querySelector("#app").dataset.conv, "home", "the shell tracks Home after navigation");
assert.ok(document.querySelector("#ws-head").closest("[hidden]"), "Home hides the Workspace conversation");

const jump = document.querySelector("#jump");
const app = document.querySelector("#app");
const key = (/** @type {string} */ name, mods = {}) => {
  const event = Object.assign(new window.Event("keydown", { cancelable: true }), { key: name, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods });
  window.dispatchEvent(event);
  return event;
};
assert.equal(key("b", { metaKey: true, shiftKey: true }).defaultPrevented, true);
assert.ok(app.classList.contains("side-folded"));
assert.equal(fold.getAttribute("aria-expanded"), "false");
key("b", { metaKey: true, shiftKey: true });
assert.ok(!app.classList.contains("side-folded"));
assert.equal(key("k", { metaKey: true }).defaultPrevented, true, "boot registers the Jump shortcut");
assert.equal(jump.hidden, false);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(app.inert, true, "the app's Jump layer holds the application inert");
const jumpField = document.querySelector("#jump-q");
Object.defineProperty(jumpField, "tabIndex", { value: 0 });
fold.focus();
assert.equal(key("Tab").defaultPrevented, true, "the app's Jump layer traps Tab");
assert.ok(document.activeElement === jumpField, "Tab moves focus back into Jump");
assert.equal(key("Escape").defaultPrevented, true);
assert.equal(jump.hidden, true, "Escape dispatches through the app's Jump layer");
assert.equal(app.inert, false, "closing Jump returns the application to interaction");

fold.focus();
const shortcuts = document.querySelector("#keys");
assert.equal(key("?").defaultPrevented, true, "boot registers the Shortcuts key");
assert.equal(shortcuts.hidden, false);
assert.ok(document.activeElement === shortcuts.querySelector("[data-close]"), "opening Shortcuts focuses its close button");
key("Escape");
assert.equal(shortcuts.hidden, true, "Escape closes Shortcuts");
assert.ok(document.activeElement === fold, "closing Shortcuts restores the previous focus");
await new Promise((resolve) => setImmediate(resolve));

press("#set-side");
assert.equal(document.querySelector("#settings").hidden, false, "sidebar opens Settings");
press('#settings [data-set="appearance"]');
assert.equal(document.querySelector('#settings [data-page="appearance"]').hidden, false, "Appearance is the visible Settings page");
assert.deepEqual([...document.querySelectorAll('#mode-seg [role="radio"]')].map((b) => [b.dataset.mode, b.textContent]), [["dark", "Dark"], ["light", "Light"], ["system", "System"]]);
assert.deepEqual([...document.querySelectorAll('#flavour-seg [role="radio"]')].map((b) => [b.dataset.flavour, b.textContent]), [STONE, ...FLAVOURS].map(({ id, name }) => [id, name]));
press('#mode-seg [data-mode="dark"]');
assert.equal(document.documentElement.dataset.theme, "dark", "choosing Dark applies it immediately");
assert.equal(storage.get("cv-theme"), "dark", "choosing Dark persists it");
assert.equal(document.querySelector('#mode-seg [data-mode="dark"]').getAttribute("aria-checked"), "true");
press('#flavour-seg [data-flavour="stone"]');
assert.equal(document.documentElement.dataset.flavour, undefined, "Stone removes the flavour override");
assert.equal(storage.get("cv-flavour"), "stone", "choosing Stone persists it");
press("#bubbles-tog");
assert.equal(document.documentElement.dataset.msgx, "bubbles");
assert.equal(document.documentElement.dataset.msgxTails, "");
assert.equal(storage.get("cv-bubbles"), "on");
assert.equal(document.querySelector("#bubbles-tog").getAttribute("aria-checked"), "true");
press("#bubbles-tog");
assert.equal(document.documentElement.dataset.msgx, undefined);
assert.equal(document.documentElement.dataset.msgxTails, undefined);
assert.equal(storage.get("cv-bubbles"), "off");

press("#theme");
assert.equal(document.documentElement.dataset.theme, "light", "the theme switch applies Light");
assert.equal(storage.get("cv-theme"), "light", "the theme switch persists Light");
assert.equal(document.querySelector("#theme").getAttribute("aria-checked"), "true");
assert.equal(document.querySelector('#mode-seg [data-mode="light"]').getAttribute("aria-checked"), "true", "the theme switch syncs Appearance");

blockedStorage.add("cv-theme");
press('#mode-seg [data-mode="dark"]');
assert.equal(document.documentElement.dataset.theme, "dark", "the chosen theme stays active for the session");
assert.equal(storage.get("cv-theme"), "light", "refusal leaves the persisted preference alone");
assert.equal(document.querySelector('#mode-seg [data-mode="dark"]').getAttribute("aria-checked"), "true");
const modeRow = document.querySelector("#mode-seg").closest(".set-row");
assert.match(modeRow.querySelector('.set-err[role="alert"]').textContent, /this browser won't keep it after a reload/);
blockedStorage.delete("cv-theme");
press('#mode-seg [data-mode="dark"]');
assert.ok(!modeRow.querySelector(".set-err"), "the inline error clears after a successful write");
assert.equal(document.documentElement.dataset.theme, "dark");
const settings = document.querySelector("#settings");
const settingsClose = document.querySelector("#set-x");
Object.defineProperty(settingsClose, "tabIndex", { value: 0 });
fold.focus();
assert.equal(key("Tab").defaultPrevented, false, "desktop Settings leaves Tab to the browser");
key("Escape");
assert.equal(settings.hidden, true, "Escape closes the app's Settings layer");
await new Promise((resolve) => setImmediate(resolve));

phone = true;
const settingsOpener = document.querySelector("#set-phone");
settingsOpener.focus();
press("#set-phone");
assert.equal(settings.hidden, false, "the phone button opens Settings");
await new Promise((resolve) => setImmediate(resolve));
const home = document.querySelector("#home");
assert.equal(home.inert, true, "Settings holds the background inert");
fold.focus();
assert.equal(key("Tab").defaultPrevented, true, "phone Settings traps Tab");
assert.ok(settings.contains(document.activeElement), "Tab moves focus into Settings");
key("Escape");
assert.equal(settings.hidden, true);
assert.equal(home.inert, false, "closing Settings releases the background");
assert.ok(document.activeElement === settingsOpener, "closing Settings restores the phone opener");
