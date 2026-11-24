// Settings › Accounts: GitHub's row says Space's state in words and offers the actions that state allows.
import assert from "node:assert/strict";
import { SETTINGS } from "../shell/overlays.js";
import { createAccounts, ghView, missingScopes, rtView, deviceCode, SIGN_IN } from "../modules/settings/accounts.js";
import { dom, settle } from "./lib/dom.mjs";

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

const rt = (name, health, extra = {}) => ({ name, health, ...extra });

t("agents: signed in offers Sign in again; signed out leads with Sign in", () => {
  const a = rtView(rt("codex", { installed: true, logged_in: true }));
  assert.equal(a.key, "in"); assert.equal(ids(a), "again");
  const b = rtView(rt("claude_code", { installed: true, logged_in: false }));
  assert.equal(b.key, "out"); assert.equal(ids(b), "in"); assert.ok(b.actions[0].pri);
  assert.match(b.line, /can't run Claude Code/);
});

t("agents: not installed and a missing route say so, with nothing to press", () => {
  assert.equal(ids(rtView(rt("codex", { installed: false }))), "");
  const v = rtView(rt("antigravity", { installed: true, logged_in: true }), null, { missing: true });
  assert.equal(v.key, "unavailable"); assert.equal(v.tone, "bad");
  assert.match(v.line, /^Signed in\. .*answers 404/);
  assert.equal(ids(v), "");
});

t("agents: each phase of a sign-in has its own line and actions", () => {
  const c = rt("claude_code", { logged_in: true });
  assert.equal(ids(rtView(c, { phase: "starting" })), "in,cancel");
  assert.equal(ids(rtView(c, { phase: "paste", url: "https://x" })), "open,cancel");
  assert.ok(!rtView(c, { phase: "paste", opened: true }).actions[0].pri, "opened: the paste field leads");
  assert.equal(rtView(rt("codex", {}), { phase: "code", code: "AB12-CD345" }).key, "code");
  assert.equal(rtView(rt("codex", {}), { phase: "installing" }).key, "installing");
  assert.equal(rtView(null).key, "checking");
});

t("agents: the route and shape each signs in with", () => {
  assert.deepEqual(Object.keys(SIGN_IN), ["claude_code", "codex", "antigravity"]);
  assert.equal(SIGN_IN.codex.kind, "device");
  assert.ok(SIGN_IN.claude_code.cancel && !SIGN_IN.codex.cancel);
});

t("codex's device code is read from its terminal text, colours and all", () => {
  const out = ["\x1b[1mWelcome to Codex\x1b[0m", "1. Open this link in your browser and sign in", "   \x1b[94mhttps://auth.openai.com/codex/device\x1b[0m", "2. Enter this one-time code (expires in 15 minutes)", "   \x1b[94mFZ8Q-7KD2M\x1b[0m"];
  assert.equal(deviceCode(out.slice(0, 3)), null, "no code yet");
  assert.deepEqual(deviceCode(out), { url: "https://auth.openai.com/codex/device", code: "FZ8Q-7KD2M" });
});

const { document } = await dom(SETTINGS);
t("Accounts has an accessible tab and a mount for its controls", () => {
  const tab = document.querySelector('[data-set="accounts"]');
  const page = document.querySelector('[data-page="accounts"]');
  assert.equal(tab.id, "set-t-accounts");
  assert.equal(page.getAttribute("aria-labelledby"), tab.id);
  assert.ok(page.querySelector(".set-live"));
});
const requests = [];
globalThis.fetch = async (url, init) => {
  requests.push([init.method, url]);
  if (url === "api/chat/runtimes") return Response.json({ runtimes: [rt("antigravity", { installed: true, logged_in: false })] });
  if (url === "api/connectors/github/status") return Response.json({ status: "needs_auth" });
  if (url === "connect/antigravity") return Response.json({ detail: "Not Found" }, { status: 404 });
  throw new Error(`Unexpected request for ${url}`);
};
createAccounts({ announce() {} }).open();
await settle();
const agent = document.querySelector('[data-key="agent:antigravity"]');
agent.querySelector('[data-agent="in"]').click();
await settle();
t("a sign-in route missing in Space leaves the agent row usable without retrying", () => {
  assert.deepEqual(requests.filter(([method]) => method === "POST"), [["POST", "connect/antigravity"]]);
  assert.match(agent.querySelector('[role="status"]').textContent, /answers 404/);
  assert.equal(agent.querySelector("[data-agent]") === null, true);
  assert.equal(document.querySelector('[data-acct="in"]').textContent, "Sign in");
});

const callbackFrame = await dom(SETTINGS);
const answer = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (url === "connect/antigravity/callback") return Response.json({ detail: "Not Found" }, { status: 404 });
  if (url !== "connect/antigravity") return answer(url, init);
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"session","session_id":"test"}\n\ndata: {"type":"auth_'));
      controller.enqueue(encoder.encode('url","url":"https://sign-in.example"}\n\n'));
      init.signal.addEventListener("abort", () => controller.close(), { once: true });
    },
  }));
};
createAccounts({ announce() {} }).open();
await settle();
const callbackAgent = callbackFrame.document.querySelector('[data-key="agent:antigravity"]');
callbackAgent.querySelector('[data-agent="in"]').click();
await settle();
const form = callbackAgent.querySelector("form");
const code = form.querySelector('input[name="code"]');
Object.defineProperty(form, "elements", { value: { code } });
code.value = "test-code";
form.dispatchEvent(new callbackFrame.window.Event("submit", { bubbles: true, cancelable: true }));
await settle();
t("a missing code callback returns to the paste step and explains the error", () => {
  assert.equal(callbackAgent.querySelector('[role="alert"]').textContent, "Not Found");
  assert.equal(callbackAgent.querySelector("input").hasAttribute("readonly"), false);
  assert.equal(callbackAgent.querySelector('[type="submit"]').textContent, "Sign in");
});
callbackAgent.querySelector('[data-agent="cancel"]').click();

console.log(`${passed} passed`);
