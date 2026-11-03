// Runtimes, the pure part (js/runtimes.js): names, health, usage windows, the runtime policy, moves.
//   node tests/runtimes.test.mjs        (no network)
import assert from "node:assert/strict";
import { stormAsks, uiMsg } from "../js/timeline.js";
import { asksOf } from "../js/kit.js";
import { rtName, manyRuntimes, healthOf, windowsOf, allowedOf, defaultOf, policyWords, moveTargets, canMove, policyErrors, errorField, untilWords, isInstalled } from "../js/runtimes.js";

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

// shaped like the live GET /api/chat/runtimes on 2026-11-03
const claude = { name: "claude_code", default: true, health: { usable: true, why_not: null, installed: true, logged_in: true, cli_version: "2.1.316", limit: "open", windows: { seven_day: { state: "open", resets_at: "2026-11-05T23:00:00Z", utilization: null } } } };
const codex = { name: "codex", default: false, health: { usable: true, why_not: null, installed: true, logged_in: true, cli_version: "0.166.0", limit: "open", windows: { weekly: { state: "warn", resets_at: "2026-11-09T06:52:14Z", utilization: 0.86 }, five_hour: { state: "open", utilization: 0.1 } } } };
const agy = { name: "antigravity", default: false, health: { usable: false, why_not: "it can't be reached (the agy CLI can't be started (agy: No such file or directory); install it, or point AGY_CLI_PATH at an executable agy)", installed: true, logged_in: false, limit: null, windows: {}, error: { code: "cli_missing", message: "the agy CLI can't be started" } } };
const rts = [claude, agy, codex];

