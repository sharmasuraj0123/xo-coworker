import assert from "node:assert/strict";
import { dom, same } from "../../../tests/lib/dom.mjs";
import { radioKeys } from "../../../core/ui/a11y/keynav.js";
import { createSetup } from "../setup.js";

const { document, window } = await dom('<button id="open">Permissions</button><div id="cs-pop" tabindex="-1" hidden></div>');
const popup = document.getElementById("cs-pop"), opener = document.getElementById("open");
const C = { prefs: { mode: "auto" }, read: new Set(), failed: new Map(), models: new Map(), pop: { open: false } };
const setup = createSetup(C, {
  world: { state: { projects: [] } }, runtime: () => null, schedule() {}, cliName: () => "Agent",
  feature: (_, name) => name === "permissions.mode" ? { values: ["plan", "ask", "auto"] } : null,
});
radioKeys(popup);
popup.addEventListener("click", (event) => { setup.setPref("mode", event.target.closest("[data-csmode]").dataset.csmode); setup.renderSetup(); });
await setup.openSetup(opener, "mode");
same(document.activeElement, popup);
const tabStops = () => [...popup.querySelectorAll('[role="radio"][tabindex="0"]')];
const [selected] = tabStops();
assert.deepEqual(tabStops().map((row) => row.dataset.csmode), ["auto"]);
selected.focus();
const arrow = new window.Event("keydown", { bubbles: true, cancelable: true });
arrow.key = "ArrowUp";
selected.dispatchEvent(arrow);
assert.equal(arrow.defaultPrevented, true);
assert.equal(C.prefs.mode, "ask");
assert.deepEqual(tabStops().map((row) => row.dataset.csmode), ["ask"]);
same(document.activeElement, tabStops()[0]);
