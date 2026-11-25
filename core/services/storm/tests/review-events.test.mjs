import assert from "node:assert/strict";
import test from "node:test";
import { review } from "../reducers/review.js";
import { isReview } from "../../../platform/review-responses.js";

test("open reviews retain valid annotations and ignore incomplete frames", () => {
  const ctx = { state: { rejectedFrames: new Map(), review: new Map() }, soon() {} };
  review["review.opened"](ctx, {}, {});
  assert.equal(ctx.state.review.size, 0);
  review["review.opened"](ctx, { seq: 1 }, { id: "r" });
  review["review.annotated"](ctx, {}, { id: "r", by: "owner" });
  assert.equal(ctx.state.review.get("r").annotations, undefined);
  const note = { id: "r", by: "owner", note: "Verified" };
  review["review.annotated"](ctx, {}, note);
  assert.deepEqual(ctx.state.review.get("r").annotations, [note]);
});

test("review timestamps accept missing, text or null values", () => {
  const row = { id: "r", state: "open" };
  for (const field of ["created_at", "expires_at"]) {
    for (const value of [undefined, null, "2026-01-01"]) assert.equal(isReview({ ...row, [field]: value }), true);
    assert.equal(isReview({ ...row, [field]: {} }), false);
  }
});

test("review risk reasons remain text through the decision projection", () => {
  const row = { id: "r", state: "open" };
  assert.equal(isReview({ ...row, risk_reasons: ["Irreversible"] }), true);
  assert.equal(isReview({ ...row, risk_reasons: [{}] }), false);
});

test("the decision contract checks hold flags and question choices before rendering", () => {
  const item = { id: "r", state: "open", options: [{ decision: "allow", hold_to_confirm: true }],
    detail: { questions: [{ id: "q", options: [{ label: "Keep" }] }] } };
  assert.ok(isReview(item));
  assert.equal(isReview({ ...item, options: [{ decision: "allow", hold_to_confirm: "false" }] }), false);
  assert.equal(isReview({ ...item, detail: { questions: [{ options: [{ label: 12 }] }] } }), false);
});
