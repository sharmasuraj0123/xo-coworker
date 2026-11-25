import assert from "node:assert/strict";
import { test } from "node:test";
import { itemParts, itemBody, questionsOf, itemEffort, evidenceOf, hostOf, askedBy, isNo, holdWords } from "../core/services/review.js";
import { askingState } from "../core/services/world/threads.js";
import { hopRank, furtherState, mergeHop } from "../core/services/world/hops.js";

// ── review items (core/services/review.js): every kind's answers come from its own options ──
const OPT = {
  once: { id: "once", decision: "allow", label: "Allow once", scope: "once" },
  thread: { id: "thread", decision: "allow", label: "Allow for this thread", scope: "thread", sentence: "In this thread, run exactly `npm test`" },
  ruleP: { id: "rule:project", decision: "allow", label: "In billing-api, run exactly `npm test`", scope: "rule", sentence: "In billing-api, run exactly `npm test`" },
  deny: { id: "deny", decision: "deny", label: "Deny", note: true },
};
const item = (kind, extra = {}) => ({ id: "rv_1", kind, state: "open", risk: "notable", title: "T", why: "W", detail: {}, options: [], ...extra });
test("permission: Allow once, Deny with a note, this thread, a rule with the server's sentence", () => {
  const it = item("permission", { options: [OPT.once, OPT.thread, OPT.ruleP, OPT.deny], detail: { command: "npm test" } });
  const P = itemParts(it);
  assert.deepEqual([P.primary.id, P.back.id, P.scopes.map((o) => o.id), P.hold], ["once", "deny", ["thread", "rule:project"], false]);
  assert.deepEqual(itemBody(it, "allow"), { decision: "allow" });
  assert.deepEqual(itemBody(it, "deny", "  use the cache  "), { decision: "deny", note: "use the cache" });
  assert.deepEqual(itemBody(it, { scope: OPT.thread }), { decision: "allow", scope: "thread" });
  assert.deepEqual(itemBody(it, { scope: OPT.ruleP }), { decision: "allow", option: "rule:project", rule_sentence: "In billing-api, run exactly `npm test`" });
  assert.equal(isNo(itemBody(it, "deny")), true);
  assert.equal(evidenceOf(it).blocks[0].text, "npm test");
});
test("destructive permission needs the hold; a secret's once carries its why", () => {
  const it = item("permission", { risk: "destructive", options: [{ ...OPT.once, why: "It carries a secret, so no rule that would keep the secret is offered." }, OPT.deny] });
  const P = itemParts(it);
  assert.equal(P.hold, true);
  assert.match(P.why, /carries a secret/);
  assert.equal(itemEffort(it), "think");
});
test("question: one option, words, several questions; never a non-answer", () => {
  const it = item("question", { options: [{ id: "answer", decision: "answer", label: "Answer" }], detail: { questions: [{ id: "answer", question: "Which provider?", options: [{ label: "SES", description: "AWS" }, { label: "Postmark" }] }] } });
  assert.deepEqual(itemBody(it, { option: "Postmark" }), { decision: "answer", option: "Postmark" });
  assert.deepEqual(itemBody(it, { text: "SES for now" }), { decision: "answer", answer: "SES for now" });
  assert.deepEqual(itemBody(it, { answers: { a: "x", b: ["y", "z"] } }), { decision: "answer", answer: { a: "x", b: ["y", "z"] } });
  assert.throws(() => itemBody(it, "allow"));
  assert.throws(() => itemBody(it, "deny"), /no way to say no/);
  assert.equal(questionsOf(it)[0].options[0].description, "AWS");
});
test("approval, action, create_project, create_job, usage, integrity, suggestion", () => {
  const ap = item("approval", { options: [{ id: "approve", decision: "approve", label: "Approve" }, { id: "send_back", decision: "send_back", label: "Send back", note: true }], detail: { plan: "1. a\n2. b" } });
  assert.deepEqual([itemBody(ap, "allow"), itemBody(ap, "deny", "no")], [{ decision: "approve" }, { decision: "send_back", note: "no" }]);
  assert.equal(itemEffort(ap), "think", "a plan to approve needs focus");
  const ac = item("action", { options: [{ id: "done", decision: "done", label: "Done" }, { id: "cant", decision: "cant", label: "Can't", note: true }] });
  assert.deepEqual([itemBody(ac, "allow"), itemBody(ac, "deny", "no login")], [{ decision: "done" }, { decision: "cant", note: "no login" }]);
  const cp = item("create_project", { chat_id: "chat_ws", thread_ts: null, options: [{ id: "allow", decision: "allow", label: "Allow", answer: "name" }, { id: "send_back", decision: "send_back", label: "Send back", note: true }], detail: { name: "status-page", purpose: "A status page" } });
  assert.deepEqual(itemBody(cp, { name: " status-v2 " }), { decision: "allow", answer: "status-v2" });
  assert.deepEqual(hostOf(cp), { id: "chat:chat_ws", chat: "chat_ws", title: null });
  const cj = item("create_job", { thread_ts: "cmsg_x", options: [{ id: "allow", decision: "allow", label: "Allow" }, { id: "send_back", decision: "send_back", label: "Send back", note: true }], detail: { schedule: "every day at 09:00", project: "billing-api", job: { prompt: "Triage", model: "haiku" } } });
  assert.match(evidenceOf(cj).facts.join(" | "), /every day at 09:00/);
  assert.equal(hostOf(cj), null, "a job asked from a thread stays on its thread");
  const us = item("usage", { risk: null, chat_id: null, session_id: null, thread_ts: null, options: [{ id: "continue", decision: "continue", label: "Continue until the next reset" }, { id: "wait", decision: "wait", label: "Wait" }], detail: { pool: "claude_code:a", resets_at: "x" } });
  assert.deepEqual([itemBody(us, "allow"), itemBody(us, "deny")], [{ decision: "continue" }, { decision: "wait" }]);
  assert.equal(hostOf(us).id, "pool:claude_code:a");
  const ig = item("integrity", { risk: null, options: [{ id: "done", decision: "done", label: "Seen" }] });
  assert.deepEqual([itemParts(ig).primary.label, itemParts(ig).back, itemBody(ig, "allow")], ["Seen", null, { decision: "done" }]);
  const sg = item("suggestion", { risk: null, options: [{ id: "approve", decision: "approve", label: "Pause it", hold_to_confirm: true }, { id: "deny", decision: "deny", label: "Dismiss" }] });
  assert.deepEqual([itemParts(sg).hold, itemBody(sg, "allow"), itemBody(sg, "deny", "ignored")], [true, { decision: "approve" }, { decision: "deny" }], "a deny without note:true carries no note");
});

