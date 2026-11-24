import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";
import { createNavigation } from "../shell/navigation.js";

const { document } = await dom(`<section id="panel"></section><div id="column"><div id="msgs">
  <div data-k="cmsg_a"><button data-go="t:A">Open A</button></div></div></div>
  <div id="tdock"></div><div id="scroller" tabindex="-1"></div><textarea></textarea>`);
const S = { view: "p:x", backTo: {}, parent: {}, trail: [], scroll: {} };
const noop = () => {};
const scroller = document.querySelector("#scroller"), card = document.querySelector("[data-go]");
const pill = [];
const nav = createNavigation({
  S, VW: {}, STAGE: { leave: noop }, IQ: { close: noop }, PHONE: { matches: false },
  REC: { leave: noop }, TD: {}, tdock: document.querySelector("#tdock"), say: document.querySelector("textarea"), scroller,
  closeSettings: noop, setDrawer: noop, saveScroll: noop, saveDraft: noop, follow: noop, pageEl: () => null,
  loadDraft: noop, render: noop, returnPill: (target) => pill.push(target), convThread: () => ({ project: "x" }),
});
nav.go("t:A", { row: "cmsg_a" });
nav.back();
same(document.activeElement, card);
same(pill.at(-1), card);
assert.equal(S.backTo["t:A"], undefined);

for (const view of ["t:B", "t:A"]) {
  card.focus();
  nav.go(view);
  nav.back();
  same(document.activeElement, scroller);
  assert.ok(pill.at(-1) === null);
}
nav.go("t:A", { row: "cmsg_a" });
nav.go("p:y", { from: "t:A" });
assert.ok(pill.at(-1) === null);
