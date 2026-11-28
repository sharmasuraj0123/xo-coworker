import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isFrame, isThread, isMessage } from "../../../platform/chat-responses.js";
import { boot, fakeBackend, until } from "../../../../tests/storm-harness.mjs";

test("recorded session and thread envelopes satisfy the live contract", () => {
  const fixture = new URL("../../../../tests/fixtures/storm-held-contract.json", import.meta.url);
  const { events } = JSON.parse(readFileSync(fixture, "utf8"));
  for (const frame of events) {
    assert.ok(isFrame(frame));
    if (frame.type === "thread") assert.ok(isThread(frame.data));
  }
  assert.ok(isMessage({ id: "attachment", text: null, extra: { attachments: [{ id: "file" }] } }));
});

test("invalid live records are counted, reported once, and later valid records still arrive", async (t) => {
  const errors = [];
  t.mock.method(console, "error", (error) => errors.push(error.message));
  const backend = fakeBackend();
  const { world } = await boot(backend);
  t.after(world.dispose);
  const push = (type, seq, data) => backend.push(type, { chat_id: "chat_p", seq, data }, seq);
  push("message", 2, { id: "bad", text: [] });
  push("message", 3, { id: "bad", text: [] });
  push("run.state", 4, { run_id: 4 });
  push("message", 5, { id: "ok", text: null });
  await until(() => world.state.lastSeq === 5);
  assert.deepEqual([...world.state.rejectedFrames], [["message.text", 2], ["run.state.run_id", 1]]);
  assert.equal(errors.length, 2);
  assert.deepEqual(world.state.timeline.demo.map((row) => row.id), ["ok"]);
});
