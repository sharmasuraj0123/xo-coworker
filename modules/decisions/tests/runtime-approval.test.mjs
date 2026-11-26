// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { actsOf, kindOf } from "../cardparts.js";
import { runtimeUsesHtml } from "../cards/evidence.js";
import { sessionThreads } from "../../../core/services/runtimes.js";

/** @param {import("../../../core/services/review-description").ReviewDetail} detail @returns {import("../cardparts.js").Need} */
const need = (detail) => ({
  risk: "notable",
  ask: { item: { kind: "approval", title: "Uninstall Codex", detail, options: [{ id: "a", label: "Approve", decision: "approve" }] } },
});

test("a coordinator's uninstall says on its button how many threads it stops", () => {
  const ra = { runtime: "codex", action: "uninstall", force: true };
  assert.equal(kindOf(need({ runtime_action: ra, sessions: ["s1", "s2"] })), "runtime");
  assert.equal(actsOf(need({ runtime_action: ra, sessions: ["s1", "s2"] }))[0].label, "Stop 2 and uninstall");
  assert.equal(actsOf(need({ runtime_action: { ...ra, force: false }, sessions: [] }))[0].label, "Uninstall");
  assert.equal(actsOf(need({}))[0].label, "Approve", "other approvals keep their own words");
});

test("the threads it stops show by title and project, not session id", () => {
  const state = {
    threads: [{ id: "t1", title: "Fix login", project: "p1", sessionId: "s1" }],
    projects: [{ id: "p1", name: "Web", sessionId: "s0" }],
  };
  const uses = sessionThreads(["s1", "s0", "s9abcdef12"], state);
  assert.deepEqual(uses.map((u) => [u.title, u.where, u.go]),
    [["Fix login", "Web", "t:t1"], ["Web's coordinator", "", "p:p1"], ["A session XO doesn't list", "s9abcdef", null]]);
  const html = runtimeUsesHtml("codex", uses);
  assert.match(html, /data-go="t:t1"[^>]*><b>Fix login<\/b>/);
  assert.doesNotMatch(html, /s1/);
  assert.equal(runtimeUsesHtml("codex", []), "");
});
