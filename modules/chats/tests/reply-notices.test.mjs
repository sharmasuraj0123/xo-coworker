import assert from "node:assert/strict";
import { test } from "node:test";
import { replyNotices } from "../reply-notices.js";

test("an answered chat announces the full reply and shows an excerpt only outside that chat", () => {
  const notices = [], announcements = [];
  let draws = 0, view = "home";
  const receive = replyNotices(() => view, () => "Demo", (notice) => notices.push(notice), (line) => announcements.push(line), () => draws++);
  const event = { kind: "message", answered: true, project: "demo", text: "**Ready** to review" };
  assert.equal(receive(event), true);
  assert.deepEqual(notices, [{ kind: "reply", text: "Demo coordinator replied", sub: "Ready to review", open: "p:demo" }]);
  view = "ws";
  receive({ ...event, project: "workspace" });
  assert.deepEqual(announcements, ["Demo coordinator replied: **Ready** to review", "The coordinator replied: **Ready** to review"]);
  receive({ ...event, answered: false });
  assert.equal(notices.length, 1);
  assert.equal(announcements.length, 2);
  assert.equal(receive({ kind: "ask" }), false);
  assert.equal(draws, 3);
});
