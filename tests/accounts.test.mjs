// Settings › Accounts: GitHub's row says Space's state in words and offers the actions that state allows.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ghView, missingScopes } from "../js/accounts.js";

const html = readFileSync(new URL("../shell/overlays.js", import.meta.url), "utf8");
const app = readFileSync(new URL("../js/app.js", import.meta.url), "utf8");
const side = readFileSync(new URL("../shell/rail/side.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const ids = (v) => v.actions.map((a) => a.id).join(",");

t("scopes: what XO needs and the connection lacks", () => {
  assert.deepEqual(missingScopes("repo, workflow, read:org"), []);
  assert.deepEqual(missingScopes("repo"), ["workflow"]);
  assert.deepEqual(missingScopes("read:org"), ["repo", "workflow"]);
  assert.deepEqual(missingScopes(""), [], "no header (a fine-grained token): nothing claimed missing");
});

t("signed in: who, and Sign in again / Sign out", () => {
  const v = ghView({ status: "connected", username: "ankit", name: "Ankit", scopes: "repo, workflow" });
  assert.equal(v.key, "in");
  assert.match(v.line, /@ankit \(Ankit\)/);
  assert.equal(ids(v), "again,out");
  assert.ok(!v.actions[0].pri, "nothing to fix: no primary button");
});

t("signed in without workflow: says Launchpad can't deploy, Sign in again leads", () => {
  const v = ghView({ status: "connected", username: "a", scopes: "repo" });
  assert.equal(v.key, "partial");
  assert.match(v.line, /Launchpad can't deploy/);
  assert.ok(v.actions[0].id === "again" && v.actions[0].pri);
});

t("a revoked token: says GitHub no longer accepts it, one Sign in", () => {
  const v = ghView({ valid: false, status: "needs_auth", error: "Token is invalid or revoked.", gh_login: { logged_in: true, usable: false } });
  assert.equal(v.key, "expired");
  assert.equal(v.tone, "bad");
  assert.equal(ids(v), "in");
});

t("never signed in, with a usable gh login on this machine: Sign in says it uses it", () => {
  const v = ghView({ status: "needs_auth", gh_login: { logged_in: true, usable: true, username: "octo" } });
  assert.equal(v.key, "out");
  assert.match(v.line, /gh is signed in as @octo/);
});

t("GitHub unreachable: Check again, not Sign in", () => {
  const v = ghView({ status: "failed", error: "Timed out connecting to GitHub." });
  assert.equal(v.key, "unreachable");
  assert.equal(ids(v), "check");
});

t("a sign-in under way: the code's actions; starting: the button says so and waits", () => {
  assert.equal(ids(ghView({ status: "needs_auth" }, { code: "ABCD-1234", uri: "https://github.com/login/device" })), "open,cancel");
  const s = ghView({ status: "needs_auth" }, { starting: true });
  assert.equal(s.actions[0].label, "Signing in…");
  assert.ok(s.actions[0].busy);
  assert.equal(ghView(null).key, "checking");
});

t("the page is wired: a tab, its panel, opened by setPage, in More's places", () => {
  assert.match(html, /id="set-t-accounts" data-set="accounts"/);
  assert.match(html, /data-page="accounts"[^>]*>.*<div class="set-live"><\/div>/);
  assert.match(app, /if \(id === "accounts"\) ACCTS\.open\(\)/);
  assert.match(side, /id: "accounts", name: "Accounts"/);
});

console.log(`${passed} passed`);
