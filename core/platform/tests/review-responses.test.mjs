import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { api, ruleApi } from "../api.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/review-api.json", import.meta.url), "utf8"));
const { review, defaultRule } = fixture;
const rule = { id: "rule_example", scope: "workspace", sentence: "Check document headings", uses: 1, revoked_at: null };
const routes = [
  ["/chat/review", () => api.review(), { items: [review], next_after_seq: null },
    { items: [{ ...review, risk_groups: [{ text: false }] }] }],
  ["/chat/review/review_example", () => api.reviewItem("review_example"), review, { ...review, decision: "approve" }],
  ["/chat/review/review_example/decision", () => api.decide("review_example", { decision: "allow" }), review,
    { ...review, state: false }, "POST"],
  ["/chat/rules", () => ruleApi.rules(), { rules: [rule], defaults: [defaultRule], next_after_seq: null },
    { rules: [rule], defaults: [{ ...defaultRule, revoked_at: [] }] }],
  ["/chat/rules", () => api.addRule({ scope: "workspace" }), rule, { ...rule, uses: "1" }, "POST"],
  ["/chat/rules/rule_example", () => ruleApi.revokeRule("rule_example"), { ...rule, revoked_at: "2026-11-23T12:00:00Z" },
    { ...rule, id: false }, "DELETE"],
];

for (const [path, read, sample, malformed, method = "GET"] of routes) {
  await test(`${method} ${path} checks its published response`, async (t) => {
    let body = sample;
    const mock = t.mock.method(globalThis, "fetch", async (url, init) => {
      assert.equal(url, "api" + path);
      assert.equal(init.method, method);
      return Response.json(body);
    });
    assert.deepEqual(await read(), sample);
    body = malformed;
    await assert.rejects(read, { code: "bad_answer" });
    assert.equal(mock.mock.callCount(), 2);
  });
}
