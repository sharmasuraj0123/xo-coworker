// @ts-check
import assert from "node:assert/strict";
import { setImmediate, setInterval, setTimeout } from "node:timers";
import { readFileSync } from "node:fs";
import { STONE, FLAVOURS } from "../core/ui/flavours.js";
import { xi } from "../core/ui/icons/icon.js";
import { ICON } from "../core/ui/icons/names.js";
import { deferred, dom } from "./lib/dom.mjs";

const { window, document } = await dom(readFileSync(new URL("../index.html", import.meta.url), "utf8"));
const lastHomeVisit = Date.now() - 86_400_000;
const storage = new Map([
  ["cv-theme", "light"], ["cv-flavour", "onyx"], ["xo-seen", JSON.stringify({ home: lastHomeVisit })],
]);
const blockedStorage = new Set();
const sinceReads = [];
const settingsReads = new Map();
const chatTitleRead = deferred();
/** @type {AbortSignal | undefined} */
let chatTitleSignal;
/** @type {Map<Element, (entries: { target: Element; isIntersecting: boolean }[]) => void>} */
const visibleChatTitles = new Map();
const githubRead = deferred();
/** @type {AbortSignal | undefined} */
let githubSignal;
const artifactsRead = deferred();
/** @type {AbortSignal | undefined} */
let artifactsSignal;
const shellStatus = deferred();
/** @type {AbortSignal | undefined} */
let shellSignal;
let settingsStarted = false;
let phone = false;
let promptCount = 0;
/** @type {string[]} */
const modelReads = [];
const threadDeletes = [];
let holdRunRead = false;
const lateRunRead = deferred();
/** @type {AbortSignal | undefined} */
let runSignal;
/** @type {ReadableStreamDefaultController<Uint8Array>} */
let stream;
const encoder = new TextEncoder();
const commands = Array.from({ length: 9 }, (_, i) => ({
  id: `command-${i + 1}`, kind: "background_command", title: `Command ${i + 1}`, state: "finished",
}));
const run = { id: "sub-agent", kind: "subagent", title: "Read the change", state: "finished", children: commands };
const streamBody = new ReadableStream({ start(controller) {
  stream = controller;
  stream.enqueue(encoder.encode("event: heartbeat\ndata: {}\n\n"));
} });
function retireChat() {
  const data = { type: "session", seq: 1, session_id: "plain-chat", data: { reason: "retired" } };
  stream.enqueue(encoder.encode(`id: 1\nevent: session\ndata: ${JSON.stringify(data)}\n\n`));
}
/** @type {string[]} */
const clipboard = [];
/** @type {Map<number, FrameRequestCallback>} */
const frames = new Map();
const shellRelocationObservers = new Set();
const threadDockObservers = new Set();
const resizeTargets = new WeakMap();
const stageLayoutObservers = new Set();
let nextFrame = 0;
function flushFrames() {
  for (const [id, frame] of [...frames]) if (frames.delete(id)) frame(performance.now());
}
const matches = window.Element.prototype.matches;
window.HTMLElement.prototype.scrollTo = function () {};
window.HTMLElement.prototype.getAnimations = function () { return []; };
const dialogPrototype = Object.getPrototypeOf(document.createElement("dialog"));
dialogPrototype.showModal = function () { this.open = true; };
dialogPrototype.close = function () { this.open = false; this.dispatchEvent(new window.Event("close")); };
const chipRects = window.HTMLElement.prototype.getClientRects;
window.HTMLElement.prototype.getClientRects = function () {
  if (this.id === "iq") return [{ width: 40, height: 20 }];
  return chipRects.call(this);
};
window.Element.prototype.matches = function (/** @type {string} */ selector) {
  if (selector === ":focus-within") return this.contains(document.activeElement);
  if (selector === ":focus-visible") return this === document.activeElement;
  return matches.call(this, selector);
};
Object.assign(globalThis, {
  location: new URL("http://localhost/"),
  innerWidth: 1440,
  innerHeight: 900,
  history: { replaceState() {}, pushState() {} },
  sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  localStorage: {
    getItem: (/** @type {string} */ key) => storage.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => {
      if (blockedStorage.has(key)) throw new DOMException("QuotaExceededError");
      storage.set(key, value);
    },
  },
  MutationObserver: class extends window.MutationObserver {
    observe(node, options) {
      if (node.id === "shd" && options.attributeFilter?.includes("hidden")) shellRelocationObservers.add(this);
      return super.observe(node, options);
    }
    disconnect() {
      shellRelocationObservers.delete(this);
      return super.disconnect();
    }
  },
  ResizeObserver: class {
    constructor() { resizeTargets.set(this, new Set()); }
    observe(node) {
      resizeTargets.get(this).add(node.id);
      if (node.id === "tpdock") threadDockObservers.add(this);
      if (node.matches("#side, .stg-frames")) stageLayoutObservers.add(this);
    }
    disconnect() { resizeTargets.get(this).clear(); threadDockObservers.delete(this); stageLayoutObservers.delete(this); }
  },
  IntersectionObserver: class {
    constructor(callback) { this.callback = callback; this.nodes = new Set(); }
    observe(node) {
      if (node.matches(".chl-row")) { this.nodes.add(node); visibleChatTitles.set(node, this.callback); }
    }
    unobserve(node) { this.nodes.delete(node); visibleChatTitles.delete(node); }
    disconnect() { for (const node of this.nodes) this.unobserve(node); }
  },
  customElements: window.customElements,
  isSecureContext: true,
  matchMedia: (/** @type {string} */ query) => ({
    get matches() { return query === "(prefers-reduced-motion: reduce)" || (query === "(max-width: 760px)" && phone); },
    addEventListener() {}, removeEventListener() {},
  }),
  getComputedStyle: window.getComputedStyle,
  requestAnimationFrame: (/** @type {FrameRequestCallback} */ fn) => {
    frames.set(++nextFrame, fn);
    return nextFrame;
  },
  cancelAnimationFrame: (/** @type {number} */ id) => frames.delete(id),
  setInterval: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setInterval(fn, ms).unref(),
  setTimeout: (/** @type {() => void} */ fn, /** @type {number} */ ms) => setTimeout(fn, ms).unref(),
  fetch: async (input, init) => {
    const path = new URL(String(input), location.href).pathname;
    const resource = path.split("/").at(-1);
    if (path === "/api/chat/stream") return new Response(streamBody);
    if (path === "/api/deploy/demo/check") return Response.json({ project: "demo", state: "ready" });
    if (path === "/api/deploy/demo/preflight") return Response.json({});
    if (path === "/api/terminal/status") {
      shellSignal = init?.signal;
      return shellStatus.promise;
    }
    if (path === "/api/chat/prompt") {
      promptCount++;
      return Response.json({ message: "Temporary failure" }, { status: 500 });
    }
    if (path === "/api/chat/chats/project-chat/threads/boot-thread" && init.method === "DELETE") {
      threadDeletes.push(JSON.parse(init.body));
      return Response.json({});
    }
    if (path === "/api/xo-projects/demo/github/issues") {
      githubSignal = init.signal;
      return githubRead.promise;
    }
    if (path === "/api/chat/chats/project-chat/made") {
      artifactsSignal = init?.signal;
      return artifactsRead.promise;
    }
    if (path === "/api/chat/worktrees" || path === "/api/chat/rules") {
      const response = deferred();
      const pending = { response, signal: init.signal };
      if (resource === "worktrees" && !settingsStarted) sinceReads.push(pending);
      else settingsReads.set(resource, pending);
      return response.promise;
    }
    if (path === "/api/chat/chats") return Response.json({ chats: [
      { id: "workspace-chat", kind: "workspace" },
      { id: "project-chat", kind: "project", project: "demo" },
    ] });
    if (path === "/api/chat/runtimes") return Response.json({ runtimes: [{ name: "codex", cli: { logged_in: true } }, { name: "claude_code" }] });
    if (path.startsWith("/api/chat/runtimes/") && resource === "models") {
      modelReads.push(path);
      return Response.json({ models: [{ id: "codex-fixture", name: "Fixture Codex" }] });
    }
    if (path === "/api/chat/runtime-policy") return Response.json({ effective: { allowed: ["codex", "claude_code"] } });
    if (path === "/api/chat/chats/project-chat/threads") return Response.json({ threads: [
      { ts: "boot-thread", chat_id: "project-chat", title: "Thread from the panel", state: "working", session_id: "boot-session", pin: { model: "codex-fixture" }, runs: { total: 1 }, can_delete: true },
      { ts: "failed-thread", chat_id: "project-chat", title: "Review the draft", state: "failed" },
    ].map((thread) => ({ ...thread, created_at: new Date(lastHomeVisit).toISOString(), updated_at: new Date(lastHomeVisit).toISOString() })) });
    if (path === "/api/chat/sessions") return Response.json({ sessions: [
      { id: "boot-session", agent: "codex" },
      { id: "plain-chat", role: "plain", agent: "codex", title: "Draft ideas", created_at: new Date(lastHomeVisit).toISOString() },
      { id: "second-plain-chat", role: "plain", agent: "codex", native_id: "title-pending", created_at: new Date(lastHomeVisit).toISOString() },
    ] });
    if (path === "/api/messages/title-pending") {
      chatTitleSignal = init?.signal;
      return chatTitleRead.promise;
    }
    if (path === "/api/chat/sessions/plain-chat") return Response.json({ id: "plain-chat", role: "plain", agent: "codex" });
    if (path === "/api/chat/sessions/boot-session/runs") return Response.json({ runs: [run] });
    if (path === "/api/chat/runs/sub-agent") {
      if (!holdRunRead) return Response.json(run);
      runSignal = init.signal;
      return lateRunRead.promise;
    }
    return Response.json({});
  },
  EventSource: class { addEventListener() {} close() {} },
});
Object.defineProperty(navigator, "clipboard", { value: { writeText: async (/** @type {string} */ text) => { clipboard.push(text); } } });