t("names come from the display map, falling back to the server's", () => {
  assert.equal(rtName("claude_code"), "Claude Code");
  assert.equal(rtName("codex"), "Codex");
  assert.equal(rtName("hermes"), "hermes");
});
t("a CLI that can't be started isn't installed", () => {
  assert.equal(isInstalled(agy), false);
  assert.equal(healthOf(agy).word, "Not installed");
  assert.match(healthOf(agy).why, /^It can't be reached/);
});
t("labels show only with more than one installed runtime", () => {
  assert.equal(manyRuntimes([claude, agy]), false);
  assert.equal(manyRuntimes(rts), true);
  assert.equal(manyRuntimes([]), false);
});
t("health pills", () => {
  assert.equal(healthOf(claude).word, "Usable");
  assert.equal(healthOf({ name: "codex", health: { ...codex.health, limit: "warn" } }).word, "Near limit");
  const now = Date.parse("2026-11-03T16:00:00Z");
  const closed = healthOf({ name: "codex", health: { ...codex.health, usable: false, limit: "closed", resets_at: "2026-11-03T18:00:00Z", why_not: "its usage limit is closed" } }, now);
  assert.match(closed.word, /^At limit until \d\d:\d\d$/);
  assert.equal(closed.tone, "bad");
  assert.equal(closed.fix, "It opens again in 2 h.");
  const out = healthOf({ name: "codex", health: { ...codex.health, usable: false, logged_in: false, why_not: "it isn't logged in" } });
  assert.equal(out.word, "Not logged in");
  assert.equal(out.why, "It isn't logged in.");
  assert.equal(out.fix, "Run `codex login` on this machine.");
  assert.equal(healthOf({ name: "x", health: { ...codex.health, usable: false, logged_in: false } }).fix, "Log in with its CLI on this machine.");
});
t("usage windows, tightest first", () => {
  const w = windowsOf(codex);
  assert.deepEqual(w.map((x) => x.id), ["weekly", "five_hour"]);
  assert.equal(w[0].name, "Weekly window");
  assert.equal(w[1].name, "5-hour window");
  assert.equal(windowsOf(agy).length, 0);
});
t("countdown words", () => {
  const now = Date.parse("2026-11-03T16:00:00Z");
  assert.equal(untilWords("2026-11-03T18:10:00Z", now), "in 2 h 10 min");
  assert.equal(untilWords("2026-11-03T16:45:00Z", now), "in 45 min");
  assert.equal(untilWords("2026-11-03T15:00:00Z", now), "");
  assert.equal(untilWords("2026-11-06T16:00:00Z", now), "in 3 days");
});
t("policy: null allowed is every installed runtime; default is the server's", () => {
  assert.deepEqual(allowedOf({ allowed: null }, rts), ["claude_code", "codex"]);
  assert.deepEqual(allowedOf({ allowed: ["codex"] }, rts), ["codex"]);
  assert.equal(defaultOf({ default: null }, rts), "claude_code");
  assert.equal(defaultOf({ default: "codex" }, rts), "codex");
});
t("policy in words", () => {
  assert.equal(policyWords({ allowed: ["claude_code", "codex"], default: null, fallback: false }, rts), "Claude Code or Codex, default Claude Code, no automatic fallback");
  assert.equal(policyWords({ allowed: ["codex"], default: "codex", fallback: false }, rts), "Only Codex");
  assert.equal(policyWords({ allowed: null, default: "codex", fallback: true }, rts), "Any runtime (Claude Code or Codex), default Codex, automatic fallback");
});
t("moves: another allowed, usable runtime; never one the project doesn't allow", () => {
  assert.equal(canMove("claude_code", { allowed: null }, rts), true);
  assert.equal(canMove("claude_code", { allowed: ["claude_code"] }, rts), false);
  assert.equal(canMove("codex", { allowed: ["codex", "antigravity"] }, rts), false);
  const m = moveTargets("claude_code", { allowed: ["claude_code", "codex", "antigravity"] }, rts);
  assert.deepEqual(m.map((x) => x.name), ["antigravity", "codex", "claude_code"]);
  assert.equal(m[0].usable, false);
  assert.match(m[0].why, /can't be reached/);
  assert.equal(m[2].own, true);
});
t("policy field errors, before and after the server", () => {
  assert.deepEqual(policyErrors({ allowed: [] }), { allowed: "Choose at least one runtime." });
  assert.ok(policyErrors({ allowed: ["codex"], default: "claude_code" }).default);
  assert.ok(policyErrors({ preferences: "x".repeat(2001) }).preferences);
  assert.deepEqual(policyErrors({ allowed: null, default: "codex" }), {});
  // the live server's own messages
  assert.equal(errorField({ code: "invalid_argument", message: "allowed names at least one runtime, or is null for every one." }), "allowed");
  assert.equal(errorField({ code: "invalid_argument", message: "The default 'claude_code' must be one of allowed." }), "default");
  assert.equal(errorField({ code: "http_422", message: "preferences: String should have at most 2000 characters" }), "preferences");
  assert.equal(errorField({ code: "unknown_runtime", message: "No storm runtime is named 'nope'" }), "allowed");
});

t("a thread continued elsewhere is frozen, not an ask; a loop-breaker pause still is", () => {
  const base = { id: "cmsg_old", state: "paused", paused: "stuck", lastAt: 1, card: {} };
  assert.equal(stormAsks({ ...base, frozen: true }).length, 0);
  assert.equal(asksOf({ ...base, frozen: true, asks: [] }).length, 0);
  assert.equal(stormAsks({ ...base, frozen: false }).length, 1);
  // picked back up after a move: working, the link kept as history, and its asks are its own
  assert.equal(stormAsks({ ...base, state: "needs_reply", frozen: false, movedTo: { to: "cmsg_new" }, card: { needs_you: "Which one?" } }).length, 1);
});
t("a message carries both ends of a move", () => {
  const m = uiMsg({ id: "a", author_kind: "system", author_id: "xo", text: "Continuing “X” on codex: limit", extra: { continued_from: "cmsg_old" } });
  assert.equal(m.continuedFrom, "cmsg_old");
  assert.equal(uiMsg({ id: "b", author_kind: "system", extra: { continued_in: "cmsg_new" } }).continuedIn, "cmsg_new");
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
