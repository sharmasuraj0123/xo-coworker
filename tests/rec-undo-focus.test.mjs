// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock } from "node:test";
import { dom } from "./lib/dom.mjs";
import { createRecordLines } from "../modules/chats/record-lines.js";

const { document } = await dom('<main id="place" tabindex="-1"></main><button data-rec-undo="rec1">Undo</button><button data-rec-undo="rec2">Undo</button>');
const place = document.getElementById("place");
/** @type {import("../modules/chats/record-lines-types.d.ts").RecordDeps["S"]} */
const S = { n: 0, view: "t:here", local: {}, herald: null };
const events = [];
const { recordLine, undoRecord } = createRecordLines({
  S, placeRegion: () => place, announce: (text) => events.push(text), heraldShow() {}, heraldNext() {},
  schedule() { events.push(document.activeElement === place ? "draw after focus returns" : "draw"); },
});
mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100 });
try {
  const undo = () => events.push(document.activeElement === place ? "undo after focus returns" : "undo");
  recordLine("t:here", { text: "Saved", undo });
  document.querySelector('[data-rec-undo="rec1"]').focus();
  events.length = 0;
  undoRecord("rec1");
  assert.deepEqual(events, ["undo after focus returns", "Undone.", "draw after focus returns"]);
  assert.equal(S.local["t:here"][0].text, "Saved · undone");
  assert.equal(S.local["t:here"][0].undo, null);
  mock.timers.tick(3050);
  recordLine("t:here", { text: "Another edit", undo });
  document.querySelector('[data-rec-undo="rec2"]').focus();
  events.length = 0;
  mock.timers.tick(3050);
  assert.deepEqual(events, ["draw after focus returns"], "expiry returns focus without undoing the record");
  undoRecord("rec2");
  assert.equal(S.local["t:here"][1].text, "Another edit");
} finally {
  mock.timers.reset();
}

const redraw = readFileSync(new URL("../core/ui/redraw.js", import.meta.url), "utf8");
assert.doesNotMatch(redraw, /around\.find|place\.focus/, "redraw leaves successor focus to the caller");
