import assert from "node:assert/strict";
import { test } from "node:test";
import { createScope } from "../../core/kernel/scope.js";
import { dom } from "../../tests/lib/dom.mjs";
import { createSideRows } from "../rail/rows.js";

test("Chats holds the Workspace: its row is on there, and its coordinator lights the Chats dot", async () => {
  const nav = ["home", "chats", "arts", "auto", "lp", "more"].map((place) => `<button id="nv-${place}"><span id="${place}-n"></span></button>`).join("");
  const { document } = await dom(`<aside id="side"><nav class="nav">${nav}<span id="chats-live"></span></nav><div id="projects"></div></aside>`);
  const side = document.getElementById("side"), matches = side.matches.bind(side);
  side.matches = (selector) => selector === ":focus-within" ? false : matches(selector);
  let view = "ws", busy = false, chat = "";
  const needs = [];
  const scope = createScope();
  const sideRender = createSideRows(scope, ({ view: () => view,
    world: { state: { threads: [] }, act: { coordinatorBusy: (p) => p === "workspace" && busy } },
    CH: { isChats: (v) => v === "chats", live: () => chat }, D: { needItems: () => needs },
    projects: () => [], convThread: () => null, isBusy: () => false, isHeld: () => false, askShort: () => "", projectIcon: () => "", folded: () => false,
  }));
  const dot = () => document.getElementById("chats-live")?.className;
  const label = () => document.getElementById("nv-chats")?.getAttribute("aria-label");
  try {
    sideRender(needs);
    assert.equal(document.getElementById("nv-chats")?.getAttribute("aria-current"), "page");
    assert.equal(dot(), "nr-live");
    busy = true;
    sideRender(needs);
    assert.equal(dot(), "nr-live is-working");
    assert.equal(label(), "Chats, the Workspace is working");
    needs.push({ admitted: true, t: { host: true, project: "workspace" } });
    sideRender(needs);
    assert.equal(dot(), "nr-live is-waiting");
    assert.equal(label(), "Chats, the Workspace needs you");
    needs.length = 0;
    busy = false;
    chat = "waiting";
    view = "home";
    sideRender(needs);
    assert.equal(label(), "Chats, a chat needs you");
    assert.equal(document.getElementById("nv-chats")?.hasAttribute("aria-current"), false);
  } finally {
    scope.dispose();
  }
});
