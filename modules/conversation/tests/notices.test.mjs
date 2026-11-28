import assert from "node:assert/strict";
import { test } from "node:test";
import { createConversationNotices } from "../../../core/services/notices/line.js";

test("a notice owner advances its own queue and clears its timer on disposal", ({ mock }) => {
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000 });
  let redraws = 0;
  let undos = 0;
  const first = createConversationNotices(() => { redraws++; });
  const other = createConversationNotices(() => {});

  first.show({ text: "Stop pending", kind: "halt", tag: "stops", undo: () => { undos++; } }, 800);
  first.show({ text: "Project removed", kind: "done", force: true }, 800);
  other.show({ text: "File saved", kind: "done" }, 800);
  assert.equal(first.current()?.text, "Stop pending");
  assert.equal(other.current()?.text, "File saved");
  first.dismiss((notice) => notice.tag === "stops");
  assert.equal(first.current()?.text, "Project removed");
  assert.equal(undos, 0);
  first.dispose();
  const before = redraws;
  mock.timers.tick(1_000);
  assert.equal(first.current(), null);
  assert.equal(redraws, before, "disposing the owner cancels its delayed redraw");
  first.show({ text: "Late message", kind: "done" });
  assert.equal(first.current(), null);
  other.dispose();
});
