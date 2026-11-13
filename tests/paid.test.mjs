// Paid usage (js/paid.js): the founder's modes, which one holds for an account, the account rows from the advisory,
// the requests a choice makes, and who an item's words are from. No DOM, no network.
//   node tests/paid.test.mjs
import assert from "node:assert/strict";
import { heldModes, effectiveMode, accountRows, onPaid, paidBody, paidItem, creditsWords, poolWords, MODE_SUB } from "../js/paid.js";
import { evidenceOf, fromWords, askedBy } from "../js/review.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const f = (value, known = true) => ({ value, known, source: "measured" });
const adv = { accounts: [
  { agent: "claude_code", account: "acct-a", plan: f("max"), paid: { possible: f(false), in_use: f(false), credits: f(null, false), disabled_reason: f("org_level_disabled") } },
  { agent: "codex", account: "acct-b", plan: f("pro"), paid: { possible: f(true), in_use: f(true), credits: f(7187.56), disabled_reason: f(null, false) } },
] };

t("nothing chosen: never", () => {
  assert.deepEqual(effectiveMode(heldModes([]), "codex:acct-b"), { mode: "never", source: "default" });
});
t("the Space's mode applies to every account; an account's own wins", () => {
  const h = heldModes([{ scope: "space", scope_id: "", key: "paid", value: "ask" }, { scope: "pool", scope_id: "codex:acct-b", key: "paid", value: "always" }]);
  assert.deepEqual(effectiveMode(h, "claude_code:acct-a"), { mode: "ask", source: "space" });
  assert.deepEqual(effectiveMode(h, "codex:acct-b"), { mode: "always", source: "pool" });
});
t("a mode past its `until`, a run hold and an unknown value hold nothing", () => {
  const h = heldModes([{ scope: "space", scope_id: "", key: "paid", value: "ask", until: "2026-01-01T00:00:00Z" }, { scope: "space", scope_id: "", key: "run", value: "paused" }, { scope: "pool", scope_id: "x:y", key: "paid", value: "sometimes" }], Date.parse("2026-11-13T00:00:00Z"));
  assert.deepEqual(h, { space: null, pools: {} });
});
t("a row per account: plan, whether it can go paid, credits, and the mode it runs under", () => {
  const held = heldModes([{ scope: "space", scope_id: "", key: "paid", value: "ask" }]);
  const rows = accountRows({ advisory: adv, held, pools: { "codex:acct-b": { state: "paid", reason: "paid_in_use" } } });
  assert.equal(rows.length, 2);
  assert.deepEqual([rows[0].pool, rows[0].name, rows[0].plan, rows[0].possible, rows[0].credits, rows[0].mode, rows[0].own], ["claude_code:acct-a", "Claude Code", "Max", false, null, "ask", null]);
  assert.equal(rows[0].why, "Paid usage is turned off for your organisation.");
  assert.deepEqual([rows[1].possible, rows[1].inUse, rows[1].credits, rows[1].state, rows[1].note], [true, true, 7187.56, "paid", "On paid usage now."]);
  assert.ok(onPaid(rows, "codex") && !onPaid(rows, "claude_code"));
});
t("an unknown fact is not read as a value", () => {
  const rows = accountRows({ advisory: { accounts: [{ agent: "codex", account: "a", plan: f(null, false), paid: { possible: f(true, false), in_use: f(true, false), credits: f(5, false) } }] }, held: heldModes([]), pools: {} });
  assert.deepEqual([rows[0].plan, rows[0].possible, rows[0].inUse, rows[0].credits], ["", null, null, null]);
});
t("the requests: the Space's mode, an account's, an account following the Space", () => {
  assert.deepEqual(paidBody("space", "", "always"), { scope: "space", scope_id: "", value: "always" });
  assert.deepEqual(paidBody("pool", "codex:acct-b", "never"), { scope: "pool", scope_id: "codex:acct-b", value: "never" });
  assert.deepEqual(paidBody("pool", "codex:acct-b", null), { scope: "pool", scope_id: "codex:acct-b", value: null });
  assert.throws(() => paidBody("space", "", null));
  assert.throws(() => paidBody("pool", "", "ask"));
  assert.throws(() => paidBody("pool", "x:y", "sometimes"));
});
t("the words: modes as the owner chose them; credits whole; a held pool says why", () => {
  assert.equal(MODE_SUB.never, "Work stops before any paid usage, and when XO can’t tell whether it would be paid.");
  assert.equal(MODE_SUB.always, "Work goes on into paid usage without asking.");
  assert.equal(creditsWords(7187.561762), "7,188 credits");
  assert.equal(creditsWords(null), "");
  assert.match(poolWords({ reason: "paid_asked" }), /Waiting for your answer/);
  assert.equal(poolWords({ reason: "limit" }), "");
});
t("a paid question shows its account, reset and credits; a closed limit and other items are left alone", () => {
  const rows = accountRows({ advisory: adv, held: heldModes([]), pools: {} });
  const q = paidItem({ kind: "usage", detail: { pool: "codex:acct-b", resets_at: "2026-11-17T09:32:00Z" } }, rows);
  assert.deepEqual(q.paid, { account: "Codex · Pro", resetsAt: "2026-11-17T09:32:00Z", credits: 7187.56 });
  const lim = { kind: "usage", detail: { pool: "codex:acct-b", limit: "closed" } };
  assert.equal(paidItem(lim, rows), lim);
  const other = { kind: "permission", detail: {} };
  assert.equal(paidItem(other, rows), other);
});
t("what XO raised says From XO; what an agent or a CLI raised says From the agent", () => {
  for (const origin of ["xo", "engine"]) assert.equal(fromWords({ origin }), "From XO");
  for (const origin of ["agent", "cli", undefined]) assert.equal(fromWords({ origin }), "From the agent");
  const blocks = (origin) => evidenceOf({ kind: "integrity", origin, detail: { text: "x" } }).blocks.map((b) => b.label);
  assert.deepEqual(blocks("xo"), ["From XO"]);
  assert.deepEqual(blocks("agent"), ["From the agent"]);
  assert.equal(askedBy({ origin: "engine" }, null), null);
});
console.log(`${passed} passed`);