await import("../boot.js");
const { kernel } = await import("../shell/kernel.js");
await new Promise((resolve) => setImmediate(resolve));
flushFrames();

const ringFixture = document.createElement("section");
ringFixture.innerHTML = '<div class="vw-body vw-diff" tabindex="0"></div>';
document.body.append(ringFixture);
const ringRegion = ringFixture.firstElementChild;
Object.defineProperty(ringRegion, "offsetParent", { value: ringFixture });
const ringMatches = ringRegion.matches.bind(ringRegion);
ringRegion.matches = (selector) => selector === ":focus-visible" || ringMatches(selector);
ringRegion.focus();
flushFrames();
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
assert.equal(document.querySelector("#all") === null, true, "boot omits the retired All Threads overlay");
assert.equal(document.querySelector("#shd").getAttribute("aria-label"), "Shells");
assert.equal(document.querySelector("#toast").getAttribute("role"), "status");
const shellToggle = document.querySelector("#nv-shells");
assert.equal(shellToggle.getAttribute("aria-label"), "Shells");
assert.equal(shellToggle.getAttribute("aria-pressed"), "false");
assert.ok(shellToggle.querySelector("#ic-shells"));

const scrollPane = document.createElement("div");
const scrollContent = document.createElement("div");
scrollContent.className = "cx-pd";
scrollContent.tabIndex = 0;
scrollPane.append(scrollContent);
document.body.append(scrollPane);
Object.defineProperties(scrollPane, { offsetWidth: { value: 400 }, offsetHeight: { value: 300 } });
Object.defineProperties(scrollContent, {
  offsetParent: { value: scrollPane }, offsetLeft: { value: 0 }, offsetTop: { value: 35 },
  offsetWidth: { value: 400 }, offsetHeight: { value: 265 },
});
scrollContent.focus();
flushFrames();
assert.equal(scrollPane.querySelectorAll(".region-ring").length, 1, "boot draws one ring for a focused diff");
scrollContent.blur();
assert.equal(scrollPane.querySelectorAll(".region-ring").length, 0);
scrollPane.remove();

