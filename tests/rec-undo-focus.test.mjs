// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { dom } from "./lib/dom.mjs";
import { createRecordLines } from "../modules/chats/record-lines.js";
import { createLocalMessages } from "../modules/conversation/local-messages.js";

const { document } = await dom('<main id="place" tabindex="-1"></main><button data-rec-undo="rec1">Undo</button><button data-rec-undo="rec2">Undo</button>');
const place = document.getElementById("place");
const localMessages = createLocalMessages();
const events = [];
const { recordLine, undoRecord, dispose } = createRecordLines({
  view: () => "t:here", localMessages, placeRegion: () => place, announce: (text) => events.push(text), heraldShow() {}, dismissRecord() {},
  schedule() { events.push(document.activeElement === place ? "draw after focus returns" : "draw"); },
});
mock.timers.enable({ apis: ["Date", "setTimeout"], now: 100 });
try {
  const undo = () => events.push(document.activeElement === place ? "undo after focus returns" : "undo");
  recordLine("t:here", { text: "Saved", undo });
  document.querySelector('[data-rec-undo="rec1"]').focus();
  events.length = 0;
  await undoRecord("rec1");
  assert.deepEqual(events, ["draw after focus returns", "undo after focus returns", "Undone.", "draw after focus returns"]);
  const record = localMessages.get("rec1");
  assert.equal(record?.text, "Saved · undone");
  assert.equal(record?.who === "rec" && record.undo, null);
  mock.timers.tick(3050);
  recordLine("t:here", { text: "Another edit", undo });
  document.querySelector('[data-rec-undo="rec2"]').focus();
  events.length = 0;
  mock.timers.tick(3050);
  assert.deepEqual(events, ["draw after focus returns"], "expiry returns focus without undoing the record");
  await undoRecord("rec2");
  assert.equal(localMessages.get("rec2")?.text, "Another edit");
} finally {
  dispose();
  mock.timers.reset();
}
