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
const scope = createScope();
document.body.innerHTML = html;
const button = document.querySelector("button");
assert.equal(button.dataset.headerAction, "dev.word:open");
assert.equal(button.getAttribute("aria-label"), "Outline <x>");
assert.equal(button.title, "Outline <x>");
assert.ok(button.querySelector("svg"));
assert.equal(button.querySelector("span").textContent, "Outline <x>");
wireHeaderActions(scope, K.places, () => ({ project: "p1", view: "p:p1" }));
button.click();
assert.deepEqual(pressed, [{ project: "p1", view: "p:p1" }]);
document.body.click();
scope.dispose();
button.click();
assert.equal(pressed.length, 1);
assert.equal(scope.size, 0);
console.log("ok header: header.action entries drawn and pressed");
