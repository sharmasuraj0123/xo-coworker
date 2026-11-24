// @ts-check
import assert from "node:assert/strict";
import { dom } from "../../tests/lib/dom.mjs";
import { createKernel } from "../../core/kernel/index.js";
import { definePlaces } from "../places.js";
import { createTopHeader } from "../top-header.js";

const { document } = await dom('<header id="top"><button id="top-back" hidden></button><div id="top-who"></div><div id="top-end"></div></header>');
const K = createKernel();
definePlaces(K);
K.places.contribute("header.action", { id: "outline", label: "Outline", icon: "plug", when: ({ project }) => project === "p", onPress() {} }, "xo.apps-host");
const S = { view: "p:p", parent: { "t:t": "home" }, hdrCtl: '<button data-stage-open>Threads</button>' };
const thread = { id: "t", project: "p", state: "working", busy: true };
const calls = [];
let title = "<h1>Project</h1>";
const top = document.getElementById("top");
const back = document.getElementById("top-back");
const who = document.getElementById("top-who");
const end = document.getElementById("top-end");
const render = createTopHeader({
  S, convThread: (v) => v === "t:t" ? thread : null, isBusy: (t) => t.busy,
  CH: { isChats: (v) => v === "chats" || v.startsWith("c:"), headHtml: () => "<h1>Chat</h1>" },
  STAGE: { button: () => "<button>Panel</button>" },
  checklistRender: () => calls.push("checklist"),
  PROJ: () => "Project",
  conversationHeaderHtml: () => title,
  kernel: K, atOf: () => ({ project: "p" }), LW: { isOpen: false },
  LP: { button: () => "<button>Deploy</button>", ensure: () => calls.push("launchpad") },
  tdelRender: () => calls.push("delete"),
  REC: { sinceLine: () => calls.push("since") },
});
render([]);
assert.equal(back.hidden, true);
assert.deepEqual([...end.children].map((control) => control.textContent), ["Threads", "Outline", "Deploy", "Panel"]);
const threads = end.querySelector("[data-stage-open]");
title = "<h1>Project renamed</h1>";
render([]);
assert.ok(end.querySelector("[data-stage-open]") === threads, "the open control survives a title redraw");
assert.deepEqual(calls.slice(-4), ["launchpad", "checklist", "delete", "since"]);
assert.equal(who.textContent, "Project renamed");
S.view = "t:t";
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
S.view = "c:chat";
render([]);
assert.equal(back.getAttribute("aria-label"), "Back to Chats");
assert.equal(who.textContent, "Chat");
assert.deepEqual(calls.slice(-2), ["since", "checklist"], "Chats only paints the checklist after its header");
