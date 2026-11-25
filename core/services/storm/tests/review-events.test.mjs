import assert from "node:assert/strict";
import test from "node:test";
import { review } from "../reducers/review.js";
import { isReview } from "../../../platform/review-responses.js";

test("open reviews retain valid annotations and ignore incomplete frames", () => {
  const ctx = { state: { review: new Map() }, soon() {} };
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
