// node modules/home/tests/setup.test.mjs: Home's suggestions to get started wait for the runtimes and GitHub, open Settings, check off once signed in, and end for good.
import assert from "node:assert/strict";
import { dom, settle } from "../../../tests/lib/dom.mjs";

await dom("");
const { createScope } = await import("../../../core/kernel/scope.js");
const { headHtml, rowHtml, setupNeeds, signedInNow } = await import("../setup.js");
const { setupSection } = await import("../setup-section.js");

let passed = 0;
/** @param {string} name @param {() => void | Promise<void>} fn */
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e instanceof Error ? e.stack : e)); process.exitCode = 1; } };

/** @param {string} name @param {boolean} signed_in @param {boolean} [installed] */
const rt = (name, signed_in, installed = true) => ({ name, lifecycle: { name, state: "", installed, signed_in, actions: [] }, health: {} });
const OUT = ["claude_code", "codex", "antigravity", "cursor", "grok_build"].map((n) => rt(n, false));
/** @param {string} name */
const signIn = (name) => OUT.map((r) => (r.name === name ? rt(name, true) : r));
const keys = (/** @type {{ key: string }[] | null} */ items) => (items || []).map((i) => i.key);

await t("nothing is decided until both the runtimes and GitHub's status have landed", () => {
  assert.equal(setupNeeds(null, { status: "needs_auth" }), null);
  assert.equal(setupNeeds(OUT, undefined), null);
});
await t("a fresh Space suggests Claude Code, Codex, Antigravity, Grok and GitHub, never Cursor", () => {
  assert.deepEqual(keys(setupNeeds(OUT, { status: "needs_auth" })), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build", "acct:github"]);
});
await t("each suggestion goes once its own sign-in is done", () => {
  assert.deepEqual(keys(setupNeeds(signIn("codex"), { status: "needs_auth" })), ["rt:claude_code", "rt:antigravity", "rt:grok_build", "acct:github"]);
  assert.deepEqual(keys(setupNeeds(OUT, { status: "connected" })), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build"]);
  assert.equal(signedInNow("rt:codex", signIn("codex"), null), true);
  assert.equal(signedInNow("acct:github", OUT, { status: "connected" }), true);
  assert.equal(signedInNow("rt:codex", OUT, null), false);
});
await t("a runtime and GitHub signed in is set up; GitHub unreadable doesn't hold it open", () => {
  const one = signIn("claude_code");
  assert.deepEqual(setupNeeds(one, { status: "connected" }), []);
  assert.deepEqual(setupNeeds(one, null), []);
  assert.deepEqual(setupNeeds(one, { status: "failed" }), []);
  assert.deepEqual(keys(setupNeeds(OUT, null)), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build"]);
});
await t("an uninstalled runtime offers Install; each row opens Settings at its own row; a done row is a check", () => {
  const [grok] = /** @type {import("../setup.js").SetupItem[]} */ (setupNeeds([rt("grok_build", false, false)], { status: "needs_auth" }));
  assert.equal(grok.act, "Install");
  assert.match(rowHtml(grok, false), /data-set-open="runtimes" data-set-row="rt:grok_build"/);
  assert.match(rowHtml(grok, false), /agm-grok/);
  const done = rowHtml(grok, true);
  assert.doesNotMatch(done, /data-set-open/);
  assert.match(done, /su-ok/);
  assert.match(done, /Signed in/);
  assert.match(headHtml(false), /Get started/);
  assert.match(headHtml(true), /You're all set/);
});

/** @param {{ runtimes: ReturnType<typeof rt>[] | null, done?: boolean }} o */
function harness({ runtimes, done = false }) {
  /** @type {(v: { status: string }) => void} */
  let answer = () => {};
  /** @type {(() => void)[]} */
  const timers = [];
  const state = { reads: 0, schedules: 0, finished: 0, done, visible: true };
  const scope = { ...createScope(), timeout: (/** @type {() => void} */ fn) => { timers.push(fn); return () => {}; } };
  const world = { state: { runtimes } };
  const memory = { done: () => state.done, finish: () => { state.done = true; state.finished++; } };
  const { section, again } = setupSection({
    world, scope, memory, schedule: () => { state.schedules++; }, seen: () => state.visible,
    githubStatus: () => { state.reads++; return new Promise((r) => { answer = r; }); },
  });
  const el = document.createElement("div");
  const render = () => section.render(el);
  const flush = () => timers.splice(0).forEach((fn) => fn());
  return { el, world, state, render, again, flush, answer: (/** @type {string} */ status) => { answer({ status }); return settle(); }, scope };
}
const rows = (/** @type {HTMLElement} */ el) => [...el.querySelectorAll(".su-list > li")].map((li) => li.getAttribute("data-k"));

await t("the section draws nothing until GitHub answers, then the welcome", async () => {
  const h = harness({ runtimes: OUT });
  h.render();
  assert.equal(h.el.innerHTML, "");
  await h.answer("needs_auth");
  assert.equal(h.state.schedules, 1);
  h.render();
  assert.match(h.el.innerHTML, /Get started/);
  assert.deepEqual(rows(h.el), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build", "acct:github"]);
  h.again();
  assert.equal(h.state.reads, 1, "read again only after a pause");
  h.scope.dispose();
});
await t("a sign-in turns its row into a check that waits for Home to be seen, then folds away", async () => {
  const h = harness({ runtimes: OUT });
  await h.answer("needs_auth");
  h.render();
  h.state.visible = false;
  h.world.state.runtimes = signIn("codex");
  h.render();
  const codex = h.el.querySelector('li[data-k="rt:codex"]');
  assert.match(codex?.innerHTML || "", /Signed in/);
  h.flush();
  assert.ok(h.el.querySelector('li[data-k="rt:codex"]'), "no fold while Settings covers Home");
  h.state.visible = true;
  h.render();
  h.flush();
  h.render();
  assert.deepEqual(rows(h.el), ["rt:claude_code", "rt:antigravity", "rt:grok_build", "acct:github"]);
  assert.equal(h.state.finished, 0);
  h.scope.dispose();
});
await t("a runtime that leaves without signing in just goes, no check", async () => {
  const h = harness({ runtimes: OUT });
  await h.answer("needs_auth");
  h.render();
  h.world.state.runtimes = OUT.filter((r) => r.name !== "antigravity");
  h.render();
  assert.deepEqual(rows(h.el), ["rt:claude_code", "rt:codex", "rt:grok_build", "acct:github"]);
  h.scope.dispose();
});
await t("once a runtime and GitHub are in: all set, then the section ends and never shows again", async () => {
  const h = harness({ runtimes: OUT });
  await h.answer("connected");
  h.render();
  h.world.state.runtimes = signIn("claude_code");
  h.render();
  assert.match(h.el.innerHTML, /You're all set/);
  assert.deepEqual(rows(h.el), ["rt:claude_code"]);
  h.flush();
  h.render();
  assert.equal(h.el.innerHTML, "");
  assert.equal(h.state.finished, 1);
  h.world.state.runtimes = OUT;
  h.render();
  assert.equal(h.el.innerHTML, "", "signing out later doesn't bring it back");
  h.scope.dispose();
});
await t("a Space that is already set up remembers it at once; a remembered one never reads GitHub", async () => {
  const fresh = harness({ runtimes: signIn("codex") });
  await fresh.answer("connected");
  fresh.render();
  assert.equal(fresh.el.innerHTML, "");
  assert.equal(fresh.state.finished, 1);
  fresh.scope.dispose();
  const known = harness({ runtimes: OUT, done: true });
  known.render();
  assert.equal(known.state.reads, 0);
  assert.equal(known.el.innerHTML, "");
  known.scope.dispose();
});
await t("GitHub unreadable hides the section without remembering it as done", async () => {
  const h = harness({ runtimes: signIn("codex") });
  await h.answer("failed");
  h.render();
  assert.equal(h.el.innerHTML, "");
  assert.equal(h.state.finished, 0);
  h.scope.dispose();
});

console.log(`setup: ${passed} passed`);
