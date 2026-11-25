import assert from "node:assert/strict";
import test from "node:test";
import { createTurns } from "../turns.js";

test("malformed turn metadata cannot replace valid wake ids, step data or a turn's ordering", () => {
  const turns = createTurns();
  turns.apply({ type: "turn.started", turn_id: "t", seq: 3, data: { wakes: ["m1", { id: "m2" }] } });
  turns.apply({ type: "block.started", turn_id: "t", seq: "later", data: {
    block: { id: "b", type: "activity", rows: [null, { call_id: "c", status: "running", progress: "pending" }] },
  } });
  const turn = turns.get("t");
  assert.deepEqual(turn.wakes, ["m1"]);
  assert.equal(turn.lastSeq, 3);
  const [block] = turns.blocksOf(turn);
  assert.equal(block.seq, 3.5);
  assert.equal(block.rows.length, 1);
  assert.equal(block.rows[0].call_id, "c");
  assert.equal(block.rows[0].progress, undefined);
});
