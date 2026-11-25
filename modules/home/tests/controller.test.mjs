// @ts-check

import assert from "node:assert/strict";
import { createPlaces } from "../../../core/kernel/places.js";
import { createScope } from "../../../core/kernel/scope.js";
import { dom, same } from "../../../tests/lib/dom.mjs";

const { document } = await dom('<main id="home"></main>');
Object.assign(globalThis, { matchMedia: () => ({ matches: true }) });
const { createHomeController } = await import("../controller.js");
const host = document.getElementById("home");
const scope = createScope();
const calls = [];
const needs = ["first", "second", "third", "fourth", "parked", "waiting"].map((key) => ({
  key, risk: "notable", effort: "think", group: "notable",
  admitted: key !== "waiting", later: key === "parked", held: key === "waiting",
  t: { id: key, project: "project", title: key },
  ask: { kind: "question" },
}));
const places = createPlaces();
places.define({ id: "home.section", kind: "list", scope: "app", description: "Home sections" });
const home = createHomeController({
  host, scope, kernel: { places }, isCurrent: () => true,
  world: { state: { threads: [] } },
  D: {
    needItems: () => needs, current: () => null, isOpen: () => false, decideNow: () => true,
    failedNote: () => null, parts: { chipsHtml: () => "", effTagHtml: () => "", leadHtml: () => "" },
    open: (key, options) => calls.push(["open", key, options]),
    laterNow: (key) => { calls.push(["later", key]); needs.find((need) => need.key === key).later = true; },
    recallAll: () => calls.push(["recall"]),
    bringIn: (key) => calls.push(["bringIn", key]),
  },
  Kit: { READ_MS: 300, isBinary: () => false }, EFFORT: { think: { label: "Think" } },
  decideKey: (key) => calls.push(["details", key]),
  announce: (message) => calls.push(["announce", message]), schedule: () => calls.push(["schedule"]),
  SV: { homeOrder() {} },
  heraldShow: (notice) => calls.push(["herald", notice.text]), noun: (word) => word,
  isBusy: () => false, askTitle: (need) => need.key, PROJ: (project) => project, threadMark: () => "",
  evidenceFor: () => ({}), convOfChat: (chat) => chat,
});

const get = (selector) => host.querySelector(selector);
home.homeRender(needs);
get("[data-open-all]").click();
home.openNext();
get("[data-later]").click();
home.homeRender(needs);
assert.equal(home.homeParts().next.key, "second");
same(document.activeElement, get(".next"), "parking moves focus to the new decision");
get("[data-bring]").click();
get("[data-handled]").click();
assert.equal(get("[data-handled]").getAttribute("aria-expanded"), "true");
get("[data-bring-in]").click();
assert.deepEqual(calls.splice(0), [
  ["open", "first", undefined], ["details", "first"], ["later", "first"], ["recall"],
  ["announce", "Brought back. They're in today's list again."], ["schedule"], ["bringIn", "waiting"],
]);
home.restore("fourth");
home.homeRender(needs);
assert.equal(get(".next").getAttribute("data-key"), "fourth");

scope.dispose();
assert.equal(scope.size, 0);
get("[data-bring]").click();
assert.deepEqual(calls, []);
