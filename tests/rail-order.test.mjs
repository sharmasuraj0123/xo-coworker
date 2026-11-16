// The Settings rail is put in the shape's order without ever moving the item that has focus (the create-project
// grader on 8a4ed16, SHAPE-FOCUS: a preset applying while you're on Shape's tab rearranged the rail with appendChild,
// and focus fell to BODY on every Marketing path). The ordering runs here on stand-in nodes: every order comes out
// right, and the focused item is never moved.
//   node tests/rail-order.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../js/shapeview.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const i = src.indexOf("function placeInOrder(want) {"), body = src.slice(i, src.indexOf("\n  }\n", i) + 4);
// a tiny DOM: a parent with children, insertBefore/appendChild that record every move
function dom(names, focused) {
  const nav = { kids: [], moved: [] };
  const mk = (n) => ({ n, contains: (x) => x === mkd[n] });
  const mkd = {}; for (const n of names) mkd[n] = mk(n);
  for (const n of names) nav.kids.push(mkd[n]);
  const sib = (x) => nav.kids[nav.kids.indexOf(x) + 1] || null;
  for (const n of names) Object.defineProperty(mkd[n], "nextSibling", { get: () => sib(mkd[n]) });
  Object.defineProperty(nav, "firstChild", { get: () => nav.kids[0] || null });
  nav.insertBefore = (el, ref) => { nav.moved.push(el.n); nav.kids.splice(nav.kids.indexOf(el), 1); const at = ref ? nav.kids.indexOf(ref) : nav.kids.length; nav.kids.splice(at, 0, el); };
  nav.appendChild = (el) => { nav.moved.push(el.n); nav.kids.splice(nav.kids.indexOf(el), 1); nav.kids.push(el); };
  return { nav, el: mkd, focus: mkd[focused] };
}
const run = (names, order, focused) => {
  const D = dom(names, focused);
  const f = new Function("nav", "document", body + "\nreturn placeInOrder;")(D.nav, { activeElement: D.focus });
  f(order.map((n) => D.el[n]));
  return { order: D.nav.kids.map((k) => k.n), moved: D.nav.moved };
};
t("the shape's order comes out, and the focused item never moves", () => {
  for (const [names, order, focused] of [
    [["general", "shape", "routing", "rules"], ["general", "routing", "rules", "shape"], "shape"],
    [["routing", "general", "shape"], ["general", "shape", "routing"], "shape"],
    [["shape", "a", "b", "c"], ["a", "b", "c", "shape"], "shape"],
    [["a", "b", "shape"], ["shape", "a", "b"], "shape"],
    [["a", "b", "c"], ["c", "b", "a"], "b"],
  ]) {
    const r = run(names, order, focused);
    assert.deepEqual(r.order, order, `${names} → ${order}`);
    assert.ok(!r.moved.includes(focused), `${focused} never moved (moved: ${r.moved})`);
  }
});
t("the rail uses it, never appendChild for every item", () => {
  assert.match(src, /want\.some\(\(el, i\) => cur\[i\] !== el\)\) placeInOrder\(want\);/);
  assert.doesNotMatch(src, /for \(const el of want\) nav\.appendChild\(el\)/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
