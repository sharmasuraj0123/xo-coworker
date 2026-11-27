import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { dom } from "../../../tests/lib/dom.mjs";
import { createHerald } from "../../../core/services/notices.js";
import { createNoticeLine } from "../notice-line.js";
import { createConversationStops } from "../stops.js";
import { createPendingRunStops } from "../../../core/services/run-stops.js";

test("Stopping shows its Undo with a ring that empties at the stop's own deadline", () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  const notices = [];
  const stop = createConversationStops({
    world: { act: { turnOf: () => "turn", stop: async () => ({ stopped: true }) } },
    Kit: { COMMIT_MS: 3000 }, PROJ: () => "Project", announce() {}, schedule() {}, chatOf: () => null,
    pendingStops: createPendingRunStops(), heraldShow: (notice) => notices.push(notice), dismissStops() {}, inUse: () => () => null,
    running: () => ({ kind: "chat", session: "s1" }), workingRuns: () => 0,
  });
  try {
    stop.stopRun("c:s1");
    assert.equal(notices[0].text, "Stopping");
    assert.equal(notices[0].undoUntil, 4000);
    assert.equal(notices[0].undoMs, 3000);
  } finally {
    stop.dispose();
    mock.timers.reset();
  }
});

test("the notice line draws that ring once and a redraw keeps the same running ring", async () => {
  const { document } = await dom('<div id="app"><div id="dock"><div id="herald"></div><textarea id="reply"></textarea></div></div>');
  const main = { say: document.querySelector("#reply") };
  const state = { herald: null };
  const herald = createHerald({ state, setTimer: () => 0, clearTimer() {} });
  const view = createNoticeLine({
    notice: () => state.herald, world: { state: {} }, MK: main, composerNow: () => main,
    panelHost: () => null, connDest: () => ({}), placeRegion: () => main.say,
  });
  const until = Date.now() + 3000;
  herald.show({ kind: "halt", text: "Stopping", sub: "This chat", undo() {}, undoUntil: until, undoMs: 3000 }, 3000);
  view.heraldRender();
  const ring = document.querySelector("#herald .hr-undo svg[data-ring-until]");
  assert.equal(!!ring, true, "the Undo carries the ring");
  assert.equal(ring.getAttribute("data-ring-until"), String(until));
  view.heraldRender();
  assert.equal(document.querySelector("#herald .hr-undo svg[data-ring-until]") === ring, true, "the same node, so it isn't restarted");
  state.herald = null;
  herald.show({ kind: "stopped", text: "Couldn't stop it", undo() {}, undoLabel: "Retry" }, 3000);
  view.heraldRender();
  assert.equal(document.querySelector("#herald .hr-undo")?.textContent, "Retry");
  assert.equal(!!document.querySelector("#herald .hr-undo svg"), false, "a Retry with no deadline has no ring");
});
