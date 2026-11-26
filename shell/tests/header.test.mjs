// The header draws header.action entries where they show, and a press runs the entry with where you are.
import assert from "node:assert/strict";

const { dom } = await import("../../tests/lib/dom.mjs");
const { createScope } = await import("../../core/kernel/scope.js");
await dom("<main></main>");
const { createKernel } = await import("../../core/kernel/index.js");
const { definePlaces } = await import("../places.js");
const { headerActionsHtml, wireHeaderActions } = await import("../header.js");

const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
const pressed = [];
K.places.contribute("header.action", { id: "dev.word:open", label: "Outline <x>", icon: "plug", when: (at) => at.project === "p1", onPress: (at) => pressed.push(at) }, "xo.apps-host");
assert.equal(headerActionsHtml(K.places, { project: "p2" }), "", "not where its when says no");
const html = headerActionsHtml(K.places, { project: "p1" });
assert.match(html, /^<button type="button" class="tw-act" data-header-action="dev\.word:open" title="Outline &lt;x&gt;"><svg[^]*<span>Outline &lt;x&gt;<\/span><\/button>$/);
K.places.contribute("header.action", { id: "dev.word:gear", label: "Settings", icon: "gear", bare: true, onPress() {} }, "xo.apps-host");
const gear = headerActionsHtml(K.places, { project: "p2" });
assert.match(gear, /aria-label="Settings"/, "a bare button keeps its name for a screen reader");
assert.doesNotMatch(gear, /<span>/, "a bare button draws only its icon");
const scope = createScope();
document.body.innerHTML = html;
const button = document.querySelector("button");
wireHeaderActions(scope, K.places, () => ({ project: "p1", view: "p:p1" }));
button.click();
assert.deepEqual(pressed, [{ project: "p1", view: "p:p1" }]);
document.body.click();
scope.dispose();
button.click();
assert.equal(pressed.length, 1);
assert.equal(scope.size, 0);
console.log("ok header: header.action entries drawn and pressed");