assert.ok(document.querySelector("#brand-mark svg"), "boot installs the visible brand icon");
assert.ok(document.querySelector("#side-fold svg"), "boot installs the sidebar fold icon");
const expectedIcon = document.createElement("span");
expectedIcon.innerHTML = xi("dashboard");
assert.equal(document.querySelector("#ic-more").innerHTML, expectedIcon.innerHTML, "More uses the dashboard icon");
expectedIcon.innerHTML = ICON.right;
assert.equal(document.querySelector("#nv-more .nr-chev").innerHTML, expectedIcon.innerHTML, "More shows the right chevron");
assert.equal(document.querySelector("#home").hidden, false, "boot starts on Home");
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(modelReads, ["/api/chat/runtimes/codex/models"], "the Home composer preloads its model names without opening the picker");
assert.equal(document.documentElement.dataset.theme, "light", "boot restores the stored mode");
assert.equal(document.documentElement.dataset.flavour, "onyx", "boot restores the stored flavour");

const homeComposer = document.querySelector("#composer");
const homeTarget = homeComposer.querySelector("#target");
const homeSay = homeComposer.querySelector("#say");
const composerRows = [homeComposer, homeSay.closest(".composer-field"), homeTarget.closest(".composer-row")];
assert.ok(composerRows.slice(1).every((row) => row.parentElement === homeComposer), "the field and controls are separate rows");
const layoutProperties = new Set(["display", "grid-template-columns", "grid-template-rows", "order", "height", "min-height", "margin-top"]);
const { publishedRules, resolveValue } = await import("./lib/css-snapshot.mjs");
assert.equal(publishedRules().some(({ sel }) => /\.held\b/.test(sel)), false, "published styles have no reader of the retired marker");
const { mediaHolds } = await import("./lib/cascade.mjs");
const composerRules = publishedRules().filter(({ sel, at, declarations }) => sel.startsWith(".composer")
  && !sel.includes("::") && declarations.some(({ p }) => layoutProperties.has(p))
  && at.every((context) => mediaHolds(context, innerWidth) !== false));
const applies = (row, selector) => selector.includes(":focus-within")
  ? row.contains(document.activeElement) && row.matches(selector.replaceAll(":focus-within", ""))
  : row.matches(selector);
const composerLayout = () => composerRows.map((row) => Object.fromEntries(composerRules
  .filter(({ sel }) => applies(row, sel)).flatMap(({ declarations }) => declarations
    .filter(({ p }) => layoutProperties.has(p)).map(({ p, v }) => [p, resolveValue(v)]))));
homeSay.focus();
const focusedComposerLayout = composerLayout();
assert.equal(focusedComposerLayout[0].display, "grid");
assert.equal(focusedComposerLayout[2].display, "flex");
assert.equal(homeSay.value, "");
document.querySelector("#side-fold").dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
assert.equal(homeComposer.classList.contains("held"), false, "an outside press does not set the retired shrink marker");
homeSay.blur();
assert.deepEqual(composerLayout(), focusedComposerLayout, "blur keeps the resolved Home composer layout");
assert.equal(homeTarget.hidden, false, "the empty unfocused composer still shows its destination row");

