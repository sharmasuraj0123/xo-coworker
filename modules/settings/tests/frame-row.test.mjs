// node modules/settings/tests/frame-row.test.mjs: a [data-set-row] shortcut opens its page and focuses that row's control, now or once the page draws it.
import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { dom } from "../../../tests/lib/dom.mjs";
import { createSettingsFrame } from "../frame.js";

const { document, window } = await dom(`
  <button id="side">Settings</button><button id="phone">Settings</button>
  <section id="settings" hidden>
    <button id="close">Close</button>
    <div class="set-nav">
      <button data-set="general" aria-selected="true">General</button>
      <button data-set="runtimes">Runtimes</button>
      <button data-set="accounts">Accounts</button>
    </div>
    <div data-page="general">General</div>
    <div data-page="runtimes" hidden><ul>
      <li data-key="rt:claude_code"><button class="btn" id="c-menu">···</button><button class="btn btn-pri" id="c-in">Sign in</button></li>
      <li data-key="rt:codex"><button class="btn btn-pri" id="x-in">Sign in</button></li>
    </ul></div>
    <div data-page="accounts" hidden><div class="set-live"></div></div>
  </section>
  <button id="go-codex" data-set-open="runtimes" data-set-row="rt:codex">Codex</button>
  <button id="go-gh" data-set-open="accounts" data-set-row="acct:github">GitHub</button>
`);
globalThis.MutationObserver = window.MutationObserver;
const el = document.getElementById("settings");
const side = document.getElementById("side");
const scope = createScope();
const frame = createSettingsFrame({
  el, side, phoneButton: document.getElementById("phone"), closeButton: document.getElementById("close"),
  onPage() {}, beforeOpen() {}, beforeClose() {}, onHidden() {}, focusIn: (node) => node.focus(), fallback: () => side,
  phone: window.matchMedia("(max-width: 760px)"), scope,
});
const tick = () => new Promise((r) => setTimeout(r, 0));

document.getElementById("go-codex").click();
assert.equal(el.hidden, false);
assert.equal(el.querySelector('[data-page="runtimes"]').hidden, false);
assert.equal(document.activeElement?.id === "x-in", true, "the runtime's own Sign in is focused");

frame.close({ restore: false });
document.getElementById("go-gh").click();
assert.equal(el.querySelector('[data-page="accounts"]').hidden, false);
assert.equal(document.activeElement?.id === "x-in", false);
el.querySelector('[data-page="accounts"] .set-live').innerHTML =
  `<div data-key="acct:github"><span>Not signed in.</span><button class="btn btn-pri" id="gh-in">Sign in</button></div>`;
await tick();
assert.equal(document.activeElement?.id === "gh-in", true, "GitHub's Sign in is focused once the row draws");

frame.dispose();
assert.equal(scope.size, 0);
console.log("frame-row: 3 passed");
