// @ts-check
import {
  document, assert, initialChats, setImmediate, flushFrames, window, ICON, modelReads, visibleChatTitles,
  chatTitleSignal, chatTitleRead, promptCount, retireChat, setTimeout, clipboard,
} from "./environment.mjs";
await import("../../modules/home/skeleton.js");
const firstHome = document.querySelector("#home");
const initialHome = firstHome.innerHTML;
assert.ok(firstHome.querySelector(".hm-sk"), "the Home skeleton supplies the initial page");
await import("../../boot.js");
const mainLatest = document.querySelector("#conv > .mx-down");
assert.ok(mainLatest, "the decorator mounts while the first world read is held");
assert.equal(mainLatest.classList.contains("is-on"), false, "the new control has no visible startup state");
assert.equal(document.querySelector("#conv").hidden, true, "the conversation remains out of the initial layout");
assert.equal(firstHome.innerHTML, initialHome, "boot keeps the initial Home layout while the first read is held");
initialChats.resolve(Response.json({ chats: [
  { id: "workspace-chat", kind: "workspace" },
  { id: "project-chat", kind: "project", project: "demo" },
  { id: "catalog-chat", kind: "project", project: "catalog-test" },
] }));
const { default: kernel } = await import("../../js/app.js");
const { renderMarkdown } = await import("../../core/ui/markdown/markdown.js");
const pictureMarkup = "![Diagram](https://example.org/diagram.png)";
assert.match(renderMarkdown(pictureMarkup), /data-mx=/, "boot mounts media rendering for Markdown pictures");
const quotedPicture = "> ![Trace](out/trace.png)";
for (const project of ["demo", "catalog-test"]) {
  const html = renderMarkdown(quotedPicture, "p:" + project);
  assert.ok(html.includes('data-mx="prj:' + project + ':out/trace.png"'), "quoted media uses the rendering project's file route");
}
assert.equal(kernel.status("xo.since"), "active", "boot activates Since through the kernel");
assert.equal(kernel.places.get("home.section", "hm-since")?.owner, "xo.since");
assert.equal(kernel.places.get("header.detail", "since")?.owner, "xo.since");
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
  ["phonebar", "home", "scheduled", "shared", "connectors", "arts", "lpp", "conv", "drop-veil", "dock",
    "panel", "viewer", "toast-wrap", "settings", "stage"],
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
expectedIcon.innerHTML = ICON.more;
assert.equal(document.querySelector("#ic-more").innerHTML, expectedIcon.innerHTML, "More uses the ellipsis icon");
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
const { publishedRules, resolveValue } = await import("../lib/css-snapshot.mjs");
assert.equal(publishedRules().some(({ sel }) => /\.held\b/.test(sel)), false, "published styles have no reader of the retired marker");
const { mediaHolds } = await import("../lib/cascade.mjs");
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
assert.equal(document.querySelector('.side-recents [data-go="c:plain-chat"]').textContent.trim(), "Draft ideas");
assert.equal(document.querySelector('.side-recents [data-go="ws"]'), null);
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
press("[data-chat-retry]");
await new Promise(setImmediate);
flushFrames();
assert.equal(promptCount, 2, "Retry resends the failed prompt in an active chat");
retireChat();
await new Promise((resolve) => setImmediate(resolve));
flushFrames();
press("[data-chat-retry]");
await new Promise((resolve) => setTimeout(resolve, 60));
flushFrames();
assert.equal(promptCount, 2, "Retry in an ended chat sends no request");
assert.match(document.querySelector("#herald").textContent, /Not sent: This chat has ended/);
assert.match(document.querySelector("#live").textContent, /Not sent: This chat has ended/);
assert.match(document.querySelector("[data-chat-retry]").closest(".m-you").textContent, /Keep this prompt/);
chatComposer.value = "Keep this unsent draft too";
chatComposer.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((resolve) => setTimeout(resolve, 60));
flushFrames();
assert.equal(promptCount, 2, "the composer also checks the ended chat before sending");
assert.equal(chatComposer.value, "Keep this unsent draft too");
assert.match(document.querySelector("#live").textContent, /Your text is kept/);

press("#nv-chats");
flushFrames();
chatComposer.setSelectionRange = function (start, end) { this.selectionStart = start; this.selectionEnd = end; };
chatComposer.value = "Restore this first message";
chatComposer.dispatchEvent(new window.Event("input", { bubbles: true }));
chatComposer.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise(setImmediate);
flushFrames();
assert.equal(chatComposer.value, "Restore this first message");
assert.equal(chatComposer.selectionStart, chatComposer.value.length);
assert.ok(document.activeElement === chatComposer);

press("#nv-ws");
assert.equal(document.querySelector("#conv-title").textContent, "All projects");
assert.doesNotMatch(document.querySelector("#top-who").textContent, /idle|All quiet/);
assert.equal(document.querySelector("#nv-ws").getAttribute("aria-current"), "page", "Workspace replaces Home");
assert.equal(document.querySelector("#app").dataset.conv, "ws", "the shell tracks the active conversation");
assert.match(document.querySelector("#ws-head").textContent, /Your coordinator, across all 2 projects/);
await new Promise(setImmediate);
flushFrames();
await new Promise(setImmediate);
const firstWorkspace = document.querySelector('#msgs [data-k="first-workspace-reply"]');
assert.match(firstWorkspace?.textContent ?? "", /The first message in Workspace/);
assert.ok(firstWorkspace.hasAttribute("data-noswipe"), "the first real conversation draw is decorated");
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

export {
  kernel, press, fold, renderMarkdown, copyMessage,
  touch, mainLatest, pictureMarkup, scrollPane, scrollContent,
};
