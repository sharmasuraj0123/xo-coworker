import assert from "node:assert/strict";
import { test } from "node:test";
import { cmp, context, decls, rules, spec } from "./lib/cascade.mjs";
import { dom, same } from "./lib/dom.mjs";
import { resolveTokens } from "./lib/tokens.mjs";
import { createConversationFiles } from "../modules/files/conversation-files.js";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import { createPanelThreadOpener } from "../shell/panel/thread-navigation.js";

test("notices move to the composer in use, with independent space and an Undo focus target", async () => {
  const { document } = await dom(`
    <div class="app" id="app"><div class="dock is-stacked" id="dock">
      <div class="herald" id="herald" aria-live="polite"></div>
      <label class="composer-field"><textarea id="main-reply"></textarea></label>
    </div></div>
    <div class="tp"><div class="dock is-stacked" id="tpdock">
      <div class="herald" id="tpherald" aria-live="polite"></div>
      <label class="composer-field"><textarea id="panel-reply"></textarea></label>
    </div></div>`);
  const page = document.querySelector("#app"), panel = document.querySelector(".tp");
  const mainLine = document.querySelector("#herald"), panelLine = document.querySelector("#tpherald");
  const main = { view: "p:demo", say: document.querySelector("#main-reply") };
  const reply = { view: "t:demo", say: document.querySelector("#panel-reply") };
  document.querySelector("#dock").getBoundingClientRect = () => ({ top: 520 });
  document.querySelector("#tpdock").getBoundingClientRect = () => ({ top: 680 });
  mainLine.getBoundingClientRect = () => ({ top: 480 });
  panelLine.getBoundingClientRect = () => ({ top: 630 });
  let current = main;
  const state = { view: "p:demo", herald: null };
  const { heraldRender } = createNoticeLine({
    notice: () => state.herald, MK: main, world: { state: { router: { mode: "off" } } },
    composerNow: () => current, panelHost: () => panel, connDest: (view) => (view === "t:demo" ? { thread: true } : { pid: "demo" }),
    convThread: () => null, placeRegion: () => page, STOP_ICON: "",
  });
  heraldRender();
  assert.match(mainLine.textContent, /The router is off/);
  assert.equal(page.style.getPropertyValue("--herald-room"), "48px");
  assert.equal(panel.style.getPropertyValue("--herald-room"), "0px");
  current = reply;
  heraldRender();
  assert.equal(panelLine.textContent, "", "thread replies do not show the router Off warning");
  assert.equal(mainLine.textContent, "", "the other line is empty");

  const now = Date.now();
  state.herald = { kind: "done", text: "Stopped a run", n: 1, until: now + 5000, undo() {} };
  heraldRender();
  assert.match(panelLine.textContent, /Stopped a run/);
  assert.equal(page.style.getPropertyValue("--herald-room"), "0px");
  assert.equal(panel.style.getPropertyValue("--herald-room"), "58px");
  panelLine.querySelector("[data-herald-undo]").focus();
  state.herald = null;
  heraldRender();
  same(document.activeElement, reply.say, "a disappearing Undo returns focus to the reply");

  const published = rules(new URL("./lib/panel-parity.mjs", import.meta.url));
  const winning = (element, name, width) => published.flatMap((rule) => {
    if (!/\.herald\b|\btextarea\b/.test(rule.sel) || /::/.test(rule.sel)) return [];
    const declarations = decls(rule.d).filter((decl) => decl.p === name);
    if (!declarations.length || !context(rule, width).active || !element.matches(rule.sel)) return [];
    return declarations.map((decl) => ({ ...decl, score: spec(rule.sel), order: rule.n }));
  }).sort((a, b) => Number(a.imp) - Number(b.imp) || cmp(a.score, b.score) || a.order - b.order).at(-1)?.v;
  document.body.classList.add("stage-covers");
  assert.equal(winning(mainLine, "position", 390), "fixed");
  assert.equal(winning(panelLine, "position", 390), "absolute");
  assert.equal(winning(panelLine, "bottom", 390), "calc(100% + var(--dock-gap))");
  const touchMinimum = resolveTokens("var(--h-touch)");
  for (const composer of [main, reply]) assert.equal(winning(composer.say, "min-height", 390), touchMinimum);
});

test("a line capsule opens a file in its own conversation's worktree", () => {
  const opened = [];
  const { openLineRef } = createConversationFiles({
    currentView: () => "p:other", convThread: () => null, convAt: () => ({ view: "t:fixture" }),
    CHG: { scope: (view) => view === "t:fixture" ? { project: "p", worktree: "fixture" } : null },
    VW: { open: (file, from) => opened.push([file, from]) },
  });
  const link = { dataset: { ref: "src/a.js", refA: "3", refB: "5" } };
  openLineRef(link);
  assert.deepEqual(opened[0][0], { path: "src/a.js", name: "a.js", project: "p", rel: ".xo/worktrees/fixture/src/a.js", lines: [3, 5] });
  assert.ok(opened[0][1] === link);
});

test("a panel link keeps its message when it opens either conversation", async () => {
  const { document } = await dom('<a data-go="t:demo" data-go-msg="message-7"><span>Open message</span></a>');
  const state = { view: "p:project" };
  const panel = { view: "t:demo" };
  const calls = [];
  const open = createPanelThreadOpener({
    view: () => state.view, panelConversation: () => panel, world: { thread: () => true },
    go: (...args) => calls.push(args), showMsg: (...args) => calls.push(args),
  });
  const event = { target: document.querySelector("span") };
  open("t:demo", event, (page, key) => calls.push([page, key]));
  assert.deepEqual(calls.splice(0), [["thread", "demo"], ["message-7", panel]]);
  open("t:demo", { ...event, metaKey: true });
  assert.deepEqual(calls, [["t:demo", { panel: true }], ["message-7"]]);
});
