import assert from "node:assert/strict";
import test from "node:test";
import { beginMessageRead, openMessageRead } from "../message-reads.js";

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

test("closing an earlier history request preserves the newer request's buffered reaction", () => {
  const active = new Map();
  const old = openMessageRead(active, "thread:t", beginMessageRead([]));
  const current = openMessageRead(active, "thread:t", beginMessageRead([]));
  old.close();
  active.get("thread:t")?.record({ message_id: "m", emoji: "ok" }, "now", true);
  const [row] = current.reconcile([], [{ id: "m" }]);
  assert.equal(row.extra?.reactions?.length, 1);
  current.close();
  assert.equal(active.size, 0);
});
