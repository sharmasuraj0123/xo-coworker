import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";
import { createKernel } from "../core/kernel/index.js";
import { stackLayers } from "../shell/layers.js";
import { focusOverlay, mountKeyboardLayers } from "../shell/keyboard-layers.js";
import { createShortcutsSheet } from "../modules/settings/shortcuts-sheet.js";

const controls = '<button tabindex="0">First</button><button tabindex="0">Last</button>';
const { document, window } = await dom(`
  <div id="app"><aside id="side">${controls}</aside><main id="main">
    <section id="content">${controls}</section><section id="files"></section>
    <section id="settings" hidden>${controls}</section><div class="toast-wrap"></div>
  </main></div>
  <div id="jump" hidden>${controls}</div><div id="all" hidden>${controls}</div>
  <div id="keys" hidden>${controls}</div><div id="quickopen" hidden></div>
`);
globalThis.MutationObserver = window.MutationObserver;
Node.DOCUMENT_POSITION_FOLLOWING = 4;
for (const button of document.querySelectorAll("button")) Object.defineProperty(button, "tabIndex", { value: 0 });
const byId = (id) => document.getElementById(id);
const app = byId("app"), main = byId("main"), side = byId("side"), settings = byId("settings");
const keys = byId("keys"), all = byId("all"), jump = byId("jump"), quickopen = byId("quickopen");
const files = byId("files"), content = byId("content");
const phone = new window.EventTarget();
phone.matches = false;
const sheet = createShortcutsSheet({ keys, closeButton: keys.firstElementChild, keysSheetRender() {}, focusOverlay, syncInert: () => syncInert() });
const layer = (id, host, config) => ({ id, open: () => !host.hidden, close: () => { host.hidden = true; }, ...config });
const stack = stackLayers(createKernel().layers, [
  layer("jump", jump, { tab: () => jump, watchHidden: jump, inertsApp: true }),
  layer("all", all, { tab: () => all, watchHidden: all, inertsApp: true }),
  layer("keys", keys, { tab: () => keys, watchHidden: keys, inertsApp: true, close: sheet.closeKeys }),
  layer("quickopen", quickopen, { inertsApp: true }),
  layer("settings", settings, { watchHidden: settings, tab: () => phone.matches ? settings : null }),
  { id: "drawer", open: () => app.classList.contains("drawer"), close: () => app.classList.remove("drawer"), tab: () => phone.matches ? side : null },
]);
const syncInert = mountKeyboardLayers({ layers: stack, phone, app, main, side, settings });
const mutation = async () => { await Promise.resolve(); await Promise.resolve(); };
const tab = (target, shiftKey = false) => {
  const e = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.assign(e, { key: "Tab", shiftKey });
  target.dispatchEvent(e);
  return e.defaultPrevented;
};
const wraps = (host) => {
  const first = host.firstElementChild, last = host.lastElementChild;
  last.focus();
  assert.equal(tab(last), true);
  same(document.activeElement, first);
  assert.equal(tab(first, true), true);
  same(document.activeElement, last);
  first.focus();
  assert.equal(tab(first), false);
};
await mutation();
files.inert = true;
phone.matches = true;
phone.dispatchEvent(new window.Event("change"));
assert.equal(side.inert, true);
app.classList.add("drawer");
syncInert();
assert.equal(side.inert, false);
assert.equal(main.inert, true);
wraps(side);

settings.hidden = false;
jump.hidden = false;
all.hidden = false;
all.firstElementChild.focus();
sheet.openKeys();
await mutation();
assert.equal(app.inert, true);
assert.equal(content.inert, true);
assert.equal(main.querySelector(".toast-wrap").inert, undefined);
wraps(keys);
const claimed = (e) => e.preventDefault();
keys.lastElementChild.focus();
keys.lastElementChild.addEventListener("keydown", claimed);
assert.equal(tab(keys.lastElementChild), true);
same(document.activeElement, keys.lastElementChild);
keys.lastElementChild.removeEventListener("keydown", claimed);
sheet.closeKeys();
same(document.activeElement, all.firstElementChild);
wraps(all);
all.hidden = true;
wraps(jump);
jump.hidden = true;
wraps(settings);
await mutation();
assert.equal(app.inert, false);
quickopen.hidden = false;
syncInert();
assert.equal(app.inert, true);
wraps(settings);
quickopen.hidden = true;
settings.hidden = true;
phone.matches = false;
phone.dispatchEvent(new window.Event("change"));
assert.equal(app.inert, false);
assert.equal(main.inert, false);
assert.equal(content.inert, false);
assert.equal(files.inert, true);
assert.equal(tab(content.lastElementChild), false);
assert.ok(document.activeElement !== document.body);

const native = document.createElement("dialog");
native.setAttribute("open", "");
native.matches = (selector) => selector === ":modal";
document.body.append(native);
keys.hidden = false;
focusOverlay(keys.firstElementChild);
content.firstElementChild.focus();
native.dispatchEvent(new window.Event("close"));
same(document.activeElement, keys.firstElementChild);
console.log("keyboard layers preserve Tab order, inert ownership and focus return");