test("a destructive yes of any kind is held; words never become a yes; a choice must be offered", () => {
  const ap = item("approval", { risk: "destructive", options: [{ id: "approve", decision: "approve", label: "Approve" }, { id: "send_back", decision: "send_back", label: "Send back", note: true }] });
  const ac = item("action", { risk: "destructive", options: [{ id: "done", decision: "done", label: "Done" }, { id: "cant", decision: "cant", label: "Can't", note: true }] });
  const q = item("question", { risk: "destructive", options: [{ id: "answer", decision: "answer", label: "Answer" }], detail: { questions: [{ id: "answer", question: "Which?", options: [{ label: "~/old" }] }] } });
  assert.deepEqual([itemParts(ap).hold, itemParts(ac).hold, itemParts(q).hold], [true, true, true]);
  assert.deepEqual([holdWords(itemParts(ap).primary), holdWords(itemParts(ac).primary), holdWords(itemParts(q).primary)], ["Hold to approve", "Hold to confirm", "Hold to answer"]);
  assert.equal(holdWords({ decision: "approve", label: "Pause it" }), "Hold to pause it");
  const notable = item("approval", { options: ap.options });
  assert.equal(itemParts(notable).hold, false, "a notable approval is one press");
  // the reply key's words on a non-question are refused, never sent as its yes
  for (const it of [ac, item("usage", { risk: null, options: [{ id: "continue", decision: "continue", label: "Continue" }, { id: "wait", decision: "wait", label: "Wait" }] })]) {
    assert.throws(() => itemBody(it, { text: "No, stop" }), /buttons/);
    assert.throws(() => itemBody(it, { option: "x" }), /buttons/);
  }
  const perm = item("permission", { options: [{ id: "once", decision: "allow", label: "Allow once", scope: "once" }, { id: "deny", decision: "deny", label: "Deny" }] });
  assert.throws(() => itemBody(perm, { scope: { id: "rule:project", scope: "rule", sentence: "made up" } }), /isn't offered/, "a scope not in the item's options is never sent");
});
test("a coordinator's sub-agent asks in its chat, named as the coordinator; a thread with an open item needs you", () => {
  // the shape of rv_4ae32ce172404421 (xo-space, 2026-11-04): no thread, the project coordinator's session
  const sub = item("permission", { chat_id: "chat_xs", thread_ts: null, session_id: "cse_pc", origin: "cli", run_id: "afbe" });
  assert.deepEqual(hostOf(sub), { id: "chat:chat_xs", chat: "chat_xs", title: null }, "hosted by its chat, not lost for want of a thread");
  assert.equal(askedBy(sub, { role: "project-coordinator" }), "coordinator");
  assert.equal(askedBy(sub, { role: "workspace-coordinator" }), "coordinator");
  assert.equal(askedBy(sub, null), "coordinator", "the session not read yet: a chat's agent is its coordinator");
  assert.equal(askedBy({ ...sub, origin: "xo" }, { role: "project-coordinator" }), null, "what XO raises itself isn't the coordinator's ask");
  assert.equal(askingState("working", 1), "needs_approval", "the row's state can trail the item");
  assert.equal(askingState("resolved", 1), "needs_approval", "a resolved thread's sub-agent can still ask");
  assert.equal(askingState("done", 0), "done");
  assert.deepEqual([askingState("needs_reply", 1), askingState("paused", 1), askingState("paused", 1, true)], ["needs_reply", "paused", "paused"]);
  assert.equal(askingState("working", 1, true), "working", "a thread continued elsewhere is frozen, not asking");
});

// ── hops (core/services/world/hops.js): a state only moves on, whichever of the stream and a read comes last ──
test("hops: a history read that left before a receipt can't put it back", () => {
  const sent = { id: "h1", kind: "ask", state: "sent", created_at: "2026-11-08T07:00:00Z" };
  const live = mergeHop(sent, { id: "h1", state: "answered" }, { seq: 9, at: "t" });
  assert.equal(live.state, "answered");
  const late = mergeHop(live, { ...sent }, { at: sent.created_at });
  assert.equal(late.state, "answered");
  assert.equal(late.kind, "ask"); // the read's fields still land
  assert.equal(late.at, sent.created_at);
});
test("hops: a receipt held before its hop was known counts once the hop arrives", () => {
  const got = mergeHop(undefined, { id: "h2", kind: "ask", state: "sent" }, {}, "answered");
  assert.equal(got.state, "answered");
  assert.equal(mergeHop(undefined, { id: "h3", kind: "ask", state: "delivered" }, {}, null).state, "delivered");
});
test("hops: a newer state moves on; an unknown state never wins over a known one", () => {
  assert.equal(mergeHop({ id: "h", state: "sent" }, { id: "h", state: "delivered" }).state, "delivered");
  assert.equal(mergeHop({ id: "h", state: "delivered" }, { id: "h", state: "answered" }).state, "answered");
  assert.equal(furtherState("answered", "sent"), "answered");
  assert.equal(furtherState("sent", "nonsense"), "sent");
  assert.equal(furtherState(undefined, "sent"), "sent");
  assert.ok(hopRank("answered") > hopRank("delivered") && hopRank("delivered") > hopRank("sent") && hopRank("sent") > hopRank(undefined));
});
