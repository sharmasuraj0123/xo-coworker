// The ARIA snapshot helpers, without a browser.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { normalise, diffLines, trimDiff, compareAria } from "../lib/aria.mjs";

let passed = 0;
const test = async (name, fn) => { await fn(); passed++; console.log(`ok ${name}`); };

await test("normalise: trailing spaces go, one newline ends it, the run's port leaves URLs", () => {
  assert.equal(normalise('- link "a":\n  - /url: http://127.0.0.1:45123/x   \n\n\n'), '- link "a":\n  - /url: http://e2e/x\n');
});

await test("diffLines: same lines kept, removed and added marked", () => {
  assert.deepEqual(diffLines("a\nb\nc", "a\nc\nd"), ["  a", "- b", "  c", "+ d"]);
  assert.deepEqual(diffLines("x", "x"), ["  x"]);
});

await test("trimDiff: changed lines with context, the rest left out", () => {
  const lines = diffLines("1\n2\n3\n4\n5\n6\n7\n8", "1\n2\n3\n4\nFIVE\n6\n7\n8");
  assert.equal(trimDiff(lines, 1), "…\n  4\n- 5\n+ FIVE\n  6\n…");
});

await test("compareAria: no golden fails; UPDATE writes it; then the same text passes and other text shows a diff", async () => {
  const dir = mkdtempSync(join(tmpdir(), "e2e-aria-")), file = join(dir, "x", "case.aria.yml");
  const loc = (t) => ({ ariaSnapshot: async () => t });
  try {
    const missing = await compareAria(loc("- button \"Send\""), file, { update: false });
    assert.equal(missing.ok, false);
    assert.match(missing.diff, /no golden/);
    const w = await compareAria(loc("- button \"Send\""), file, { update: true });
    assert.equal(w.written, true);
    assert.equal(readFileSync(file, "utf8"), '- button "Send"\n');
    assert.equal((await compareAria(loc("- button \"Send\""), file, { update: true })).written, false, "an unchanged golden isn't rewritten");
    assert.equal((await compareAria(loc("- button \"Send\"  "), file, { update: false })).ok, true);
    const d = await compareAria(loc("- button \"Stop\""), file, { update: false });
    assert.equal(d.ok, false);
    assert.equal(d.diff, '- - button "Send"\n+ - button "Stop"');
  } finally { rmSync(dir, { recursive: true, force: true }); }
  assert.equal(existsSync(dir), false);
});

console.log(`${passed} passed`);
