// Saving a file (Files: the file saves itself, modules/files/documents.js refusal): every refusal Space can give means one thing,
// in words, and none of them loses your text or overwrites the agent's. The flows themselves (autosave, merge,
// confirm, offline, deleted) are in tests/docs.test.mjs. No network, no browser.
//   node tests/edits.test.mjs
import assert from "node:assert/strict";

globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
const { refusal } = await import("../modules/files/documents.js");
const { RUNS } = await import("../modules/files/scope.js");
const err = (status, code, extra = {}) => Object.assign(new Error(`${status} ${code}`), { status, code, ...extra });

let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; }
};

t("a file that runs code: ask, then send again with confirm", () => {
  assert.equal(refusal(err(428, "confirm_required")).kind, "confirm");
});
t("what runs code, before Space says: any case (Space treats .GIT/ and .Claude/ as .git/ and .claude/)", () => {
  for (const p of [".git/hooks/pre-commit", ".GIT/config", ".claude/settings.json", ".Claude/settings.json", ".codex/x", ".Agents/run.md", ".mcp.json", ".MCP.json"]) assert.ok(RUNS.test(p), p);
  for (const p of ["src/.git.md", "gitignore", "docs/.claude.md", "a/.mcp.json"]) assert.ok(!RUNS.test(p), p);
});
t("the file changed meanwhile: merge with what's there now (sent with the 409)", () => {
  assert.equal(refusal(err(409, "file_changed", { current: { content: "x", version: "v2" } })).kind, "changed");
  // a 409 without the current version can't be merged: said, never forced
  const o = refusal(err(409, "file_changed"));
  assert.equal(o.kind, "error");
  assert.match(o.words, /changed/);
});
t("the file was deleted on disk (409, current null): said, your text kept, made again only when you save", () => {
  const o = refusal(err(409, "file_changed", { current: null }));
  assert.equal(o.kind, "deleted");
  assert.match(o.words, /deleted/);
  assert.match(o.words, /kept/);
});
t("a place XO keeps: read only from now on, in words", () => {
  assert.deepEqual(refusal(err(403, "read_only_place")), { kind: "readonly", words: "XO keeps this file: it can't be saved here" });
});
t("other refusals, in words; no answer at all is offline (it tries again)", () => {
  assert.equal(refusal(err(403, "outside_project")).words, "This file is outside the project");
  assert.equal(refusal(err(403, "ui_only")).words, "Saving isn't allowed here");
  assert.equal(refusal(err(503, "writer_key_missing")).words, "XO Space hasn't enabled saving yet");
  assert.equal(refusal(err(413, "too_large")).words, "Too large to save here");
  assert.equal(refusal(err(0, "network")).kind, "offline");
  assert.equal(refusal(err(500, "boom")).words, "500 boom");
});

console.log(`\n${passed} passed`);