const press = (/** @type {string} */ selector, detail = 0, pointerType = "", modifiers = {}) => {
  const button = document.querySelector(selector);
  assert.ok(button, selector);
  button.dispatchEvent(Object.assign(new window.Event("click", { bubbles: true, cancelable: true }), { detail, pointerType, ...modifiers }));
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

press("#nv-chats");
flushFrames();
await new Promise((resolve) => setImmediate(resolve));
flushFrames();
await new Promise(setImmediate);
const secondChat = document.querySelector('.chl-row[data-go="c:second-plain-chat"]');
assert.ok(visibleChatTitles.has(secondChat), "the mounted Chats list observes a row that needs its title");
assert.equal(chatTitleSignal, undefined);
visibleChatTitles.get(secondChat)([{ target: secondChat, isIntersecting: true }]);
await new Promise(setImmediate);
assert.ok(chatTitleSignal, "a row in view starts the progressive title read");
press("#nv-home");
assert.equal(chatTitleSignal.aborted, true, "leaving Chats for Home aborts its title read in the navigation event");
chatTitleRead.resolve(Response.json({ messages: [] }));
await new Promise(setImmediate);
press("#nv-chats");
flushFrames();
press('.chl-row[data-go="c:plain-chat"]');
const chatComposer = document.querySelector("#say");
chatComposer.value = "Keep this prompt";
chatComposer.dispatchEvent(new window.Event("input", { bubbles: true }));
chatComposer.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((resolve) => setImmediate(resolve));
flushFrames();
assert.equal(promptCount, 1);
assert.ok(document.querySelector("[data-chat-retry]"), "a failed prompt offers Retry");
retireChat();
await new Promise((resolve) => setImmediate(resolve));
flushFrames();
press("[data-chat-retry]");
await new Promise((resolve) => setTimeout(resolve, 60));
flushFrames();
assert.equal(promptCount, 1, "Retry in an ended chat sends no request");
assert.match(document.querySelector("#herald").textContent, /Not sent: This chat has ended/);
assert.match(document.querySelector("#live").textContent, /Not sent: This chat has ended/);
assert.match(document.querySelector("[data-chat-retry]").closest(".m-you").textContent, /Keep this prompt/);
chatComposer.value = "Keep this unsent draft too";
chatComposer.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((resolve) => setTimeout(resolve, 60));
flushFrames();
assert.equal(promptCount, 1, "the composer also checks the ended chat before sending");
assert.equal(chatComposer.value, "Keep this unsent draft too");
assert.match(document.querySelector("#live").textContent, /Your text is kept/);

press("#nv-ws");
assert.equal(document.querySelector("#nv-ws").getAttribute("aria-current"), "page", "Workspace replaces Home");
assert.equal(document.querySelector("#app").dataset.conv, "ws", "the shell tracks the active conversation");
assert.match(document.querySelector("#ws-head").textContent, /Your coordinator, across all 1 project/);
const message = document.createElement("div");
message.className = "m-them";
message.innerHTML = '<div class="mb"><div class="prose"><p>Run this:</p><div class="md-code"><div class="md-code-head">JavaScript <button data-copy>Copy</button></div><pre><code>const answer = 42;</code></pre></div><p>Then check it.</p></div></div>';
document.querySelector("#msgs").append(message);
const touch = (type, x, y) => Object.assign(new window.Event(type, { bubbles: true }), { touches: [{ clientX: x, clientY: y }] });
function copyMessage(/** @type {Element} */ paragraph) {
  const realTimeout = globalThis.setTimeout;
  /** @type {(() => void)[]} */
  const pressTimers = [];
  try {
    globalThis.setTimeout = (callback) => pressTimers.push(callback);
    paragraph.dispatchEvent(touch("touchstart", 50, 50));
  } finally {
    globalThis.setTimeout = realTimeout;
  }
  for (const callback of pressTimers) callback();
  press('.lp-menu [data-lp="copy"]');
}
copyMessage(message.querySelector("p"));
assert.deepEqual(clipboard, ["Run this:\n\nconst answer = 42;\n\nThen check it."], "long-press copies only the message text through boot's gesture wiring");
const copyCode = message.querySelector("[data-copy]");
copyCode.focus();
copyCode.click();
await new Promise(setImmediate);
assert.equal(clipboard.at(-1), "const answer = 42;", "boot's code button writes just the code to the clipboard");
assert.equal(copyCode.textContent, "Copied", "boot's code button acknowledges the write");
assert.ok(document.activeElement === copyCode, "copying code keeps focus on the button");
message.remove();
press("#nv-home");
assert.equal(document.querySelector("#nv-home").getAttribute("aria-current"), "page", "Home navigation restores Home");
assert.equal(document.querySelector("#app").dataset.conv, "home", "the shell tracks Home after navigation");
assert.ok(document.querySelector("#ws-head").closest("[hidden]"), "Home hides the Workspace conversation");

const jump = document.querySelector("#jump");
const app = document.querySelector("#app");
assert.equal(Boolean(document.querySelector('#side input[type="search"], #side #pf-in')), false, "The sidebar uses Jump for project search");
press("#side-jump");
assert.equal(jump.hidden, false, "The visible sidebar search opens Jump");
press("#side-jump");
assert.equal(jump.hidden, true);
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

press('#projects [data-go="p:demo"]');
const picker = document.querySelector("#iq-pop");
const dropVeil = document.querySelector("#drop-veil");
const uploads = [];
globalThis.XMLHttpRequest = class {
  upload = {};
  open(/** @type {string} */ _method, /** @type {string} */ url) { this.url = url; }
  setRequestHeader() {}
  send() { uploads.push(this.url); }
  abort() { this.onabort?.(); }
};
function dropFile(/** @type {Element} */ target, /** @type {string} */ name) {
  const file = new File(["notes"], name, { type: "text/plain" });
  const dataTransfer = { types: ["Files"], files: [file] };
  const drag = (type) => target.dispatchEvent(Object.assign(new window.Event(type, { bubbles: true, cancelable: true }), { dataTransfer }));
  drag("dragenter");
  assert.equal(dropVeil.hidden, false, "dragging a file over the composer opens the shared veil");
  drag("drop");
  assert.equal(dropVeil.hidden, true, "a drop dismisses the veil");
}
function togglePicker(selector) {
  const chip = document.querySelector(selector);
  chip.focus();
  press(selector);
  assert.equal(picker.hidden, false);
  assert.equal(chip.getAttribute("aria-expanded"), "true");
  assert.ok(document.activeElement === picker);
  press(selector);
  assert.equal(picker.hidden, true);
  assert.equal(chip.getAttribute("aria-expanded"), "false");
  assert.ok(document.activeElement === chip);
}
togglePicker("#iq");
dropFile(document.querySelector("#say"), "main.txt");
assert.match(document.querySelector("#att-tray").textContent, /main\.txt/);
press("[data-stage-toggle]", 1, "touch");
const panelThread = '#stage .ag-r[data-go="t:boot-thread"]';
for (const [detail, pointerType, expected] of [[1, "touch", "[data-page-heading]"], [1, "mouse", "#tsay"], [0, "", "#tsay"]]) {
  press(panelThread, detail, pointerType);
  const heading = document.querySelector("#stage [data-page-heading]");
  assert.equal(heading.textContent, "Thread from the panel");
  assert.equal(heading.getAttribute("role"), "heading");
  assert.equal(heading.getAttribute("tabindex"), "-1");
  assert.ok(document.activeElement === document.querySelector("#stage " + expected), pointerType || "keyboard");
  if (pointerType === "mouse") {
    togglePicker("#tiq");
    const reply = document.querySelector("#tsay");
    const replyNotice = document.querySelector("#tpherald");
    assert.equal(reply.getAttribute("aria-controls"), "tat-list");
    assert.equal(document.querySelector("#tat-list").getAttribute("role"), "listbox");
    assert.equal(document.querySelector("#ttarget").tagName, "BUTTON");
    assert.equal(replyNotice.getAttribute("aria-live"), "polite");
    assert.ok(reply.closest("#tpdock").contains(replyNotice));
    dropFile(replyNotice, "panel.txt");
    assert.match(document.querySelector("#tatt-tray").textContent, /panel\.txt/);
    assert.doesNotMatch(document.querySelector("#att-tray").textContent, /panel\.txt/);
    assert.deepEqual(uploads.map((url) => new URL(url, location.href).searchParams.get("name")), ["main.txt", "panel.txt"]);
    assert.ok(document.activeElement === reply, "the drop returns focus to its own reply");
    heading.focus();
    assert.equal(key("/").defaultPrevented, true);
    assert.ok(document.activeElement === reply, "Write targets the open panel conversation on a phone");
    assert.equal(key(".", { metaKey: true }).defaultPrevented, true);
    assert.equal(document.querySelector("#tiq").getAttribute("aria-expanded"), "true");
    assert.equal(document.querySelector("#iq").getAttribute("aria-expanded"), "false");
    key("Escape");

    const messages = document.querySelector("#stage #tmsgs");
    const panelMessage = document.createElement("div");
    panelMessage.className = "m-them";
    panelMessage.innerHTML = '<div class="mb"><div class="prose"><p>Panel reply</p></div></div>';
    messages.append(panelMessage);
    copyMessage(panelMessage.querySelector("p"));
    assert.equal(clipboard.at(-1), "Panel reply", "long-press Copy uses the panel conversation's words");
    panelMessage.remove();
    reply.value = "Kept while typing";
    reply.focus();
    messages.dispatchEvent(touch("touchstart", 50, 50));
    messages.dispatchEvent(touch("touchmove", 52, 100));
    assert.ok(document.activeElement !== reply, "a downward drag leaves the reply field");
    assert.equal(reply.value, "Kept while typing", "lowering the keyboard keeps the reply");
  }
  press("#stage [data-stg-sections]", detail, pointerType);
}
press(panelThread, 1, "touch");
const threadPageModuleId = "xo.thread-page";
function mountedThreadObservers() {
  const observers = [...threadDockObservers];
  assert.equal(observers.length, 2, "the thread has one observer for each dock responsibility");
  const layout = observers.filter((observer) => resizeTargets.get(observer).size === 1);
  const latest = observers.filter((observer) => resizeTargets.get(observer).has("tscroller"));
  assert.equal(layout.length, 1, "the layout owner watches the height of the composer dock");
  assert.equal(latest.length, 1, "Back to latest watches the scroller and dock together");
  assert.ok(resizeTargets.get(latest[0]).has("tptdock"));
  assert.ok(resizeTargets.get(latest[0]).has("tpherald"));
  return observers;
}
const initialThreadObservers = mountedThreadObservers();
const detachedMessages = document.querySelector("#tmsgs");
const detachedComposer = document.querySelector("#tsay");
detachedMessages.insertAdjacentHTML("beforeend", '<div class="m-them"><div class="mb"><div class="prose">Pending message</div></div></div>');
const deferredPress = detachedMessages.querySelector(".prose:last-child");
const realTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
const pendingPressTimers = new Map();
let pressTimerId = 0;
try {
  globalThis.setTimeout = (fn) => { pendingPressTimers.set(++pressTimerId, fn); return pressTimerId; };
  globalThis.clearTimeout = (id) => { pendingPressTimers.delete(id); };
  deferredPress.dispatchEvent(touch("touchstart", 50, 50));
  assert.equal(pendingPressTimers.size, 1, "the mounted conversation can begin a long press");
  await kernel.disable(threadPageModuleId);
  assert.equal(pendingPressTimers.size, 0, "unmount cancels a pending long press");
} finally {
  globalThis.setTimeout = realTimeout;
  globalThis.clearTimeout = realClearTimeout;
}
assert.equal(Boolean(document.querySelector("#tpdock")), false, "disabling the thread page unmounts the Stage contribution");
assert.equal(threadDockObservers.size, 0, "unmount releases both dock observers");
const oldHeight = detachedComposer.style.height;
detachedComposer.style.height = "3px";
detachedComposer.dispatchEvent(new window.Event("input"));
assert.equal(detachedComposer.style.height, "3px", "unmount releases retained composer controls");
detachedComposer.style.height = oldHeight;
await kernel.enable(threadPageModuleId);
press(panelThread, 1, "touch");
assert.ok(mountedThreadObservers().every((observer) => !initialThreadObservers.includes(observer)), "remount creates fresh owners");
flushFrames();
await new Promise((resolve) => setTimeout(resolve, 0));
press('#tpacts [data-tmenu="boot-thread"]', 1, "touch");
flushFrames();
press('#tpacts [data-tgo="t:failed-thread"]', 1, "touch");
const siblingHeading = document.querySelector("#stage [data-page-heading]");
assert.equal(siblingHeading.textContent, "Review the draft");
assert.ok(document.activeElement === siblingHeading, "touch on a sibling action focuses the new thread heading");
press("#stage [data-stg-sections]", 1, "touch");
phone = false;
press(panelThread);
const mainComposer = document.querySelector("#say");
const panelNotice = document.querySelector("#tpherald");
mainComposer.focus();
key(".", { metaKey: true });
assert.equal(document.querySelector("#iq").getAttribute("aria-expanded"), "true", "desktop focus selects the main composer");
key("Escape");
const previousControl = document.createElement("button");
panelNotice.append(previousControl);
previousControl.focus();
previousControl.remove();
assert.ok(document.activeElement === document.body, "the focused control was replaced");
key(".", { metaKey: true });
assert.equal(document.querySelector("#tiq").getAttribute("aria-expanded"), "true", "a redraw remembers the last focused composer");
key("Escape");
await new Promise(setImmediate);
flushFrames();
await new Promise((resolve) => setTimeout(resolve, 0));
const nestedRuns = document.querySelector("#tpthead [data-runs]");
assert.ok(nestedRuns, "the panel thread has a Sub-agents entry");
nestedRuns.focus();
press("#tpthead [data-runs]");
await new Promise(setImmediate);
const runPage = document.querySelector("#stage .stg-page #runs-card");
assert.ok(runPage && runPage.getAttribute("role") === "region", "Runs mounts inside the panel's page");
assert.match(document.querySelector("#stage [data-stg-sections]").getAttribute("aria-label"), /Back to Thread from the panel/);
press("#stage [data-stg-sections]");
assert.ok(document.querySelector("#stage #tsay"), "closing Runs returns to the thread inside the panel");
assert.ok(document.activeElement === document.querySelector("#tpthead [data-runs]"), "focus returns to the panel thread's entry");
press("#stage [data-stg-sections]");
press(panelThread, 1, "mouse", { metaKey: true });
assert.equal(app.dataset.conv, "t:boot-thread", "the modified panel click opens the thread in the main conversation");
assert.match(document.querySelector("#iq").textContent, /Fixture Codex/, "the thread chip uses the preloaded model name");
press("#stage [data-stg-close]");
await new Promise(setImmediate);
press('#top [data-tmenu="boot-thread"]', 1, "touch");
flushFrames();
press('#top [data-tside="boot-thread"]', 1, "touch");
assert.ok(document.activeElement === document.querySelector("#stage [data-page-heading]"), "touch from the main thread menu focuses the panel heading");
press("#stage [data-tp-main]", 1, "touch");
press("#stage [data-stg-close]");
await new Promise(setImmediate);
const mainRuns = document.querySelector("#thead [data-runs]");
mainRuns.focus();
press("#thead [data-runs]");
await new Promise(setImmediate);
assert.ok(document.querySelector("#stage .stg-page #runs-card") === runPage, "both entries reuse the Runs region");
assert.equal(document.querySelector("#stage [data-stg-sections]").getAttribute("aria-label"), "Back to the thread");
assert.equal(runPage.querySelectorAll(".rn-cmds [data-run]").length, 8);
press("#runs-card [data-runs-more]");
const moreCommand = runPage.querySelector('.rn-cmds [data-run="command-9"]');
assert.equal(runPage.querySelectorAll(".rn-cmds [data-run]").length, 9);
assert.ok(document.activeElement === moreCommand, "Show more focuses the first newly revealed command");
press("#runs-card [data-runs-cmds]");
assert.equal(runPage.querySelector("[data-runs-cmds]").getAttribute("aria-expanded"), "false");
assert.equal(runPage.querySelectorAll(".rn-cmds [data-run]").length, 0);
press('#runs-card [data-run="sub-agent"]');
await new Promise(setImmediate);
assert.equal(document.querySelector("#stage [data-stg-sections]").getAttribute("aria-label"), "Back to Sub-agents");
press("#stage [data-stg-sections]");
assert.ok(document.activeElement === runPage.querySelector('[data-run="sub-agent"]'));
holdRunRead = true;
press('#runs-card [data-run="sub-agent"]');
await new Promise(setImmediate);
assert.equal(runSignal?.aborted, false);
press("#stage [data-stg-sections]");
assert.equal(runSignal?.aborted, true, "back aborts a pending Runs detail read");
lateRunRead.resolve(Response.json({ ...run, title: "Late result" }));
await new Promise(setImmediate);
assert.doesNotMatch(runPage.textContent, /Late result/);
press("#stage [data-stg-sections]");
assert.equal(document.querySelector("#stage").hidden, true, "Runs closes the panel it opened from the main thread");
assert.ok(document.activeElement === mainRuns, "focus returns to the main thread's entry");
press('#top [data-tmenu="boot-thread"]');
const move = document.querySelector('#top [data-tmove="boot-thread"]');
assert.ok(move, "the thread menu offers the other available runtime");
move.focus();
let focusedWhileMenuPresent = false;
picker.addEventListener("focusin", () => { focusedWhileMenuPresent = move.isConnected; }, { once: true });
press('#top [data-tmove="boot-thread"]');
assert.equal(picker.hidden, false, "the runtime picker opens in the menu item's click");
assert.ok(picker.contains(document.activeElement), "focus moves directly from the menu to the picker");
assert.equal(focusedWhileMenuPresent, true, "the picker takes focus before the menu is dismissed");
flushFrames();
assert.equal(move.isConnected, false, "the old menu is dismissed after opening the picker");
key("Escape");
press('#top [data-tmenu="boot-thread"]');
press('#top [data-tdel="boot-thread"]');
flushFrames();
const keepThread = document.querySelector("#tdel [data-tdel-no]");
assert.ok(document.activeElement === keepThread, "deleting a thread leaves the safe choice focused");
press("#tdel [data-tdel-no]");
assert.ok(document.activeElement === document.querySelector('#top [data-tmenu="boot-thread"]'));
assert.equal(threadDeletes.length, 0);
press('#top [data-tmenu="boot-thread"]');
press('#top [data-tdel="boot-thread"]');
press("#tdel [data-tdel-yes]");
await new Promise(setImmediate);
assert.deepEqual(threadDeletes, [{ keep_branch: true }]);
assert.equal(app.dataset.conv, "p:demo", "successful deletion returns to the project");
press("#nv-lp");
await new Promise(setImmediate);
flushFrames();
const launchpadAction = document.querySelector('#lpp [data-lpp-open="demo"]');
assert.ok(launchpadAction, "the overview draws the real project action");
const launchpadOverview = launchpadAction.closest("#lpp");
const removeOverviewListener = launchpadOverview.removeEventListener;
let overviewRetirements = 0;
launchpadOverview.removeEventListener = function (type, ...args) {
  if (type === "click") overviewRetirements++;
  return removeOverviewListener.call(this, type, ...args);
};
press('#lpp [data-lpp-open="demo"]');
const launchpadDialog = document.querySelector("#lq");
assert.equal(launchpadDialog.open, true, "the overview's action opens the production Launchpad dialog");
launchpadDialog.querySelector("[data-lq-close]").click();
press("#nv-home");

assert.ok(JSON.parse(storage.get("xo-seen")).home > lastHomeVisit, "Home records its visit in the app's Since store");
settingsStarted = true;
press("#set-phone");
press('#settings [data-set="rules"]');
press('#settings [data-set="worktrees"]');
await new Promise(setImmediate);
const rules = settingsReads.get("rules");
const worktrees = settingsReads.get("worktrees");
assert.ok(rules && worktrees, "Settings opens Rules and Worktrees through the app");
assert.ok(sinceReads.length, "Since checks worktrees when boot restores a prior Home visit");
assert.ok(githubSignal, "the visible panel checks for the project's GitHub remote");
assert.ok(artifactsSignal, "the app reads project artifacts");
assert.ok(shellSignal, "the mounted Shells dock starts a cancellable status read");
const pagehide = (persisted) => window.dispatchEvent(Object.assign(new window.Event("pagehide"), { persisted }));
const shellDock = document.querySelector("#shd");
const shellGrip = shellDock.querySelector(".shd-grip");
const resizeShells = () => shellGrip.dispatchEvent(Object.assign(new window.Event("keydown", { cancelable: true }), { key: "ArrowUp" }));
assert.equal(resizeShells(), false, "the mounted Shells dock owns its keyboard resize");
const shellHeight = shellDock.style.getPropertyValue("--shd-h");
assert.equal(kernel.status("xo.settings"), "active");
const settingsOwners = ["xo.settings", "xo.rules", "xo.worktrees", "xo.routing"];
for (const id of settingsOwners) assert.ok(kernel.live(id) > 0, `${id} owns its Settings lifetime`);
let filePickerClicks = 0;
document.querySelector("#att-input").addEventListener("click", () => { filePickerClicks++; });
press("#attach");
assert.equal(filePickerClicks, 1, "the mounted composer opens its file picker");
const mountedDockObservers = mountedThreadObservers();
assert.equal(stageLayoutObservers.size, 2, "Stage watches sidebar width and frame height independently");
pagehide(true);
launchpadAction.click();
assert.equal(launchpadDialog.open, true, "the page cache keeps Launchpad's overview and dialog active");
press("#attach");
assert.equal(filePickerClicks, 2, "the page cache keeps the composer control live");
assert.equal(rules.signal.aborted || worktrees.signal.aborted, false, "the page cache keeps both Settings readers live");
assert.equal(sinceReads.some(({ signal }) => signal.aborted), false);
assert.equal(githubSignal.aborted, false, "the page cache keeps GitHub's read live");
assert.equal(artifactsSignal.aborted, false, "the page cache keeps the Artifacts read live");
assert.equal(shellSignal.aborted, false, "the page cache keeps the Shells poll live");
assert.equal(shellRelocationObservers.size, 1, "the page cache keeps the Stage Shells observer live");
assert.equal(threadDockObservers.size, mountedDockObservers.length);
assert.equal(stageLayoutObservers.size, 2, "the page cache keeps Stage layout observations");
assert.ok(mountedDockObservers.every((observer) => threadDockObservers.has(observer)), "the page cache keeps the mounted dock observations");
pagehide(false);
assert.equal(overviewRetirements, 1, "unloading releases the Launchpad overview click listener");
launchpadOverview.removeEventListener = removeOverviewListener;
assert.equal(launchpadDialog.isConnected, false, "unloading removes the Launchpad dialog");
assert.equal(launchpadDialog.open, false);
launchpadAction.click();
assert.equal(launchpadDialog.open, false, "the retained overview cannot reopen its retired dialog");
press("#attach");
assert.equal(filePickerClicks, 2, "unloading releases the retained composer control");
for (const id of settingsOwners) assert.equal(kernel.live(id), 0, `${id} disposed through the app`);
assert.equal(rules.signal.aborted, true, "unloading aborts Rules through the app");
assert.equal(worktrees.signal.aborted, true, "unloading aborts Worktrees through the app");
assert.equal(sinceReads.some(({ signal }) => signal.aborted), true, "unloading aborts Since through the app");
assert.equal(githubSignal.aborted, true, "unloading aborts GitHub through the app");
assert.equal(artifactsSignal.aborted, true, "unloading aborts Artifacts through the app");
assert.equal(shellSignal.aborted, true, "unloading aborts the Shells poll through the app");
assert.equal(shellRelocationObservers.size, 0, "unloading releases the Stage Shells observer");
assert.equal(threadDockObservers.size, 0, "unloading releases the mounted thread dock observations");
assert.equal(stageLayoutObservers.size, 0, "unloading releases both Stage layout observations");
assert.equal(resizeShells(), true, "the retained Shells grip has no listener after teardown");
assert.equal(shellDock.style.getPropertyValue("--shd-h"), shellHeight);
document.body.append(scrollPane);
scrollContent.focus();
flushFrames();
assert.equal(scrollPane.querySelectorAll(".region-ring").length, 0, "the unloaded app no longer draws a ring");
scrollPane.remove();
const rulesPage = settings.querySelector('[data-page="rules"]');
const worktreesPage = settings.querySelector('[data-page="worktrees"]');
const displayed = [rulesPage.textContent, worktreesPage.textContent];
rules.response.resolve(Response.json({ rules: [{ id: "late", sentence: "Late rule" }] }));
worktrees.response.resolve(Response.json({ worktrees: [] }));
for (const { response } of sinceReads) response.resolve(Response.json({ worktrees: [] }));
githubRead.resolve(Response.json({ repo: "demo/repo", issues: [{ number: 1, title: "Late issue" }] }));
artifactsRead.resolve(Response.json({ made: [{ id: "late", name: "Late artifact", relative_path: "late.txt" }] }));
shellStatus.resolve(Response.json({ enabled: true }));
await new Promise(setImmediate);
assert.deepEqual([rulesPage.textContent, worktreesPage.textContent], displayed, "pending replies leave the unloaded pages alone");
storage.delete("xo-seen");
pagehide(false);
assert.equal(storage.has("xo-seen"), false, "Since removes its visit listener after unload");
