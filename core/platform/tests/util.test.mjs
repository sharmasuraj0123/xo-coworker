// node core/platform/tests/util.test.mjs: esc, space, isImagePath, toMs and the old js/util.js names, through both doors.
import assert from "node:assert/strict";

const P = await import("../index.js");
const legacy = await import("../../../js/util.js");
let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log("  ok  " + name); };

t("js/util.js still offers every name it had, each the platform's own", () => {
  for (const n of ["space", "esc", "toMs", "isImagePath", "copyText", "COPY_REFUSED"]) assert.equal(legacy[n], P[n], n);
});
t("esc escapes text for element content and quoted attributes", () => {
  assert.equal(P.esc(`<a href="x">it's \`q\` & co</a>`), "&lt;a href=&quot;x&quot;&gt;it&#39;s &#96;q&#96; &amp; co&lt;/a&gt;");
  assert.equal(P.esc(null), "");
  assert.equal(P.esc(undefined), "");
  assert.equal(P.esc(0), "0");
});
t("space reads 0 where there is no page", () => assert.equal(P.space("--s-4"), 0));
t("isImagePath goes by suffix, any case", () => {
  for (const p of ["a.png", "b/c.JPG", "x.jpeg", "y.svg", "z.avif", "q.ico"]) assert.ok(P.isImagePath(p), p);
  for (const p of ["a.pdf", "png", "", null, "a.png.txt"]) assert.ok(!P.isImagePath(p), String(p));
});
t("toMs parses ISO times and gives NaN for nothing or nonsense", () => {
  assert.equal(P.toMs("2026-11-19T10:00:00Z"), Date.UTC(2026, 10, 19, 10));
  assert.ok(Number.isNaN(P.toMs("")));
  assert.ok(Number.isNaN(P.toMs(null)));
  assert.ok(Number.isNaN(P.toMs("not a time")));
});
t("COPY_REFUSED says what to do instead", () => assert.match(P.COPY_REFUSED, /Select the text and copy it/));
console.log(`\n${passed} passed`);
