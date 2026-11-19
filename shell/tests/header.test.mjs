// The header draws header.action entries where they show, and a press runs the entry with where you are.
import assert from "node:assert/strict";

const { createKernel } = await import("../../core/kernel/index.js");
const { definePlaces } = await import("../places.js");
const { headerActionsHtml, wireHeaderActions } = await import("../header.js");

const K = createKernel({ warn: () => {}, log: () => {} });
definePlaces(K);
const pressed = [];
const ic = (n) => `<i data-ic="${n}"></i>`;
K.places.contribute("header.action", { id: "dev.word:open", label: "Outline <x>", icon: "plug", when: (at) => at.project === "p1", onPress: (at) => pressed.push(at) }, "xo.apps-host");
assert.equal(headerActionsHtml(K.places, { project: "p2" }, ic), "", "not where its when says no");
const html = headerActionsHtml(K.places, { project: "p1" }, ic);
assert.match(html, /^<button type="button" class="tw-act" data-header-action="dev\.word:open" title="Outline &lt;x&gt;"><i data-ic="plug"><\/i><span>Outline &lt;x&gt;<\/span><\/button>$/);
let click;
wireHeaderActions(K.places, () => ({ project: "p1", view: "p:p1" }), { addEventListener: (_t, fn) => { click = fn; } });
click({ target: { closest: () => ({ dataset: { headerAction: "dev.word:open" } }) } });
assert.deepEqual(pressed, [{ project: "p1", view: "p:p1" }]);
click({ target: { closest: () => null } });
assert.equal(pressed.length, 1, "a press elsewhere does nothing");
console.log("ok header: header.action entries drawn and pressed");
