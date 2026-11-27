// node modules/home/tests/setup.test.mjs: Home's set-up suggestions wait for the runtimes and GitHub, each opens its Settings row, and each goes once signed in.
import assert from "node:assert/strict";
import { createScope } from "../../../core/kernel/scope.js";
import { setupHtml, setupItems } from "../setup.js";
import { setupSection } from "../setup-section.js";
import { dom } from "../../../tests/lib/dom.mjs";

await dom("");

let passed = 0;
/** @param {string} name @param {() => void | Promise<void>} fn */
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + (e instanceof Error ? e.stack : e)); process.exitCode = 1; } };

/** @param {string} name @param {boolean} signed_in @param {boolean} [installed] */
const rt = (name, signed_in, installed = true) => ({ name, lifecycle: { name, state: "", installed, signed_in, actions: [] }, health: {} });
const OUT = ["claude_code", "codex", "antigravity", "cursor", "grok_build"].map((n) => rt(n, false));
const keys = (/** @type {{ key: string }[]} */ items) => items.map((i) => i.key);

await t("nothing shows until both the runtimes and GitHub's status have landed", () => {
  assert.deepEqual(setupItems(null, { status: "needs_auth" }), []);
  assert.deepEqual(setupItems(OUT, undefined), []);
  assert.equal(setupHtml([]), "");
});
await t("a fresh Space suggests Claude Code, Codex, Antigravity, Grok and GitHub, never Cursor", () => {
  assert.deepEqual(keys(setupItems(OUT, { status: "needs_auth" })), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build", "acct:github"]);
});
await t("each suggestion goes once its own sign-in is done", () => {
  const some = OUT.map((r) => (r.name === "codex" ? rt("codex", true) : r));
  assert.deepEqual(keys(setupItems(some, { status: "needs_auth" })), ["rt:claude_code", "rt:antigravity", "rt:grok_build", "acct:github"]);
  assert.deepEqual(keys(setupItems(OUT, { status: "connected" })), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build"]);
});
await t("a runtime and GitHub signed in is set up: nothing shows; GitHub unreadable doesn't hold it open", () => {
  const one = OUT.map((r) => (r.name === "claude_code" ? rt("claude_code", true) : r));
  assert.deepEqual(setupItems(one, { status: "connected" }), []);
  assert.deepEqual(setupItems(one, null), []);
  assert.deepEqual(setupItems(one, { status: "failed" }), []);
  assert.deepEqual(keys(setupItems(OUT, null)), ["rt:claude_code", "rt:codex", "rt:antigravity", "rt:grok_build"]);
});
await t("an uninstalled runtime offers Install; each row opens Settings at its own row", () => {
  const items = setupItems([rt("grok_build", false, false)], { status: "needs_auth" });
  assert.equal(items[0].act, "Install");
  const html = setupHtml(items);
  assert.match(html, /data-set-open="runtimes" data-set-row="rt:grok_build"/);
  assert.match(html, /data-set-open="accounts" data-set-row="acct:github"/);
  assert.match(html, /agm-grok/);
});
await t("the section draws nothing until GitHub answers, then the suggestions", async () => {
  /** @type {(v: { status: string }) => void} */
  let answer = () => {};
  let schedules = 0, reads = 0;
  const scope = createScope();
  const world = { state: { runtimes: OUT } };
  const { section, again } = setupSection({ world, scope, schedule: () => { schedules++; },
    githubStatus: () => { reads++; return new Promise((r) => { answer = r; }); } });
  const el = { html: "" }, patch = (/** @type {{ html: string }} */ e, /** @type {string} */ h) => { e.html = h; return true; };
  section.render(el, { patch });
  assert.equal(el.html, "");
  answer({ status: "needs_auth" });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(schedules, 1);
  section.render(el, { patch });
  assert.match(el.html, /Get set up/);
  again();
  assert.equal(reads, 1, "read again only after a pause");
  scope.dispose();
});

console.log(`setup: ${passed} passed`);
