// Drafts (js/drafts.js): unsaved edits kept in this browser, by file. Pure, with a stand-in for localStorage.
//   node tests/drafts.test.mjs
import assert from "node:assert/strict";
import { draftKey, getDraft, putDraft, dropDraft } from "../js/drafts.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
// localStorage's shape, with a quota on everything kept (as the browser's is), and a count of writes
const mem = (quota = Infinity) => {
  const m = new Map(); let used = 0;
  const s = {
    writes: [],
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { v = String(v); const next = used - (m.get(k)?.length || 0) + v.length; if (next > quota) throw new Error("QuotaExceededError"); used = next; m.set(k, v); s.writes.push(k); },
    removeItem: (k) => { used -= m.get(k)?.length || 0; m.delete(k); },
    raw: m,
  };
  return s;
};

t("kept by project and path, read back as it was, and let go", () => {
  const s = mem(), k = draftKey("p", ".xo/worktrees/thread-a/js/app.js");
  assert.equal(getDraft(s, k), null);
  assert.ok(putDraft(s, k, { text: "mine", base: "theirs", version: "v1", at: 5 }));
  assert.deepEqual(getDraft(s, k), { text: "mine", base: "theirs", version: "v1", at: 5 });
  assert.equal(getDraft(s, draftKey("p", "js/app.js")), null, "the project's copy is another file");
  dropDraft(s, k);
  assert.equal(getDraft(s, k), null);
  assert.equal(s.raw.size, 0, "nothing left behind");
});
t("keeping one draft writes that one and the index, never the others", () => {
  const s = mem();
  for (let i = 0; i < 5; i++) putDraft(s, draftKey("p", `f${i}`), { text: "x".repeat(1000), base: "", version: "v", at: i });
  s.writes.length = 0;
  putDraft(s, draftKey("p", "f2"), { text: "y", base: "", version: "v", at: 9 });
  assert.deepEqual(s.writes, ["xo-draft:p|f2", "xo-drafts"]);
});
t("at most 20: the oldest go, entries and all", () => {
  const s = mem();
  for (let i = 0; i < 25; i++) putDraft(s, draftKey("p", `f${i}`), { text: "x", base: "", version: null, at: i });
  assert.equal(getDraft(s, draftKey("p", "f0")), null);
  assert.equal(getDraft(s, draftKey("p", "f4")), null);
  assert.ok(getDraft(s, draftKey("p", "f5")));
  assert.ok(getDraft(s, draftKey("p", "f24")));
  assert.equal(s.raw.size, 21, "20 drafts and the index");
});
t("too big, or storage full: not kept, and said (false), so leaving asks first", () => {
  const s = mem();
  assert.equal(putDraft(s, draftKey("p", "big"), { text: "x".repeat(1100 * 1024), base: "", version: "v" }), false);
  const full = mem(10);
  assert.equal(putDraft(full, draftKey("p", "f"), { text: "a whole line", base: "", version: "v" }), false);
  assert.equal(full.raw.size, 0);
});
t("storage full: the oldest drafts make room for the newest; the one being kept is never dropped", () => {
  const s = mem(400);
  for (let i = 0; i < 3; i++) assert.ok(putDraft(s, draftKey("p", `f${i}`), { text: "x".repeat(60), base: "", version: "v", at: i }));
  assert.ok(putDraft(s, draftKey("p", "new"), { text: "y".repeat(90), base: "", version: "v", at: 9 }));
  assert.equal(getDraft(s, draftKey("p", "f0")), null, "the oldest went");
  assert.ok(getDraft(s, draftKey("p", "new")));
  assert.ok(getDraft(s, draftKey("p", "f2")), "the newest older one stays while there's room");
  assert.ok(putDraft(s, draftKey("p", "f2"), { text: "z".repeat(60), base: "", version: "v", at: 10 }), "a draft kept again is the newest");
  assert.ok(getDraft(s, draftKey("p", "new")));
});
t("a broken store reads as no drafts, never throws", () => {
  const s = mem(); s.setItem("xo-drafts", "{not json"); s.setItem("xo-draft:p|g", "{nor this");
  assert.equal(getDraft(s, draftKey("p", "f")), null);
  assert.equal(getDraft(s, draftKey("p", "g")), null);
  assert.ok(putDraft(s, draftKey("p", "f"), { text: "x", base: "y", version: "v" }));
  assert.ok(getDraft(s, draftKey("p", "f")));
  assert.equal(getDraft(null, "k"), null);
  assert.equal(putDraft(null, "k", { text: "x", base: "y" }), false);
  const throwing = { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); }, removeItem() { throw new Error("SecurityError"); } };
  assert.equal(getDraft(throwing, "k"), null);
  assert.equal(putDraft(throwing, "k", { text: "x", base: "y" }), false);
  dropDraft(throwing, "k");
});
console.log(`${passed} passed${process.exitCode ? ", with failures" : ""}`);
