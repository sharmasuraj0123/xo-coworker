import assert from "node:assert/strict";
import test from "node:test";
import { createScope } from "../core/kernel/scope.js";
import { createHerald } from "../core/services/notices.js";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import { dom } from "./lib/dom.mjs";
import { mountFailureSurface } from "../shell/failure-surface.js";

test("failure floods wait behind Undo as one line and reveal a diagnostic only on request", async (t) => {
  const { document } = await dom('<div id="app"><div id="dock"><div id="herald"></div><textarea></textarea></div></div>');
  const create = document.createElement.bind(document);
  t.mock.method(document, "createElement", tag => {
    const el = create(tag);
    if (tag === "dialog") {
      el.showModal = () => el.setAttribute("open", "");
      el.close = () => el.removeAttribute("open");
    }
    return el;
  });
  const state = { herald: null }, scope = createScope();
  t.after(scope.dispose);
  const notices = createHerald({ state, setTimer: () => 0, clearTimer() {} });
  notices.show({ kind: "sent", text: "Sent", undo() {} });
  const surface = mountFailureSurface({ ...scope, use: () => notices, frame: fn => fn() });
  const message = 'Unexpected "<tag>"';
  for (let i = 0; i < 100; i++) surface.report(message, "xo.map");
  assert.equal(state.herald.text, "Sent");
  assert.equal(notices.HQ.length, 1);
  state.herald.until = 0;
  notices.next();
  const main = { say: document.querySelector("textarea") };
  const view = createNoticeLine({
    notice: () => state.herald, world: { state: {} }, MK: main, composerNow: () => main,
    panelHost: () => null, connDest: () => ({}), placeRegion: () => main.say,
  });
  view.heraldRender([]);
  const line = document.getElementById("herald");
  assert.equal(line.textContent, "Map couldn’t start. (100 reports)Details");
  const button = line.querySelector("button");
  button.focus();
  surface.report(message, "xo.map");
  view.heraldRender([]);
  assert.ok(document.activeElement === button);
  button.click();
  const dialog = document.querySelector("dialog[open]");
  assert.equal(dialog.querySelector("pre").textContent, 'xo.map: Unexpected "<tag>" (×101)');
  assert.ok(dialog.querySelector("tag") === null);
  dialog.querySelector("button").click();
  assert.equal(dialog.hasAttribute("open"), false);
});
