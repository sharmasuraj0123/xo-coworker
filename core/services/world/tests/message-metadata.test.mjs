import assert from "node:assert/strict";
import test from "node:test";
import { addReaction, uiMsg, updateMessage } from "../rows.js";

test("malformed optional metadata cannot turn a reaction or attachment into an invalid view row", () => {
  const row = { id: "m", extra: {
    reactions: { emoji: "bad" }, passed_on: { project: [] }, continued_in: {},
    forwarded_from: { message_id: "f", via: ["space", 7], root: { message_id: [] } },
    attachments: [{ id: "file", bytes: "unknown", tint: {}, w: 24 }],
  } };
  const list = addReaction([row], { message_id: "m", emoji: "ok", by: {} });
  const message = uiMsg(list[0]);
  assert.deepEqual(message.reactions, [{ emoji: "ok", by: null, at: null }]);
  assert.deepEqual(message.fwd, { id: "f", chatId: null, via: ["space"] });
  assert.equal(message.passedOn, null);
  assert.equal(message.continuedIn, null);
  assert.deepEqual(message.files, [{ id: "file", name: "file", type: "", bytes: null, w: 24 }]);
  assert.equal(updateMessage(list, { id: "m", extra: [] }), null);
});
