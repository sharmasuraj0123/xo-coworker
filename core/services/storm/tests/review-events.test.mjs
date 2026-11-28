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

test("an Antigravity question with null headers and choice notes opens as a review", async () => {
  const { readFileSync } = await import("node:fs");
  const { questionsOf } = await import("../../review.js");
  const item = JSON.parse(readFileSync(new URL("./fixtures/agy-question-review.json", import.meta.url), "utf8"));
  const ctx = { state: { rejectedFrames: new Map(), review: new Map() }, soon() {} };
  review["review.opened"](ctx, { seq: 1 }, item);
  assert.equal(ctx.state.rejectedFrames.size, 0);
  const shown = questionsOf(ctx.state.review.get(item.id));
  assert.deepEqual(shown.map((q) => [q.header, q.options.length]), [["", 4], ["", 4]]);
});

test("a live review that can't be read is dropped and said", () => {
  const ctx = { state: { rejectedFrames: new Map(), review: new Map() }, soon() {} };
  review["review.opened"](ctx, { seq: 1 }, { id: "r", detail: { questions: [{ header: 3 }] } });
  assert.equal(ctx.state.review.has("r"), false);
  assert.deepEqual([...ctx.state.rejectedFrames.keys()], ["review.opened.detail"]);
});
