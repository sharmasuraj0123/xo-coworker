// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";
import { createKernel } from "../../core/kernel/index.js";
import { definePlaces } from "../places.js";
import { createTopHeader } from "../top-header.js";
import { createScope } from "../../core/kernel/scope.js";

const { document } = await dom('<header id="top"><button id="top-back" hidden></button><div id="top-who"></div><div id="top-end"></div></header><div id="since"></div>');
const K = createKernel();
definePlaces(K);
K.places.contribute("header.action", { id: "outline", label: "Outline", icon: "plug", when: ({ project }) => project === "p", onPress() {} }, "xo.apps-host");
let view = "p:p", parent = "home";
const thread = { id: "t", project: "p", state: "working", busy: true };
const calls = [];
K.bus.on("app:conversation-header", () => calls.push("since"));
const details = [];
K.places.contribute("header.detail", { id: "since", render: (_host, { project }) => details.push(project) }, "xo.since");
let title = "<h1>Project</h1>";
const top = document.getElementById("top");
const back = document.getElementById("top-back");
const who = document.getElementById("top-who");
const end = document.getElementById("top-end");
const render = createTopHeader({
  location: { view: () => view, parentOf: (v) => v === "t:t" ? parent : undefined },
  convThread: (v) => v === "t:t" ? thread : null, isBusy: (t) => t.busy,
  CH: { isChats: (v) => v === "chats" || v.startsWith("c:"), headHtml: () => "<h1>Chat</h1>" },
  STAGE: { button: () => "<button>Panel</button>" },
  checklistRender: () => calls.push("checklist"),
  PROJ: () => "Project",
  conversationHeaderHtml: () => ({ who: title, controls: '<button data-stage-open>Threads</button>' }),
  places: K.places, emit: K.bus.emit, atOf: () => ({ project: "p" }), LW: { isOpen: false },
  LP: { button: () => "<button>Deploy</button>", ensure: () => calls.push("launchpad") },
  tdelRender: () => calls.push("delete"),
}, createScope(), () => {});
render([]);
assert.equal(back.hidden, true);
assert.deepEqual([...end.children].map((control) => control.textContent), ["Threads", "Outline", "Deploy", "Panel"]);
const threads = end.querySelector("[data-stage-open]");
title = "<h1>Project renamed</h1>";
render([]);
assert.ok(end.querySelector("[data-stage-open]") === threads, "the open control survives a title redraw");
assert.deepEqual(calls.slice(-4), ["launchpad", "checklist", "delete", "since"]);
assert.equal(who.textContent, "Project renamed");
view = "t:t";
title = '<input value="Editing">';
render([]);
assert.equal(top.dataset.state, "busy");
assert.equal(back.getAttribute("aria-label"), "Back to Home");
const input = who.querySelector("input");
const backLabel = back.querySelector("span");
title = null;
render([{ t: { id: "t" }, admitted: true }]);
assert.equal(top.dataset.state, "need");
assert.ok(who.querySelector("input") === input, "the paused title draw keeps the active editor");
assert.ok(back.querySelector("span") === backLabel, "a changed state keeps the Back label in place");
view = "c:chat";
render([]);
assert.equal(back.getAttribute("aria-label"), "Back to Chats");
assert.equal(who.textContent, "Chat");
assert.deepEqual(calls.slice(-2), ["since", "checklist"], "Chats only paints the checklist after its header");
view = "ws";
title = "<h1>Workspace</h1>";
render([]);
assert.equal(back.hidden, false, "the Workspace has a way back");
assert.equal(back.getAttribute("aria-label"), "Back to Chats");
view = "chats";
render([]);
assert.equal(back.hidden, true);
view = "p:p";
render([]);
assert.equal(details.at(-1), "p");
view = "chats";
render([]);
assert.equal(details.at(-1), null, "Chats clears the project's details, so its Since line doesn't stay under the Chats header");
view = "t:t";
for (const [from, words] of [["automations", "Automations"], ["artifacts", "Artifacts"], ["launchpad", "Launchpad"], ["p:p", "Project"]]) {
  parent = from;
  render([]);
  assert.equal(back.getAttribute("aria-label"), `Back to ${words}`, `a thread opened from ${from} names it whole`);
}
