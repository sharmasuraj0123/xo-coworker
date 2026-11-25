import assert from "node:assert/strict";
import test from "node:test";
import { beginMessageRead } from "../message-reads.js";

test("history retains newer rows and replays edits received before the base row", () => {
  const old = { id: "seen", text: "old" };
  const live = { ...old, text: "new" };
  const read = beginMessageRead([old]);
  const reaction = { message_id: "unseen", emoji: "ok", by: "agent" };
  read.record(reaction, "now", true);
  read.record({ id: "unseen", extra: { title: "live" } }, null, false);
  const page = [old, { id: "unseen", text: "from page" }];
  const expected = { reactions: [{ emoji: "ok", by: "agent", at: "now" }], title: "live" };
  assert.deepEqual(read.reconcile([live], page), [live, { ...page[1], extra: expected }]);
  assert.deepEqual(read.reconcile([], [{ ...page[1], extra: expected }])[0].extra, expected);
});
