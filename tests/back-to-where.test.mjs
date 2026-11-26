import assert from "node:assert/strict";
import { dom, same } from "./lib/dom.mjs";
import { createNavigation } from "../shell/navigation.js";
import { createNavigationState } from "../shell/navigation-state.js";

const { document } = await dom(`<section id="panel"></section><div id="column"><div id="msgs">
  <div data-k="cmsg_a"><button data-go="t:A">Open A</button></div></div></div>
  <div id="tdock"></div><div id="scroller" tabindex="-1"></div><textarea></textarea>`);
const location = createNavigationState("p:x");
const scroller = document.querySelector("#scroller"), card = document.querySelector("[data-go]");
const pill = [];
const nav = createNavigation({
  location, say: document.querySelector("textarea"), scroller, pageEl: () => null, convThread: () => ({ project: "x" }),
  bus: { emit(topic, value) { if (topic === "app:return-target") pill.push(value); } },
});
nav.go("t:A", { row: "cmsg_a" });
nav.back();
same(document.activeElement, card);
same(pill.at(-1), card);

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
nav.go("ws");
nav.back();
assert.equal(location.view(), "chats", "the Workspace's Back goes to Chats, where it lives");
