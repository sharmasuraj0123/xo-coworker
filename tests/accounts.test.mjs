// Settings › Accounts: GitHub's row says Space's state in words and offers the actions that state allows.
import assert from "node:assert/strict";
import { createScope } from "../core/kernel/scope.js";
import { SETTINGS } from "../shell/overlays.js";
import { createAccounts, ghView, missingScopes } from "../modules/settings/accounts.js";
import { dom, same, settle } from "./lib/dom.mjs";

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

const { document } = await dom(SETTINGS);
t("Accounts has an accessible tab and a mount for its controls", () => {
  const tab = document.querySelector('[data-set="accounts"]');
  const page = document.querySelector('[data-page="accounts"]');
  assert.equal(tab.id, "set-t-accounts");
  assert.equal(page.getAttribute("aria-labelledby"), tab.id);
  assert.ok(page.querySelector(".set-live"));
});

{
  const frame = await dom(SETTINGS + '<button data-outside>Other view</button>');
  const timers = new Map();
  let timerId = 0;
  const scope = createScope({ timers: {
    setInterval,
    clearInterval,
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  } });
  const notices = [];
  const polls = [];
  const cancelled = [];
  const signedIn = { status: "connected", username: "sample" };
  const signedOut = { status: "needs_auth" };
  let status = signedOut;
  let statusReply;
  let nextSession = 0;
  const asked = [];
  globalThis.fetch = async (url, init) => {
    asked.push(url);
    if (url === "api/connectors/github/status") {
      return statusReply?.promise ?? Response.json(status);
    }
    if (new URL(url, "https://space.invalid/").pathname === "/api/connectors/github/cli/start") {
      return Response.json({
        session_id: `fixture-${++nextSession}`, user_code: "0000", verification_uri: "https://sign-in.example", expires_in: 900,
      });
    }
    if (url === "api/connectors/github/cli/poll") {
      const reply = Promise.withResolvers();
      polls.push({ signal: init.signal, reply });
      return reply.promise;
    }
    if (url === "api/connectors/github/cli/cancel") {
      cancelled.push(JSON.parse(init.body).session_id);
      return Response.json({ status: "cancelled" });
    }
    if (url === "api/connectors/github/disconnect") {
      status = signedOut;
      return Response.json(signedOut);
    }
    throw new Error(`Unexpected request for ${url}`);
  };
  const accounts = createAccounts({ announce: (message) => notices.push(message), scope });
  accounts.open();
  await settle();
  t("Accounts shows only Connectors and reads only GitHub", () => {
    const live = frame.document.querySelector('[data-page="accounts"] .set-live');
    assert.deepEqual([...live.querySelectorAll("h3")].map((h) => h.textContent), ["Connectors"]);
    assert.deepEqual(asked, ["api/connectors/github/status"]);
  });
  const control = (id) => frame.document.querySelector(`[data-acct="${id}"]`);
  const start = async (id) => {
    control(id).click();
    await settle();
    assert.equal(timers.size, 1);
  };
  const tick = async () => {
    timers.values().next().value();
    await settle();
    return polls.at(-1);
  };
  await start("in");
  const settings = frame.document.getElementById("settings");
  settings.hidden = true;
  const hidden = await tick();
  assert.ok(hidden, "GitHub polling continues while Settings is hidden");
  status = signedIn;
  hidden.reply.resolve(Response.json(signedIn));
  await settle();
  t("GitHub sign-in finishes while Settings is hidden", () => {
    assert.equal(hidden.signal?.aborted, false);
    assert.deepEqual(notices, ["GitHub signed in as @sample."]);
  });

  settings.hidden = false;
  await start("again");
  const abandoned = await tick();
  control("cancel").click();
  abandoned.reply.resolve(Response.json({ ...signedIn, username: "late" }));
  await settle();
  t("Cancel aborts an active GitHub poll and ignores its late result", () => {
    assert.equal(abandoned.signal?.aborted, true);
    assert.deepEqual(cancelled, ["fixture-2"]);
    assert.deepEqual(notices, ["GitHub signed in as @sample."]);
  });

  statusReply = Promise.withResolvers();
  control("out").click();
  control("out-yes").focus();
  control("out-yes").click();
  await settle();
  const outside = frame.document.querySelector("[data-outside]");
  outside.focus();
  statusReply.resolve(Response.json(signedOut));
  await settle();
  t("GitHub sign-out keeps focus where the user moved during the read", () => {
    assert.equal(control("in")?.textContent, "Sign in");
    same(frame.document.activeElement, outside);
  });
  statusReply = undefined;

  await start("in");
  const retired = await tick();
  accounts.dispose();
  retired.reply.resolve(Response.json({ ...signedIn, username: "retired" }));
  await settle();
  t("Disposal aborts an active poll and releases the account scope", () => {
    assert.equal(retired.signal?.aborted, true);
    assert.equal(timers.size, 0);
    assert.equal(scope.size, 0);
    assert.deepEqual(notices, ["GitHub signed in as @sample.", "Signed out of GitHub."]);
  });
}

console.log(`${passed} passed`);
